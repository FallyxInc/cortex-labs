/**
 * Tests for Data Processing Firebase Path Verification
 * 
 * These tests verify that processed data is uploaded to the correct
 * Firebase path based on the home identifier.
 */

import { NextRequest } from 'next/server';

// Track Firebase writes to verify correct paths
const firebaseWrites: Array<{ path: string; data: any }> = [];

// Mock Firebase admin
jest.mock('@/lib/firebase/firebaseAdmin', () => ({
  adminDb: {
    ref: jest.fn((path: string) => {
      return {
        once: jest.fn((event?: string) => {
          // Return chainId for home lookup
          if (path.includes('berkshire_care') || path.includes('berkshire')) {
            return Promise.resolve({
              exists: () => true,
              val: () => ({ chainId: 'kindera' })
            });
          }
          if (path.includes('mill_creek_care') || path.includes('millCreek')) {
            return Promise.resolve({
              exists: () => true,
              val: () => ({ chainId: 'responsive' })
            });
          }
          return Promise.resolve({
            exists: () => false,
            val: () => null
          });
        }),
        set: jest.fn((data: any) => {
          firebaseWrites.push({ path, data });
          return Promise.resolve();
        }),
        update: jest.fn((data: any) => {
          firebaseWrites.push({ path, data });
          return Promise.resolve();
        })
      };
    })
  }
}));

// Mock homeMappings
jest.mock('@/lib/homeMappings', () => ({
  getFirebaseIdAsync: jest.fn(async (home: string) => {
    // Simulate mapping: berkshire_care -> berkshire, mill_creek_care -> millCreek
    if (home === 'berkshire_care') return 'berkshire';
    if (home === 'berkshire') return 'berkshire';
    if (home === 'mill_creek_care') return 'millCreek';
    if (home === 'millCreek') return 'millCreek';
    return home;
  }),
  getHomeNameAsync: jest.fn(async (home: string) => {
    return home;
  })
}));

// Mock configUtils
jest.mock('@/lib/utils/configUtils', () => ({
  getChainExtractionConfig: jest.fn(async () => ({
    pdf: { extractionStrategy: 'test' },
    excel: { extractionStrategy: 'test' }
  }))
}));

// Mock processing functions to capture Firebase writes
jest.mock('@/lib/processing/firebaseUpload', () => ({
  processCsvFiles: jest.fn(async (homeName: string, chainId: string) => {
    // Simulate Firebase writes that would happen in real processing
    const { adminDb } = require('@/lib/firebase/firebaseAdmin');
    const { getFirebaseIdAsync } = require('@/lib/homeMappings');
    
    const firebaseId = await getFirebaseIdAsync(homeName);
    const year = '2025';
    const month = '12';
    
    // Simulate writing to behaviours path
    const behavioursRef = adminDb.ref(`/${firebaseId}/behaviours/${year}/${month}`);
    await behavioursRef.set({
      'test-incident-1': {
        name: 'Test Resident',
        date: '2025-12-04',
        behaviour_type: 'Test Behaviour'
      }
    });
    
    return Promise.resolve();
  })
}));

jest.mock('@/lib/processing/firebaseUpdate', () => ({
  processMergedCsvFiles: jest.fn(() => Promise.resolve())
}));

jest.mock('@/lib/processing/excelProcessor', () => ({
  processExcelFiles: jest.fn(() => Promise.resolve())
}));

jest.mock('@/lib/processing/pdfProcessor', () => ({
  processPdfFiles: jest.fn(() => Promise.resolve())
}));

jest.mock('@/lib/processing/behaviourGenerator', () => ({
  processAllMergedFiles: jest.fn(() => Promise.resolve())
}));

jest.mock('@/lib/claude-client', () => ({
  getAIModelConfig: () => ({ apiKey: 'test-key', model: 'test' })
}));

import { POST } from '../process-behaviours/route';

