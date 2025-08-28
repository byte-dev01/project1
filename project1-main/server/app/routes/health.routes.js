const controller = require("../controllers/health.controller");

module.exports = function(app) {
  // Add CORS headers for monitoring tools
  app.use("/health/*", function(req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept"
    );
    res.header(
      "Access-Control-Allow-Origin",
      process.env.MONITORING_ORIGIN || "*"
    );
    next();
  });

  /**
   * Basic health check - lightweight
   * Used by: Load balancers, uptime monitors
   * Frequency: Every 10-30 seconds
   */
  app.get("/health", controller.health);

  /**
   * Kubernetes liveness probe
   * Determines if pod should be restarted
   * Frequency: Every 10 seconds after initial delay
   */
  app.get("/health/live", controller.liveness);
  
  /**
   * Kubernetes readiness probe  
   * Determines if pod can receive traffic
   * Frequency: Every 5 seconds
   */
  app.get("/health/ready", controller.readiness);

  /**
   * Detailed health check with all dependencies
   * Used by: Admin dashboards, debugging
   * Frequency: On-demand or every 60 seconds
   */
  app.get("/health/detailed", controller.detailedHealth);

  /**
   * Prometheus metrics endpoint
   * Scraped by Prometheus
   * Frequency: Every 15-30 seconds
   */
  app.get("/metrics", controller.metrics);

  /**
   * Version endpoint for deployment tracking
   */
  app.get("/health/version", (req, res) => {
    res.json({
      version: process.env.APP_VERSION || "1.0.0",
      commit: process.env.GIT_COMMIT || "unknown",
      buildTime: process.env.BUILD_TIME || new Date().toISOString(),
      environment: process.env.NODE_ENV || "development"
    });
  });
};