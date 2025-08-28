// routes/health.js
router.get('/health/internal', async (req, res) => {
  try {
    const [
      apiStats,
      businessChecks,
      serviceDependencies,
      syntheticResults
    ] = await Promise.allSettled([
      apiMonitor.getAllStats(),
      businessHealth.runAll(),
      serviceHealth.checkAll(),
      synthetic.runAll()
    ]);

    const health = {
      timestamp: new Date().toISOString(),
      apis: {
        summary: summarizeAPIHealth(apiStats.value),
        details: apiStats.value
      },
      business: {
        summary: summarizeBusinessHealth(businessChecks.value),
        checks: businessChecks.value
      },
      dependencies: serviceDependencies.value,
      synthetic: {
        scenarios: syntheticResults.value,
        successRates: getScenarioSuccessRates()
      }
    };

    // 计算整体健康分数
    const healthScore = calculateHealthScore(health);
    health.score = healthScore;
    health.status = getStatusFromScore(healthScore);

    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error.message
    });
  }
});

function calculateHealthScore(health) {
  let score = 100;
  
  // API健康 (40分)
  const unhealthyAPIs = health.apis.details?.filter(
    api => api.health !== 'healthy'
  ).length || 0;
  score -= unhealthyAPIs * 5;
  
  // 业务健康 (30分)
  const failedBusinessChecks = Object.values(health.business.checks || {})
    .filter(check => check.status !== 'healthy').length;
  score -= failedBusinessChecks * 10;
  
  // 依赖健康 (20分)
  const unhealthyDependencies = Object.values(health.dependencies?.services || {})
    .filter(service => service.status !== 'healthy').length;
  score -= unhealthyDependencies * 10;
  
  // 合成监控 (10分)
  const failedScenarios = health.synthetic.scenarios?.filter(
    s => !s.success
  ).length || 0;
  score -= failedScenarios * 5;
  
  return Math.max(0, score);
}

function getStatusFromScore(score) {
  if (score >= 90) return 'healthy';
  if (score >= 70) return 'degraded';
  if (score >= 50) return 'partial';
  return 'unhealthy';
}