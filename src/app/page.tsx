'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Middleware handles redirects, but as a fallback redirect to login
    router.replace('/login');
  }, [router]);

  return null; // Return null to avoid showing anything during redirect
}
