# Fallyx Behaviours Dashboard

A Next.js application for tracking and analyzing behaviour incidents in care facilities.

## Features

- **Behaviour Tracking**: Monitor and record behaviour incidents
- **Analysis Charts**: Visualize behaviour patterns by time of day, type, location, etc.
- **Follow-up Management**: Track follow-up actions and notes
- **API Routes**: Server-side Firebase operations for data fetching and updates
- **Client-side Authentication**: Firebase authentication with role-based access
- **Multiple Facilities**: Support for MCB, ONCB, Berkshire, and Banwell

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Firebase Client SDK Configuration (for frontend auth)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_DATABASE_URL=your_database_url
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Firebase Admin SDK Configuration (for API routes)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY="your_private_key"
FIREBASE_ADMIN_DATABASE_URL=your_database_url
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

### 4. Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
behaviours/
├── app/                      # Next.js app router pages
│   ├── api/                 # API routes
│   │   └── behaviours/      # Behaviour data endpoints
│   ├── login/               # Login page
│   ├── reset-password/      # Password reset page
│   ├── unauthorized/        # Unauthorized access page
│   ├── MCB/                 # Mill Creek dashboard
│   ├── ONCB/                # O'Neill Centre dashboard
│   ├── berkshire/           # Berkshire dashboard
│   └── banwell/             # Banwell dashboard
├── components/              # React components
│   ├── behaviours/          # Behaviour-specific components
│   ├── BehavioursDashboard.tsx  # Main dashboard component
│   └── Modal.js             # Modal component
├── lib/                     # Utility libraries
│   ├── firebase.ts          # Firebase client SDK
│   ├── firebase-admin.ts    # Firebase admin SDK
│   └── DashboardUtils.ts    # Dashboard utility functions
├── styles/                  # CSS modules
│   ├── Behaviours.module.css
│   ├── Login.css
│   └── UpdatePasswordPage.module.css
├── public/                  # Static assets
│   └── assets/
│       └── fallyxlogo.jpeg
└── middleware.ts            # Next.js middleware for routing

```

## Authentication

- Authentication is handled client-side using Firebase Authentication
- Users log in with username (converted to email format) and password
- Role-based routing directs users to their appropriate dashboard
- Protected routes redirect unauthenticated users to the login page

## API Routes

### GET `/api/behaviours/[name]`
Fetch behaviour data for a specific facility
- Query params: `month`, `year`

### POST `/api/behaviours/[name]`
Update behaviour records
- Body: `{ id, updates }`

### GET `/api/behaviours/follow-up/[name]`
Fetch follow-up data for a specific facility
- Query params: `month`, `year`

## Technologies

- **Next.js 15**: React framework with app router
- **TypeScript**: Type-safe development
- **Firebase**: Authentication and Realtime Database
- **Chart.js**: Data visualization
- **Tailwind CSS**: Utility-first CSS framework
- **jsPDF**: PDF generation
- **Papa Parse**: CSV parsing

## License

Private - Fallyx Inc.
