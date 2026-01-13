

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

// home preferences (separate from feature flags)
export type DefaultSection = 'behaviours' | 'hydration';

export interface HomePreferences {
  defaultSection?: DefaultSection;
}

export const DEFAULT_HOME_PREFERENCES: HomePreferences = {
  defaultSection: undefined,
};
