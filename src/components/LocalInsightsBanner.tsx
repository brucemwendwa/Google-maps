import { useState } from 'react';
import { ChevronDown, ChevronUp, Compass, HelpCircle, Loader2, RefreshCw } from 'lucide-react';
import type { InsightsState } from '../types/explorer';
import { ErrorBanner } from './ErrorBanner';

interface LocalInsightsBannerProps {
  insights: InsightsState;
  onRetry: () => void;
  onDismissError: () => void;
  onStartQuiz: () => void;
}

export function LocalInsightsBanner({
  insights,
  onRetry,
  onDismissError,
  onStartQuiz,
}: LocalInsightsBannerProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (insights.status === 'idle') {
    return null;
  }

  return (
    <section
      aria-label="Local Insights"
      data-testid="local-insights-banner"
      className="pointer-events-auto w-full max-w-2xl rounded-xl border border-[#D8D1C3] bg-[#F9F7F2]/95 backdrop-blur-md shadow-lg transition-all duration-200"
    >
      <div className="flex items-center justify-between gap-4 border-b border-[#E4DFD3] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Compass className="h-4 w-4 shrink-0 text-[#1B3B6F]" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-serif text-base font-semibold text-[#181715] truncate">
              Local Insights
              {insights.cityState ? ` · ${insights.cityState}` : ''}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {insights.status !== 'loading' && (
            <button
              type="button"
              onClick={onRetry}
              aria-label="Refresh local insights"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E4DFD3] bg-white px-2.5 text-xs font-medium text-[#181715] hover:border-[#1B3B6F]/50 hover:text-[#1B3B6F] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3B6F]"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand Local Insights' : 'Collapse Local Insights'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E4DFD3] bg-white text-[#5C5852] hover:text-[#181715] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3B6F]"
          >
            {collapsed ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 py-3.5 sm:px-5 sm:py-4">
          {insights.status === 'loading' && (
            <div
              className="flex items-center gap-3 py-2 text-sm text-[#5C5852]"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-4 w-4 animate-spin text-[#1B3B6F] shrink-0" aria-hidden="true" />
              <span>
                Gathering local stories and curiosities for{' '}
                <strong className="font-medium text-[#181715]">{insights.cityState}</strong>...
              </span>
            </div>
          )}

          {insights.status === 'error' && insights.error && (
            <ErrorBanner
              error={insights.error}
              onRetry={onRetry}
              onDismiss={onDismissError}
              compact
            />
          )}

          {insights.status === 'success' && insights.html && (
            <div className="space-y-3.5">
              <div
                data-testid="local-insights-content"
                className="insights-html text-sm text-[#2D2A26]"
                dangerouslySetInnerHTML={{ __html: insights.html }}
              />

              <div className="flex items-center justify-between gap-3 border-t border-[#E4DFD3] pt-3">
                <p className="text-xs text-[#5C5852]">
                  Ready to put these local insights to the test?
                </p>
                <button
                  type="button"
                  onClick={onStartQuiz}
                  data-testid="test-local-knowledge-btn"
                  className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#1B3B6F] px-4 py-2 text-xs font-medium text-white hover:bg-[#152E57] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3B6F]"
                >
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Test your local knowledge</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
