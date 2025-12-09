'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, get } from 'firebase/database';
import { db, auth } from '@/lib/firebase';
import ConfigManagerWizard from '@/components/admin/ConfigManager';

export default function ConfigManagerPage() {
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();

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

          if (role !== 'admin') {
            router.push('/unauthorized');
            return;
          }

          setUserRole(role);
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
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2" style={{ borderColor: '#06b6d4' }}></div>
      </div>
    );
  }

  if (!userRole || userRole !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <img
                src="/assets/fallyxlogo.jpeg"
                alt="Fallyx Logo"
                className="h-12 w-auto"
              />
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  Chain Configuration Manager
                </h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">
                  R&D
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Back to Admin
              </button>
              <span className="text-sm text-gray-600">
                {auth.currentUser?.email}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong className="font-semibold">R&D Status:</strong> This feature is currently in active development.
                  Some functionality may be incomplete or subject to change. Please report any issues or provide feedback.
                </p>
              </div>
            </div>
          </div>
          <ConfigManagerWizard />
        </div>
      </main>
    </div>
  );
}
