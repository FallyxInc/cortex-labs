# Cortex Behaviours - Repository Structure

## High-Level Modules/Features

### Core Application Modules
1. **File Processing Pipeline**
   - PDF extraction and text parsing (`lib/processing/pdfProcessor.ts`)
   - Excel incident extraction (`lib/processing/excelProcessor.ts`)
   - Behaviour data merging (`lib/processing/behaviourGenerator.ts`)
   - Firebase sync and upload (`lib/processing/firebaseUpdate.ts`, `firebaseUpload.ts`)

2. **Admin Dashboard**
   - Home management (`components/admin/HomeManagement.tsx`)
   - User management (`components/admin/UserManagement.tsx`)
   - File upload interface (`components/admin/FileUpload.tsx`)
   - Chain configuration wizard (`components/config/ConfigManager.tsx`)

3. **Home Dashboard**
   - Behaviour incidents visualization (`app/[homeId]/page.tsx`)
   - Charts and trends (`components/dashboard/`)
   - Data export (CSV/PDF)

4. **Chain Dashboard**
   - Multi-home comparison (`app/chain/[chainId]/page.tsx`)
   - Cross-facility analytics

5. **AI-Powered Analysis**
   - Injury detection (Claude AI)
   - Head injury detection
   - Incident summarization
   - Intent determination
   - AI insights generation (`api/trends/ai-insights`)

6. **Configuration Management**
   - Chain extraction configs (hardcoded + Firebase)
   - Dynamic config creation via UI
   - Field extraction markers
   - Note type definitions

### Supporting Modules
- **Authentication**: Firebase Auth (email/username login)
- **Analytics**: Mixpanel integration for user tracking
- **File Storage**: Local filesystem (`files/chains/[chain]/downloads`)
- **Python Processing**: Legacy Python scripts for file extraction

---

## Data Model + DB Tables

### Firebase Realtime Database Structure

```
/
├── users/
│   └── {userId}/
│       ├── username
│       ├── email
│       ├── role (admin | chainAdmin | homeUser)
│       ├── homeId (for homeUser)
│       ├── chainId (for chainAdmin/homeUser)
│       ├── loginCount
│       └── createdAt
│
├── chains/
│   └── {chainId}/
│       ├── name
│       ├── homes (array of homeIds)
│       └── config/ (ChainExtractionConfig)
│           ├── behaviourNoteTypes
│           ├── followUpNoteTypes
│           ├── fieldExtractionMarkers
│           ├── excelExtraction
│           └── matchingWindowHours
│
├── homeMappings/
│   └── {homeId}/
│       ├── firebaseId
│       ├── pythonDir
│       ├── homeName
│       └── displayName
│
└── {homeId}/ (e.g., "millCreek", "berkshire")
    └── behaviours/
        └── {year}/
            └── {month}/
                └── {day}/
                    └── {index}/
                        ├── name
                        ├── date
                        ├── time
                        ├── incident_number
                        ├── incident_location
                        ├── room
                        ├── injuries
                        ├── incident_type
                        ├── behaviour_type
                        ├── triggers
                        ├── interventions
                        ├── poa_notified
                        ├── who_affected
                        ├── code_white
                        ├── prn
                        ├── other_notes
                        ├── summary
                        └── CI
```

### Data Types (TypeScript)
- `BehaviourEntry`: Raw PDF-extracted behaviour data
- `ProcessedIncident`: Excel-extracted incident data
- `MergedBehaviourData`: Combined behaviour + incident data
- `FollowUpNote`: Non-behaviour follow-up notes
- `ChainExtractionConfig`: Chain-specific extraction configuration
- `HomeMapping`: Home ID mapping across systems

### Python Data Structures
- CSV outputs: `_processed_incidents.csv`, `_behaviour_incidents.csv`, `_merged.csv`, `_follow.csv`
- Chain configs in `python/chains/{chain}/homes_db.py`

---

## Auth + Tenancy Model

### Authentication
- **Provider**: Firebase Authentication
- **Methods**: Email/password, username-based login
- **Session**: Client-side Firebase Auth state management
- **Middleware**: Basic route protection (redirects to login)

### Authorization Model (Role-Based Access Control)

