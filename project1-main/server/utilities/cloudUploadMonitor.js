// cloudUploadMonitor.js - For uploading to cloud server (optional)
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data'); // ✅ FIXED: Import proper form-data package
const axios = require('axios');

// Configuration
const FAX_FOLDER = 'C:/FaxInbox';
const PROCESSED_FOLDER = 'C:/FaxProcessed';
const ERROR_FOLDER = 'C:/FaxError';
const CLOUD_SERVER_URL = 'http://localhost:3000'; // ✅ FIXED: http instead of https

console.log('🌐 Cloud Upload Monitor Starting...');
console.log(`📁 Watching folder: ${FAX_FOLDER}`);
console.log(`☁️ Cloud server: ${CLOUD_SERVER_URL}`);

// Upload file to cloud server
async function uploadToCloud(filePath) {
  const fileName = path.basename(filePath);
  console.log(`☁️ Uploading to cloud: ${fileName}`);
  
  try {
    // Create proper FormData
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    
    const response = await axios.post(`${CLOUD_SERVER_URL}/api/fax-upload`, formData, {
      headers: formData.getHeaders(), // ✅ This works with form-data package
      timeout: 60000, // 60 seconds timeout
    });
    
    console.log(`✅ Cloud upload successful: ${fileName}`);
    return response.data;
    
  } catch (error) {
    if (error.response) {
      console.error(`❌ Cloud server error (${error.response.status}):`, error.response.data);
      throw new Error(`Cloud server error: ${error.response.status} ${error.response.data.message || ''}`);
    } else if (error.request) {
      console.error('❌ No response from cloud server');
      throw new Error('Cloud server not responding - is it running?');
    } else {
      console.error('❌ Upload error:', error.message);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }
}

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

// Process a single fax file via cloud
async function processFaxFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`🔄 Processing: ${fileName}`);
  
  try {
    // Upload to cloud for processing
    const result = await uploadToCloud(filePath);
    
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
  ignored: /^\./, 
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});

// Event handlers
watcher
  .on('add', async (filePath) => {
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
  .on('error', (error) => {
    console.error('👀 Watcher error:', error);
  })
  .on('ready', () => {
    console.log('👀 File watcher ready! Monitoring for new fax files...');
    console.log('☁️ Will upload to cloud server for processing');
    console.log('💡 Make sure your server is running: node server.js');
  });

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down file watcher...');
  watcher.close().then(() => {
    console.log('👋 File watcher stopped. Goodbye!');
    process.exit(0);
  });
});

module.exports = {
  processFaxFile,
  uploadToCloud,
  moveToProcessed,
  moveToError,
  isFaxFile
};