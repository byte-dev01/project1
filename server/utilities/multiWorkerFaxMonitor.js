// multiWorkerFaxMonitor.js - Multi-worker file processing
const cluster = require('cluster');
const os = require('os');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

// Configuration
const FAX_FOLDER = 'C:/FaxInbox';
const PROCESSED_FOLDER = 'C:/FaxProcessed';
const ERROR_FOLDER = 'C:/FaxError';
const WORKERS = process.env.WORKERS || os.cpus().length;

console.log('🚀 Multi-Worker Fax Monitor Starting...');
console.log(`💻 Available CPUs: ${os.cpus().length}`);
console.log(`👷 Starting ${WORKERS} workers`);

if (cluster.isMaster) {
  // =====================================
  // MASTER PROCESS - FILE MONITORING
  // =====================================
  
  console.log(`🔧 Master process ${process.pid} starting`);
  
  // Create folders
  function createFoldersIfNeeded() {
    [FAX_FOLDER, PROCESSED_FOLDER, ERROR_FOLDER].forEach(folder => {
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        console.log(`📁 Created folder: ${folder}`);
      }
    });
  }
  
  // Check if file is supported format
  function isFaxFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const supportedFormats = ['.tif', '.tiff', '.pdf', '.png', '.jpg', '.jpeg'];
    return supportedFormats.includes(ext);
  }
  
  // Move file to processed/error folder
  function moveFile(filePath, targetFolder, reason = '') {
    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const newPath = path.join(targetFolder, `${timestamp}_${fileName}`);
    
    try {
      fs.renameSync(filePath, newPath);
      console.log(`📁 Moved ${fileName} to ${path.basename(targetFolder)}`);
      
      // Create error log if moving to error folder
      if (targetFolder === ERROR_FOLDER && reason) {
        const errorLogPath = path.join(ERROR_FOLDER, `${timestamp}_${fileName}.error.txt`);
        fs.writeFileSync(errorLogPath, `Error: ${reason}\nTime: ${new Date().toISOString()}`);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Failed to move ${fileName}:`, error.message);
      return false;
    }
  }
  
  // Queue for managing file processing
  let processingQueue = [];
  let isProcessing = false;
  
  // Worker management
  const workers = new Map();
  
  // Fork workers
  for (let i = 0; i < WORKERS; i++) {
    const worker = cluster.fork();
    workers.set(worker.id, {
      worker: worker,
      busy: false,
      processedCount: 0,
      startTime: Date.now()
    });
    
    console.log(`👷 Worker ${worker.process.pid} started (ID: ${worker.id})`);
  }
  
  // Handle worker messages
  cluster.on('message', (worker, message) => {
    const workerInfo = workers.get(worker.id);
    
    if (message.type === 'PROCESSING_COMPLETE') {
      workerInfo.busy = false;
      workerInfo.processedCount++;
      
      const { filePath, success, error, result } = message;
      
      if (success) {
        console.log(`✅ Worker ${worker.id} completed: ${path.basename(filePath)}`);
        moveFile(filePath, PROCESSED_FOLDER);
      } else {
        console.error(`❌ Worker ${worker.id} failed: ${path.basename(filePath)} - ${error}`);
        moveFile(filePath, ERROR_FOLDER, error);
      }
      
      // Process next file in queue
      setTimeout(processQueue, 100);
    }
  });
  
  // Handle worker crashes
  cluster.on('exit', (worker, code, signal) => {
    console.log(`💥 Worker ${worker.process.pid} died (${signal || code})`);
    workers.delete(worker.id);
    
    // Restart worker
    const newWorker = cluster.fork();
    workers.set(newWorker.id, {
      worker: newWorker,
      busy: false,
      processedCount: 0,
      startTime: Date.now()
    });
    
    console.log(`🔄 Restarted worker ${newWorker.process.pid} (ID: ${newWorker.id})`);
  });
  
  // Queue processing function
  function processQueue() {
    if (isProcessing || processingQueue.length === 0) return;
    
    // Find available worker
    const availableWorker = Array.from(workers.values()).find(w => !w.busy);
    if (!availableWorker) {
      console.log('⏳ All workers busy, waiting...');
      return;
    }
    
    isProcessing = true;
    const filePath = processingQueue.shift();
    
    availableWorker.busy = true;
    availableWorker.worker.send({
      type: 'PROCESS_FILE',
      filePath: filePath
    });
    
    console.log(`📋 Queue: ${processingQueue.length} files remaining`);
    console.log(`🔄 Assigned to worker ${availableWorker.worker.id}: ${path.basename(filePath)}`);
    
    isProcessing = false;
  }
  
  // Create folders
  createFoldersIfNeeded();
  
  // File watcher
  const watcher = chokidar.watch(FAX_FOLDER, {
    ignored: /^\./,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });
  
  watcher
    .on('add', (filePath) => {
      if (isFaxFile(filePath)) {
        console.log(`📥 New fax detected: ${path.basename(filePath)}`);
        processingQueue.push(filePath);
        processQueue();
      } else {
        console.log(`⚠️ Unsupported format: ${path.basename(filePath)}`);
      }
    })
    .on('ready', () => {
      console.log('👀 File watcher ready!');
      console.log(`📁 Monitoring: ${FAX_FOLDER}`);
      console.log(`👷 ${WORKERS} workers standing by`);
    })
    .on('error', (error) => {
      console.error('👀 Watcher error:', error);
    });
  
  // Status reporting
  setInterval(() => {
    const totalProcessed = Array.from(workers.values()).reduce((sum, w) => sum + w.processedCount, 0);
    const busyWorkers = Array.from(workers.values()).filter(w => w.busy).length;
    
    console.log(`📊 Status: ${totalProcessed} processed | ${busyWorkers}/${WORKERS} workers busy | ${processingQueue.length} in queue`);
  }, 30000); // Every 30 seconds
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down master process...');
    
    watcher.close().then(() => {
      console.log('👀 File watcher stopped');
      
      // Kill all workers
      for (const workerInfo of workers.values()) {
        workerInfo.worker.kill();
      }
      
      console.log('👋 All workers stopped. Goodbye!');
      process.exit(0);
    });
  });

} else {
  // =====================================
  // WORKER PROCESS - FILE PROCESSING
  // =====================================
  
  const handleNewFax = require('../controllers/handleNewFax');
  
  console.log(`👷 Worker ${process.pid} (ID: ${cluster.worker.id}) ready for processing`);
  
  // Listen for file processing requests
  process.on('message', async (message) => {
    if (message.type === 'PROCESS_FILE') {
      const { filePath } = message;
      const fileName = path.basename(filePath);
      
      console.log(`👷 Worker ${cluster.worker.id} processing: ${fileName}`);
      
      try {
        const result = await handleNewFax(filePath);
        
        // Send success message back to master
        process.send({
          type: 'PROCESSING_COMPLETE',
          filePath: filePath,
          success: true,
          result: result
        });
        
      } catch (error) {
        console.error(`👷 Worker ${cluster.worker.id} error:`, error.message);
        
        // Send error message back to master
        process.send({
          type: 'PROCESSING_COMPLETE',
          filePath: filePath,
          success: false,
          error: error.message
        });
      }
    }
  });
  
  // Handle worker shutdown
  process.on('SIGTERM', () => {
    console.log(`👷 Worker ${process.pid} shutting down...`);
    process.exit(0);
  });
}