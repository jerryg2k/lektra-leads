import { Loader2, RefreshCw } from "lucide-react";

interface Props {
  pullDistance: number;
  isRefreshing: boolean;
  threshold?: number;
}

/**
 * Renders a small pull-to-refresh indicator at the top of the page.
 * Only visible on mobile (md:hidden).
 */
export function PullToRefreshIndicator({ pullDistance, isRefreshing, threshold = 72 }: Props) {
  const progress = Math.min(pullDistance / threshold, 1);
  const ready = progress >= 1;

  if (!isRefreshing && pullDistance === 0) return null;

  return (
    <div
      className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-center pointer-events-none"
      style={{ height: isRefreshing ? 48 : Math.max(pullDistance * 0.6, 0) }}
    >
      <div
        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium shadow-md transition-all ${
          ready || isRefreshing
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border text-muted-foreground"
        }`}
        style={{ opacity: Math.min(progress * 2, 1) }}
      >
        {isRefreshing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw
            className="h-3.5 w-3.5 transition-transform"
            style={{ transform: `rotate(${progress * 180}deg)` }}
          />
        )}
        {isRefreshing ? "Refreshing..." : ready ? "Release to refresh" : "Pull to refresh"}
      </div>
    </div>
  );
}
