// middleware/apiMonitoring.js
class APIMonitor {
  constructor() {
    this.endpoints = new Map();
    this.window = 60000; // 1分钟滑动窗口
  }

  recordRequest(endpoint, method, statusCode, duration) {
    const key = `${method}:${endpoint}`;
    
    if (!this.endpoints.has(key)) {
      this.endpoints.set(key, {
        requests: [],
        errors: [],
        lastUpdated: Date.now()
      });
    }

    const data = this.endpoints.get(key);
    const now = Date.now();
    
    // 清理旧数据
    data.requests = data.requests.filter(r => now - r.timestamp < this.window);
    data.errors = data.errors.filter(e => now - e.timestamp < this.window);
    
    // 记录新请求
    data.requests.push({
      timestamp: now,
      duration,
      statusCode
    });
    
    if (statusCode >= 400) {
      data.errors.push({
        timestamp: now,
        statusCode
      });
    }
    
    data.lastUpdated = now;
  }

  getStats(endpoint, method) {
    const key = `${method}:${endpoint}`;
    const data = this.endpoints.get(key);
    
    if (!data) return null;
    
    const requests = data.requests;
    const errors = data.errors;
    
    if (requests.length === 0) return null;
    
    const durations = requests.map(r => r.duration);
    const sorted = [...durations].sort((a, b) => a - b);
    
    return {
      endpoint,
      method,
      metrics: {
        count: requests.length,
        errorCount: errors.length,
        errorRate: (errors.length / requests.length * 100).toFixed(2) + '%',
        avgDuration: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2),
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        min: Math.min(...durations),
        max: Math.max(...durations)
      },
      health: this.determineHealth(requests, errors)
    };
  }

  determineHealth(requests, errors) {
    const errorRate = errors.length / requests.length;
    const avgDuration = requests.reduce((sum, r) => sum + r.duration, 0) / requests.length;
    
    if (errorRate > 0.1) return 'unhealthy';  // >10% 错误率
    if (errorRate > 0.05) return 'degraded';  // >5% 错误率
    if (avgDuration > 5000) return 'slow';    // >5秒平均响应
    if (avgDuration > 2000) return 'degraded'; // >2秒平均响应
    
    return 'healthy';
  }

  getAllStats() {
    const stats = [];
    
    for (const [key, data] of this.endpoints) {
      const [method, ...endpointParts] = key.split(':');
      const endpoint = endpointParts.join(':');
      const stat = this.getStats(endpoint, method);
      if (stat) stats.push(stat);
    }
    
    return stats;
  }
}

const apiMonitor = new APIMonitor();

// 监控中间件
const monitoringMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // 捕获原始的 res.end
  const originalEnd = res.end;
  
  res.end = function(...args) {
    const duration = Date.now() - start;
    
    // 记录到监控器
    apiMonitor.recordRequest(
      req.route?.path || req.path,
      req.method,
      res.statusCode,
      duration
    );
    
    // 调用原始的 end
    originalEnd.apply(res, args);
  };
  
  next();
};
