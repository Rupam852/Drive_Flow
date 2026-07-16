import { useEffect, useState, useRef } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<any>) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const startY = useRef(0);
  const startX = useRef(0);
  const isPullingRef = useRef(false);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      // Only allow pulling if at the top
      if (window.scrollY > 0) return;

      const touch = e.touches[0];
      startY.current = touch.screenY;
      startX.current = touch.screenX;
      isPullingRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing) return;

      // Only allow pulling if at the top
      if (window.scrollY > 0) return;

      const touch = e.touches[0];
      const currentY = touch.screenY;
      const currentX = touch.screenX;

      const yDiff = currentY - startY.current;
      const xDiff = currentX - startX.current;

      if (yDiff > 0 && Math.abs(yDiff) > Math.abs(xDiff)) {
        if (e.cancelable) {
          e.preventDefault();
        }

        isPullingRef.current = true;
        setIsPulling(true);

        // Apply resistance
        const distance = Math.min(80, yDiff * 0.4);
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = async () => {
      if (isRefreshing || !isPullingRef.current) return;
      isPullingRef.current = false;

      if (pullDistance >= 50) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } catch (err) {
          console.error('Refresh error:', err);
        } finally {
          setIsRefreshing(false);
          setIsPulling(false);
          setPullDistance(0);
        }
      } else {
        setIsPulling(false);
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullDistance, isRefreshing, onRefresh]);

  return { pullDistance, isRefreshing, isPulling };
}
