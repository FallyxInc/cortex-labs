/**
 * Tests for Chain Management API
 * 
 * These tests verify:
 * - Chain creation
 * - Chain retrieval
 * - Chain validation
 */

import { NextRequest } from 'next/server';

// Mock Firebase Admin - define mocks inside factory function
const mockOnce = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();

jest.mock('@/lib/firebase/firebaseAdmin', () => {
  const mockRef = jest.fn(() => ({
    once: mockOnce,
    set: mockSet,
    update: mockUpdate
  }));
  
  return {
    adminDb: {
      ref: mockRef
    }
  };
});

// Import after mock
import { GET, POST } from '../chains/route';

describe('Chains API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnce.mockReset();
    mockSet.mockReset();
    mockUpdate.mockReset();
  });

  describe('GET /api/admin/chains', () => {
    it('should return empty array when no chains exist', async () => {
      mockOnce.mockResolvedValue({
        exists: jest.fn(() => false),
        val: jest.fn(() => null)
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.chains)).toBe(true);
      expect(data.chains.length).toBe(0);
    });

    it('should return all chains when they exist', async () => {
      mockOnce.mockResolvedValue({
        exists: jest.fn(() => true),
        val: jest.fn(() => ({
          kindera: { name: 'Kindera', homes: ['berkshire_care', 'banwell_gardens'] },
          responsive: { name: 'Responsive', homes: ['mill_creek_care'] }
        }))
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.chains.length).toBe(2);
      expect(data.chains[0].name).toBe('Kindera');
    });
  });

  describe('POST /api/admin/chains', () => {
    it('should create a new chain', async () => {
      mockOnce.mockResolvedValue({
        exists: jest.fn(() => false),
        val: jest.fn(() => null)
      });

      const request = new NextRequest('http://localhost/api/admin/chains', {
        method: 'POST',
        body: JSON.stringify({ chainName: 'Test Chain', extractionType: 'kindera' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.chainName).toBe('Test Chain');
      expect(data.extractionType).toBe('kindera');
      expect(mockSet).toHaveBeenCalled();
    });

    it('should reject chain creation without name', async () => {
      const request = new NextRequest('http://localhost/api/admin/chains', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Chain name is required');
    });

    it('should reject duplicate chain creation', async () => {
      mockOnce.mockResolvedValue({
        exists: jest.fn(() => true),
        val: jest.fn(() => ({ name: 'Existing Chain' }))
      });

      const request = new NextRequest('http://localhost/api/admin/chains', {
        method: 'POST',
        body: JSON.stringify({ chainName: 'Existing Chain', extractionType: 'kindera' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
    });
  });
});
