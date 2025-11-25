# Fallyx Behaviours Dashboard - Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend - Next.js 16"
        Admin[Admin Dashboard]
        HomeUser[Home User Dashboard]
        Login[Login Page]
        Upload[File Upload]
        TenantMgmt[Tenant Management]
        UserMgmt[User Management]
    end

    subgraph "API Layer - Next.js API Routes"
        API_Users["/api/admin/users"]
        API_Chains["/api/admin/chains"]
        API_Homes["/api/admin/homes"]
        API_Migrate["/api/admin/migrate"]
        API_Process["/api/admin/process-behaviours"]
        API_Behaviours["/api/behaviours/[name]"]
        API_FollowUp["/api/behaviours/follow-up/[name]"]
        API_AI["/api/trends/ai-insights"]
    end

    subgraph "Firebase Realtime Database"
        subgraph "Users Collection"
            User1["/users/{userId}<br/>- role: admin|homeUser<br/>- homeId?: string<br/>- chainId?: string<br/>- loginCount: number<br/>- createdAt: timestamp<br/>- username: string<br/>- email: string"]
        end

        subgraph "Chains Collection"
            Chain1["/chains/{chainId}<br/>- name: string<br/>- homes: string[]<br/>- extractionType: responsive|kindera|test|custom<br/>- extractionConfig?: ExtractionStrategyConfig<br/>- createdAt: timestamp"]
        end

        subgraph "Homes Collection"
            Home1["/{homeId}<br/>- chainId: string<br/>- behaviours: {<br/>  createdAt: timestamp<br/>}<br/>- mapping: {<br/>  firebaseId: string<br/>  homeName: string<br/>  displayName: string<br/>}<br/>- overviewMetrics?: {<br/>  antipsychotics: {...}<br/>  worsened: {...}<br/>  improved: {...}<br/>}<br/>- createdAt: timestamp"]
            
            Home2["/{homeId}/behaviours/{behaviourId}<br/>- date: string<br/>- time: string<br/>- resident: string<br/>- incident_type: string<br/>- location: string<br/>- room: string<br/>- injury: string<br/>- affected: string<br/>- note_content: string<br/>- ai_analysis?: {<br/>  injuries_detected: string[]<br/>  poa_contact: boolean<br/>  summary: string<br/>}"]
            
            Home3["/{homeId}/followUp/{followUpId}<br/>- date: string<br/>- resident: string<br/>- note: string<br/>- type: string<br/>- created_at: timestamp"]
        end

        subgraph "Mappings Collection"
            Mapping1["/homeMappings<br/>{<br/>  [homeId]: {<br/>    firebaseId: string<br/>    homeName: string<br/>    displayName: string<br/>  }<br/>}"]
        end
    end

    subgraph "Python Processing Pipeline"
        subgraph "Chain Directories"
            ChainDir1["python/chains/responsive/<br/>- getPdfInfo.py<br/>- getExcelInfo.py<br/>- getBe.py<br/>- update.py<br/>- upload_to_dashboard.py<br/>- run_script.py<br/>- homes_db.py<br/>- downloads/<br/>- analyzed/{homeId}/"]
            
            ChainDir2["python/chains/kindera/<br/>- getPdfInfo.py<br/>- getExcelInfo.py<br/>- getBe.py<br/>- update.py<br/>- upload_to_dashboard.py<br/>- run_script.py<br/>- homes_db.py<br/>- downloads/<br/>- analyzed/{homeId}/"]
            
            ChainDir3["python/chains/test/<br/>- getPdfInfo.py<br/>- getExcelInfo.py<br/>- getBe.py<br/>- update.py<br/>- upload_to_dashboard.py<br/>- run_script.py<br/>- homes_db.py<br/>- downloads/<br/>- analyzed/{homeId}/"]
        end

        subgraph "Extraction Strategy Parameters"
            Strategy1["ExtractionStrategyConfig<br/>{<br/>  pdfExtraction: {<br/>    xTolerance: number<br/>    yTolerance: number<br/>    maxPages: number<br/>  }<br/>  noteTypes: {<br/>    typePattern: regex<br/>    validTypes: string[]<br/>    skipPatterns: string[]<br/>  }<br/>  followUpNotes: {<br/>    enabled: boolean<br/>    types: string[]<br/>  }<br/>  excelProcessing: {<br/>    headerRow: number<br/>    injuryColumnStart: number<br/>    injuryColumnEnd: number<br/>    units: string[]<br/>    filterStruckOut: boolean<br/>  }<br/>  contentCleaning: {<br/>    removePatterns: regex[]<br/>  }<br/>  aiProcessing: {<br/>    model: string<br/>    temperature: number<br/>    maxTokens: number<br/>  }<br/>  kinderaFeatures?: {<br/>    filterBehaviourNotes: boolean<br/>    smartTruncate: boolean<br/>  }<br/>}"]
        end

        subgraph "Processing Steps"
            Step1["1. getExcelInfo.py<br/>- Reads Excel files<br/>- Extracts incident data<br/>- Processes injury columns<br/>- Filters struck out rows<br/>- Output: processed_incidents.csv"]
            
            Step2["2. getPdfInfo.py<br/>- Extracts PDF text<br/>- Parses note types<br/>- Extracts resident names<br/>- Cleans content<br/>- Output: behaviour_incidents.csv"]
            
            Step3["3. getBe.py<br/>- Merges Excel + PDF data<br/>- Generates analytics<br/>- Output: Behaviour_Analytics.csv"]
            
            Step4["4. update.py<br/>- Syncs with Firebase<br/>- Updates behaviour records"]
            
            Step5["5. upload_to_dashboard.py<br/>- Uploads final data<br/>- Creates Firebase entries"]
        end
    end

    subgraph "External Services"
        OpenAI[OpenAI GPT-3.5 API<br/>- Injury Detection<br/>- POA Contact Analysis<br/>- Note Summarization]
        FirebaseAuth[Firebase Authentication<br/>- User Login<br/>- Role-based Access]
    end

    subgraph "Data Flow"
        Flow1[PDF Files<br/>PointClickCare Notes]
        Flow2[Excel Files<br/>Incident Reports]
    end

    %% Frontend to API connections
    Admin --> API_Users
    Admin --> API_Chains
    Admin --> API_Homes
    Admin --> API_Migrate
    Admin --> API_Process
    TenantMgmt --> API_Chains
    TenantMgmt --> API_Homes
    TenantMgmt --> API_Migrate
    UserMgmt --> API_Users
    Upload --> API_Process
    HomeUser --> API_Behaviours
    HomeUser --> API_FollowUp
    Login --> FirebaseAuth

    %% API to Firebase connections
    API_Users --> User1
    API_Chains --> Chain1
    API_Homes --> Home1
    API_Migrate --> Chain1
    API_Migrate --> Home1
    API_Process --> Home1
    API_Process --> Home2
    API_Process --> Home3
    API_Behaviours --> Home2
    API_FollowUp --> Home3
    API_Homes --> Mapping1

    %% Processing pipeline
    API_Process --> ChainDir1
    API_Process --> ChainDir2
    API_Process --> ChainDir3
    ChainDir1 --> Step1
    ChainDir2 --> Step1
    ChainDir3 --> Step1
    Step1 --> Step2
    Step2 --> Step3
    Step3 --> Step4
    Step4 --> Step5
    Step5 --> Home2
    Step5 --> Home3

    %% Strategy configuration
    Chain1 --> Strategy1
    ChainDir1 --> Strategy1
    ChainDir2 --> Strategy1
    ChainDir3 --> Strategy1

    %% AI Processing
    Step3 --> OpenAI
    OpenAI --> Home2

    %% File upload flow
    Flow1 --> Upload
    Flow2 --> Upload
    Upload --> ChainDir1
    Upload --> ChainDir2
    Upload --> ChainDir3

    %% Relationships
    User1 -.->|homeId| Home1
    User1 -.->|chainId| Chain1
    Home1 -.->|chainId| Chain1
    Chain1 -.->|homes[]| Home1
    Home1 -.->|behaviours| Home2
    Home1 -.->|followUp| Home3
    Home1 -.->|mapping| Mapping1

    %% Styling
    classDef frontend fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef api fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef firebase fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef python fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef external fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    classDef data fill:#fff9c4,stroke:#f57f17,stroke-width:2px

    class Admin,HomeUser,Login,Upload,TenantMgmt,UserMgmt frontend
    class API_Users,API_Chains,API_Homes,API_Migrate,API_Process,API_Behaviours,API_FollowUp,API_AI api
    class User1,Chain1,Home1,Home2,Home3,Mapping1 firebase
    class ChainDir1,ChainDir2,ChainDir3,Step1,Step2,Step3,Step4,Step5,Strategy1 python
    class OpenAI,FirebaseAuth external
    class Flow1,Flow2 data
