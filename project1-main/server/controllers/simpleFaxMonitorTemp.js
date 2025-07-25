//simpleFaxMonitorTemp.js
const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Simple Fax Monitoring...');

// Folders to create
const folders = [
  'C:/FaxInbox',
  'C:/FaxProcessed', 
  'C:/FaxError'
];

// Create folders
folders.forEach(folder => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    console.log(`📁 Created: ${folder}`);
  } else {
    console.log(`📁 Already exists: ${folder}`);
  }
});

// Create a test fax file
const testFaxContent = `
MEDICAL FAX REPORT
===============================
Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}
Patient: Test Patient
DOB: 01/01/1990

FINDINGS:
This is a test fax file for monitoring system.
Contains medical keywords like: findings, impression, CT scan.

IMPRESSION:
Test file for automated processing.
Severity should be low-moderate.

===============================
End of Report
`;

const testFaxPath = path.join('C:/FaxInbox', 'test-fax.txt');
fs.writeFileSync(testFaxPath, testFaxContent);
console.log(`📄 Created test file: ${testFaxPath}`);

console.log('\n✅ Setup complete!');
console.log('\nNext steps:');
console.log('1. Install chokidar: npm install chokidar');
console.log('2. Run monitor: node simpleFaxMonitor.js');
console.log('3. Test by copying files to C:/FaxInbox');
