import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import * as XLSX from 'xlsx';

// Helper function to convert display name to camelCase for Firebase ID
function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .map((word, index) => {
      if (index === 0) {
        return word.charAt(0).toLowerCase() + word.slice(1).toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

interface ImportUser {
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'homeUser' | 'chainAdmin';
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
    }) as Record<string, unknown>[];

    console.log('Parsed Excel data rows:', data.length);
    if (data.length > 0) {
      console.log('Sample row:', data[0]);
      console.log('Sample row keys:', Object.keys(data[0]));
    }

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Excel file is empty or has no data rows' },
        { status: 400 }
      );
    }

    // Helper function to normalize names for flexible matching
    const normalizeName = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
        .trim();
    };

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
    const allHomeNames: string[] = []; // For error messages
    
    for (const key in homesData) {
      if (key === 'users' || key === 'reviews' || key === 'chains' || key === 'homeMappings') {
        continue;
      }
      const homeData = homesData[key];
      if (homeData && typeof homeData === 'object' && 'behaviours' in homeData) {
        const displayName = homeData.mapping?.displayName || key;
        const normalizedDisplay = normalizeName(displayName);
        const normalizedKey = normalizeName(key);
        
        // Store multiple variations for flexible lookup
        homeMap.set(displayName.toLowerCase(), key);
        homeMap.set(displayName, key);
        homeMap.set(normalizedDisplay, key);
        homeMap.set(key.toLowerCase(), key);
        homeMap.set(key, key);
        homeMap.set(normalizedKey, key);
        
        // Also handle common variations
        // Remove common suffixes like "Care Centre", "Care", "Place", etc.
        const displayWithoutSuffix = displayName
          .replace(/\s+(Care Centre|Care|Place|Gardens?|Centre|Center)$/i, '')
          .trim();
        if (displayWithoutSuffix && displayWithoutSuffix !== displayName) {
          homeMap.set(displayWithoutSuffix.toLowerCase(), key);
          homeMap.set(displayWithoutSuffix, key);
          homeMap.set(normalizeName(displayWithoutSuffix), key);
        }
        
        allHomeNames.push(`${displayName} (ID: ${key})`);
      }
    }

    // Validate and parse rows
    const usersToImport: ImportUser[] = [];
    const errors: string[] = [];

    // Debug: Log first row to see what columns we're getting
    if (data.length > 0) {
      console.log('First row columns:', Object.keys(data[0]));
      console.log('First row data:', data[0]);
    }

    // Process rows sequentially to allow async home creation
    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      const rowNumber = index + 2; // +2 because Excel rows are 1-indexed and we skip header
      
      // Normalize column names (case-insensitive, trim whitespace)
      const normalizedRow: Record<string, string> = {};
      Object.keys(row).forEach(key => {
        normalizedRow[key.trim().toLowerCase()] = String(row[key] || '').trim();
      });
      
      // Debug: Log normalized columns for first row
      if (index === 0) {
        console.log('Normalized columns:', Object.keys(normalizedRow));
        console.log('Normalized row data:', normalizedRow);
      }

      const username = normalizedRow['username'] || normalizedRow['user name'] || '';
      const email = normalizedRow['email'] || '';
      const password = normalizedRow['password'] || '';
      const role = (normalizedRow['role'] || '').toLowerCase();
      const chainIdOrName = normalizedRow['chainid'] || normalizedRow['chain id'] || normalizedRow['chain'] || normalizedRow['chainname'] || normalizedRow['chain name'] || '';
      const homeIdOrName = normalizedRow['homeid'] || normalizedRow['home id'] || normalizedRow['home'] || normalizedRow['homename'] || normalizedRow['home name'] || '';

      // Validation
      if (!username) {
        errors.push(`Row ${rowNumber}: Username is required`);
        continue;
      }

      if (!email) {
        errors.push(`Row ${rowNumber}: Email is required`);
        continue;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(`Row ${rowNumber}: Invalid email format: ${email}`);
        continue;
      }

      if (!password) {
        errors.push(`Row ${rowNumber}: Password is required`);
        continue;
      }

      if (password.length < 6) {
        errors.push(`Row ${rowNumber}: Password must be at least 6 characters`);
        continue;
      }

      if (!role || (role !== 'admin' && role !== 'homeuser' && role !== 'chainadmin')) {
        errors.push(`Row ${rowNumber}: Role must be "admin", "chainAdmin", or "homeUser" (found: ${role})`);
        continue;
      }

      const finalRole = role === 'admin' ? 'admin' : role === 'chainadmin' ? 'chainAdmin' : 'homeUser';

      // For chainAdmin, require chain
      if (finalRole === 'chainAdmin') {
        if (!chainIdOrName) {
          errors.push(`Row ${rowNumber}: Chain ID or Chain Name is required for chainAdmin role`);
          continue;
        }

        // Resolve chain ID with flexible matching
        const chainId = chainIdMap.get(chainIdOrName) || 
                     chainMap.get(chainIdOrName) || 
                     chainMap.get(chainIdOrName.toLowerCase());
        
        if (!chainId) {
          const availableChains = Array.from(new Set([...chainIdMap.keys(), ...Array.from(chainMap.values())]))
            .map(id => {
              const chain = chainsData[id];
              return chain?.name || id;
            })
            .join(', ');
          errors.push(`Row ${rowNumber}: Chain not found: "${chainIdOrName}". Available chains: ${availableChains}`);
          continue;
        }

        usersToImport.push({
          username,
          email,
          password,
          role: finalRole,
          chainId,
          rowNumber,
        });
        continue;
      }

      // For homeUser, require chain and home
      if (finalRole === 'homeUser') {
        if (!chainIdOrName) {
          errors.push(`Row ${rowNumber}: Chain ID or Chain Name is required for homeUser role`);
          continue;
        }

        if (!homeIdOrName) {
          errors.push(`Row ${rowNumber}: Home ID or Home Name is required for homeUser role`);
          continue;
        }

        // Resolve chain ID with flexible matching
        const chainId = chainIdMap.get(chainIdOrName) || 
                     chainMap.get(chainIdOrName) || 
                     chainMap.get(chainIdOrName.toLowerCase());
        
        if (!chainId) {
          const availableChains = Array.from(new Set([...chainIdMap.keys(), ...Array.from(chainMap.values())]))
            .map(id => {
              const chain = chainsData[id];
              return chain?.name || id;
            })
            .join(', ');
          errors.push(`Row ${rowNumber}: Chain not found: "${chainIdOrName}". Available chains: ${availableChains}`);
          continue;
        }

        // Resolve or create home ID with flexible matching
        const normalizedHomeInput = normalizeName(homeIdOrName);
        let homeId = homeMap.get(homeIdOrName) || 
                    homeMap.get(homeIdOrName.toLowerCase()) ||
                    homeMap.get(normalizedHomeInput);
        
        // Try partial/fuzzy matching if exact match fails
        if (!homeId) {
          // Also try matching after removing common suffixes
          const homeWithoutSuffix = homeIdOrName
            .replace(/\s+(Care Centre|Care|Place|Gardens?|Centre|Center)$/i, '')
            .trim();
          if (homeWithoutSuffix && homeWithoutSuffix !== homeIdOrName) {
            homeId = homeMap.get(homeWithoutSuffix) || 
                    homeMap.get(homeWithoutSuffix.toLowerCase()) ||
                    homeMap.get(normalizeName(homeWithoutSuffix));
          }
          
          // Try fuzzy matching by comparing normalized names
          if (!homeId) {
            for (const [mapKey, mapValue] of homeMap.entries()) {
              const normalizedMapKey = normalizeName(mapKey);
              // Check if one contains the other (for partial matches like "millcreek" vs "millcreekcare")
              if (normalizedMapKey === normalizedHomeInput || 
                  normalizedMapKey.includes(normalizedHomeInput) ||
                  normalizedHomeInput.includes(normalizedMapKey)) {
                // Make sure it's a reasonable match (at least 50% overlap)
                const minLength = Math.min(normalizedMapKey.length, normalizedHomeInput.length);
                const maxLength = Math.max(normalizedMapKey.length, normalizedHomeInput.length);
                if (minLength >= 3 && (minLength / maxLength) >= 0.5) {
                  homeId = mapValue;
                  break;
                }
              }
            }
          }
        }
        
        // If home doesn't exist, create it
        if (!homeId) {
          // Check if a home with the same sanitized name already exists
          const sanitizedName = homeIdOrName.trim().toLowerCase().replace(/\s+/g, '_');
          const existingHomeRef = adminDb.ref(`/${sanitizedName}`);
          const existingHomeSnapshot = await existingHomeRef.once('value');
          
          if (existingHomeSnapshot.exists()) {
            // Home exists with this ID but wasn't in our map, use it
            const existingHomeData = existingHomeSnapshot.val();
            if (existingHomeData.chainId === chainId) {
              homeId = sanitizedName;
              // Update our maps for future lookups
              homeMap.set(homeIdOrName.toLowerCase(), homeId);
              homeMap.set(homeIdOrName, homeId);
              homesData[homeId] = existingHomeData;
            } else {
              errors.push(`Row ${rowNumber}: A home with similar name exists but belongs to a different chain`);
              continue;
            }
          } else {
            // Create new home
            const displayName = homeIdOrName.trim();
            const firebaseId = toCamelCase(displayName);
            
            await existingHomeRef.set({
              behaviours: {
                createdAt: new Date().toISOString()
              },
              chainId: chainId,
              createdAt: new Date().toISOString(),
              mapping: {
                firebaseId: firebaseId,
                homeName: sanitizedName,
                displayName: displayName
              }
            });
            
            // Update chain's homes list
            const chainRef = adminDb.ref(`/chains/${chainId}`);
            const chainSnapshot = await chainRef.once('value');
            if (chainSnapshot.exists()) {
              const chainData = chainSnapshot.val();
              const homes = chainData.homes || [];
              if (!homes.includes(sanitizedName)) {
                homes.push(sanitizedName);
                await chainRef.update({ homes });
              }
            }
            
            // Update homeMappings
            const mappingsRef = adminDb.ref('/homeMappings');
            const mappingsSnapshot = await mappingsRef.once('value');
            const existingMappings = mappingsSnapshot.exists() ? mappingsSnapshot.val() : {};
            await mappingsRef.set({
              ...existingMappings,
              [sanitizedName]: {
                firebaseId: firebaseId,
                homeName: sanitizedName,
                displayName: displayName
              },
              [firebaseId]: {
                firebaseId: firebaseId,
                homeName: sanitizedName,
                displayName: displayName
              }
            });
            
            homeId = sanitizedName;
            console.log(`✅ Created new home: ${displayName} (${sanitizedName}) in chain ${chainId}`);
            
            // Update our maps for future lookups in this batch
            homeMap.set(displayName.toLowerCase(), homeId);
            homeMap.set(displayName, homeId);
            homeMap.set(homeIdOrName.toLowerCase(), homeId);
            homeMap.set(homeIdOrName, homeId);
            homesData[homeId] = {
              behaviours: { createdAt: new Date().toISOString() },
              chainId: chainId,
              mapping: { displayName, homeName: sanitizedName, firebaseId }
            };
          }
        } else {
          // Verify existing home belongs to chain
          const homeData = homesData[homeId];
          if (homeData?.chainId !== chainId) {
            errors.push(`Row ${rowNumber}: Home "${homeIdOrName}" exists but belongs to a different chain`);
            continue;
          }
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
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      console.error('Bulk import validation errors:', errors);
      return NextResponse.json({
        success: false,
        error: 'Validation errors found',
        errors,
        validatedRows: usersToImport.length,
        totalRows: data.length,
      }, { status: 400 });
    }

    // Import users
    const auth = getAuth(adminDb.app);
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
        } catch (error: unknown) {
          // User doesn't exist, continue
          if (error instanceof Error && error.message !== 'User not found') {
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
        const userData: Record<string, unknown> = {
          username: user.username,
          role: user.role,
          loginCount: 0,
          createdAt: new Date().toISOString(),
        };

        if (user.role === 'homeUser') {
          userData.homeId = user.homeId;
          userData.chainId = user.chainId;
        }

        if (user.role === 'chainAdmin') {
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
      } catch (error: unknown) {
        results.push({
          rowNumber: user.rowNumber,
          username: user.username,
          email: user.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack, error });
    
    // Return 400 if it's a validation/parsing error, 500 for server errors
    const statusCode = errorMessage.includes('required') || 
                      errorMessage.includes('invalid') || 
                      errorMessage.includes('not found') 
                      ? 400 : 500;
    
    return NextResponse.json(
      { 
        error: 'Failed to process bulk import', 
        details: errorMessage,
        ...(process.env.NODE_ENV === 'development' && errorStack ? { stack: errorStack } : {})
      },
      { status: statusCode }
    );
  }
}