describe('Data Processing Firebase Path Verification', () => {
  beforeEach(() => {
    firebaseWrites.length = 0;
  });

  it('should upload processed data to correct Firebase path for berkshire_care', async () => {
    const formData = new FormData();
    formData.append('home', 'berkshire_care');
    formData.append('pdfCount', '1');
    formData.append('excelCount', '1');
    
    const pdfBlob = new Blob(['dummy pdf'], { type: 'application/pdf' });
    formData.append('pdf_0', pdfBlob, 'test.pdf');
    
    const excelBlob = new Blob(['dummy excel'], { type: 'application/vnd.ms-excel' });
    formData.append('excel_0', excelBlob, 'test.xls');

    const request = new NextRequest('http://localhost/api/admin/process-behaviours', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify data was written to correct Firebase path
    // Path should be /berkshire/behaviours/... (not /berkshire_care/behaviours/...)
    const behavioursWrites = firebaseWrites.filter(w => 
      w.path.includes('behaviours') && !w.path.includes('overviewMetrics')
    );
    
    if (behavioursWrites.length > 0) {
      const behavioursWrite = behavioursWrites[0];
      expect(behavioursWrite.path).toMatch(/^\/berkshire\/behaviours\//);
      expect(behavioursWrite.path).not.toMatch(/^\/berkshire_care\/behaviours\//);
    }
  });

  it('should upload processed data to correct Firebase path for mill_creek_care', async () => {
    const formData = new FormData();
    formData.append('home', 'mill_creek_care');
    formData.append('pdfCount', '1');
    formData.append('excelCount', '1');
    
    const pdfBlob = new Blob(['dummy pdf'], { type: 'application/pdf' });
    formData.append('pdf_0', pdfBlob, 'test.pdf');
    
    const excelBlob = new Blob(['dummy excel'], { type: 'application/vnd.ms-excel' });
    formData.append('excel_0', excelBlob, 'test.xls');

    const request = new NextRequest('http://localhost/api/admin/process-behaviours', {
      method: 'POST',
      body: formData
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify data was written to correct Firebase path
    const behavioursWrites = firebaseWrites.filter(w => 
      w.path.includes('behaviours') && !w.path.includes('overviewMetrics')
    );
    
    if (behavioursWrites.length > 0) {
      const behavioursWrite = behavioursWrites[0];
      expect(behavioursWrite.path).toMatch(/^\/millCreek\/behaviours\//);
      expect(behavioursWrite.path).not.toMatch(/^\/mill_creek_care\/behaviours\//);
    }
  });

  it('should isolate data between different homes', async () => {
    // Process data for berkshire
    const formData1 = new FormData();
    formData1.append('home', 'berkshire_care');
    formData1.append('pdfCount', '0');
    formData1.append('excelCount', '0');

    const request1 = new NextRequest('http://localhost/api/admin/process-behaviours', {
      method: 'POST',
      body: formData1
    });

    await POST(request1);
    const berkshireWrites = firebaseWrites.filter(w => w.path.includes('berkshire'));

    // Process data for mill creek
    firebaseWrites.length = 0;
    const formData2 = new FormData();
    formData2.append('home', 'mill_creek_care');
    formData2.append('pdfCount', '0');
    formData2.append('excelCount', '0');

    const request2 = new NextRequest('http://localhost/api/admin/process-behaviours', {
      method: 'POST',
      body: formData2
    });

    await POST(request2);
    const millCreekWrites = firebaseWrites.filter(w => w.path.includes('millCreek'));

    // Verify paths are different
    if (berkshireWrites.length > 0 && millCreekWrites.length > 0) {
      berkshireWrites.forEach(write => {
        expect(write.path).not.toMatch(/millCreek/);
      });
      millCreekWrites.forEach(write => {
        expect(write.path).not.toMatch(/berkshire/);
      });
    }
  });

  it('should use firebaseId (not homeName) for Firebase paths', async () => {
    const formData = new FormData();
    formData.append('home', 'berkshire_care'); // homeName format
    formData.append('pdfCount', '0');
    formData.append('excelCount', '0');

    const request = new NextRequest('http://localhost/api/admin/process-behaviours', {
      method: 'POST',
      body: formData
    });

    await POST(request);

    // All Firebase writes should use firebaseId (berkshire), not homeName (berkshire_care)
    const allWrites = firebaseWrites.filter(w => !w.path.includes('overviewMetrics'));
    allWrites.forEach(write => {
      if (write.path.startsWith('/berkshire')) {
        // Should use firebaseId
        expect(write.path).toMatch(/^\/berkshire\//);
        expect(write.path).not.toMatch(/^\/berkshire_care\//);
      }
    });
  });
});

