// healthcheck/syntheticMonitoring.js
class SyntheticMonitor {
  constructor() {
    this.scenarios = [];
    this.results = new Map();
  }

  addScenario(scenario) {
    this.scenarios.push(scenario);
  }

  async runScenario(scenario) {
    const start = Date.now();
    const steps = [];
    let success = true;

    for (const step of scenario.steps) {
      const stepStart = Date.now();
      
      try {
        const result = await step.execute();
        steps.push({
          name: step.name,
          success: true,
          duration: Date.now() - stepStart,
          result
        });
      } catch (error) {
        steps.push({
          name: step.name,
          success: false,
          duration: Date.now() - stepStart,
          error: error.message
        });
        success = false;
        
        if (!step.continueOnError) break;
      }
    }

    return {
      scenario: scenario.name,
      success,
      duration: Date.now() - start,
      steps,
      timestamp: new Date().toISOString()
    };
  }

  async runAll() {
    const results = [];
    
    for (const scenario of this.scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
      
      // 保存历史记录
      if (!this.results.has(scenario.name)) {
        this.results.set(scenario.name, []);
      }
      this.results.get(scenario.name).push(result);
      
      // 只保留最近100次结果
      const history = this.results.get(scenario.name);
      if (history.length > 100) {
        history.shift();
      }
    }
    
    return results;
  }

  getSuccessRate(scenarioName, window = 100) {
    const history = this.results.get(scenarioName) || [];
    const recent = history.slice(-window);
    
    if (recent.length === 0) return null;
    
    const successful = recent.filter(r => r.success).length;
    return (successful / recent.length * 100).toFixed(2) + '%';
  }
}

// 定义监控场景
const synthetic = new SyntheticMonitor();

synthetic.addScenario({
  name: 'CompletePatientFlow',
  description: '完整的患者就诊流程',
  steps: [
    {
      name: 'UserLogin',
      execute: async () => {
        const response = await axios.post('/api/auth/login', {
          username: 'test_user',
          password: 'test_pass'
        });
        return { token: response.data.token };
      }
    },
    {
      name: 'SearchPatient',
      execute: async () => {
        const response = await axios.get('/api/patients/search?q=test');
        return { count: response.data.length };
      }
    },
    {
      name: 'CreateAppointment',
      execute: async () => {
        const response = await axios.post('/api/appointments', {
          patientId: 'test_patient',
          date: new Date()
        });
        return { appointmentId: response.data.id };
      }
    },
    {
      name: 'SendNotification',
      execute: async () => {
        const response = await axios.post('/api/notifications/send', {
          type: 'appointment_reminder'
        });
        return { sent: response.data.success };
      },
      continueOnError: true  // 即使失败也继续
    }
  ]
});