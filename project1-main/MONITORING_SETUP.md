# Monitoring Setup Guide

## Required NPM Packages

Add these dependencies to your package.json for monitoring:

```bash
# Prometheus metrics
npm install prom-client

# Sentry for error tracking (optional)
npm install @sentry/node @sentry/profiling-node

# DataDog APM (optional)
npm install dd-trace

# New Relic (optional)
npm install newrelic
```

## Minimal Setup (Just Prometheus)

If you only want basic monitoring without external services:

```bash
npm install prom-client
```

## How to Integrate

### 1. Update your server.js

```javascript
// Add at the top of server.js
const healthRoutes = require('./app/routes/health.routes');
const { metricsMiddleware } = require('./app/controllers/health.controller');

// After your app initialization
app.use(metricsMiddleware); // Track all requests

// Add health check routes
healthRoutes(app);
```

### 2. Test Health Endpoints

```bash
# Basic health check
curl http://localhost:3000/health

# Readiness check
curl http://localhost:3000/health/ready

# Detailed health with dependencies
curl http://localhost:3000/health/detailed

# Prometheus metrics
curl http://localhost:3000/metrics
```

### 3. Optional: Run with Docker Monitoring Stack

```bash
# Start the full monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Access services:
- Grafana: http://localhost:3001 (admin/healthbridge)
- Prometheus: http://localhost:9090
```

## Environment Variables

Add these to your .env file:

```env
# Optional monitoring services
SENTRY_DSN=your-sentry-dsn-here
DD_API_KEY=your-datadog-key-here
NEW_RELIC_LICENSE_KEY=your-newrelic-key-here

# Redis (optional for caching)
REDIS_URL=redis://localhost:6379

# External services to monitor
EPIC_FHIR_BASE_URL=https://api.epic.com/fhir
OFFICEALLY_API_URL=https://api.officeally.com

# Alert webhooks (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
PAGERDUTY_INTEGRATION_KEY=your-pd-key
```

## Kubernetes Deployment

```bash
# Deploy with health checks
kubectl apply -f server/kubernetes/healthbridge-deployment.yaml

# Check pod health
kubectl get pods -n production
kubectl describe pod healthbridge-api-xxxxx -n production
```

## What Gets Monitored

1. **Application Health**
   - Response times (p50, p95, p99)
   - Error rates
   - Active connections
   - Request throughput

2. **System Resources**
   - CPU usage
   - Memory usage
   - Disk space
   - Network status

3. **Dependencies**
   - MongoDB connection
   - Redis availability (if configured)
   - External API status (Epic, OfficeAlly)

4. **Security & Compliance**
   - Audit logs (using your existing AuditService)
   - Failed authentication attempts
   - API access patterns

## Minimal Implementation

If you want the simplest possible setup:

1. Install prom-client: `npm install prom-client`
2. Add health routes to server.js
3. Access `/health` for basic health check
4. Access `/metrics` for Prometheus metrics

The health check system will automatically use your existing:
- MongoDB connection (via mongoose)
- AuditService for logging
- Authentication middleware

No additional configuration needed for basic functionality!