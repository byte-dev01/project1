// simpleFaxMonitor.js - Basic folder monitoring
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const axios = require("axios");

// Configuration - you can change these paths
const FAX_FOLDER = 'C:/FaxInbox';           // Where Brother L2750 saves faxes
const PROCESSED_FOLDER = 'C:/FaxProcessed'; // Where successful files go
const ERROR_FOLDER = 'C:/FaxError';         // Where failed files go

console.log('🚀 Simple Fax Monitor Starting...');
console.log(`📁 Watching folder: ${FAX_FOLDER}`);
console.log(`✅ Processed folder: ${PROCESSED_FOLDER}`);
console.log(`❌ Error folder: ${ERROR_FOLDER}`);
/*
async function uploadToCloud(filePath) {
  const fileName = path.basename(filePath);
  const formData = new FormData();
  formData.append("file", fs.createReadStream(filePath));

  try {
    const response = await axios.post("http://localhost:3000/api/fax-upload", formData, {
      headers: formData.getHeaders(),
    });
    return response.data;
  } catch (err) {
    throw new Error(`Cloud upload failed: ${err.message}`);
  }
}
*/
const handleNewFax = require('./handleNewFax'); // ✅ LOCAL processing

// Create folders if they don't exist
function createFoldersIfNeeded() {
  [FAX_FOLDER, PROCESSED_FOLDER, ERROR_FOLDER].forEach(folder => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      console.log(`📁 Created folder: ${folder}`);
    }
  });
}

// Check if file is a supported fax format
function isFaxFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const supportedFormats = ['.tif', '.tiff', '.pdf', '.png', '.jpg', '.jpeg'];
  return supportedFormats.includes(ext);
}

// Move file to processed folder
function moveToProcessed(filePath) {
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const newPath = path.join(PROCESSED_FOLDER, `${timestamp}_${fileName}`);
  
  try {
    fs.renameSync(filePath, newPath);
    console.log(`✅ Moved to processed: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to move processed file: ${error.message}`);
    return false;
  }
}

// Move file to error folder
function moveToError(filePath, errorMessage) {
  const fileName = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const newPath = path.join(ERROR_FOLDER, `${timestamp}_${fileName}`);
  
  try {
    fs.renameSync(filePath, newPath);
    
    // Create error log file
    const errorLogPath = path.join(ERROR_FOLDER, `${timestamp}_${fileName}.error.txt`);
    fs.writeFileSync(errorLogPath, `Error processing ${fileName}:\n${errorMessage}\n\nTimestamp: ${new Date().toISOString()}`);
    
    console.log(`❌ Moved to error folder: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to move error file: ${error.message}`);
    return false;
  }
}

// Process a single fax file
async function processFaxFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`🔄 Processing: ${fileName}`);
  
  try {
    // Use your existing handleNewFax function
    const result = await handleNewFax(filePath);
    
    // If successful, move to processed folder
    moveToProcessed(filePath);
    console.log(`🎉 Successfully processed: ${fileName}`);
    
    return result;
  } catch (error) {
    console.error(`❌ Error processing ${fileName}:`, error.message);
    
    // Move to error folder
    moveToError(filePath, error.message);
    
    throw error;
  }
}

// Create folders
createFoldersIfNeeded();

// Set up file watcher with chokidar
const watcher = chokidar.watch(FAX_FOLDER, {
  ignored: /^\./, // Ignore hidden files (starting with .)
  persistent: true, // Keep the process running
  ignoreInitial: true, // Don't process files that are already there when starting
  awaitWriteFinish: {
    stabilityThreshold: 2000, // Wait 2 seconds after file stops changing
    pollInterval: 100 // Check every 100ms
  }
});

// Event handlers
watcher
  .on('add', async (filePath) => {
    // New file detected
    if (isFaxFile(filePath)) {
      console.log(`📥 New fax file detected: ${path.basename(filePath)}`);
      
      try {
        await processFaxFile(filePath);
      } catch (error) {
        console.error(`💥 Failed to process: ${path.basename(filePath)}`);
      }
    } else {
      console.log(`⚠️ Unsupported file format: ${path.basename(filePath)}`);
    }
  })
  .on('change', (filePath) => {
    // File changed - usually not needed for fax files, but good to know
    console.log(`📝 File changed: ${path.basename(filePath)}`);
  })
  .on('unlink', (filePath) => {
    // File deleted
    console.log(`🗑️ File deleted: ${path.basename(filePath)}`);
  })
  .on('error', (error) => {
    console.error('👀 Watcher error:', error);
  })
  .on('ready', () => {
    console.log('👀 File watcher ready! Monitoring for new fax files...');
    console.log('📝 Supported formats: .tif, .tiff, .pdf, .png, .jpg, .jpeg');
    console.log('💡 To test: Copy a fax file to the watched folder');
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down file watcher...');
  watcher.close().then(() => {
    console.log('👋 File watcher stopped. Goodbye!');
    process.exit(0);
  });
});

// Export for testing
module.exports = {
  processFaxFile,
  moveToProcessed,
  moveToError,
  isFaxFile
};
