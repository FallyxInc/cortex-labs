import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const auth = getAuth();

    // Delete from Firebase Realtime Database
    const userRef = adminDb.ref(`/users/${userId}`);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    await userRef.remove();

    // Delete from Firebase Authentication
    try {
      await auth.deleteUser(userId);
    } catch (authError) {
      console.error('Error deleting user from Firebase Auth:', authError);
      // User was deleted from database but not auth
      // This might happen if the user doesn't exist in auth
      return NextResponse.json({
        success: true,
        message: 'User deleted from database, but authentication record not found',
        warning: 'Authentication record may not exist'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted from database and authentication'
    });

  } catch (error: unknown) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

