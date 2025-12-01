# Behaviour Processing Library

TypeScript-based system for processing behaviour incident files (PDF and Excel) and uploading to Firebase.

## Quick Start

```typescript
import { processBehaviourFiles } from '@/lib/processing/orchestrator';

await processBehaviourFiles({
  downloadsDir: '/path/to/downloads',
  analyzedDir: '/path/to/analyzed',
  homeId: 'millCreek',
  year: '2024',
  month: '01',
  day: '15',
  openaiApiKey: process.env.OPENAI_API_KEY!,
  onProgress: async (progress) => {
    console.log(`${progress.percentage}% - ${progress.message}`);
  },
});
```

## Modules

### `orchestrator.ts`
Main entry point for processing pipeline. Coordinates all processing steps.

**Key Functions:**
- `processBehaviourFiles()`: Main processing function
- `BehaviourProcessor`: Class-based processor with individual step methods

### `pdfProcessor.ts`
PDF text extraction and behaviour note parsing.

**Key Functions:**
- `extractTextFromPdf()`: Extract text from PDF files
- `getAllFallNotesInfo()`: Parse behaviour notes from text
- `detectInjuries()`: AI-powered injury detection
- `checkForHeadInjury()`: AI-powered head injury detection

### `excelProcessor.ts`
Excel incident file processing.

**Key Functions:**
- `processExcelFile()`: Process single Excel file
- `processExcelFiles()`: Process all Excel files in directory

### `behaviourGenerator.ts`
Merge incident data with behaviour notes and generate AI insights.

**Key Functions:**
- `mergeBehaviourData()`: Merge processed incidents with behaviour notes
- `processAllMergedFiles()`: Process all files in directory

### `firebaseUpdate.ts`
Sync processed data with Firebase.

**Key Functions:**
- `syncFirebaseWithCsv()`: Sync single CSV with Firebase
- `processMergedCsvFiles()`: Process all merged CSV files

### `firebaseUpload.ts`
Upload final data to Firebase.

**Key Functions:**
- `uploadCsvToFirebase()`: Upload single CSV to Firebase
- `processCsvFiles()`: Upload all CSV files

### `homesDb.ts`
Shared configuration and home mappings.

**Key Functions:**
- `getChainForHome()`: Get chain ID for home
- `getExtractionType()`: Get extraction type for home
- `extractInfoFromFilename()`: Extract date info from filename

### `types.ts`
TypeScript type definitions for all data structures.

## Data Flow

```
1. Excel Files → excelProcessor → processed_incidents.csv
2. PDF Files → pdfProcessor → behaviour_incidents.csv
3. Both CSVs → behaviourGenerator → merged.csv + follow.csv
4. merged.csv → firebaseUpdate → Updated with Firebase data
5. Updated CSVs → firebaseUpload → Firebase database
```

## File Naming Convention

Input files must follow this format:
```
{home_name}_{MM}-{DD}-{YYYY}_{timestamp}.{ext}
```

Example:
```
mill_creek_care_01-15-2024_1640.pdf
mill_creek_care_01-15-2024_1640.xls
```

## Output Structure

```
analyzed/
└── {YYYY}_{MM}_{DD}/
    ├── {home}_{date}_{time}_processed_incidents.csv
    ├── {home}_{date}_{time}_behaviour_incidents.csv
    ├── {home}_{date}_{time}_merged.csv
    └── {home}_{date}_{time}_follow.csv
```

## AI Integration

The system uses OpenAI GPT-3.5-turbo for:

1. **Injury Detection**: Identifies injuries from medical notes
2. **Head Injury Detection**: Specific detection for head injuries
3. **Who Affected Classification**: Determines residents/staff involved
4. **Incident Summarization**: Generates concise incident summaries
5. **Intent Determination**: Analyzes if actions were intentional

## Error Handling

All processors include try-catch blocks with detailed logging:

```typescript
try {
  await processStep();
} catch (error) {
  console.error('Error in step:', error);
  throw error; // Propagate to orchestrator
}
```

The orchestrator catches all errors and reports them via progress callbacks.

## Performance Considerations

1. **PDF Processing**: Most time-consuming step (1-5 minutes per MB)
2. **AI Calls**: Rate-limited by OpenAI (consider batch processing)
3. **Firebase Operations**: Asynchronous but sequential per file
4. **Memory Usage**: Files are processed in streaming fashion

## Development

### Adding New Features

1. Create new module in `src/lib/processing/`
2. Export functions from module
3. Import and use in `orchestrator.ts`
4. Update types in `types.ts` if needed

### Testing Individual Modules

```typescript
import { processExcelFile } from '@/lib/processing/excelProcessor';

await processExcelFile(
  'path/to/input.xlsx',
  'path/to/output.csv'
);
```

## Troubleshooting

### PDF Parsing Issues
- Ensure PDF is text-based (not scanned images)
- Check PDF file is not corrupted
- Verify file naming convention

### Excel Processing Issues
- Ensure Excel format is .xls or .xlsx
- Check header row is at row 8 (index 7)
- Verify column structure matches expected format

### AI Analysis Issues
- Check OpenAI API key is valid
- Monitor rate limits
- Verify prompt formatting

### Firebase Issues
- Ensure Firebase Admin SDK is initialized
- Check Firebase credentials
- Verify database rules allow write access

## License

Internal use only - Fallyx Inc.
