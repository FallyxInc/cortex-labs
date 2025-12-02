import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

interface UserIssue {
  userId: string;
  currentData: any;
  proposedChanges: {
    role?: string;
    homeId?: string | null;
    chainId?: string | null;
    loginCount?: number;
    username?: string | null;
    email?: string | null;
    createdAt?: string;
  };
  issues: string[];
}

/**
 * GET: Analyze users and return migration preview
 */
export async function GET() {
  try {
    const usersRef = adminDb.ref('/users');
    const usersSnapshot = await usersRef.once('value');
    
    if (!usersSnapshot.exists()) {
      return NextResponse.json({
        success: true,
        usersToMigrate: [],
        totalUsers: 0
      });
    }

    const usersData = usersSnapshot.val();
    const homesRef = adminDb.ref('/');
    const homesSnapshot = await homesRef.once('value');
    const homesData = homesSnapshot.exists() ? homesSnapshot.val() : {};
    
    // Build a map of home IDs (including variations)
    const homeMap = new Map<string, { id: string; chainId: string | null }>();
    for (const key in homesData) {
      if (key === 'users' || key === 'reviews' || key === 'chains' || key === 'homeMappings') {
        continue;
      }
      const homeData = homesData[key];
      if (homeData && typeof homeData === 'object' && 'behaviours' in homeData) {
        homeMap.set(key, { id: key, chainId: homeData.chainId || null });
        // Also map variations (lowercase, with/without underscores)
        const variations = [
          key.toLowerCase(),
          key.replace(/_/g, ''),
          key.replace(/_/g, '-'),
        ];
        variations.forEach(v => {
          if (v !== key && !homeMap.has(v)) {
            homeMap.set(v, { id: key, chainId: homeData.chainId || null });
          }
        });
      }
    }

    const usersToMigrate: UserIssue[] = [];
    const auth = getAuth();

    for (const userId in usersData) {
      const userData = usersData[userId];
      const issues: string[] = [];
      const proposedChanges: UserIssue['proposedChanges'] = {};

      // Check role - should be "admin" or "homeUser"
      const currentRole = userData.role;
      const isAdmin = currentRole === 'admin';
      const isHomeUser = currentRole === 'homeUser';
      
      if (!currentRole || (!isAdmin && !isHomeUser)) {
        issues.push(`Role is "${currentRole}" (should be "admin" or "homeUser")`);
        
        // If role is a home name, try to find the home
        if (currentRole && currentRole !== 'admin' && currentRole !== 'homeUser') {
          const homeMatch = homeMap.get(currentRole.toLowerCase()) || 
                           homeMap.get(currentRole.replace(/\s+/g, '_').toLowerCase()) ||
                           homeMap.get(currentRole.replace(/\s+/g, '').toLowerCase());
          
          if (homeMatch) {
            proposedChanges.role = 'homeUser';
            proposedChanges.homeId = homeMatch.id;
            proposedChanges.chainId = homeMatch.chainId;
          } else {
            // Home not found, but still set role to homeUser
            proposedChanges.role = 'homeUser';
            proposedChanges.homeId = null;
            proposedChanges.chainId = null;
          }
        } else if (!currentRole) {
          proposedChanges.role = 'homeUser';
        }
      }

      // Check loginCount - should be a number
      const currentLoginCount = userData.loginCount;
      if (currentLoginCount === '' || currentLoginCount === null || currentLoginCount === undefined) {
        issues.push('loginCount is empty or invalid');
        proposedChanges.loginCount = 0;
      } else if (typeof currentLoginCount !== 'number') {
        issues.push(`loginCount is not a number (${typeof currentLoginCount})`);
        const parsed = parseInt(currentLoginCount, 10);
        proposedChanges.loginCount = isNaN(parsed) ? 0 : parsed;
      }

      // Check for missing fields
      if (userData.username === undefined) {
        issues.push('username field missing');
        proposedChanges.username = null;
      }
      
      // Only require homeId/chainId for homeUser roles, not admin
      if (isHomeUser || (!isAdmin && !isHomeUser && proposedChanges.role === 'homeUser')) {
        if (userData.homeId === undefined) {
          issues.push('homeId field missing (required for homeUser)');
          proposedChanges.homeId = null;
        }
        
        if (userData.chainId === undefined) {
          issues.push('chainId field missing (required for homeUser)');
          proposedChanges.chainId = null;
        }
      } else if (isAdmin) {
        // For admin users, ensure homeId and chainId are not set (should be null/undefined)
        if (userData.homeId !== undefined && userData.homeId !== null) {
          issues.push('homeId should not be set for admin users');
          proposedChanges.homeId = null;
        }
        if (userData.chainId !== undefined && userData.chainId !== null) {
          issues.push('chainId should not be set for admin users');
          proposedChanges.chainId = null;
        }
      }
      
      if (userData.createdAt === undefined) {
        issues.push('createdAt field missing');
        proposedChanges.createdAt = new Date().toISOString();
      }

      // Try to get email from Auth if missing
      if (userData.email === undefined) {
        try {
          const userRecord = await auth.getUser(userId);
          if (userRecord.email) {
            proposedChanges.email = userRecord.email;
          } else {
            issues.push('email field missing');
            proposedChanges.email = null;
          }
        } catch {
          issues.push('email field missing and cannot fetch from Auth');
          proposedChanges.email = null;
        }
      }

      if (issues.length > 0) {
        usersToMigrate.push({
          userId,
          currentData: { ...userData },
          proposedChanges,
          issues
        });
      }
    }

    return NextResponse.json({
      success: true,
      usersToMigrate,
      totalUsers: Object.keys(usersData).length,
      usersNeedingMigration: usersToMigrate.length
    });

  } catch (error) {
    console.error('Error analyzing users for migration:', error);
    return NextResponse.json(
      { error: 'Failed to analyze users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Execute the migration
 */
export async function POST(request: NextRequest) {
  try {
    const { userIds } = await request.json();
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'User IDs array is required' },
        { status: 400 }
      );
    }

    const usersRef = adminDb.ref('/users');
    const homesRef = adminDb.ref('/');
    const homesSnapshot = await homesRef.once('value');
    const homesData = homesSnapshot.exists() ? homesSnapshot.val() : {};
    
    // Build home map
    const homeMap = new Map<string, { id: string; chainId: string | null }>();
    for (const key in homesData) {
      if (key === 'users' || key === 'reviews' || key === 'chains' || key === 'homeMappings') {
        continue;
      }
      const homeData = homesData[key];
      if (homeData && typeof homeData === 'object' && 'behaviours' in homeData) {
        homeMap.set(key, { id: key, chainId: homeData.chainId || null });
        const variations = [
          key.toLowerCase(),
          key.replace(/_/g, ''),
          key.replace(/_/g, '-'),
        ];
        variations.forEach(v => {
          if (v !== key && !homeMap.has(v)) {
            homeMap.set(v, { id: key, chainId: homeData.chainId || null });
          }
        });
      }
    }

    const results = {
      updated: [] as string[],
      failed: [] as Array<{ userId: string; error: string }>,
      skipped: [] as string[]
    };

    const auth = getAuth();

    for (const userId of userIds) {
      try {
        const userRef = adminDb.ref(`/users/${userId}`);
        const userSnapshot = await userRef.once('value');
        
        if (!userSnapshot.exists()) {
          results.skipped.push(userId);
          continue;
        }

        const userData = userSnapshot.val();
        const updates: any = {};
        const currentRole = userData.role;
        const isAdmin = currentRole === 'admin';
        const isHomeUser = currentRole === 'homeUser';

        // Fix role
        if (!currentRole || (!isAdmin && !isHomeUser)) {
          if (currentRole && currentRole !== 'admin' && currentRole !== 'homeUser') {
            const homeMatch = homeMap.get(currentRole.toLowerCase()) || 
                             homeMap.get(currentRole.replace(/\s+/g, '_').toLowerCase()) ||
                             homeMap.get(currentRole.replace(/\s+/g, '').toLowerCase());
            
            if (homeMatch) {
              updates.role = 'homeUser';
              updates.homeId = homeMatch.id;
              updates.chainId = homeMatch.chainId;
            } else {
              updates.role = 'homeUser';
              if (userData.homeId === undefined) updates.homeId = null;
              if (userData.chainId === undefined) updates.chainId = null;
            }
          } else {
            updates.role = 'homeUser';
          }
        }

        // Fix loginCount
        if (userData.loginCount === '' || userData.loginCount === null || userData.loginCount === undefined) {
          updates.loginCount = 0;
        } else if (typeof userData.loginCount !== 'number') {
          const parsed = parseInt(userData.loginCount, 10);
          updates.loginCount = isNaN(parsed) ? 0 : parsed;
        }

        // Ensure all required fields exist
        if (userData.username === undefined) {
          updates.username = null;
        }
        
        // Only set homeId/chainId for homeUser roles, not admin
        if (isHomeUser || (!isAdmin && !isHomeUser && updates.role === 'homeUser')) {
          if (userData.homeId === undefined) {
            updates.homeId = null;
          }
          if (userData.chainId === undefined) {
            updates.chainId = null;
          }
        } else if (isAdmin) {
          // For admin users, ensure homeId and chainId are null/removed
          if (userData.homeId !== undefined && userData.homeId !== null) {
            updates.homeId = null;
          }
          if (userData.chainId !== undefined && userData.chainId !== null) {
            updates.chainId = null;
          }
        }
        
        if (userData.createdAt === undefined) {
          updates.createdAt = new Date().toISOString();
        }

        // Try to get email from Auth if missing
        if (userData.email === undefined) {
          try {
            const userRecord = await auth.getUser(userId);
            if (userRecord.email) {
              updates.email = userRecord.email;
            } else {
              updates.email = null;
            }
          } catch {
            updates.email = null;
          }
        }

        if (Object.keys(updates).length > 0) {
          await userRef.update(updates);
          results.updated.push(userId);
        } else {
          results.skipped.push(userId);
        }

      } catch (error) {
        results.failed.push({
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration completed: ${results.updated.length} updated, ${results.failed.length} failed, ${results.skipped.length} skipped`,
      results
    });

  } catch (error) {
    console.error('Error executing migration:', error);
    return NextResponse.json(
      { error: 'Failed to execute migration', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

