/**
 * Script to extract TTF file from ZIP base64 and convert to proper format
 * 
 * The jsPDF font converter sometimes outputs a ZIP file instead of just the TTF.
 * This script extracts the TTF from the ZIP and creates a proper base64 string.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const fontFile = process.argv[2];
const outputFile = path.join(process.cwd(), 'src/lib/inter-font.js');

if (!fontFile) {
  console.error('Usage: node scripts/extract-ttf-from-zip.js <path-to-font-file.js>');
  process.exit(1);
}

try {
  console.log(`Reading font file: ${fontFile}`);
  const content = fs.readFileSync(fontFile, 'utf8');
  
  // Extract base64 string
  const match = content.match(/var font = ['"]([^'"]+)['"]/);
  
  if (!match || !match[1]) {
    console.error('Could not find base64 string in font file');
    process.exit(1);
  }
  
  const base64 = match[1];
  console.log(`✓ Extracted base64 string (length: ${base64.length})`);
  
  // Check if it's a ZIP file (starts with UEsDBBQ which is PK in base64)
  if (base64.startsWith('UEsDBBQ')) {
    console.log('⚠️  Detected ZIP file instead of TTF. Extracting TTF...');
    
    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp-font-extract');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Write ZIP to file
    const zipPath = path.join(tempDir, 'font.zip');
    const zipBuffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(zipPath, zipBuffer);
    console.log('✓ Wrote ZIP to temp file');
    
    // Extract ZIP (using Node.js built-in or require user to have unzip)
    try {
      // Try using Node.js to extract
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();
      
      // Find the correct TTF file based on font type
      const isBold = fontFile.toLowerCase().includes('bold');
      let ttfEntry;
      
      if (isBold) {
        // Look for Bold font
        ttfEntry = zipEntries.find(entry => 
          entry.entryName.toLowerCase().includes('bold') && 
          entry.entryName.endsWith('.ttf') &&
          !entry.entryName.toLowerCase().includes('italic')
        ) || zipEntries.find(entry => 
          entry.entryName.toLowerCase().includes('semibold') && 
          entry.entryName.endsWith('.ttf') &&
          !entry.entryName.toLowerCase().includes('italic')
        );
      } else {
        // Look for Regular font
        ttfEntry = zipEntries.find(entry => 
          (entry.entryName.toLowerCase().includes('regular') || 
           entry.entryName.toLowerCase().includes('normal')) && 
          entry.entryName.endsWith('.ttf') &&
          !entry.entryName.toLowerCase().includes('italic')
        );
      }
      
      if (!ttfEntry) {
        console.error('❌ Could not find the correct TTF file in ZIP');
        console.log('Looking for:', isBold ? 'Bold' : 'Regular');
        console.log('Available TTF files:', zipEntries.filter(e => e.entryName.endsWith('.ttf')).map(e => e.entryName).join(', '));
        process.exit(1);
      }
      
      console.log(`✓ Found TTF: ${ttfEntry.entryName}`);
      
      // Extract TTF
      const ttfBuffer = ttfEntry.getData();
      const ttfBase64 = ttfBuffer.toString('base64');
      
      console.log(`✓ Extracted TTF base64 (length: ${ttfBase64.length})`);
      
      // Clean up
      fs.unlinkSync(zipPath);
      fs.rmdirSync(tempDir);
      
      // Update inter-font.js
      let interFontContent = fs.readFileSync(outputFile, 'utf8');
      
      if (isBold) {
        interFontContent = interFontContent.replace(
          /const INTER_BOLD_BASE64 = 'PASTE_BOLD_BASE64_HERE'|const INTER_BOLD_BASE64 = '[^']*';/,
          `const INTER_BOLD_BASE64 = '${ttfBase64}';`
        );
        console.log('✓ Updated INTER_BOLD_BASE64');
      } else {
        interFontContent = interFontContent.replace(
          /const INTER_REGULAR_BASE64 = 'PASTE_REGULAR_BASE64_HERE'|const INTER_REGULAR_BASE64 = '[^']*';/,
          `const INTER_REGULAR_BASE64 = '${ttfBase64}';`
        );
        console.log('✓ Updated INTER_REGULAR_BASE64');
      }
      
      fs.writeFileSync(outputFile, interFontContent, 'utf8');
      console.log(`✓ Updated ${outputFile}`);
      
    } catch (error) {
      console.error('❌ Error extracting ZIP:', error.message);
      console.log('\nPlease install adm-zip: npm install adm-zip');
      console.log('Or manually extract the TTF from the ZIP and convert it separately');
      process.exit(1);
    }
    
  } else {
    console.log('✓ Base64 appears to be a TTF file (not a ZIP)');
    console.log('Using base64 directly...');
    
    // It's already a TTF, just update the file
    const isBold = fontFile.toLowerCase().includes('bold');
    let interFontContent = fs.readFileSync(outputFile, 'utf8');
    
    if (isBold) {
      interFontContent = interFontContent.replace(
        /const INTER_BOLD_BASE64 = 'PASTE_BOLD_BASE64_HERE'|const INTER_BOLD_BASE64 = '[^']*';/,
        `const INTER_BOLD_BASE64 = '${base64}';`
      );
    } else {
      interFontContent = interFontContent.replace(
        /const INTER_REGULAR_BASE64 = 'PASTE_REGULAR_BASE64_HERE'|const INTER_REGULAR_BASE64 = '[^']*';/,
        `const INTER_REGULAR_BASE64 = '${base64}';`
      );
    }
    
    fs.writeFileSync(outputFile, interFontContent, 'utf8');
    console.log(`✓ Updated ${outputFile}`);
  }
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

