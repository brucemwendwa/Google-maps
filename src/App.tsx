import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorialControlPanel } from './components/EditorialControlPanel';
import { LocalQuizModal } from './components/LocalQuizModal';
import { MapViewport } from './components/MapViewport';
import type {
  ExplorerError,
  GeocodedLocation,
  InsightsState,
  PresetDestination,
  QuizState,
} from './types/explorer';
import { PRESET_DESTINATIONS } from './utils/geocoding';
import { evaluateQuizAnswers, type QuizCategory, type QuizData } from './utils/quiz';

const ENV_MAPS_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || null;

const INITIAL_QUIZ_STATE: QuizState = {
  status: 'closed',
  cityState: null,
  category: null,
  data: null,
  selectedAnswers: {},
  evaluation: null,
  error: null,
};

export default function App() {
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(ENV_MAPS_KEY);
  const [configLoaded, setConfigLoaded] = useState<boolean>(Boolean(ENV_MAPS_KEY));

  const [query, setQuery] = useState<string>('');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [lastSearchedQuery, setLastSearchedQuery] = useState<string>('');
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [activeLocation, setActiveLocation] = useState<GeocodedLocation | null>(null);
  const [geocodeError, setGeocodeError] = useState<ExplorerError | null>(null);
  const [mapError, setMapError] = useState<ExplorerError | null>(null);

  const [insights, setInsights] = useState<InsightsState>({
    status: 'idle',
    cityState: null,
    html: null,
    error: null,
  });

  const [quiz, setQuiz] = useState<QuizState>(INITIAL_QUIZ_STATE);

  const geocodeAbortRef = useRef<AbortController | null>(null);
  const insightsAbortRef = useRef<AbortController | null>(null);
  const quizAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (ENV_MAPS_KEY) {
      setConfigLoaded(true);
      return;
    }

    let cancelled = false;
    fetch('/api/maps-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { apiKey?: string | null } | null) => {
        if (!cancelled && data?.apiKey) {
          setMapsApiKey(data.apiKey);
        }
      })
      .catch(() => {
        // Non-fatal: fallback UI handles missing Maps key gracefully
      })
      .finally(() => {
        if (!cancelled) {
          setConfigLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleAuthError = () => {
      setMapError({
        source: 'map',
        title: 'Google Maps Authentication Failed',
        message:
          'Google Maps JavaScript API could not authenticate this request. Verify your API key, HTTP referrer restrictions, and Maps JavaScript API enablement.',
        endpoint: 'Maps JavaScript API',
        detail: 'AUTH_FAILURE',
      });
    };

    window.addEventListener('gmp-map-auth-error', handleAuthError);
    return () => {
      window.removeEventListener('gmp-map-auth-error', handleAuthError);
    };
  }, []);

  useEffect(() => {
    return () => {
      geocodeAbortRef.current?.abort();
      insightsAbortRef.current?.abort();
      quizAbortRef.current?.abort();
    };
  }, []);

  const fetchLocalInsights = useCallback(async (cityState: string) => {
    insightsAbortRef.current?.abort();
    const controller = new AbortController();
    insightsAbortRef.current = controller;

    setInsights({
      status: 'loading',
      cityState,
      html: null,
      error: null,
    });

    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityState }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => null)) as {
        html?: string;
        cityState?: string;
        error?: ExplorerError;
      } | null;

      if (!response.ok || !payload?.html) {
        const errorObj: ExplorerError = payload?.error ?? {
          source: 'insights',
          title: 'Local Insights Unavailable',
          message: `Could not load Gemini local insights for ${cityState}.`,
          statusCode: response.status,
          endpoint: '/api/insights',
        };
        setInsights({
          status: 'error',
          cityState,
          html: null,
          error: errorObj,
        });
        return;
      }

      setInsights({
        status: 'success',
        cityState: payload.cityState ?? cityState,
        html: payload.html,
        error: null,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setInsights({
        status: 'error',
        cityState,
        html: null,
        error: {
          source: 'insights',
          title: 'Local Insights Request Failed',
          message:
            err instanceof Error
              ? err.message
              : `Network error while loading insights for ${cityState}.`,
          endpoint: '/api/insights',
          detail: 'NETWORK_ERROR',
        },
      });
    }
  }, []);

  const exploreLocation = useCallback(
    async (rawInput: string, presetId: string | null = null) => {
      const trimmed = rawInput.trim();
      if (!trimmed) {
        setGeocodeError({
          source: 'geocode',
          title: 'Location Required',
          message: 'Enter a city, neighborhood, or street address to geocode.',
          detail: 'EMPTY_INPUT',
        });
        return;
      }

      geocodeAbortRef.current?.abort();
      quizAbortRef.current?.abort();
      const controller = new AbortController();
      geocodeAbortRef.current = controller;

      setLastSearchedQuery(trimmed);
      setActivePresetId(presetId);
      setGeocodeError(null);
      setQuiz(INITIAL_QUIZ_STATE);
      setIsGeocoding(true);

      try {
        const response = await fetch(
          `/api/geocode?address=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );

        const payload = (await response.json().catch(() => null)) as {
          location?: GeocodedLocation;
          error?: ExplorerError;
        } | null;

        if (!response.ok || !payload?.location) {
          setGeocodeError(
            payload?.error ?? {
              source: 'geocode',
              title: 'Geocoding Request Failed',
              message: `Could not geocode "${trimmed}". Verify your query or API configuration.`,
              statusCode: response.status,
              endpoint: 'https://geocode.googleapis.com/v4/geocode/address/',
            }
          );
          return;
        }

        const resolved = payload.location;
        setActiveLocation(resolved);
        void fetchLocalInsights(resolved.cityStateLabel);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setGeocodeError({
          source: 'geocode',
          title: 'Network Error',
          message:
            err instanceof Error
              ? err.message
              : 'Unable to reach the geocoding service. Check your connection and try again.',
          endpoint: '/api/geocode',
          detail: 'FETCH_FAILED',
        });
      } finally {
        if (geocodeAbortRef.current === controller) {
          setIsGeocoding(false);
        }
      }
    },
    [fetchLocalInsights]
  );

  const handleStartQuiz = useCallback(() => {
    const cityState = insights.cityState || activeLocation?.cityStateLabel;
    if (!cityState) return;
    quizAbortRef.current?.abort();
    setQuiz({
      status: 'choose',
      cityState,
      category: null,
      data: null,
      selectedAnswers: {},
      evaluation: null,
      error: null,
    });
  }, [activeLocation, insights.cityState]);

  const generateQuizForCategory = useCallback(
    async (category: QuizCategory) => {
      const cityState = quiz.cityState || insights.cityState || activeLocation?.cityStateLabel;
      if (!cityState) return;

      quizAbortRef.current?.abort();
      const controller = new AbortController();
      quizAbortRef.current = controller;

      setQuiz({
        status: 'loading',
        cityState,
        category,
        data: null,
        selectedAnswers: {},
        evaluation: null,
        error: null,
      });

      try {
        const response = await fetch('/api/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cityState,
            category,
            insightsHtml: insights.html,
          }),
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as {
          quiz?: QuizData;
          error?: ExplorerError;
        } | null;

        if (!response.ok || !payload?.quiz) {
          setQuiz({
            status: 'error',
            cityState,
            category,
            data: null,
            selectedAnswers: {},
            evaluation: null,
            error: payload?.error ?? {
              source: 'quiz',
              title: 'Quiz Generation Failed',
              message: `Could not generate a ${category} quiz for ${cityState}.`,
              statusCode: response.status,
              endpoint: '/api/quiz',
            },
          });
          return;
        }

        setQuiz({
          status: 'active',
          cityState,
          category,
          data: payload.quiz,
          selectedAnswers: {},
          evaluation: null,
          error: null,
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setQuiz({
          status: 'error',
          cityState,
          category,
          data: null,
          selectedAnswers: {},
          evaluation: null,
          error: {
            source: 'quiz',
            title: 'Quiz Request Failed',
            message:
              err instanceof Error
                ? err.message
                : `Network error while generating ${category} quiz for ${cityState}.`,
            endpoint: '/api/quiz',
            detail: 'NETWORK_ERROR',
          },
        });
      }
    },
    [activeLocation, insights.cityState, insights.html, quiz.cityState]
  );

  const handleSelectAnswer = useCallback((questionId: string, optionIndex: number) => {
    setQuiz((prev) => ({
      ...prev,
      selectedAnswers: {
        ...prev.selectedAnswers,
        [questionId]: optionIndex,
      },
    }));
  }, []);

  const handleSubmitQuiz = useCallback(() => {
    setQuiz((prev) => {
      if (!prev.data) return prev;
      const evaluation = evaluateQuizAnswers(prev.data.questions, prev.selectedAnswers);
      return {
        ...prev,
        status: 'submitted',
        evaluation,
      };
    });
  }, []);

  const handleSearchSubmit = useCallback(
    (submittedQuery: string) => {
      void exploreLocation(submittedQuery, null);
    },
    [exploreLocation]
  );

  const handlePresetSelect = useCallback(
    (preset: PresetDestination) => {
      setQuery(preset.label);
      void exploreLocation(preset.query, preset.id);
    },
    [exploreLocation]
  );

  const handleRetryGeocode = useCallback(() => {
    const target = lastSearchedQuery || query;
    void exploreLocation(target, activePresetId);
  }, [activePresetId, exploreLocation, lastSearchedQuery, query]);

  const handleRetryInsights = useCallback(() => {
    const targetCityState = insights.cityState || activeLocation?.cityStateLabel;
    if (targetCityState) {
      void fetchLocalInsights(targetCityState);
    }
  }, [activeLocation, fetchLocalInsights, insights.cityState]);

  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row bg-[#F9F7F2] text-[#181715] lg:overflow-hidden">
      <EditorialControlPanel
        query={query}
        onQueryChange={setQuery}
        onSearchSubmit={handleSearchSubmit}
        presets={PRESET_DESTINATIONS}
        activePresetId={activePresetId}
        onPresetSelect={handlePresetSelect}
        isGeocoding={isGeocoding}
        activeLocation={activeLocation}
        geocodeError={geocodeError}
        onDismissGeocodeError={() => setGeocodeError(null)}
        onRetryGeocode={handleRetryGeocode}
      />

      <MapViewport
        mapsApiKey={mapsApiKey}
        configLoaded={configLoaded}
        activeLocation={activeLocation}
        mapError={mapError}
        onDismissMapError={() => setMapError(null)}
        insights={insights}
        onRetryInsights={handleRetryInsights}
        onDismissInsightsError={() =>
          setInsights((prev) => ({
            ...prev,
            status: 'idle',
            error: null,
          }))
        }
        onStartQuiz={handleStartQuiz}
      />

      <LocalQuizModal
        quiz={quiz}
        onClose={() => {
          quizAbortRef.current?.abort();
          setQuiz(INITIAL_QUIZ_STATE);
        }}
        onSelectCategory={(cat) => void generateQuizForCategory(cat)}
        onSelectAnswer={handleSelectAnswer}
        onSubmitQuiz={handleSubmitQuiz}
        onBackToCategories={() => {
          quizAbortRef.current?.abort();
          setQuiz((prev) => ({
            ...prev,
            status: 'choose',
            category: null,
            data: null,
            selectedAnswers: {},
            evaluation: null,
            error: null,
          }));
        }}
        onRetryQuiz={() => {
          if (quiz.category) {
            void generateQuizForCategory(quiz.category);
          }
        }}
      />
    </div>
  );
}
