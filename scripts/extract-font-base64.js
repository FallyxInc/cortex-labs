/**
 * Script to extract base64 font string from jsPDF-generated font file
 * 
 * Usage:
 * node scripts/extract-font-base64.js "path/to/Inter-normal.js"
 * 
 * This will extract the base64 string and update src/lib/inter-font.js
 */

const fs = require('fs');
const path = require('path');

const fontFile = process.argv[2];
const outputFile = path.join(process.cwd(), 'src/lib/inter-font.js');

if (!fontFile) {
  console.error('Usage: node scripts/extract-font-base64.js <path-to-font-file.js>');
  console.error('Example: node scripts/extract-font-base64.js "c:\\Users\\Rishi Mehta\\Downloads\\Inter-normal.js"');
  process.exit(1);
}

try {
  console.log(`Reading font file: ${fontFile}`);
  const content = fs.readFileSync(fontFile, 'utf8');
  
  // Extract base64 string - it's between 'var font = ' and ';'
  const match = content.match(/var font = ['"]([^'"]+)['"]/);
  
  if (!match || !match[1]) {
    console.error('Could not find base64 string in font file');
    console.error('Expected format: var font = \'BASE64_STRING\';');
    process.exit(1);
  }
  
  const base64 = match[1];
  console.log(`✓ Extracted base64 string (length: ${base64.length})`);
  
  // Determine if it's regular or bold based on filename
  const isBold = fontFile.toLowerCase().includes('bold');
  const isRegular = fontFile.toLowerCase().includes('normal') || (!isBold);
  
  // Read the inter-font.js file
  let interFontContent = fs.readFileSync(outputFile, 'utf8');
  
  // Replace the appropriate placeholder
  if (isBold) {
    interFontContent = interFontContent.replace(
      /const INTER_BOLD_BASE64 = 'PASTE_BOLD_BASE64_HERE';/,
      `const INTER_BOLD_BASE64 = '${base64}';`
    );
    console.log('✓ Updated INTER_BOLD_BASE64');
  } else if (isRegular) {
    interFontContent = interFontContent.replace(
      /const INTER_REGULAR_BASE64 = 'PASTE_REGULAR_BASE64_HERE';/,
      `const INTER_REGULAR_BASE64 = '${base64}';`
    );
    console.log('✓ Updated INTER_REGULAR_BASE64');
  }
  
  fs.writeFileSync(outputFile, interFontContent, 'utf8');
  console.log(`✓ Updated ${outputFile}`);
  
  if (isRegular) {
    console.log('\nNext step: Convert Inter-Bold.ttf and run:');
    console.log('node scripts/extract-font-base64.js "path/to/Inter-bold.js"');
  } else {
    console.log('\n✓ Inter font setup complete! Both Regular and Bold fonts are now configured.');
  }
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

