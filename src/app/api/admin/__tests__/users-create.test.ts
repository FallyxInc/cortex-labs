/**
 * Tests for User Creation API
 * 
 * These tests verify:
 * - Admin user creation (no home/chain required)
 * - HomeUser creation with existing chain/home
 * - HomeUser creation with new chain
 * - HomeUser creation with new home in existing chain
 * - Validation of required fields
 * - Role validation (only admin and homeUser allowed)
 */

import { NextRequest } from 'next/server';

// Mock Firebase Admin and Auth
const mockCreateUser = jest.fn();
const mockGetUser = jest.fn();

const pathToData = new Map<string, any>();

jest.mock('@/lib/firebase/firebaseAdmin', () => {
  const mockRef = jest.fn((refPath: string) => {
    // Capture path in closure
    const path = refPath;
    return {
      once: jest.fn(() => {
        const data = pathToData.get(path);
        return Promise.resolve({
          exists: jest.fn(() => data !== undefined),
          val: jest.fn(() => data || null)
        });
      }),
      set: jest.fn((value: any) => {
        pathToData.set(path, value);
        return Promise.resolve();
      }),
      update: jest.fn((updates: any) => {
        const existing = pathToData.get(path) || {};
        pathToData.set(path, { ...existing, ...updates });
        return Promise.resolve();
      })
    };
  });
  
  return {
    adminDb: {
      ref: mockRef
    }
  };
});

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    createUser: mockCreateUser,
    getUser: mockGetUser
  }))
}));

// Import after mocks
import { POST } from '../users/create/route';

describe('User Creation API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pathToData.clear();
    mockCreateUser.mockResolvedValue({ uid: 'test-uid-123' });
  });

  describe('Admin User Creation', () => {
    it('should create admin user without home/chain', async () => {
      const request = new NextRequest('http://localhost/api/admin/users/create', {
        method: 'POST',
        body: JSON.stringify({
          username: 'admin_user',
          email: 'admin@test.com',
          password: 'password123',
          role: 'admin'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('admin');
      expect(data.user.homeId).toBeUndefined();
      expect(data.user.chainId).toBeUndefined();
    });
  });

  describe('HomeUser Creation', () => {
    it('should create homeUser with existing chain and home', async () => {
      // Pre-populate existing chain and home
      pathToData.set('/chains/existing_chain', { name: 'Existing Chain', homes: ['existing_home'] });
      pathToData.set('/existing_home', { behaviours: {}, chainId: 'existing_chain' });

      const request = new NextRequest('http://localhost/api/admin/users/create', {
        method: 'POST',
        body: JSON.stringify({
          username: 'home_user',
          email: 'homeuser@test.com',
          password: 'password123',
          role: 'homeUser',
          chainId: 'existing_chain',
          homeId: 'existing_home',
          createNewChain: false,
          createNewHome: false
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('homeUser');
      expect(data.user.homeId).toBe('existing_home');
      expect(data.user.chainId).toBe('existing_chain');
    });

    it('should create homeUser with new home in new chain', async () => {
      // Pre-populate the chain (chain must exist to create home in it)
      pathToData.set('/chains/new_chain', { name: 'New Chain', homes: [] });

      const request = new NextRequest('http://localhost/api/admin/users/create', {
        method: 'POST',
        body: JSON.stringify({
          username: 'new_chain_user',
          email: 'newchain@test.com',
          password: 'password123',
          role: 'homeUser',
          chainId: 'new_chain',
          createNewHome: true,
          newHomeName: 'New Home'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.role).toBe('homeUser');
      expect(data.user.homeId).toBe('new_home');
      expect(data.user.chainId).toBe('new_chain');
    });

    it('should create homeUser with new home in existing chain', async () => {
      // Pre-populate the existing chain
      pathToData.set('/chains/existing_chain', { name: 'Existing Chain', homes: [] });

      const request = new NextRequest('http://localhost/api/admin/users/create', {
        method: 'POST',
        body: JSON.stringify({
          username: 'new_home_user',
          email: 'newhome@test.com',
          password: 'password123',
          role: 'homeUser',
          chainId: 'existing_chain',
          createNewHome: true,
          newHomeName: 'New Home'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user.homeId).toBe('new_home');
      expect(data.user.chainId).toBe('existing_chain');
    });

    it('should reject homeUser without chain', async () => {
      const request = new NextRequest('http://localhost/api/admin/users/create', {
        method: 'POST',
        body: JSON.stringify({
          username: 'invalid_user',
          email: 'invalid@test.com',
          password: 'password123',
          role: 'homeUser'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Chain ID is required');
    });

    it('should reject invalid role', async () => {
      const request = new NextRequest('http://localhost/api/admin/users/create', {
        method: 'POST',
        body: JSON.stringify({
          username: 'test_user',
          email: 'test@test.com',
          password: 'password123',
          role: 'test'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('must be either "admin", "homeUser", or "chainAdmin"');
    });

    it('should reject weak password', async () => {
      const request = new NextRequest('http://localhost/api/admin/users/create', {
        method: 'POST',
        body: JSON.stringify({
          username: 'test_user',
          email: 'weak@test.com',
          password: '12345',
          role: 'admin'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('at least 6 characters');
    });
  });
});
