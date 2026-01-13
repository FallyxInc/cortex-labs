import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { HomePreferences, DEFAULT_HOME_PREFERENCES, DefaultSection } from '@/types/featureTypes';

interface RouteParams {
  params: Promise<{
    userId: string;
  }>;
}

/**
 * GET /api/admin/users/[userId]/preferences
 * Get preferences for a specific user
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const userRef = adminDb.ref(`/users/${userId}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = snapshot.val();
    const preferences: HomePreferences = {
      defaultSection: userData.preferences?.defaultSection ?? DEFAULT_HOME_PREFERENCES.defaultSection,
    };

    return NextResponse.json({
      success: true,
      userId,
      preferences,
    });
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch user preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[userId]/preferences
 * Update preferences for a specific user
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { defaultSection } = body;

    // validate defaultSection if provided
    if (defaultSection !== undefined && defaultSection !== null) {
      const validSections: DefaultSection[] = ['behaviours', 'hydration'];
      if (!validSections.includes(defaultSection)) {
        return NextResponse.json(
          { error: 'Invalid defaultSection value. Must be "behaviours" or "hydration"' },
          { status: 400 }
        );
      }
    }

    const userRef = adminDb.ref(`/users/${userId}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = snapshot.val();

    const existingPreferences: HomePreferences = {
      defaultSection: userData.preferences?.defaultSection ?? DEFAULT_HOME_PREFERENCES.defaultSection,
    };

    // null clears the preference
    const updatedPreferences: HomePreferences = {
      defaultSection: defaultSection === null ? undefined : (defaultSection ?? existingPreferences.defaultSection),
    };

    await userRef.child('preferences').set(updatedPreferences);

    return NextResponse.json({
      success: true,
      message: 'User preferences updated successfully',
      userId,
      preferences: updatedPreferences,
    });
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return NextResponse.json(
      {
        error: 'Failed to update user preferences',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
