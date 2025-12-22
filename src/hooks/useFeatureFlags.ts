"use client";

import { useState, useEffect, useCallback } from "react";
import { HomeFeatureFlags, DEFAULT_FEATURE_FLAGS } from "@/types/featureTypes";
import { db } from "@/lib/firebase/firebase";
import { get, ref } from "firebase/database";

interface UseFeatureFlagsParams {
  homeId: string;
}

interface UseFeatureFlagsReturn {
  features: HomeFeatureFlags;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useFeatureFlags({
  homeId,
}: UseFeatureFlagsParams): UseFeatureFlagsReturn {
  const [features, setFeatures] = useState<HomeFeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatureFlags = useCallback(async () => {
    if (!homeId) {
      setFeatures(DEFAULT_FEATURE_FLAGS);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // use firebase ref
      const homeRef = ref(db, `/${homeId}/features`);
      const snapshot = await get(homeRef);
      const data = snapshot.val();

      const flags = {
        behaviours: data.behaviours ?? DEFAULT_FEATURE_FLAGS.behaviours,
        hydration: data.hydration ?? DEFAULT_FEATURE_FLAGS.hydration,
      };

      setFeatures(flags);
    } catch (err) {
      console.error("Error fetching feature flags:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch feature flags");
      setFeatures(DEFAULT_FEATURE_FLAGS);
    } finally {
      setIsLoading(false);
    }
  }, [homeId]);

  useEffect(() => {
    fetchFeatureFlags();
  }, [fetchFeatureFlags]);

  return {
    features,
    isLoading,
    error,
    refetch: fetchFeatureFlags,
  };
}
