"use client";

import { useState, useEffect, useCallback } from "react";
import { HomeFeatureFlags, DEFAULT_FEATURE_FLAGS } from "@/types/featureTypes";

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
      const response = await fetch(`/api/admin/homes/${homeId}/features`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch feature flags");
      }

      if (data.success && data.features) {
        setFeatures(data.features);
      } else {
        setFeatures(DEFAULT_FEATURE_FLAGS);
      }
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
