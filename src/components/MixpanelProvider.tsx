'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/mixpanel';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { identifyUser } from '@/lib/mixpanel';

function MixpanelTracker({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Track page views on route changes
    const fullPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    
    // Get page name from pathname
    const pageName = pathname === '/' ? 'home' : pathname.replace('/', '') || 'unknown';
    
    trackPageView(pageName, {
      path: fullPath,
      referrer: document.referrer,
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    // Identify user when auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch user data from database
          const userSnapshot = await get(ref(db, `users/${user.uid}`));
          if (userSnapshot.exists()) {
            const userData = userSnapshot.val();
            identifyUser(user.uid, {
              username: userData.username,
              email: user.email || undefined,
              role: userData.role,
              homeId: userData.homeId,
              chainId: userData.chainId,
              loginCount: userData.loginCount,
              createdAt: userData.createdAt,
            });
          } else {
            // Fallback to basic user info
            identifyUser(user.uid, {
              email: user.email || undefined,
            });
          }
        } catch (error) {
          console.error('Error identifying user in Mixpanel:', error);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return <>{children}</>;
}

export default function MixpanelProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <MixpanelTracker>{children}</MixpanelTracker>
    </Suspense>
  );
}
