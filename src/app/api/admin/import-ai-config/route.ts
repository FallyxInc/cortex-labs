import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  convertAIOutputToChainConfig,
  convertChainConfigToExtractionConfig,
  validateChainConfig,
  AIOutputFormat,
  ChainConfig
} from '@/lib/chainConfig';

export async function POST(request: NextRequest) {
  try {
    const aiOutput: AIOutputFormat = await request.json();

    // Validate required fields
    if (!aiOutput.chainId || !aiOutput.chainName) {
      return NextResponse.json(
        { error: 'Chain ID and name are required' },
        { status: 400 }
      );
    }

    // Convert AI output to chain config format
    const chainConfig = convertAIOutputToChainConfig(aiOutput);

    // Validate the converted config
    const validationErrors = validateChainConfig(chainConfig);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          errors: validationErrors,
          details: 'Please check the configuration and ensure all required fields are present'
        },
        { status: 400 }
      );
    }

    // Save to Firebase
    const configRef = adminDb.ref(`/chains/${chainConfig.chainId}/config`);
    const snapshot = await configRef.once('value');
    const exists = snapshot.exists();

    const now = new Date().toISOString();
    const existingConfig = (snapshot.val() as Partial<ChainConfig> | null) || null;
    const configData: ChainConfig & { createdAt: string; updatedAt: string; source: string } = {
      ...chainConfig,
      createdAt: exists ? existingConfig?.createdAt || now : now,
      updatedAt: now,
      source: 'ai-import'
    };

    if (exists) {
      await configRef.update(configData);
    } else {
      await configRef.set(configData);
    }

    // Convert to extraction config for immediate use
    const extractionConfig = convertChainConfigToExtractionConfig(chainConfig);

    return NextResponse.json({
      success: true,
      chainId: chainConfig.chainId,
      message: exists ? 'Configuration updated successfully' : 'Configuration imported successfully',
      config: {
        chain: chainConfig,
        extraction: extractionConfig
      }
    });
  } catch (error) {
    console.error('Error importing AI config:', error);
    return NextResponse.json(
      {
        error: 'Failed to import configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