1. **Admin** (`role: "admin"`)
   - Full access to admin dashboard
   - Home management (CRUD)
   - User management (CRUD)
   - Chain management (CRUD)
   - File uploads and processing
   - Configuration management

2. **Chain Admin** (`role: "chainAdmin"`)
   - Access to chain dashboard (`/chain/[chainId]`)
   - View all homes in assigned chain
   - Cross-facility analytics
   - Assigned via `chainId` field

3. **Home User** (`role: "homeUser"`)
   - Access to single home dashboard (`/[homeId]`)
   - View behaviour data for assigned home
   - Data export (CSV/PDF)
   - Assigned via `homeId` and `chainId` fields

### Tenancy
- **Multi-tenant**: Yes (by chain/home)
- **Data Isolation**: Firebase paths scoped by `homeId`
- **User Scoping**: Users linked to specific `homeId` or `chainId`
- **No tenant-level billing**: Not implemented

### Access Control Implementation
- Client-side checks in page components (`app/admin/page.tsx`, `app/chain/[chainId]/page.tsx`)
- Firebase Realtime Database rules (not visible in codebase, likely configured in Firebase console)
- Route-level middleware redirects unauthenticated users

---

## API Surface (Routes/Controllers)

### Admin API Routes (`/api/admin/`)

#### File Processing
- `POST /api/admin/process-behaviours` - Main TypeScript processing pipeline
- `POST /api/admin/process-behaviours-py` - Python-based processing (legacy)
- `POST /api/admin/process-behaviours-py 2` - Duplicate Python route (⚠️ duplication)
- `GET /api/admin/process-progress` - Get processing job progress
- `POST /api/admin/process-progress` - Update processing progress
- `DELETE /api/admin/process-progress` - Clear progress

#### File Analysis
- `POST /api/admin/analyze-pdf` - Analyze PDF structure for config
- `POST /api/admin/analyze-excel` - Analyze Excel structure for config
- `POST /api/admin/extract-pdf-text` - Extract raw PDF text

#### Chain Management
- `GET /api/admin/chains` - List all chains
- `POST /api/admin/chains` - Create new chain
- `POST /api/admin/save-chain-config` - Save chain extraction config
- `GET /api/admin/save-chain-config` - Get chain config
- `DELETE /api/admin/save-chain-config` - Delete chain config

#### Home Management
- `GET /api/admin/homes` - List all homes
- `POST /api/admin/homes` - Create new home
- `DELETE /api/admin/homes` - Delete home

#### User Management
- `GET /api/admin/users` - List all users
- `DELETE /api/admin/users` - Delete user
- `POST /api/admin/users/create` - Create new user
- `POST /api/admin/users/bulk-import` - Bulk import users from CSV
- `GET /api/admin/users/migrate` - Get migration status
- `POST /api/admin/users/migrate` - Migrate users
- `PATCH /api/admin/users/[userId]/role` - Update user role
- `PATCH /api/admin/users/[userId]/profile` - Update user profile
- `PATCH /api/admin/users/[userId]/home-chain` - Update user home/chain assignment
- `DELETE /api/admin/users/[userId]` - Delete specific user

#### Migration
- `POST /api/admin/migrate` - Data migration endpoint

### Chain API Routes
- `GET /api/chain/[chainId]/homes` - Get homes for chain

### Trends API Routes
- `POST /api/trends/ai-insights` - Generate AI-powered insights

### Page Routes (Next.js App Router)
- `GET /login` - Login page
- `GET /reset-password` - Password reset page
- `GET /unauthorized` - Unauthorized access page
- `GET /admin` - Admin dashboard
- `GET /admin/config` - Configuration manager
- `GET /upload` - File upload page
- `GET /[homeId]` - Home dashboard
- `GET /chain/[chainId]` - Chain dashboard

---

## Background Jobs/Cron/Queues

### Current Implementation
- **No dedicated job queue**: Processing happens synchronously in API routes
- **Progress tracking**: In-memory `progressStore` (Map) for job status
  - Location: `api/admin/process-progress/route.ts`
  - Auto-cleanup: 1 hour TTL
- **No cron jobs**: No scheduled tasks found
- **No background workers**: All processing is request-driven

