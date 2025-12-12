'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { db, auth } from '@/lib/firebase/firebase';
import ChainAdminDashboard from '@/components/chain/ChainAdminDashboard';

interface PageProps {
  params: Promise<{ chainId: string }>;
}

export default function ChainAdminPage({ params }: PageProps) {
  const { chainId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userChainId, setUserChainId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const userSnapshot = await get(ref(db, `users/${user.uid}`));
        
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          const role = userData.role;
          
          if (role !== 'chainAdmin') {
            router.push('/unauthorized');
            return;
          }

          // Verify user has access to this chain
          if (userData.chainId !== chainId) {
            router.push('/unauthorized');
            return;
          }
          
          setUserRole(role);
          setUserChainId(userData.chainId);
        } else {
          router.push('/login');
          return;
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        router.push('/login');
        return;
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, chainId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2" style={{ borderColor: '#06b6d4' }}></div>
      </div>
    );
  }

  if (!userRole || userRole !== 'chainAdmin' || userChainId !== chainId) {
    return null;
  }

  return <ChainAdminDashboard chainId={chainId} />;
}

