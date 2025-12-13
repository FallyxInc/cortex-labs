import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { role } = await request.json();

    if (!role) {
      return NextResponse.json(
        { error: 'Role is required' },
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

    await userRef.update({ role });

    return NextResponse.json({
      success: true,
      message: 'User role updated successfully'
    });

  } catch (error: unknown) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: 'Failed to update user role', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

