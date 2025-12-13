# Fallyx Behaviours Dashboard

A Next.js application for tracking and analyzing behaviour incidents in care facilities, with AI-powered file processing and injury detection.

## Quick Start

### 1. Installing Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env.local` and `.env` files in the root directory based on `.env.local.example` and `.env.example`.

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

General Processing Flow
> Referencing pdfs and csvs in files/tests may be useful

- files are uploaded in components/admin/FileUpload to api/admin/process-beahviours/
- uploaded files are moved into files/chains/[chain-name]/downloads
- files in lib/processing are run
- excelProcessor extracts incidents into _processed_incidents.csv
- pdfProcessor extracts incidents with while text dump for each incident into _behaviour_incidents.csv
- behaviourGenerator processes both .csv files, and extracts necessary field markers 
  - merge incidents from behaviour.csv and processed.csv into merged.csv
  - find follow up notes that aren't behaviours into follow.csv
- firebaseUpdate updates info if there is already data uploaded
- firebaseUpload uploads data

```
fallyx-behaviours/
├── src/
│   ├── app/                          # Next.js app router pages
│   │   ├── api/                      # API routes
│   │   │   ├── admin/                # Admin endpoints
│   │   │   │   ├── process-behaviours/   # File processing
│   │   │   │   ├── analyze-pdf/          # PDF analysis
│   │   │   │   ├── analyze-excel/        # Excel analysis
│   │   │   │   ├── chains/               # Chain management
│   │   │   │   ├── homes/                # Home management
│   │   │   │   └── users/                # User management
│   │   │   └── trends/               # Trends and insights
│   │   ├── [homeId]/                 # Dynamic facility dashboard
│   │   ├── admin/                    # Admin dashboard
│   │   │   └── config/               # Configuration management
│   │   ├── upload/                   # File upload page
│   │   ├── login/                    # Login page
│   │   └── reset-password/           # Password reset
│   ├── components/
│   │   ├── admin/                    # Admin components
│   │   ├── config/                   # Configuration components
│   │   └── dashboard/                # Dashboard components
│   ├── lib/
│   │   ├── firebase/                 # Firebase client & admin SDK
│   │   ├── processing/               # File processing utilities
│   │   └── utils/                    # Utility functions
│   ├── hooks/                        # React hooks
│   └── types/                        # TypeScript types
├── python/                           # Python processing scripts
├── .env                              # Environment variables
├── .env.local                        # Local environment variables
└── package.json                      # Node.js dependencies
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Technologies

### Frontend
- **Next.js 16**: React framework with app router
- **React 19**: UI library
- **TypeScript**: Type-safe development
- **Tailwind CSS 4**: Utility-first CSS framework
- **Chart.js**: Data visualization

### Backend
- **Firebase**: Authentication, Firestore, and Storage
- **Claude AI (Anthropic)**: AI-powered analysis
- **OpenAI**: Additional AI capabilities

## License

Private - Fallyx Inc.
