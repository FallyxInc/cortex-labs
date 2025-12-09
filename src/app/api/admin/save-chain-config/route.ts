import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { StoredChainExtractionConfig, ChainExtractionConfig } from '@/lib/processing/types';

/**
 * Validate ChainExtractionConfig
 */
function validateChainConfig(config: ChainExtractionConfig): string[] {
  const errors: string[] = [];

  if (!config.chainId || config.chainId.trim() === '') {
    errors.push('Chain ID is required');
  }

  if (!config.chainName || config.chainName.trim() === '') {
    errors.push('Chain name is required');
  }

  if (!config.behaviourNoteTypes || config.behaviourNoteTypes.length === 0) {
    errors.push('At least one behaviour note type is required');
  }

  // Validate required Excel fields
  const requiredExcelFields = ['incident_number', 'name', 'date', 'time', 'incident_type'];
  for (const field of requiredExcelFields) {
    if (!config.excelFieldMappings?.[field]) {
      errors.push(`Excel field mapping for "${field}" is required`);
    }
  }

  // Validate Excel field mappings have required properties
  if (config.excelFieldMappings) {
    for (const [fieldKey, mapping] of Object.entries(config.excelFieldMappings)) {
      if (!mapping || typeof mapping !== 'object') {
        errors.push(`Excel field mapping for "${fieldKey}" is invalid`);
        continue;
      }
      if (!mapping.excelColumn || (typeof mapping.excelColumn === 'string' && mapping.excelColumn.trim() === '')) {
        errors.push(`Excel field mapping for "${fieldKey}" is missing column name`);
      }
    }
  }

  return errors;
}

export async function POST(request: NextRequest) {
  try {
    const config: StoredChainExtractionConfig = await request.json();

    if (!config.chainId || !config.chainName) {
      return NextResponse.json(
        { error: 'Chain ID and name are required' },
        { status: 400 }
      );
    }

    // Validate the config
    const validationErrors = validateChainConfig(config);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          errors: validationErrors
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Check if chain exists
    const chainRef = adminDb.ref(`/chains/${config.chainId}`);
    const chainSnapshot = await chainRef.once('value');

    // Check if config already exists
    const configRef = adminDb.ref(`/chains/${config.chainId}/config`);
    const configSnapshot = await configRef.once('value');
    const configExists = configSnapshot.exists();

    // Prepare config data with timestamps
    const configData: StoredChainExtractionConfig = {
      ...config,
      createdAt: configExists ? (configSnapshot.val()?.createdAt || now) : now,
      updatedAt: now,
    };

    if (!chainSnapshot.exists()) {
      // Create new chain with config
      await chainRef.set({
        name: config.chainName,
        homes: [],
        extractionType: 'custom',
        createdAt: now,
        config: configData,
      });
    } else {
      // Update existing chain's config
      await configRef.set(configData);
      // Also update chain name if it changed
      await chainRef.update({
        name: config.chainName,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      message: configExists ? 'Configuration updated successfully' : 'Configuration saved successfully',
      chainId: config.chainId,
      chainConfig: configData
    });
  } catch (error) {
    console.error('Error saving chain config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Fetch all chains and return their configs
    const chainsRef = adminDb.ref('/chains');
    const snapshot = await chainsRef.once('value');

    if (!snapshot.exists()) {
      return NextResponse.json({
        success: true,
        configs: []
      });
    }

    const chainsData = snapshot.val();
    const configs: StoredChainExtractionConfig[] = [];

    for (const chainId of Object.keys(chainsData)) {
      const chainData = chainsData[chainId];
      if (chainData.config) {
        configs.push({
          ...chainData.config,
          chainId,
          chainName: chainData.config.chainName || chainData.name || chainId,
        });
      }
    }

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
    console.error('Error fetching chain configs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configurations' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get('chainId');

    if (!chainId) {
      return NextResponse.json(
        { error: 'Chain ID is required' },
        { status: 400 }
      );
    }

    // Remove the config from the chain (but keep the chain)
    const configRef = adminDb.ref(`/chains/${chainId}/config`);
    await configRef.remove();

    return NextResponse.json({
      success: true,
      message: 'Configuration deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting chain config:', error);
    return NextResponse.json(
      { error: 'Failed to delete configuration' },
      { status: 500 }
    );
  }
}
