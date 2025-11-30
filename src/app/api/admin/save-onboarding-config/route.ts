import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

interface OnboardingConfig {
  chainId: string;
  chainName: string;
  behaviourNoteTypes: string[];
  followUpNoteTypes: string[];
  noteTypeConfigs: Record<string, {
    name: string;
    isFollowUp: boolean;
    fields: Record<string, {
      fieldName: string;
      endMarkers: string[];
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const config: OnboardingConfig = await request.json();

    if (!config.chainId || !config.chainName) {
      return NextResponse.json(
        { error: 'Chain ID and name are required' },
        { status: 400 }
      );
    }

    // Save to Firebase under /onboardingConfigs/{chainId}
    const configRef = adminDb.ref(`/onboardingConfigs/${config.chainId}`);
    
    const configData = {
      chainId: config.chainId,
      chainName: config.chainName,
      behaviourNoteTypes: config.behaviourNoteTypes,
      followUpNoteTypes: config.followUpNoteTypes,
      noteTypeConfigs: config.noteTypeConfigs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await configRef.set(configData);

    return NextResponse.json({
      success: true,
      message: 'Configuration saved successfully',
      chainId: config.chainId,
    });
  } catch (error) {
    console.error('Error saving onboarding config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const configsRef = adminDb.ref('/onboardingConfigs');
    const snapshot = await configsRef.once('value');
    
    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,
        configs: []
      });
    }

    const configsData = snapshot.val();
    const configs = Object.keys(configsData).map(chainId => ({
      chainId,
      ...configsData[chainId]
    }));

    // Sort by updatedAt descending (most recent first)
    configs.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({
      success: true,
      configs
    });
  } catch (error) {
    console.error('Error fetching onboarding configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configurations' },
      { status: 500 }
    );
  }
}

