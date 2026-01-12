import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { HomeFeatureFlags, DEFAULT_FEATURE_FLAGS } from '@/types/featureTypes';

interface RouteParams {
  params: Promise<{ chainId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { chainId } = await params;

    if (!chainId) {
      return NextResponse.json(
        { error: 'Chain ID is required' },
        { status: 400 }
      );
    }

    const chainRef = adminDb.ref(`/chains/${chainId}`);
    const snapshot = await chainRef.once('value');

    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: 'Chain not found' },
        { status: 404 }
      );
    }

    const chainData = snapshot.val();
    const features: HomeFeatureFlags = chainData.features || DEFAULT_FEATURE_FLAGS;

    return NextResponse.json({
      success: true,
      chainId,
      features,
    });
  } catch (error) {
    console.error('Error fetching chain features:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch chain features',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { chainId } = await params;

    if (!chainId) {
      return NextResponse.json(
        { error: 'Chain ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { behaviours, hydration } = body;

    if (behaviours === undefined && hydration === undefined) {
      return NextResponse.json(
        { error: 'At least one feature flag (behaviours or hydration) must be provided' },
        { status: 400 }
      );
    }

    const chainRef = adminDb.ref(`/chains/${chainId}`);
    const chainSnapshot = await chainRef.once('value');

    if (!chainSnapshot.exists()) {
      return NextResponse.json(
        { error: 'Chain not found' },
        { status: 404 }
      );
    }

    const chainData = chainSnapshot.val();
    const existingFeatures: HomeFeatureFlags = {
      behaviours: chainData.features?.behaviours ?? DEFAULT_FEATURE_FLAGS.behaviours,
      hydration: chainData.features?.hydration ?? DEFAULT_FEATURE_FLAGS.hydration,
    };

    const updatedFeatures: HomeFeatureFlags = {
      behaviours: behaviours !== undefined ? Boolean(behaviours) : existingFeatures.behaviours,
      hydration: hydration !== undefined ? Boolean(hydration) : existingFeatures.hydration,
    };

    await chainRef.child('features').set(updatedFeatures);

    const homesInChain = chainData.homes || [];
    const updatePromises = homesInChain.map(async (homeId: string) => {
      const homeRef = adminDb.ref(`/${homeId}`);
      const homeSnapshot = await homeRef.once('value');
      
      if (homeSnapshot.exists()) {
        await homeRef.child('features').set(updatedFeatures);
        console.log(`✅ Updated features for home ${homeId} to match chain ${chainId}`);
      }
    });

    await Promise.all(updatePromises);

    console.log(`✅ Updated features for chain ${chainId} and ${homesInChain.length} home(s):`, updatedFeatures);

    return NextResponse.json({
      success: true,
      message: 'Chain features updated and cascaded to all homes',
      chainId,
      features: updatedFeatures,
      homesUpdated: homesInChain.length,
    });
  } catch (error) {
    console.error('Error updating chain features:', error);
    return NextResponse.json(
      {
        error: 'Failed to update chain features',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

