# Migration Summary: Chain-Based Home Management

## Overview

This document summarizes the migration from per-home extraction logic to a chain-based system.

## Changes Completed

### 1. Backend API Changes ✅

#### Chain Management API (`/api/admin/chains`)
- **GET** - Retrieve all chains
- **POST** - Create new chain
- Chains stored in Firebase at `/chains/{chainId}`

#### Updated Home API (`/api/admin/homes`)
- **GET** - Returns homes with chainId property
- **POST** - Now requires chainId when creating homes
- Homes automatically added to chain's homes list

#### Updated User Creation API (`/api/admin/users/create`)
- Added validation for `admin` and `homeUser` roles only
- Added `homeId` and `chainId` properties for homeUser
- Supports creating new chain (auto-creates home)
- Supports creating new home in existing chain
- Supports selecting existing chain/home

### 2. Frontend Changes ✅

#### UserManagement Component
- Updated to show only `admin` and `homeUser` roles
- Added chain selection (create new or select existing)
- Added home selection (create new or select existing)
- Chain selection filters available homes
- New chain creation automatically creates a new home
- User table displays home and chain columns

#### FileUpload Component
- Updated to work with new home structure (homes now have id/name)

### 3. Python Extraction Logic Structure ✅

#### Chain-Based Organization
- Created `python/chains/` directory structure
- `chains/kindera/` - For Kindera chain (Berkshire Care, Banwell Gardens)
- `chains/responsive/` - For Responsive chain (Mill Creek Care, The O'Neill, Franklin Gardens)
- Shared `chains/homes_db.py` - Central configuration

#### Chain Definitions
- **Kindera Chain:**
  - Homes: Berkshire Care, Banwell Gardens
  - Extraction Type: Berkshire format
  - Follow-up Notes: Supported for Berkshire Care, not for Banwell Gardens

- **Responsive Chain:**
  - Homes: Mill Creek Care, The O'Neill, Franklin Gardens
  - Extraction Type: Millcreek/Oneill format
  - Follow-up Notes: Supported for all homes

### 4. Tests ✅

- Created test files for chain management API
- Created test files for user creation API
- Created testing documentation

## Remaining Work

### Python Script Updates

The extraction scripts in `chains/kindera/` and `chains/responsive/` need to be updated to:

1. **Accept home_id parameter** - Scripts should accept home ID as command-line argument
2. **Use home-specific directories** - Create `downloads/{home_id}/` and `analyzed/{home_id}/` directories
3. **Import from shared homes_db** - Use `from homes_db import ...` from parent directory
4. **Conditional follow-up notes** - Use `supports_follow_up(home_id)` to determine if follow-up CSV should be generated

Example script updates needed:
- `getExcelInfo.py` - Accept home_id, use home-specific paths
- `getPdfInfo.py` - Accept home_id, use home-specific paths
- `getBe.py` - Accept home_id, conditionally generate follow-up CSV
- `update.py` - Accept home_id, use home-specific paths
- `upload_to_dashboard.py` - Accept home_id, use home-specific paths

### Migration Steps

1. **Test the new structure:**
   ```bash
   cd python/chains/kindera
   python3 run_script.py berkshire_care
   ```

2. **Update individual scripts** to accept and use home_id parameter

3. **Update file paths** in scripts to use `downloads/{home_id}/` and `analyzed/{home_id}/`

4. **Test with all homes** in each chain

5. **Deprecate old structure** - Once verified, old per-home folders can be archived

## Database Structure

### Chains
```
/chains
  /kindera
    name: "Kindera"
    homes: ["berkshire_care", "banwell_gardens"]
    createdAt: timestamp
  /responsive
    name: "Responsive"
    homes: ["mill_creek_care", "the_oneill", "franklingardens"]
    createdAt: timestamp
```

### Homes
```
/{home_id}
  behaviours: {...}
  chainId: "kindera" | "responsive"
  createdAt: timestamp
```

### Users
```
/users/{userId}
  role: "admin" | "homeUser"
  homeId: "berkshire_care" (if homeUser)
  chainId: "kindera" (if homeUser)
  loginCount: number
  createdAt: timestamp
```

## Testing Checklist

- [x] Chain API endpoints work
- [x] User creation with chains works
- [x] User creation with new chain works
- [x] User creation with new home works
- [x] UI displays chains and homes correctly
- [ ] Python extraction scripts accept home parameter
- [ ] Python extraction scripts use home-specific directories
- [ ] Python extraction scripts generate correct output
- [ ] End-to-end test: Create user → Upload files → Process → Verify

## Rollback Plan

If issues arise:

1. Old per-home Python structure still exists
2. User creation API can be reverted to previous version
3. Frontend can be reverted to previous UserManagement component
4. Database changes are additive (chains don't break existing homes)

## Notes

- The old per-home Python folders (`python/berkshire/`, `python/millcreek/`, etc.) are still present for reference
- Once the chain-based structure is fully tested, the old folders can be archived
- The shared `chains/homes_db.py` provides a single source of truth for chain/home mappings

