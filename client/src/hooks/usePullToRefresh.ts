import { useEffect, useRef, useState } from "react";

/**
 * usePullToRefresh — attaches touch listeners to a container ref and calls
 * `onRefresh` when the user pulls down more than `threshold` pixels.
 * Returns `isPulling` (drag in progress) and `pullDistance` for visual feedback.
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 72,
  enabled = true,
}: {
  onRefresh: () => void | Promise<void>;
  threshold?: number;
  enabled?: boolean;
}) {
  const startY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only trigger when scrolled to top
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === 0) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0) {
        setPullDistance(Math.min(delta, threshold * 1.5));
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }
      startY.current = 0;
      setPullDistance(0);
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onRefresh, threshold, enabled, pullDistance, isRefreshing]);

  return { pullDistance, isRefreshing, isPulling: pullDistance > 0 };
}
