import { AlertTriangle, RotateCw, X } from 'lucide-react';
import type { ExplorerError } from '../types/explorer';

interface ErrorBannerProps {
  error: ExplorerError;
  onDismiss?: () => void;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorBanner({ error, onDismiss, onRetry, compact = false }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      data-testid={`error-banner-${error.source}`}
      className={`rounded-lg border border-[#A84324]/30 bg-[#FDF4F1] text-[#3B190E] ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[#A84324] mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#3B190E]">{error.title}</h3>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label={`Dismiss ${error.title} error`}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#7B402D] hover:bg-[#A84324]/10 hover:text-[#3B190E] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3B6F]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#5E2D1D]">{error.message}</p>

          {(error.statusCode || error.detail || error.endpoint) && (
            <div className="mt-2.5 border-t border-[#A84324]/15 pt-2 text-[11px] font-mono tabular-nums text-[#7B402D] break-words">
              <span>
                {error.statusCode ? `HTTP ${error.statusCode}` : 'Diagnostic'}
                {error.detail ? ` · ${error.detail}` : ''}
              </span>
              {error.endpoint && <div className="mt-0.5 truncate opacity-85">{error.endpoint}</div>}
            </div>
          )}

          {onRetry && (
            <div className="mt-3">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#A84324]/35 bg-white px-3 py-1.5 text-xs font-medium text-[#3B190E] hover:bg-[#FAF1EE] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B3B6F]"
              >
                <RotateCw className="h-3 w-3" aria-hidden="true" />
                <span>Try again</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
