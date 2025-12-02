import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase-admin';
import * as XLSX from 'xlsx';

interface ImportUser {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'homeUser';
  chainId?: string;
  homeId?: string;
  chainName?: string;
  homeName?: string;
  rowNumber: number;
}

interface ImportResult {
  rowNumber: number;
  username: string;
  email: string;
  success: boolean;
  userId?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const excelFile = formData.get('file') as File | null;

    if (!excelFile) {
      return NextResponse.json(
        { error: 'Excel file is required' },
        { status: 400 }
      );
    }

    const isExcel = excelFile.type === 'application/vnd.ms-excel' || 
                   excelFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                   excelFile.name.toLowerCase().endsWith('.xls') ||
                   excelFile.name.toLowerCase().endsWith('.xlsx');

    if (!isExcel) {
      return NextResponse.json(
        { error: 'File must be an XLS or XLSX file' },
        { status: 400 }
      );
    }

    // Parse Excel file
    const bytes = await excelFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Read the first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON (first row should be headers)
    const data = XLSX.utils.sheet_to_json(sheet, {
      defval: '',
      raw: false,
    }) as Record<string, any>[];

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Excel file is empty or has no data rows' },
        { status: 400 }
      );
    }

    // Get all chains and homes for name-to-ID mapping
    const chainsRef = adminDb.ref('/chains');
    const chainsSnapshot = await chainsRef.once('value');
    const chainsData = chainsSnapshot.exists() ? chainsSnapshot.val() : {};
    const chainMap = new Map<string, string>(); // name -> id
    const chainIdMap = new Map<string, string>(); // id -> id (for direct ID lookup)
    Object.keys(chainsData).forEach(chainId => {
      const chain = chainsData[chainId];
      if (chain.name) {
        chainMap.set(chain.name.toLowerCase(), chainId);
        chainMap.set(chain.name, chainId);
      }
      chainIdMap.set(chainId, chainId);
    });

    const homesRef = adminDb.ref('/');
    const homesSnapshot = await homesRef.once('value');
    const homesData = homesSnapshot.exists() ? homesSnapshot.val() : {};
    const homeMap = new Map<string, string>(); // name/id -> id
    for (const key in homesData) {
      if (key === 'users' || key === 'reviews' || key === 'chains' || key === 'homeMappings') {
        continue;
      }
      const homeData = homesData[key];
      if (homeData && typeof homeData === 'object' && 'behaviours' in homeData) {
        const displayName = homeData.mapping?.displayName || key;
        homeMap.set(displayName.toLowerCase(), key);
        homeMap.set(displayName, key);
        homeMap.set(key.toLowerCase(), key);
        homeMap.set(key, key);
      }
    }

    // Validate and parse rows
    const usersToImport: ImportUser[] = [];
    const errors: string[] = [];

    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because Excel rows are 1-indexed and we skip header
      
      // Normalize column names (case-insensitive, trim whitespace)
      const normalizedRow: Record<string, string> = {};
      Object.keys(row).forEach(key => {
        normalizedRow[key.trim().toLowerCase()] = String(row[key] || '').trim();
      });

      const username = normalizedRow['username'] || normalizedRow['user name'] || '';
      const email = normalizedRow['email'] || '';
      const password = normalizedRow['password'] || '';
      const role = (normalizedRow['role'] || '').toLowerCase();
      const chainIdOrName = normalizedRow['chainid'] || normalizedRow['chain id'] || normalizedRow['chain'] || normalizedRow['chainname'] || normalizedRow['chain name'] || '';
      const homeIdOrName = normalizedRow['homeid'] || normalizedRow['home id'] || normalizedRow['home'] || normalizedRow['homename'] || normalizedRow['home name'] || '';

      // Validation
      if (!username) {
        errors.push(`Row ${rowNumber}: Username is required`);
        return;
      }

      if (!email) {
        errors.push(`Row ${rowNumber}: Email is required`);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(`Row ${rowNumber}: Invalid email format: ${email}`);
        return;
      }

      if (!password) {
        errors.push(`Row ${rowNumber}: Password is required`);
        return;
      }

      if (password.length < 6) {
        errors.push(`Row ${rowNumber}: Password must be at least 6 characters`);
        return;
      }

      if (!role || (role !== 'admin' && role !== 'homeuser')) {
        errors.push(`Row ${rowNumber}: Role must be "admin" or "homeUser" (found: ${role})`);
        return;
      }

      const finalRole = role === 'admin' ? 'admin' : 'homeUser';

      // For homeUser, require chain and home
      if (finalRole === 'homeUser') {
        if (!chainIdOrName) {
          errors.push(`Row ${rowNumber}: Chain ID or Chain Name is required for homeUser role`);
          return;
        }

        if (!homeIdOrName) {
          errors.push(`Row ${rowNumber}: Home ID or Home Name is required for homeUser role`);
          return;
        }

        // Resolve chain ID
        const chainId = chainIdMap.get(chainIdOrName) || chainMap.get(chainIdOrName.toLowerCase());
        if (!chainId) {
          errors.push(`Row ${rowNumber}: Chain not found: ${chainIdOrName}`);
          return;
        }

        // Resolve home ID
        const homeId = homeMap.get(homeIdOrName) || homeMap.get(homeIdOrName.toLowerCase());
        if (!homeId) {
          errors.push(`Row ${rowNumber}: Home not found: ${homeIdOrName}`);
          return;
        }

        // Verify home belongs to chain
        const homeData = homesData[homeId];
        if (homeData?.chainId !== chainId) {
          errors.push(`Row ${rowNumber}: Home "${homeIdOrName}" does not belong to chain "${chainIdOrName}"`);
          return;
        }

        usersToImport.push({
          username,
          email,
          password,
          role: finalRole,
          chainId,
          homeId,
          rowNumber,
        });
      } else {
        // Admin users don't need chain/home
        usersToImport.push({
          username,
          email,
          password,
          role: finalRole,
          rowNumber,
        });
      }
    });

    // If there are validation errors, return them
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'Validation errors found',
        errors,
        validatedRows: usersToImport.length,
        totalRows: data.length,
      }, { status: 400 });
    }

    // Import users
    const auth = getAuth();
    const results: ImportResult[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const user of usersToImport) {
      try {
        // Check if email already exists
        try {
          await auth.getUserByEmail(user.email);
          results.push({
            rowNumber: user.rowNumber,
            username: user.username,
            email: user.email,
            success: false,
            error: 'Email already exists',
          });
          failCount++;
          continue;
        } catch (error: any) {
          // User doesn't exist, continue
          if (error.code !== 'auth/user-not-found') {
            throw error;
          }
        }

        // Create user in Firebase Auth
        const userRecord = await auth.createUser({
          email: user.email,
          password: user.password,
          displayName: user.username,
          emailVerified: false,
        });

        // Create user data in database
        const userData: any = {
          username: user.username,
          role: user.role,
          loginCount: 0,
          createdAt: new Date().toISOString(),
        };

        if (user.role === 'homeUser') {
          userData.homeId = user.homeId;
          userData.chainId = user.chainId;
        }

        const userRef = adminDb.ref(`/users/${userRecord.uid}`);
        await userRef.set(userData);

        results.push({
          rowNumber: user.rowNumber,
          username: user.username,
          email: user.email,
          success: true,
          userId: userRecord.uid,
        });
        successCount++;
      } catch (error: any) {
        results.push({
          rowNumber: user.rowNumber,
          username: user.username,
          email: user.email,
          success: false,
          error: error.message || 'Unknown error',
        });
        failCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import completed: ${successCount} succeeded, ${failCount} failed`,
      results,
      summary: {
        total: usersToImport.length,
        succeeded: successCount,
        failed: failCount,
      },
    });

  } catch (error) {
    console.error('Error during bulk import:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process bulk import', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

