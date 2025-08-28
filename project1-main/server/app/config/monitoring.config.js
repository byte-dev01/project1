/**
 * Monitoring Configuration
 * Integrates with Sentry, Prometheus, and other APM tools
 */

const Sentry = require("@sentry/node");
const { ProfilingIntegration } = require("@sentry/profiling-node");

const monitoringConfig = {
  // Sentry Configuration
  sentry: {
    enabled: process.env.SENTRY_DSN ? true : false,
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 0.1,
    integrations: [
      new ProfilingIntegration(),
    ],
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers?.authorization;
        delete event.request.headers?.['x-access-token'];
      }
      
      // Don't send events in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_FORCE_SEND) {
        return null;
      }
      
      return event;
    },
    beforeSendTransaction(event) {
      // Filter out health check transactions
      if (event.transaction?.includes('/health')) {
        return null;
      }
      return event;
    }
  },

  // Prometheus Configuration
  prometheus: {
    enabled: process.env.ENABLE_PROMETHEUS !== 'false',
    collectDefaultMetrics: true,
    prefix: 'healthbridge_',
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    httpDurationBuckets: [0.003, 0.03, 0.1, 0.3, 1.5, 10]
  },

  // Custom APM Configuration (DataDog, New Relic, etc.)
  apm: {
    datadog: {
      enabled: process.env.DD_API_KEY ? true : false,
      apiKey: process.env.DD_API_KEY,
      appKey: process.env.DD_APP_KEY,
      site: process.env.DD_SITE || 'datadoghq.com',
      service: 'healthbridge-api',
      env: process.env.NODE_ENV
    },
    newRelic: {
      enabled: process.env.NEW_RELIC_LICENSE_KEY ? true : false,
      appName: 'HealthBridge API',
      licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
      logging: {
        level: 'info'
      }
    }
  },

  // Health Check Thresholds
  thresholds: {
    memory: {
      heapUsedPercent: 85, // Alert if heap usage > 85%
      rssLimit: 1024 * 1024 * 1024, // 1GB RSS limit
    },
    responseTime: {
      p50: 100, // 50th percentile should be < 100ms
      p95: 500, // 95th percentile should be < 500ms
      p99: 1000 // 99th percentile should be < 1000ms
    },
    errorRate: {
      threshold: 0.01, // Alert if error rate > 1%
      window: 300 // Check over 5 minute windows
    },
    database: {
      connectionTimeout: 5000, // 5 seconds
      queryTimeout: 30000, // 30 seconds
      maxConnections: 100
    },
    external: {
      timeout: 10000, // 10 seconds for external services
      retries: 3
    }
  },

  // Alert Configurations
  alerts: {
    slack: {
      enabled: process.env.SLACK_WEBHOOK_URL ? true : false,
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
      username: 'HealthBridge Monitor',
      thresholds: {
        criticalErrorRate: 0.05, // 5% error rate
        highMemoryUsage: 90, // 90% memory usage
        slowResponseTime: 2000, // 2 seconds
        serviceDown: true // Alert when external service is down
      }
    },
    pagerDuty: {
      enabled: process.env.PAGERDUTY_INTEGRATION_KEY ? true : false,
      integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
      serviceId: process.env.PAGERDUTY_SERVICE_ID
    },
    email: {
      enabled: process.env.ALERT_EMAIL ? true : false,
      to: process.env.ALERT_EMAIL,
      from: process.env.ALERT_FROM_EMAIL || 'alerts@healthbridge.com'
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    transports: ['console', 'file'],
    file: {
      filename: 'logs/healthbridge.log',
      maxSize: '20m',
      maxFiles: 5
    },
    sensitiveFields: [
      'password',
      'token',
      'authorization',
      'ssn',
      'dob',
      'mrn'
    ]
  }
};

/**
 * Initialize monitoring services
 */
function initializeMonitoring(app) {
  // Initialize Sentry
  if (monitoringConfig.sentry.enabled) {
    Sentry.init(monitoringConfig.sentry);
    
    // Add Sentry middleware
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
    
    // Make Sentry available globally for health checks
    global.__SENTRY__ = Sentry;
    
    console.log('✅ Sentry monitoring initialized');
  }

  // Initialize DataDog
  if (monitoringConfig.apm.datadog.enabled) {
    try {
      const tracer = require('dd-trace').init({
        service: monitoringConfig.apm.datadog.service,
        env: monitoringConfig.apm.datadog.env,
        version: process.env.APP_VERSION,
        analytics: true,
        logInjection: true,
        profiling: true,
        runtimeMetrics: true
      });
      
      global.__DD_TRACER__ = tracer;
      console.log('✅ DataDog APM initialized');
    } catch (error) {
      console.error('Failed to initialize DataDog:', error);
    }
  }

  // Initialize New Relic
  if (monitoringConfig.apm.newRelic.enabled) {
    try {
      require('newrelic');
      console.log('✅ New Relic APM initialized');
    } catch (error) {
      console.error('Failed to initialize New Relic:', error);
    }
  }

  return monitoringConfig;
}

/**
 * Send alert to configured channels
 */
async function sendAlert(severity, message, details) {
  const axios = require('axios');
  const promises = [];

  // Send to Slack
  if (monitoringConfig.alerts.slack.enabled) {
    const slackMessage = {
      channel: monitoringConfig.alerts.slack.channel,
      username: monitoringConfig.alerts.slack.username,
      icon_emoji: severity === 'critical' ? ':rotating_light:' : ':warning:',
      attachments: [{
        color: severity === 'critical' ? 'danger' : 'warning',
        title: `[${severity.toUpperCase()}] ${message}`,
        text: JSON.stringify(details, null, 2),
        footer: 'HealthBridge Monitoring',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    promises.push(
      axios.post(monitoringConfig.alerts.slack.webhookUrl, slackMessage)
        .catch(err => console.error('Slack alert failed:', err))
    );
  }

  // Send to PagerDuty
  if (monitoringConfig.alerts.pagerDuty.enabled && severity === 'critical') {
    const pdEvent = {
      routing_key: monitoringConfig.alerts.pagerDuty.integrationKey,
      event_action: 'trigger',
      dedup_key: `healthbridge-${message}`,
      payload: {
        summary: message,
        severity: 'critical',
        source: 'healthbridge-api',
        custom_details: details
      }
    };

    promises.push(
      axios.post('https://events.pagerduty.com/v2/enqueue', pdEvent)
        .catch(err => console.error('PagerDuty alert failed:', err))
    );
  }

  await Promise.allSettled(promises);
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown() {
  let isShuttingDown = false;

  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n${signal} received. Starting graceful shutdown...`);

    // Send shutdown alert
    await sendAlert('info', 'Service shutting down', { signal, time: new Date().toISOString() });

    // Close monitoring connections
    if (global.__SENTRY__) {
      await Sentry.close(2000);
    }

    // Allow time for final metrics to be sent
    setTimeout(() => {
      process.exit(0);
    }, 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = {
  monitoringConfig,
  initializeMonitoring,
  sendAlert,
  setupGracefulShutdown
};