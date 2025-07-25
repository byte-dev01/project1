const Service = require('node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'FaxMonitorService',
  description: 'Multi-worker fax file monitoring and processing service',
  script: require('path').join(__dirname, './utilities/multiWorkerFaxMonitor.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    },
    {
      name: "WORKERS", 
      value: "4" // Adjust based on your CPU cores
    }
  ]
});

// Listen for the "install" event
svc.on('install', function(){
  console.log('✅ Fax Monitor Service installed successfully!');
  console.log('🚀 Starting service...');
  svc.start();
});

// Listen for the "start" event
svc.on('start', function(){
  console.log('🎉 Fax Monitor Service started!');
});

// Install the service
svc.install();
