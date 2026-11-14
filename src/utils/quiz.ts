export type QuizCategory = 'Local cuisine' | 'Art and culture' | 'Local history';

export const QUIZ_CATEGORIES: readonly {
  id: QuizCategory;
  label: QuizCategory;
  description: string;
}[] = [
  {
    id: 'Local cuisine',
    label: 'Local cuisine',
    description: 'Signature dishes, street markets, and regional flavors',
  },
  {
    id: 'Art and culture',
    label: 'Art and culture',
    description: 'Architecture, music, galleries, and neighborhood traditions',
  },
  {
    id: 'Local history',
    label: 'Local history',
    description: 'Founding stories, turning points, and historic landmarks',
  },
];

export interface QuizQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
}

export interface QuizData {
  cityState: string;
  category: QuizCategory;
  questions: QuizQuestion[];
}

export interface QuizResultItem {
  questionId: string;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
}

export interface QuizEvaluation {
  score: number;
  total: number;
  items: QuizResultItem[];
}

export function isValidQuizCategory(value: unknown): value is QuizCategory {
  return (
    value === 'Local cuisine' ||
    value === 'Art and culture' ||
    value === 'Local history'
  );
}

export function buildQuizPrompt(
  cityState: string,
  category: QuizCategory,
  insightsHtml?: string | null
): string {
  const plainInsights = insightsHtml
    ? insightsHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  const contextSection = plainInsights
    ? `\nContext from local insights already shared with the traveler: ${plainInsights}\n`
    : '';

  return (
    `You are an expert local guide for ${cityState}. ` +
    `Create a multiple-choice trivia quiz of exactly 3 engaging, factually accurate questions about ${cityState} focused on "${category}".` +
    `${contextSection}` +
    `\nRequirements:\n` +
    `- Exactly 3 questions.\n` +
    `- Each question must have exactly 4 distinct answer choices.\n` +
    `- correctIndex must be the 0-based index (0, 1, 2, or 3) of the single best answer.\n` +
    `- explanation must be 1 concise, informative sentence explaining why the correct answer is right.`
  );
}

export function parseQuizResponse(
  rawJson: string,
  cityState: string,
  category: QuizCategory
): QuizData {
  if (!rawJson || typeof rawJson !== 'string') {
    throw new Error('Quiz generator returned an empty response.');
  }

  const stripped = rawJson
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error('Could not parse the generated quiz JSON.');
  }

  const rawQuestions = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { questions?: unknown[] }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : null;

  if (!rawQuestions || rawQuestions.length === 0) {
    throw new Error('Generated quiz did not contain any questions.');
  }

  const normalized: QuizQuestion[] = rawQuestions.slice(0, 3).map((item, idx) => {
    const q = item as {
      question?: unknown;
      options?: unknown;
      correctIndex?: unknown;
      explanation?: unknown;
    };

    const questionText = typeof q?.question === 'string' ? q.question.trim() : '';
    const optionsRaw = Array.isArray(q?.options)
      ? q.options.map((o) => String(o).trim()).filter(Boolean)
      : [];

    if (!questionText || optionsRaw.length < 4) {
      throw new Error(`Question ${idx + 1} is incomplete or missing 4 answer choices.`);
    }

    const correctIdx =
      typeof q.correctIndex === 'number' &&
      Number.isInteger(q.correctIndex) &&
      q.correctIndex >= 0 &&
      q.correctIndex < 4
        ? q.correctIndex
        : 0;

    const explanationText =
      typeof q.explanation === 'string' && q.explanation.trim().length > 0
        ? q.explanation.trim()
        : `The correct answer is ${optionsRaw[correctIdx]}.`;

    return {
      id: `q-${idx + 1}`,
      question: questionText,
      options: [optionsRaw[0], optionsRaw[1], optionsRaw[2], optionsRaw[3]],
      correctIndex: correctIdx,
      explanation: explanationText,
    };
  });

  if (normalized.length < 3) {
    throw new Error('Expected 3 quiz questions from Gemini, but received fewer.');
  }

  return {
    cityState,
    category,
    questions: normalized,
  };
}

export function evaluateQuizAnswers(
  questions: readonly QuizQuestion[],
  selectedAnswers: Record<string, number>
): QuizEvaluation {
  let score = 0;
  const items: QuizResultItem[] = questions.map((q) => {
    const selectedIndex =
      typeof selectedAnswers[q.id] === 'number' ? selectedAnswers[q.id] : -1;
    const isCorrect = selectedIndex === q.correctIndex;
    if (isCorrect) {
      score += 1;
    }
    return {
      questionId: q.id,
      selectedIndex,
      correctIndex: q.correctIndex,
      isCorrect,
    };
  });

  return {
    score,
    total: questions.length,
    items,
  };
}
