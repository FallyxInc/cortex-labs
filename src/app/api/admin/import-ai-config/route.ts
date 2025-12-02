import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
  convertAIOutputToOnboardingConfig,
  convertOnboardingConfigToChainConfig,
  validateOnboardingConfig,
  AIOutputFormat,
  OnboardingConfig
} from '@/lib/processing/onboardingUtils';

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

    // Convert AI output to onboarding config format
    const onboardingConfig = convertAIOutputToOnboardingConfig(aiOutput);

    // Validate the converted config
    const validationErrors = validateOnboardingConfig(onboardingConfig);
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
    const configRef = adminDb.ref(`/onboardingConfigs/${onboardingConfig.chainId}`);
    const snapshot = await configRef.once('value');
    const exists = snapshot.exists();

    const now = new Date().toISOString();
    const configData: OnboardingConfig & { createdAt: string; updatedAt: string; source: string } = {
      ...onboardingConfig,
      createdAt: exists ? (snapshot.val() as any).createdAt || now : now,
      updatedAt: now,
      source: 'ai-import'
    };

    if (exists) {
      await configRef.update(configData);
    } else {
      await configRef.set(configData);
    }

    // Convert to chain config for immediate use
    const chainConfig = convertOnboardingConfigToChainConfig(onboardingConfig);

    return NextResponse.json({
      success: true,
      chainId: onboardingConfig.chainId,
      message: exists ? 'Configuration updated successfully' : 'Configuration imported successfully',
      config: {
        onboarding: onboardingConfig,
        chain: chainConfig
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

