import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackTimeOnPage } from '@/lib/mixpanel';

export function useTimeTracking(pageName: string, additionalProps?: {
  homeId?: string;
  interactions?: number;
}) {
  const pathname = usePathname();
  const startTime = useRef<number>(Date.now());
  const interactionCount = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Track interactions
  const trackInteraction = () => {
    interactionCount.current += 1;
  };

  // Track time periodically (every 30 seconds)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
      if (timeSpent > 0 && timeSpent % 30 === 0) {
        trackTimeOnPage({
          pageName,
          timeSpent,
          homeId: additionalProps?.homeId,
          interactions: interactionCount.current,
        });
      }
    }, 30000); // Check every 30 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pageName, additionalProps?.homeId]);

  // Track final time when component unmounts or pathname changes
  useEffect(() => {
    return () => {
      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
      if (timeSpent > 5) { // Only track if user spent more than 5 seconds
        trackTimeOnPage({
          pageName,
          timeSpent,
          homeId: additionalProps?.homeId,
          interactions: interactionCount.current,
        });
      }
    };
  }, [pathname, pageName, additionalProps?.homeId]);

  return { trackInteraction };
}

