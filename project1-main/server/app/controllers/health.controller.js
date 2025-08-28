const mongoose = require('mongoose');
const redis = require('redis');
const axios = require('axios');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

// Import your existing audit service
const { ServerAuditService } = require('./AuditService');
const auditService = new ServerAuditService();

// Prometheus metrics
const promClient = require('prom-client');
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const healthCheckDuration = new promClient.Histogram({
  name: 'health_check_duration_seconds',
  help: 'Duration of health check components',
  labelNames: ['component'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1]
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['type']
});

const externalServiceStatus = new promClient.Gauge({
  name: 'external_service_status',
  help: 'Status of external services (1=up, 0=down)',
  labelNames: ['service']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(healthCheckDuration);
register.registerMetric(activeConnections);
register.registerMetric(externalServiceStatus);

// Health check cache to prevent overwhelming checks
let healthCache = null;
let healthCacheTime = 0;
const HEALTH_CACHE_TTL = 5000; // 5 seconds

/**
 * Basic health check - lightweight, frequently called
 */
exports.health = async (req, res) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'healthbridge-api',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    // Send to Sentry if configured
    if (global.__SENTRY__) {
      global.__SENTRY__.addBreadcrumb({
        message: 'Health check',
        level: 'info',
        data: healthData
      });
    }

    res.status(200).json(healthData);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Liveness probe - Kubernetes uses this to know if pod should be restarted
 * Should be lightweight and not check external dependencies
 */
exports.liveness = async (req, res) => {
  try {
    // Basic application liveness check
    const memoryUsage = process.memoryUsage();
    const maxMemory = 1024 * 1024 * 1024; // 1GB threshold
    
    if (memoryUsage.heapUsed > maxMemory) {
      throw new Error('Memory threshold exceeded');
    }

    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      pid: process.pid
    });
  } catch (error) {
    // Log to monitoring
    console.error('Liveness check failed:', error);
    
    res.status(503).json({
      status: 'dead',
      error: error.message
    });
  }
};

/**
 * Readiness probe - Kubernetes uses this to know if pod can receive traffic
 * Should check critical dependencies
 */
exports.readiness = async (req, res) => {
  const start = Date.now();
  
  try {
    // Use cache if available
    if (healthCache && (Date.now() - healthCacheTime) < HEALTH_CACHE_TTL) {
      return res.status(healthCache.httpStatus).json(healthCache);
    }

    const checks = await performReadinessChecks();
    const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
    
    const response = {
      status: allHealthy ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      duration: Date.now() - start,
      checks
    };

    // Cache the result
    healthCache = { ...response, httpStatus: allHealthy ? 200 : 503 };
    healthCacheTime = Date.now();

    res.status(allHealthy ? 200 : 503).json(response);
  } catch (error) {
    console.error('Readiness check error:', error);
    
    res.status(503).json({
      status: 'not_ready',
      error: error.message,
      duration: Date.now() - start
    });
  }
};

/**
 * Detailed health check with all components
 */
exports.detailedHealth = async (req, res) => {
  const start = Date.now();
  
  try {
    const [
      dbHealth,
      redisHealth,
      externalServices,
      systemHealth,
      applicationMetrics
    ] = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkExternalServices(),
      getSystemHealth(),
      getApplicationMetrics()
    ]);

    const health = {
      status: 'detailed',
      timestamp: new Date().toISOString(),
      duration: Date.now() - start,
      components: {
        database: dbHealth.status === 'fulfilled' ? dbHealth.value : { status: 'error', error: dbHealth.reason?.message },
        redis: redisHealth.status === 'fulfilled' ? redisHealth.value : { status: 'error', error: redisHealth.reason?.message },
        externalServices: externalServices.status === 'fulfilled' ? externalServices.value : { status: 'error' },
        system: systemHealth.status === 'fulfilled' ? systemHealth.value : { status: 'error' },
        application: applicationMetrics.status === 'fulfilled' ? applicationMetrics.value : { status: 'error' }
      }
    };

    // Determine overall health
    const criticalComponents = [health.components.database, health.components.redis];
    const isHealthy = criticalComponents.every(c => c.status === 'healthy');

    health.overall = isHealthy ? 'healthy' : 'degraded';

    // Send metrics to monitoring services
    await sendToMonitoring(health);

    res.status(isHealthy ? 200 : 503).json(health);
  } catch (error) {
    console.error('Detailed health check failed:', error);
    
    res.status(503).json({
      status: 'error',
      error: error.message,
      duration: Date.now() - start
    });
  }
};

/**
 * Prometheus metrics endpoint
 */
exports.metrics = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper functions

async function performReadinessChecks() {
  const checks = {};
  
  // Database check
  const dbStart = Date.now();
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      checks.database = { status: 'healthy', duration: Date.now() - dbStart };
      externalServiceStatus.set({ service: 'mongodb' }, 1);
    } else {
      checks.database = { status: 'unhealthy', error: 'Not connected' };
      externalServiceStatus.set({ service: 'mongodb' }, 0);
    }
  } catch (error) {
    checks.database = { status: 'unhealthy', error: error.message };
    externalServiceStatus.set({ service: 'mongodb' }, 0);
  }
  healthCheckDuration.observe({ component: 'database' }, (Date.now() - dbStart) / 1000);

  // Redis check (if configured)
  if (process.env.REDIS_URL) {
    const redisStart = Date.now();
    try {
      const redisClient = redis.createClient({ url: process.env.REDIS_URL });
      await redisClient.connect();
      await redisClient.ping();
      await redisClient.quit();
      checks.redis = { status: 'healthy', duration: Date.now() - redisStart };
      externalServiceStatus.set({ service: 'redis' }, 1);
    } catch (error) {
      checks.redis = { status: 'unhealthy', error: error.message };
      externalServiceStatus.set({ service: 'redis' }, 0);
    }
    healthCheckDuration.observe({ component: 'redis' }, (Date.now() - redisStart) / 1000);
  }

  return checks;
}

