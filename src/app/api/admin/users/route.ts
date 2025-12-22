import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

export async function GET() {
  try {
    const usersRef = adminDb.ref('/users');
    const snapshot = await usersRef.once('value');
    
    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,
        users: []
      });
    }

    const usersData = snapshot.val();
    const auth = getAuth(adminDb.app);
    
    const usersWithAuth = await Promise.all(
      Object.keys(usersData).map(async (userId) => {
        let username = null;
        let email = null;
        
        try {
          const userRecord = await auth.getUser(userId);
          email = userRecord.email;
          // Use stored username from Firebase, fallback to displayName or email
          username = usersData[userId]?.username || userRecord.displayName || email?.split('@')[0] || null;
        } catch {
          console.log(`Could not fetch auth data for user ${userId}`);
        }
        
        return {
          id: userId,
          username,
          email,
          ...usersData[userId]
        };
      })
    );

    return NextResponse.json({
      success: true,
      users: usersWithAuth
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const userRef = adminDb.ref(`/users/${userId}`);
    await userRef.remove();

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

