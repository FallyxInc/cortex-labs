

// ============================================================================
// Feature Flags
// ============================================================================

export interface HomeFeatureFlags {
  behaviours: boolean;
  hydration: boolean;
}

export const DEFAULT_FEATURE_FLAGS: HomeFeatureFlags = {
  behaviours: true,
  hydration: false,
};