### Processing Flow
1. User uploads files via `/api/admin/process-behaviours`
2. Processing runs synchronously in API route
3. Progress updates stored in memory (`progressStore`)
4. Client polls `/api/admin/process-progress` for updates
5. Processing can take 1-5 minutes per MB (PDF processing is slow)

### Python Scripts
- `python/chains/{chain}/run_script.py` - Manual execution scripts
- `requirements.txt` includes `schedule` library but no cron setup found
- Scripts appear to be run manually or via API calls

### Recommendations
- ⚠️ **No queue system**: Long-running jobs block API requests
- ⚠️ **In-memory progress**: Lost on server restart
- Consider: Bull/BullMQ, AWS SQS, or Railway cron jobs

---

## Integrations

### External Services

1. **Firebase**
   - **Authentication**: Firebase Auth (email/password)
   - **Database**: Firebase Realtime Database
   - **Admin SDK**: Server-side operations (`firebase-admin`)
   - **Client SDK**: Client-side auth (`firebase/auth`, `firebase/database`)

2. **AI Services**
   - **Claude AI (Anthropic)**: Primary AI for analysis
     - Model: `claude-3-haiku-20240307` (configurable via `AI_MODEL` env var)
     - Uses: Injury detection, summarization, insights generation
   - **OpenAI**: Legacy/fallback (mentioned in code but not actively used)
     - Referenced in `lib/processing/README.md` but not in current codebase

3. **Analytics**
   - **Mixpanel**: User behavior tracking
     - Tracks: Page views, file uploads, dashboard interactions, errors
     - Client-side only (`mixpanel-browser`)

4. **File Storage**
   - **Local Filesystem**: No cloud storage (S3/GCS)
   - Storage paths:
     - `files/chains/[chain]/downloads/` - Uploaded files
     - `files/chains/[chain]/analyzed/` - Processed CSVs
     - `files/tests/` - Test files

5. **No Email Service**: No email integration found
6. **No EHR/PCC Integration**: No direct EHR system imports
7. **No S3/Cloud Storage**: Files stored locally on server

### Python Dependencies
- PDF processing: `pdfplumber`, `PyPDF2`, `pdfminer.six`
- Excel processing: `xlrd`, `openpyxl`
- Data: `pandas`, `numpy`
- Firebase: `firebase-admin`
- AI: `openai` (legacy)

---

## Config/Env Vars

### Required Environment Variables

#### Firebase (Client)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

#### Firebase (Admin/Server)
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_PRIVATE_KEY_ID`
- `FIREBASE_ADMIN_PRIVATE_KEY` (with `\n` newlines)
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_CLIENT_ID`

#### AI Services
- `CLAUDE_API_KEY` or `ANTHROPIC_API_KEY` (Claude AI)
- `AI_MODEL` (optional, defaults to `claude-3-haiku-20240307`)
- `OPENAI_API_KEY` (legacy, may not be used)

#### Analytics
- `NEXT_PUBLIC_MIXPANEL_TOKEN`

#### Python Processing (Optional)
- `PYTHON_PATH` (defaults to `python3`)
- `LD_LIBRARY_PATH` (for PDF libraries)

#### General
- `NODE_ENV` (development/production)

### Configuration Files
- `.env.local` - Local development (gitignored)
- `.env` - Production environment
- `next.config.ts` - Next.js config
- `railway.json` - Railway deployment config
- `nixpacks.toml` - Nixpacks build config

---

## Deployment

### Platform: Railway

#### Configuration
- **Build**: Nixpacks (auto-detected or `nixpacks.toml`)
  - Node.js 20
  - Chromium + ChromeDriver (for PDF processing)
  - Build command: `npm ci && npm run build`
- **Start**: `npm run start` (Next.js production server)
- **Healthcheck**: `/` endpoint, 300s timeout
- **Restart Policy**: On failure, max 10 retries

#### Domain
- **Custom Domain**: `behaviours.ascenix.co`
- **Railway Subdomain**: `fallyx-behaviours.up.railway.app` (redirects to custom domain)

#### Build Process
1. Install dependencies (`npm ci`)
2. Build Next.js app (`npm run build`)
3. Start production server (`npm start`)

