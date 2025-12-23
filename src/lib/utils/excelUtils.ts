/**
 * Excel text extraction utilities.
 * Uses xlsx library to extract text from Excel buffers.
 */

import * as XLSX from "xlsx";

/**
 * Extract text from each sheet of an Excel file separately.
 * This provides better sheet-level granularity for processing.
 *
 * @param buffer - Excel file buffer
 * @returns Array of text content, one per sheet
 */
export async function extractExcelText(buffer: Buffer): Promise<string[]> {
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
        const sheetsText: string[] = [];

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
            
            const sheetText: string[] = [];
            for (let row = range.s.r; row <= range.e.r; row++) {
                const rowText: string[] = [];
                for (let col = range.s.c; col <= range.e.c; col++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                    const cell = sheet[cellAddress];
                    if (cell && cell.v !== undefined && cell.v !== null) {
                        rowText.push(String(cell.v));
                    }
                }
                if (rowText.length > 0) {
                    sheetText.push(rowText.join(' '));
                }
            }
            sheetsText.push(sheetText.join('\n'));
        }

        return sheetsText.length > 0 ? sheetsText : [''];
    } catch (error) {
        console.error(`Error extracting text from Excel: ${error}`);
        return [];
    }
}

