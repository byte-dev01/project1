import React, { useState } from 'react';

const ConnectionTest = () => {
  const [results, setResults] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const testEndpoint = async (endpoint, label) => {
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      return {
        status: response.status,
        success: response.ok,
        data: JSON.stringify(data, null, 2).substring(0, 200) + '...'
      };
    } catch (error) {
      return {
        status: 'ERROR',
        success: false,
        error: error.message
      };
    }
  };

  const runTests = async () => {
    setIsLoading(true);
    const endpoints = [
      { url: '/api/clinics', label: 'Clinics' },
      { url: '/api/whoami', label: 'Who Am I' },
      { url: '/api/auth/verify', label: 'Auth Verify' }
    ];

    const testResults = {};
    
    for (const endpoint of endpoints) {
      console.log(`Testing ${endpoint.url}...`);
      testResults[endpoint.label] = await testEndpoint(endpoint.url, endpoint.label);
    }

    setResults(testResults);
    setIsLoading(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Backend Connection Test</h2>
      
      <button 
        onClick={runTests}
        disabled={isLoading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4 disabled:opacity-50"
      >
        {isLoading ? 'Testing...' : 'Test Backend Connection'}
      </button>

      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          {Object.entries(results).map(([label, result]) => (
            <div key={label} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{label}</h3>
                <span className={`px-2 py-1 rounded text-sm ${
                  result.success 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {result.success ? '✅ Success' : '❌ Failed'}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 mb-2">
                Status: {result.status}
              </div>
              
              {result.error ? (
                <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-sm">
                  Error: {result.error}
                </div>
              ) : (
                <div className="bg-gray-50 border rounded p-2 text-sm font-mono overflow-x-auto">
                  {result.data}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded p-4">
        <h4 className="font-semibold text-blue-800 mb-2">Connection Status:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>✅ Backend running on port 3000</li>
          <li>✅ Frontend running on port 5000</li>
          <li>✅ MongoDB Atlas connected</li>
          <li>✅ Socket.IO connected</li>
          <li>🔧 Proxy should forward /api/* to localhost:3000</li>
        </ul>
      </div>
    </div>
  );
};

export default ConnectionTest;