#### Procfile
- `web: npm run start` (Heroku-style, may be for compatibility)

### Deployment Notes
- **No CI/CD pipeline**: Deployment appears manual via Railway
- **No staging environment**: Single production deployment
- **File storage**: Local filesystem (⚠️ ephemeral on Railway, files lost on restart)
- **No database migrations**: Firebase schema managed manually

### Recommendations
- ⚠️ **File storage**: Move to S3/GCS (files lost on Railway restarts)
- ⚠️ **Environment separation**: Add staging environment
- Consider: Automated deployments via Railway Git integration

---

## Duplications & Reusable Components

### Code Duplications

1. **Python Processing Routes** ⚠️
   - `api/admin/process-behaviours-py/route.ts`
   - `api/admin/process-behaviours-py 2/route.ts` (duplicate)
   - **Action**: Remove duplicate, consolidate

2. **Chain Configuration**
   - Hardcoded configs in `lib/utils/configUtils.ts` (CHAIN_EXTRACTION_CONFIGS)
   - Python configs in `python/chains/{chain}/homes_db.py`
   - Firebase configs in `/chains/{chainId}/config`
   - **Action**: Centralize config management

3. **Home Mappings**
   - TypeScript: `src/lib/homeMappings.ts` (hardcoded fallback)
   - Python: `python/chains/homes_db.py` (chain definitions)
   - Firebase: `/homeMappings` (dynamic)
   - **Action**: Single source of truth (Firebase), sync to other systems

4. **Extraction Logic**
   - TypeScript processors in `lib/processing/`
   - Python scripts in `python/chains/{chain}/`
   - Both do similar PDF/Excel extraction
   - **Action**: Migrate fully to TypeScript, deprecate Python

5. **File Processing**
   - TypeScript: `api/admin/process-behaviours/route.ts` (new)
   - Python: `api/admin/process-behaviours-py/route.ts` (legacy)
   - **Action**: Complete migration to TypeScript

### Reusable Components (Potential)

1. **Processing Pipeline**
   - Could be extracted as shared library
   - Used by: File upload, batch processing

2. **Chain Config System**
   - Config loading, validation, AI generation
   - Reusable across chains

3. **Home Mapping Utilities**
   - ID conversion (firebaseId ↔ pythonDir ↔ homeName)
   - Used throughout codebase

4. **Firebase Utilities**
   - Admin/client initialization
   - Database operations

5. **AI Client Wrapper**
   - Claude API wrapper (`lib/claude-client.ts`)
   - Reusable for all AI operations

6. **Analytics Tracking**
   - Mixpanel wrapper (`lib/mixpanel.ts`)
   - Comprehensive event tracking

### Shared Across Repos (Potential)

1. **Firebase Setup**
   - Admin/client initialization patterns
   - Database structure conventions

2. **Auth Middleware**
   - Role-based access control patterns
   - User permission checks

3. **File Processing**
   - PDF/Excel extraction utilities
   - CSV generation patterns

4. **AI Integration**
   - Claude API wrapper
   - Prompt engineering patterns

5. **Analytics**
   - Mixpanel tracking utilities
   - Event naming conventions

---

## Summary

### Architecture
- **Framework**: Next.js 16 (App Router)
- **Database**: Firebase Realtime Database
- **Auth**: Firebase Authentication
- **Deployment**: Railway (Nixpacks)
- **File Storage**: Local filesystem (⚠️ ephemeral)

### Key Strengths
- Modern Next.js App Router architecture
- TypeScript throughout
- AI-powered analysis
- Flexible chain-based configuration
- Comprehensive analytics tracking

### Key Issues
- ⚠️ File storage on ephemeral filesystem (Railway)
- ⚠️ No background job queue (long-running API requests)
- ⚠️ Code duplication (Python/TypeScript, duplicate routes)
- ⚠️ In-memory progress tracking (lost on restart)
- ⚠️ No staging environment

### Migration Opportunities
- Complete Python → TypeScript migration
- Move file storage to S3/GCS
- Implement proper job queue (Bull/BullMQ)
- Consolidate configuration management
- Add CI/CD pipeline

