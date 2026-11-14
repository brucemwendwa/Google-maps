import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Loader2,
  Palette,
  Utensils,
  X,
  XCircle,
} from 'lucide-react';
import type { QuizState } from '../types/explorer';
import { QUIZ_CATEGORIES, type QuizCategory } from '../utils/quiz';
import { ErrorBanner } from './ErrorBanner';

interface LocalQuizModalProps {
  quiz: QuizState;
  onClose: () => void;
  onSelectCategory: (category: QuizCategory) => void;
  onSelectAnswer: (questionId: string, optionIndex: number) => void;
  onSubmitQuiz: () => void;
  onBackToCategories: () => void;
  onRetryQuiz: () => void;
}

const CATEGORY_ICONS: Record<QuizCategory, typeof Utensils> = {
  'Local cuisine': Utensils,
  'Art and culture': Palette,
  'Local history': BookOpen,
};

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export function LocalQuizModal({
  quiz,
  onClose,
  onSelectCategory,
  onSelectAnswer,
  onSubmitQuiz,
  onBackToCategories,
  onRetryQuiz,
}: LocalQuizModalProps) {
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (quiz.status === 'submitted' && modalBodyRef.current) {
      modalBodyRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [quiz.status]);

  if (quiz.status === 'closed') {
    return null;
  }

  const questions = quiz.data?.questions ?? [];
  const answeredCount = questions.filter(
    (q) => typeof quiz.selectedAnswers[q.id] === 'number'
  ).length;

  const handleSubmit = () => {
    if (answeredCount < questions.length) {
      setValidationMessage(
        `Please answer all ${questions.length} questions before submitting (${answeredCount} of ${questions.length} answered).`
      );
      return;
    }
    setValidationMessage(null);
    onSubmitQuiz();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#181715]/50 backdrop-blur-xs p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-modal-title"
      data-testid="local-quiz-modal"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#D8D1C3] bg-[#F9F7F2] text-[#181715] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E4DFD3] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider uppercase text-[#5C5852]">
              {quiz.cityState ?? 'Local Knowledge'}
              {quiz.category ? ` · ${quiz.category}` : ''}
            </p>
            <h2
              id="quiz-modal-title"
              className="mt-1 font-serif text-xl sm:text-2xl font-semibold text-[#181715]"
            >
              {quiz.status === 'choose' && 'Test Your Local Knowledge'}
              {quiz.status === 'loading' && 'Preparing Your Quiz'}
              {quiz.status === 'active' && 'Three Local Questions'}
              {quiz.status === 'submitted' && 'Your Local Knowledge Score'}
              {quiz.status === 'error' && 'Quiz Unavailable'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close quiz"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E4DFD3] bg-white text-[#5C5852] hover:text-[#181715] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3B6F]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div
          ref={modalBodyRef}
          className="overflow-y-auto px-5 py-5 sm:px-6 sm:py-6 space-y-5"
        >
          {/* Step 1: Choose Category */}
          {quiz.status === 'choose' && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[#5C5852]">
                Select a theme below and Gemini will craft a 3-question multiple-choice quiz based
                on <strong className="font-medium text-[#181715]">{quiz.cityState}</strong>.
              </p>

              <div className="grid gap-3">
                {QUIZ_CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.id];
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setValidationMessage(null);
                        onSelectCategory(cat.id);
                      }}
                      className="flex items-start gap-3.5 rounded-lg border border-[#D8D1C3] bg-white p-4 text-left hover:border-[#1B3B6F] hover:bg-[#F4F1EA] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3B6F]"
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E4DFD3] bg-[#F9F7F2] text-[#1B3B6F]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-[#181715]">
                          {cat.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-[#5C5852] leading-relaxed">
                          {cat.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Loading */}
          {quiz.status === 'loading' && (
            <div
              className="flex flex-col items-center justify-center py-10 text-center"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-7 w-7 animate-spin text-[#1B3B6F]" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-[#181715]">
                Generating 3 {quiz.category?.toLowerCase()} questions for {quiz.cityState}...
              </p>
              <p className="mt-1 text-xs text-[#78726A]">
                Drawing from local stories and landmarks.
              </p>
            </div>
          )}

          {/* Error State */}
          {quiz.status === 'error' && quiz.error && (
            <div className="space-y-4">
              <ErrorBanner error={quiz.error} onRetry={onRetryQuiz} />
              <button
                type="button"
                onClick={onBackToCategories}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D8D1C3] bg-white px-4 py-2 text-xs font-medium text-[#181715] hover:bg-[#F4F1EA] transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Choose another category</span>
              </button>
            </div>
          )}

          {/* Submitted Score Summary */}
          {quiz.status === 'submitted' && quiz.evaluation && (
            <div
              data-testid="quiz-score-banner"
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#1B3B6F]/25 bg-white p-4 sm:p-5"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#1B3B6F] text-white">
                  <Award className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#5C5852]">
                    Final Result
                  </p>
                  <p className="font-serif text-2xl font-semibold tabular-nums text-[#181715]">
                    {quiz.evaluation.score} / {quiz.evaluation.total} Correct
                  </p>
                </div>
              </div>
              <p className="text-sm text-[#5C5852]">
                {quiz.evaluation.score === quiz.evaluation.total
                  ? 'Spotless — you know this neighborhood like a local.'
                  : quiz.evaluation.score >= 2
                    ? 'Strong showing — review the notes below for the final detail.'
                    : 'Every block has hidden stories — check the answers below.'}
              </p>
            </div>
          )}

          {/* Step 3 & 4: Active Questions & Submitted Review */}
          {(quiz.status === 'active' || quiz.status === 'submitted') && (
            <div className="space-y-6">
              {questions.map((q, qIndex) => {
                const selectedIdx = quiz.selectedAnswers[q.id];
                const isSubmitted = quiz.status === 'submitted';
                const resultItem = quiz.evaluation?.items.find((item) => item.questionId === q.id);

                return (
                  <fieldset
                    key={q.id}
                    className="space-y-3 border-b border-[#E4DFD3] pb-5 last:border-b-0 last:pb-0"
                  >
                    <legend className="text-sm sm:text-base font-semibold text-[#181715] leading-snug">
                      <span className="mr-2 font-mono text-xs tabular-nums text-[#1B3B6F]">
                        0{qIndex + 1}.
                      </span>
                      {q.question}
                    </legend>

                    <div className="grid gap-2 pt-1">
                      {q.options.map((optionText, optIdx) => {
                        const isSelected = selectedIdx === optIdx;
                        const isCorrectChoice = optIdx === q.correctIndex;

                        let optionClasses =
                          'border-[#E4DFD3] bg-white text-[#181715] hover:border-[#1B3B6F]/60 hover:bg-[#F4F1EA]';
                        if (!isSubmitted && isSelected) {
                          optionClasses = 'border-[#1B3B6F] bg-[#1B3B6F]/8 text-[#181715] ring-1 ring-[#1B3B6F]';
                        } else if (isSubmitted && isCorrectChoice) {
                          optionClasses = 'border-[#14532D]/50 bg-[#ECFDF5] text-[#14532D]';
                        } else if (isSubmitted && isSelected && !isCorrectChoice) {
                          optionClasses = 'border-[#A84324]/50 bg-[#FDF4F1] text-[#7B2D16]';
                        } else if (isSubmitted) {
                          optionClasses = 'border-[#E4DFD3] bg-white/70 text-[#5C5852]';
                        }

                        return (
                          <label
                            key={`${q.id}-${optIdx}`}
                            className={`flex min-h-[44px] items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                              isSubmitted ? 'cursor-default' : 'cursor-pointer'
                            } ${optionClasses}`}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={optIdx}
                              checked={isSelected}
                              disabled={isSubmitted}
                              onChange={() => {
                                setValidationMessage(null);
                                onSelectAnswer(q.id, optIdx);
                              }}
                              className="h-4 w-4 accent-[#1B3B6F] shrink-0"
                            />
                            <span className="font-mono text-xs font-semibold tabular-nums opacity-70 shrink-0">
                              {OPTION_LETTERS[optIdx]}
                            </span>
                            <span className="flex-1 leading-snug">{optionText}</span>

                            {isSubmitted && isCorrectChoice && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#14532D] shrink-0">
                                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                                <span>Correct answer</span>
                              </span>
                            )}
                            {isSubmitted && isSelected && !isCorrectChoice && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#A84324] shrink-0">
                                <XCircle className="h-4 w-4" aria-hidden="true" />
                                <span>Your choice</span>
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {isSubmitted && resultItem && (
                      <div className="rounded-lg border border-[#E4DFD3] bg-white px-3.5 py-2.5 text-xs leading-relaxed text-[#5C5852]">
                        <span className="font-semibold text-[#181715]">
                          {resultItem.isCorrect ? 'Correct: ' : `Correct answer (${OPTION_LETTERS[q.correctIndex]}): `}
                        </span>
                        {q.explanation}
                      </div>
                    )}
                  </fieldset>
                );
              })}

              {validationMessage && (
                <p role="alert" className="text-xs font-medium text-[#A84324]">
                  {validationMessage}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {(quiz.status === 'active' || quiz.status === 'submitted') && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4DFD3] bg-[#F4F1EA]/70 px-5 py-3.5 sm:px-6">
            <button
              type="button"
              onClick={() => {
                setValidationMessage(null);
                onBackToCategories();
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D8D1C3] bg-white px-3.5 py-2 text-xs font-medium text-[#181715] hover:bg-[#F9F7F2] transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Change category</span>
            </button>

            {quiz.status === 'active' ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono tabular-nums text-[#5C5852]">
                  {answeredCount}/{questions.length} answered
                </span>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#1B3B6F] px-5 py-2 text-sm font-medium text-white hover:bg-[#152E57] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3B6F]"
                >
                  Submit Quiz
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#1B3B6F] px-5 py-2 text-sm font-medium text-white hover:bg-[#152E57] transition-colors whitespace-nowrap shrink-0"
              >
                Done Exploring
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