async function checkDatabase() {
  const start = Date.now();
  
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }

    // Perform a simple query
    await mongoose.connection.db.admin().ping();
    
    // Get connection stats
    const stats = await mongoose.connection.db.stats();
    
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      connections: mongoose.connection.readyState,
      collections: stats.collections,
      dataSize: stats.dataSize,
      indexes: stats.indexes
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error.message
    };
  }
}

async function checkRedis() {
  if (!process.env.REDIS_URL) {
    return { status: 'not_configured' };
  }

  const start = Date.now();
  
  try {
    const client = redis.createClient({ url: process.env.REDIS_URL });
    await client.connect();
    
    const info = await client.info();
    const ping = await client.ping();
    
    await client.quit();
    
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      ping: ping,
      version: info.match(/redis_version:([^\r\n]+)/)?.[1],
      connectedClients: info.match(/connected_clients:([^\r\n]+)/)?.[1],
      usedMemory: info.match(/used_memory_human:([^\r\n]+)/)?.[1]
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start,
      error: error.message
    };
  }
}

async function checkExternalServices() {
  const services = {};
  
  // Check Epic FHIR API
  if (process.env.EPIC_FHIR_BASE_URL) {
    const epicStart = Date.now();
    try {
      const response = await axios.get(`${process.env.EPIC_FHIR_BASE_URL}/metadata`, {
        timeout: 5000,
        validateStatus: () => true
      });
      services.epic = {
        status: response.status < 500 ? 'healthy' : 'degraded',
        statusCode: response.status,
        responseTime: Date.now() - epicStart
      };
      externalServiceStatus.set({ service: 'epic' }, response.status < 500 ? 1 : 0);
    } catch (error) {
      services.epic = {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - epicStart
      };
      externalServiceStatus.set({ service: 'epic' }, 0);
    }
  }

  // Check OfficeAlly API
  if (process.env.OFFICEALLY_API_URL) {
    const oaStart = Date.now();
    try {
      const response = await axios.get(`${process.env.OFFICEALLY_API_URL}/status`, {
        timeout: 5000,
        validateStatus: () => true
      });
      services.officeAlly = {
        status: response.status < 500 ? 'healthy' : 'degraded',
        statusCode: response.status,
        responseTime: Date.now() - oaStart
      };
      externalServiceStatus.set({ service: 'officeally' }, response.status < 500 ? 1 : 0);
    } catch (error) {
      services.officeAlly = {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - oaStart
      };
      externalServiceStatus.set({ service: 'officeally' }, 0);
    }
  }

  return services;
}

async function getSystemHealth() {
  const load = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    status: 'healthy',
    hostname: os.hostname(),
    platform: os.platform(),
    architecture: os.arch(),
    cpus: os.cpus().length,
    loadAverage: {
      '1m': load[0],
      '5m': load[1],
      '15m': load[2]
    },
    memory: {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      percentUsed: ((usedMem / totalMem) * 100).toFixed(2)
    },
    uptime: os.uptime()
  };
}

async function getApplicationMetrics() {
  const memUsage = process.memoryUsage();
  
  return {
    status: 'healthy',
    process: {
      pid: process.pid,
      version: process.version,
      uptime: process.uptime(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      }
    },
    activeRequests: global.activeRequests || 0,
    totalRequests: global.totalRequests || 0,
    averageResponseTime: global.averageResponseTime || 0
  };
}

async function sendToMonitoring(health) {
  const promises = [];
  
  // Send to Sentry
  if (global.__SENTRY__ && health.overall !== 'healthy') {
    global.__SENTRY__.captureMessage('Health check degraded', {
      level: 'warning',
      extra: health
    });
  }

  // Send to custom APM endpoint if configured
  if (process.env.APM_ENDPOINT) {
    promises.push(
      axios.post(process.env.APM_ENDPOINT, health, {
        timeout: 2000,
        headers: {
          'X-API-Key': process.env.APM_API_KEY
        }
      }).catch(err => console.error('APM send failed:', err))
    );
  }

  // Update Prometheus metrics
  if (health.components) {
    Object.entries(health.components).forEach(([component, data]) => {
      if (data.responseTime) {
        healthCheckDuration.observe({ component }, data.responseTime / 1000);
      }
    });
  }

  await Promise.allSettled(promises);
}

// Middleware to track request metrics
exports.metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  // Track active connections
  global.activeRequests = (global.activeRequests || 0) + 1;
  activeConnections.set({ type: 'http' }, global.activeRequests);
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    // Record metrics
    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route?.path || 'unknown',
        status_code: res.statusCode
      },
      duration
    );
    
    // Update global metrics
    global.activeRequests--;
    global.totalRequests = (global.totalRequests || 0) + 1;
    
    // Update rolling average response time
    const currentAvg = global.averageResponseTime || 0;
    const totalReqs = global.totalRequests || 1;
    global.averageResponseTime = ((currentAvg * (totalReqs - 1)) + duration) / totalReqs;
    
    activeConnections.set({ type: 'http' }, global.activeRequests);
  });
  
  next();
};