import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildGeocodeV4Url,
  formatGeocodeError,
  GEOCODE_V4_BASE_URL,
  parseGeocodeV4Response,
} from './src/utils/geocoding.ts';
import { buildLocalGuidePrompt, sanitizeInsightsHtml } from './src/utils/insights.ts';
import {
  buildQuizPrompt,
  isValidQuizCategory,
  parseQuizResponse,
} from './src/utils/quiz.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const INSIGHTS_MODEL = 'gemini-3.8-flash';
const QUIZ_MODEL = 'gemini-4-hydrogen';
const GEMINI_TIMEOUT_MS = 18000;

function getMapsApiKey(): string {
  return (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

function getClientMapsApiKey(): string {
  return (process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
}

function getGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`) as Error & {
        status?: number;
        code?: string;
      };
      err.status = 504;
      err.code = 'UPSTREAM_TIMEOUT';
      reject(err);
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function generateWithFallbackAndRetry(
  ai: GoogleGenAI,
  primaryModel: string,
  fallbackModel: string,
  params: {
    contents: string;
    config?: Record<string, unknown>;
  },
  maxAttempts = 2
): Promise<string> {
  let currentModel = primaryModel;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: currentModel,
          contents: params.contents,
          ...(params.config ? { config: params.config } : {}),
        }),
        GEMINI_TIMEOUT_MS,
        `Gemini (${currentModel})`
      );
      return response.text ?? '';
    } catch (err: unknown) {
      lastError = err;
      const errObj = err as { status?: number; message?: string };
      const status = errObj?.status;

      if (status === 404 && currentModel !== fallbackModel) {
        currentModel = fallbackModel;
        continue;
      }

      const isTransient = status === 429 || status === 503 || status === 500;
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}

function formatGeminiRouteError(
  err: unknown,
  source: 'insights' | 'quiz',
  endpoint: string,
  fallbackTitle: string
) {
  const errObj = err as { status?: number; message?: string; code?: string };
  const statusCode = typeof errObj?.status === 'number' ? errObj.status : 500;
  const rawMessage = errObj?.message || 'Unable to reach the Gemini API.';

  let friendlyMessage = rawMessage;
  if (statusCode === 400 || statusCode === 403) {
    friendlyMessage =
      'Gemini API authorization failed. Please verify your GEMINI_API_KEY in Settings > Secrets.';
  } else if (statusCode === 429) {
    friendlyMessage =
      'Gemini API rate limit or quota was exceeded. Please wait briefly or check your quota in Settings > Secrets.';
  } else if (statusCode === 504) {
    friendlyMessage =
      'The Gemini request took too long to respond. Please check network connectivity and try again.';
  }

  return {
    statusCode: statusCode >= 400 && statusCode < 600 ? statusCode : 500,
    error: {
      source,
      title: fallbackTitle,
      message: friendlyMessage,
      statusCode,
      endpoint,
      detail: errObj?.code || rawMessage,
    },
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/maps-config', (_req: Request, res: Response) => {
    const apiKey = getClientMapsApiKey();
    res.json({
      hasMapsKey: Boolean(apiKey),
      apiKey: apiKey || null,
    });
  });

  app.get('/api/geocode', async (req: Request, res: Response) => {
    const rawAddress = typeof req.query.address === 'string' ? req.query.address : '';
    const address = rawAddress.trim();

    if (!address) {
      res.status(400).json({
        error: {
          source: 'geocode',
          title: 'Missing Location Query',
          message: 'Please enter a city, neighborhood, or street address before searching.',
          statusCode: 400,
          endpoint: GEOCODE_V4_BASE_URL,
          detail: 'EMPTY_QUERY',
        },
      });
      return;
    }

    const apiKey = getMapsApiKey();
    if (!apiKey) {
      res.status(503).json({
        error: {
          source: 'geocode',
          title: 'Google Maps API Key Not Configured',
          message:
            'No Google Maps Platform API key was detected. Set VITE_GOOGLE_MAPS_API_KEY or GOOGLE_MAPS_API_KEY and enable the Geocoding API.',
          statusCode: 503,
          endpoint: GEOCODE_V4_BASE_URL,
          detail: 'MISSING_MAPS_API_KEY',
        },
      });
      return;
    }

    try {
      const url = buildGeocodeV4Url(address);
      const upstreamRes = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'results.placeId,results.location,results.formattedAddress,results.granularity,results.viewport,results.addressComponents,results.postalAddress,results.types',
          'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
        },
      });

      const body = await upstreamRes.json().catch(() => null);

      if (!upstreamRes.ok) {
        const formatted = formatGeocodeError(upstreamRes.status, body);
        res.status(upstreamRes.status).json({ error: formatted });
        return;
      }

      const parsed = parseGeocodeV4Response(body, address);
      res.json({ location: parsed });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error while geocoding address.';
      const isNotFound = message.includes('No geocoded location was found');
      res.status(isNotFound ? 404 : 500).json({
        error: {
          source: 'geocode',
          title: isNotFound ? 'Location Not Found' : 'Geocoding Request Failed',
          message,
          statusCode: isNotFound ? 404 : 500,
          endpoint: GEOCODE_V4_BASE_URL,
          detail: isNotFound ? 'ZERO_RESULTS' : 'NETWORK_OR_PARSE_ERROR',
        },
      });
    }
  });

  app.post('/api/insights', async (req: Request, res: Response) => {
    const cityState = typeof req.body?.cityState === 'string' ? req.body.cityState.trim() : '';

    if (!cityState) {
      res.status(400).json({
        error: {
          source: 'insights',
          title: 'Invalid Insights Request',
          message: 'A valid City and State label is required to generate Local Insights.',
          statusCode: 400,
          endpoint: '/api/insights',
          detail: 'MISSING_CITY_STATE',
        },
      });
      return;
    }

    const geminiKey = getGeminiApiKey();
    if (!geminiKey) {
      res.status(503).json({
        error: {
          source: 'insights',
          title: 'Gemini API Key Not Configured',
          message:
            'No GEMINI_API_KEY was found on the server. Add your Gemini API key in Settings > Secrets to load Local Insights.',
          statusCode: 503,
          endpoint: '/api/insights',
          detail: 'MISSING_GEMINI_API_KEY',
        },
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = buildLocalGuidePrompt(cityState);
      const rawText = await generateWithFallbackAndRetry(
        ai,
        INSIGHTS_MODEL,
        QUIZ_MODEL,
        { contents: prompt }
      );
      const html = sanitizeInsightsHtml(rawText);

      if (!html) {
        res.status(502).json({
          error: {
            source: 'insights',
            title: 'Empty Local Insights Response',
            message: `Gemini did not return formatted fun facts for ${cityState}. Try again in a moment.`,
            statusCode: 502,
            endpoint: '/api/insights',
            detail: 'EMPTY_MODEL_OUTPUT',
          },
        });
        return;
      }

      res.json({ cityState, html });
    } catch (err: unknown) {
      console.error('Error in /api/insights:', err);
      const formatted = formatGeminiRouteError(
        err,
        'insights',
        `/api/insights (${INSIGHTS_MODEL})`,
        'Local Insights Unavailable'
      );
      res.status(formatted.statusCode).json({ error: formatted.error });
    }
  });

  app.post('/api/quiz', async (req: Request, res: Response) => {
    const cityState = typeof req.body?.cityState === 'string' ? req.body.cityState.trim() : '';
    const category = req.body?.category;
    const insightsHtml =
      typeof req.body?.insightsHtml === 'string' ? req.body.insightsHtml : undefined;

    if (!cityState || !isValidQuizCategory(category)) {
      res.status(400).json({
        error: {
          source: 'quiz',
          title: 'Invalid Quiz Request',
          message:
            'Please provide a valid location and choose Local cuisine, Art and culture, or Local history.',
          statusCode: 400,
          endpoint: '/api/quiz',
          detail: 'INVALID_QUIZ_PARAMS',
        },
      });
      return;
    }

    const geminiKey = getGeminiApiKey();
    if (!geminiKey) {
      res.status(503).json({
        error: {
          source: 'quiz',
          title: 'Gemini API Key Not Configured',
          message:
            'No GEMINI_API_KEY was found on the server. Add your Gemini API key in Settings > Secrets to generate quizzes.',
          statusCode: 503,
          endpoint: '/api/quiz',
          detail: 'MISSING_GEMINI_API_KEY',
        },
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = buildQuizPrompt(cityState, category, insightsHtml);
      const rawJson = await generateWithFallbackAndRetry(
        ai,
        QUIZ_MODEL,
        INSIGHTS_MODEL,
        {
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                    },
                    required: ['question', 'options', 'correctIndex', 'explanation'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        }
      );

      const quiz = parseQuizResponse(rawJson, cityState, category);
      res.json({ quiz });
    } catch (err: unknown) {
      console.error('Error in /api/quiz:', err);
      const formatted = formatGeminiRouteError(
        err,
        'quiz',
        `/api/quiz (${QUIZ_MODEL})`,
        'Quiz Generation Failed'
      );
      res.status(formatted.statusCode).json({ error: formatted.error });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Block Explorer server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Block Explorer server:', err);
  process.exit(1);
});
