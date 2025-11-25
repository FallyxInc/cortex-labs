import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { username, email } = await request.json();

    if (!username && !email) {
      return NextResponse.json(
        { error: 'Username or email is required' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
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

    const auth = getAuth();
    const updates: any = {};

    // Update username in Firebase database
    if (username !== undefined) {
      updates.username = username;
    }

    // Update email in Firebase Auth
    if (email) {
      try {
        await auth.updateUser(userId, { email });
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error) {
          if (error.code === 'auth/email-already-exists') {
            return NextResponse.json(
              { error: 'Email is already in use by another user' },
              { status: 409 }
            );
          }
        }
        throw error;
      }
    }

    // Update Firebase database
    if (Object.keys(updates).length > 0) {
      await userRef.update(updates);
    }

    // Update displayName if username changed
    if (username !== undefined) {
      try {
        await auth.updateUser(userId, { displayName: username });
      } catch (error) {
        console.warn('Failed to update displayName:', error);
        // Non-critical, continue
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User profile updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

