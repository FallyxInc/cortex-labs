import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { ChainExtractionConfig } from '@/lib/processing/types';
import { HomeFeatureFlags, DEFAULT_FEATURE_FLAGS } from '@/types/featureTypes';

export interface ChainWithConfig {
  id: string;
  name: string;
  homes: string[];
  extractionType?: string;
  hasConfig: boolean;
  config?: ChainExtractionConfig;
  features?: HomeFeatureFlags;
  createdAt?: string;
  updatedAt?: string;
}

export async function GET() {
  try {
    const chainsRef = adminDb.ref('/chains');
    const snapshot = await chainsRef.once('value');

    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,
        chains: []
      });
    }

    const chainsData = snapshot.val();
    const chains: ChainWithConfig[] = Object.keys(chainsData).map(chainId => {
      const chainData = chainsData[chainId];
      let config = chainData.config as ChainExtractionConfig | undefined;
      
      // Remove chainId/chainName from config if they exist (backward compatibility)
      if (config && ('chainId' in config || 'chainName' in config)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const configAny = config as any;
        const { chainId: _unused1, chainName: _unused2, ...configWithoutIds } = configAny;
        config = configWithoutIds as ChainExtractionConfig;
      }

      return {
        id: chainId,
        name: chainData.name || chainId,
        homes: chainData.homes || [],
        extractionType: chainData.extractionType,
        hasConfig: !!config,
        config: config,
        features: chainData.features || DEFAULT_FEATURE_FLAGS,
        createdAt: chainData.createdAt,
        updatedAt: chainData.updatedAt || config?.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      chains: chains.sort((a, b) => a.name.localeCompare(b.name))
    });

  } catch (error) {
    console.error('Error fetching chains:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chains', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainName, extractionType, extractionConfig } = body;

    if (!chainName || typeof chainName !== 'string') {
      return NextResponse.json(
        { error: 'Chain name is required' },
        { status: 400 }
      );
    }

    if (!extractionType || typeof extractionType !== 'string') {
      return NextResponse.json(
        { error: 'Extraction type is required. Choose one of: kindera, responsive, test, custom' },
        { status: 400 }
      );
    }

    // Validate extraction type
    const validExtractionTypes = ['kindera', 'responsive', 'test', 'custom'];
    if (!validExtractionTypes.includes(extractionType)) {
      return NextResponse.json(
        { error: `Invalid extraction type. Must be one of: ${validExtractionTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // If custom, require extractionConfig
    if (extractionType === 'custom') {
      if (!extractionConfig || typeof extractionConfig !== 'object') {
        return NextResponse.json(
          { error: 'Extraction configuration is required for custom strategies' },
          { status: 400 }
        );
      }
    }

    const sanitizedName = chainName.trim().toLowerCase().replace(/\s+/g, '_');

    // Check if chain already exists
    const chainRef = adminDb.ref(`/chains/${sanitizedName}`);
    const snapshot = await chainRef.once('value');
    
    if (snapshot.exists()) {
      return NextResponse.json(
        { error: 'Chain already exists' },
        { status: 409 }
      );
    }

    // Create chain structure
    const chainData: {
      name: string;
      homes: string[];
      extractionType: string;
      createdAt: string;
      extractionConfig?: unknown;
    } = {
      name: chainName,
      homes: [],
      extractionType: extractionType,
      createdAt: new Date().toISOString()
    };

    // Add custom config if provided
    if (extractionType === 'custom' && extractionConfig) {
      chainData.extractionConfig = extractionConfig;
    }

    await chainRef.set(chainData);

    console.log(`✅ Created chain: ${chainName} (${sanitizedName}) with extraction type: ${extractionType}`);
    if (extractionType === 'custom') {
      console.log(`📋 Custom config: ${JSON.stringify(extractionConfig, null, 2)}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Chain created successfully',
      chainId: sanitizedName,
      chainName: chainName,
      extractionType: extractionType,
      hasCustomConfig: extractionType === 'custom'
    });

  } catch (error) {
    console.error('Error creating chain:', error);
    return NextResponse.json(
      { error: 'Failed to create chain', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


