// healthcheck/serviceDependencyHealth.js
class ServiceDependencyHealth {
  constructor() {
    this.dependencies = new Map();
  }

  defineDependency(service, dependsOn = []) {
    this.dependencies.set(service, {
      name: service,
      dependsOn,
      status: 'unknown',
      lastCheck: null
    });
  }

  async checkServiceHealth(serviceName) {
    const service = this.dependencies.get(serviceName);
    if (!service) return { status: 'unknown' };

    // 检查所有依赖
    const dependencyResults = await Promise.all(
      service.dependsOn.map(dep => this.checkEndpoint(dep))
    );

    const allHealthy = dependencyResults.every(r => r.healthy);
    
    service.status = allHealthy ? 'healthy' : 'degraded';
    service.lastCheck = Date.now();
    service.dependencies = dependencyResults;

    return service;
  }

  async checkEndpoint(endpoint) {
    try {
      const response = await axios.get(endpoint.url, { 
        timeout: 2000,
        validateStatus: () => true 
      });
      
      return {
        name: endpoint.name,
        url: endpoint.url,
        healthy: response.status < 400,
        statusCode: response.status,
        responseTime: response.headers['x-response-time']
      };
    } catch (error) {
      return {
        name: endpoint.name,
        url: endpoint.url,
        healthy: false,
        error: error.message
      };
    }
  }

  async checkAll() {
    const results = {};
    
    for (const [name, service] of this.dependencies) {
      results[name] = await this.checkServiceHealth(name);
    }
    
    return this.buildDependencyGraph(results);
  }

  buildDependencyGraph(results) {
    return {
      services: results,
      graph: this.generateMermaidDiagram(results),
      criticalPath: this.findCriticalPath(results)
    };
  }
}

// 使用示例
const serviceHealth = new ServiceDependencyHealth();

serviceHealth.defineDependency('patientAPI', [
  { name: 'authService', url: 'http://localhost:3000/api/auth/verify' },
  { name: 'database', url: 'http://localhost:3000/health/db' }
]);

serviceHealth.defineDependency('appointmentAPI', [
  { name: 'patientAPI', url: 'http://localhost:3000/api/patients/health' },
  { name: 'notificationService', url: 'http://localhost:3000/api/notifications/health' }
]);
