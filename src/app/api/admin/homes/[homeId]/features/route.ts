import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { HomeFeatureFlags, DEFAULT_FEATURE_FLAGS } from '@/types/featureTypes';

interface RouteParams {
  params: Promise<{
    homeId: string;
  }>;
}

/**
 * GET /api/admin/homes/[homeId]/features
 * Get feature flags for a specific home
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { homeId } = await params;

    if (!homeId) {
      return NextResponse.json(
        { error: 'Home ID is required' },
        { status: 400 }
      );
    }

    const homeRef = adminDb.ref(`/${homeId}`);
    const snapshot = await homeRef.once('value');

    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: 'Home not found' },
        { status: 404 }
      );
    }

    const homeData = snapshot.val();
    const features: HomeFeatureFlags = {
      behaviours: homeData.features?.behaviours ?? DEFAULT_FEATURE_FLAGS.behaviours,
      hydration: homeData.features?.hydration ?? DEFAULT_FEATURE_FLAGS.hydration,
    };

    return NextResponse.json({
      success: true,
      homeId,
      features,
    });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch feature flags',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/homes/[homeId]/features
 * Update feature flags for a specific home
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { homeId } = await params;

    if (!homeId) {
      return NextResponse.json(
        { error: 'Home ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { behaviours, hydration } = body;

    // Validate that at least one feature flag is provided
    if (behaviours === undefined && hydration === undefined) {
      return NextResponse.json(
        { error: 'At least one feature flag (behaviours or hydration) must be provided' },
        { status: 400 }
      );
    }

    // Check if home exists
    const homeRef = adminDb.ref(`/${homeId}`);
    const snapshot = await homeRef.once('value');

    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: 'Home not found' },
        { status: 404 }
      );
    }

    const homeData = snapshot.val();

    // Get existing features or use defaults
    const existingFeatures: HomeFeatureFlags = {
      behaviours: homeData.features?.behaviours ?? DEFAULT_FEATURE_FLAGS.behaviours,
      hydration: homeData.features?.hydration ?? DEFAULT_FEATURE_FLAGS.hydration,
    };

    // Merge with provided features
    const updatedFeatures: HomeFeatureFlags = {
      behaviours: behaviours !== undefined ? Boolean(behaviours) : existingFeatures.behaviours,
      hydration: hydration !== undefined ? Boolean(hydration) : existingFeatures.hydration,
    };

    // Update features in Firebase
    await homeRef.child('features').set(updatedFeatures);

    console.log(`✅ Updated features for home ${homeId}:`, updatedFeatures);

    return NextResponse.json({
      success: true,
      message: 'Feature flags updated successfully',
      homeId,
      features: updatedFeatures,
    });
  } catch (error) {
    console.error('Error updating feature flags:', error);
    return NextResponse.json(
      {
        error: 'Failed to update feature flags',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/homes/[homeId]/features
 * Replace all feature flags for a specific home
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { homeId } = await params;

    if (!homeId) {
      return NextResponse.json(
        { error: 'Home ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { behaviours, hydration } = body;

    // Validate that all feature flags are provided
    if (behaviours === undefined || hydration === undefined) {
      return NextResponse.json(
        { error: 'Both behaviours and hydration feature flags must be provided' },
        { status: 400 }
      );
    }

    // Check if home exists
    const homeRef = adminDb.ref(`/${homeId}`);
    const snapshot = await homeRef.once('value');

    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: 'Home not found' },
        { status: 404 }
      );
    }

    const features: HomeFeatureFlags = {
      behaviours: Boolean(behaviours),
      hydration: Boolean(hydration),
    };

    // Replace features in Firebase
    await homeRef.child('features').set(features);

    console.log(`✅ Replaced features for home ${homeId}:`, features);

    return NextResponse.json({
      success: true,
      message: 'Feature flags replaced successfully',
      homeId,
      features,
    });
  } catch (error) {
    console.error('Error replacing feature flags:', error);
    return NextResponse.json(
      {
        error: 'Failed to replace feature flags',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
