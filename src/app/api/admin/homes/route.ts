import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const rootRef = adminDb.ref('/');
    const snapshot = await rootRef.once('value');
    
    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,
        homes: []
      });
    }

    const data = snapshot.val();
    const homes: Array<{ id: string; name: string; chainId?: string }> = [];

    for (const key in data) {
      if (key === 'users' || key === 'reviews' || key === 'chains') {
        continue;
      }

      const homeData = data[key];
      if (homeData && typeof homeData === 'object' && 'behaviours' in homeData) {
        homes.push({
          id: key,
          name: key,
          chainId: homeData.chainId || null
        });
      }
    }

    return NextResponse.json({
      success: true,
      homes: homes.sort((a, b) => a.name.localeCompare(b.name))
    });

  } catch (error) {
    console.error('Error fetching homes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { homeName, chainId } = body;

    if (!homeName || typeof homeName !== 'string') {
      return NextResponse.json(
        { error: 'Home name is required' },
        { status: 400 }
      );
    }

    if (!chainId || typeof chainId !== 'string') {
      return NextResponse.json(
        { error: 'Chain ID is required' },
        { status: 400 }
      );
    }

    const sanitizedName = homeName.trim().toLowerCase().replace(/\s+/g, '_');

    // Check if home already exists
    const homeRef = adminDb.ref(`/${sanitizedName}`);
    const snapshot = await homeRef.once('value');
    
    if (snapshot.exists()) {
      return NextResponse.json(
        { error: 'Home already exists' },
        { status: 409 }
      );
    }

    // Verify chain exists
    const chainRef = adminDb.ref(`/chains/${chainId}`);
    const chainSnapshot = await chainRef.once('value');
    
    if (!chainSnapshot.exists()) {
      return NextResponse.json(
        { error: 'Chain not found' },
        { status: 404 }
      );
    }

    // Create Firebase structure
    await homeRef.set({
      behaviours: {
        createdAt: new Date().toISOString()
      },
      chainId: chainId,
      createdAt: new Date().toISOString()
    });

    // Add home to chain's homes list
    const chainData = chainSnapshot.val();
    const homes = chainData.homes || [];
    if (!homes.includes(sanitizedName)) {
      homes.push(sanitizedName);
      await chainRef.update({ homes });
    }

    console.log(`✅ Created home: ${homeName} (${sanitizedName}) in chain ${chainId}`);

    return NextResponse.json({
      success: true,
      message: 'Home created successfully',
      homeName: sanitizedName,
      displayName: homeName,
      chainId: chainId
    });

  } catch (error) {
    console.error('Error creating home:', error);
    return NextResponse.json(
      { error: 'Failed to create home', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

