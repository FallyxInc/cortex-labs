"use client";

import { useState, useEffect, useCallback } from "react";
import { HomePreferences, DEFAULT_HOME_PREFERENCES } from "@/types/featureTypes";
import { db, auth } from "@/lib/firebase/firebase";
import { get, ref } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";

interface UseHomePreferencesReturn {
  preferences: HomePreferences;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useHomePreferences(): UseHomePreferencesReturn {
  const [preferences, setPreferences] = useState<HomePreferences>(DEFAULT_HOME_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
    });
    return () => unsubscribe();
  }, []);

  const fetchPreferences = useCallback(async () => {
    if (!userId) {
      setPreferences(DEFAULT_HOME_PREFERENCES);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const prefsRef = ref(db, `/users/${userId}/preferences`);
      const snapshot = await get(prefsRef);
      const data = snapshot.val();

      const prefs: HomePreferences = {
        defaultSection: data?.defaultSection ?? DEFAULT_HOME_PREFERENCES.defaultSection,
      };

      setPreferences(prefs);
    } catch (err) {
      console.error("Error fetching user preferences:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch user preferences");
      setPreferences(DEFAULT_HOME_PREFERENCES);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  return {
    preferences,
    isLoading,
    error,
    refetch: fetchPreferences,
  };
}
