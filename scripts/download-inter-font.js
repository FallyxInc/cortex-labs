/**
 * Script to download Inter font files from Google Fonts for jsPDF
 * 
 * This script helps download the TTF files needed for jsPDF font conversion
 * 
 * Usage:
 * 1. Install node-fetch: npm install node-fetch
 * 2. Run: node scripts/download-inter-font.js
 * 
 * The script will download Inter-Regular.ttf and Inter-Bold.ttf to public/fonts/
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Create fonts directory if it doesn't exist
const fontsDir = path.join(process.cwd(), 'public', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// Google Fonts direct TTF download URLs for Inter
// These are direct links to the static TTF files
const fontUrls = {
  regular: 'https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Regular.ttf',
  bold: 'https://github.com/rsms/inter/raw/master/docs/font-files/Inter-Bold.ttf',
  // Alternative: Download from Google Fonts API
  // regular: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',
  // But TTF is better for jsPDF
};

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading ${path.basename(filepath)}...`);
    
    const file = fs.createWriteStream(filepath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirects
        return downloadFile(response.headers.location, filepath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded ${path.basename(filepath)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function downloadFonts() {
  console.log('Starting Inter font download...\n');
  
  try {
    // Download Regular font
    const regularPath = path.join(fontsDir, 'Inter-Regular.ttf');
    await downloadFile(fontUrls.regular, regularPath);
    
    // Download Bold font
    const boldPath = path.join(fontsDir, 'Inter-Bold.ttf');
    await downloadFile(fontUrls.bold, boldPath);
    
    console.log('\n✓ All fonts downloaded successfully!');
    console.log('\nNext steps:');
    console.log('1. Visit: https://rawgit.com/MrRio/jsPDF/master/fontconverter/fontconverter.html');
    console.log('2. Upload Inter-Regular.ttf and download the generated JavaScript');
    console.log('3. Copy the base64 string and paste it in src/lib/inter-font.js');
    console.log('4. Repeat for Inter-Bold.ttf');
    console.log(`\nFont files are located at: ${fontsDir}`);
    
  } catch (error) {
    console.error('Error downloading fonts:', error);
    console.log('\nAlternative: Download manually from:');
    console.log('https://fonts.google.com/specimen/Inter');
    console.log('Click "Download family" and extract the TTF files');
  }
}

// Run if called directly
if (require.main === module) {
  downloadFonts();
}

module.exports = { downloadFonts };