```

## Key Relationships

### User → Home → Chain
- **Users** (homeUser role) are assigned to a **Home** via `homeId`
- **Homes** belong to a **Chain** via `chainId`
- **Chains** contain multiple **Homes** in `homes[]` array
- **Users** can also reference **Chain** directly via `chainId`

### Chain → Python Processing
- Each **Chain** has an `extractionType` (responsive, kindera, test, custom)
- Each **Chain** has an optional `extractionConfig` (ExtractionStrategyConfig)
- Python scripts are organized by chain: `python/chains/{chainId}/`
- All homes in a chain share the same Python processing logic

### Home → Data Storage
- Each **Home** has its own Firebase path: `/{homeId}`
- **Behaviours** are stored under: `/{homeId}/behaviours/{behaviourId}`
- **Follow-ups** are stored under: `/{homeId}/followUp/{followUpId}`
- **Overview Metrics** are stored under: `/{homeId}/overviewMetrics`

### Processing Flow
1. Files uploaded → Saved to `python/chains/{chainId}/downloads/`
2. `getExcelInfo.py` → Processes Excel files → `analyzed/{homeId}/processed_incidents.csv`
3. `getPdfInfo.py` → Processes PDF files → `analyzed/{homeId}/behaviour_incidents.csv`
4. `getBe.py` → Merges data + AI analysis → `analyzed/{homeId}/Behaviour_Analytics.csv`
5. `update.py` → Syncs with Firebase
6. `upload_to_dashboard.py` → Uploads final data to Firebase

### Extraction Strategy Parameters
- **PDF Extraction**: xTolerance, yTolerance, maxPages
- **Note Types**: Regex patterns, valid types, skip patterns
- **Follow-up Notes**: Enabled flag, types to extract
- **Excel Processing**: Header row, injury column range, units list
- **Content Cleaning**: Regex patterns for header/footer removal
- **AI Processing**: Model, temperature, maxTokens
- **Kindera Features**: Filter behaviour notes, smart truncate

