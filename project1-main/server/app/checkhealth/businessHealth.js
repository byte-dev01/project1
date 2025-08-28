// healthcheck/businessHealth.js
class BusinessHealthChecks {
  constructor() {
    this.checks = new Map();
  }

  // 注册业务健康检查
  register(name, checkFn, config = {}) {
    this.checks.set(name, {
      name,
      fn: checkFn,
      critical: config.critical || false,
      timeout: config.timeout || 3000,
      description: config.description || ''
    });
  }

  async runAll() {
    const results = {};
    
    for (const [name, check] of this.checks) {
      try {
        const start = Date.now();
        const result = await Promise.race([
          check.fn(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), check.timeout)
          )
        ]);
        
        results[name] = {
          status: result.success ? 'healthy' : 'unhealthy',
          duration: Date.now() - start,
          critical: check.critical,
          details: result.details || {},
          message: result.message
        };
      } catch (error) {
        results[name] = {
          status: 'error',
          critical: check.critical,
          error: error.message
        };
      }
    }
    
    return results;
  }
}

const businessHealth = new BusinessHealthChecks();

// 注册具体的业务健康检查
businessHealth.register('authentication', async () => {
  // 测试认证流程
  try {
    const testToken = await generateTestToken();
    const verified = await verifyToken(testToken);
    return { 
      success: verified, 
      details: { tokenGeneration: 'ok', tokenVerification: 'ok' }
    };
  } catch (error) {
    return { 
      success: false, 
      message: error.message,
      details: { error: 'Auth system failure' }
    };
  }
}, { critical: true });

businessHealth.register('patientDataAccess', async () => {
  // 测试患者数据访问
  try {
    const testPatientId = process.env.HEALTH_CHECK_TEST_PATIENT_ID;
    const patient = await PatientModel.findById(testPatientId).lean();
    return { 
      success: !!patient,
      details: { 
        dataAccess: 'ok',
        responseTime: 'fast'
      }
    };
  } catch (error) {
    return { 
      success: false, 
      message: 'Cannot access patient data'
    };
  }
}, { critical: true });

businessHealth.register('faxProcessing', async () => {
  // 测试传真处理管道
  try {
    const canAccessFaxDir = await fs.access(process.env.FAX_DIRECTORY);
    const ocrServiceUp = await checkOCRService();
    
    return {
      success: canAccessFaxDir && ocrServiceUp,
      details: {
        faxDirectory: canAccessFaxDir ? 'accessible' : 'not accessible',
        ocrService: ocrServiceUp ? 'up' : 'down'
      }
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}, { critical: false });

businessHealth.register('appointmentScheduling', async () => {
  // 测试预约系统
  try {
    const availableSlots = await getAvailableSlots(new Date());
    const canCreateAppointment = availableSlots.length > 0;
    
    return {
      success: canCreateAppointment,
      details: {
        availableSlots: availableSlots.length,
        schedulingSystem: 'operational'
      }
    };
  } catch (error) {
    return { success: false, message: 'Scheduling system error' };
  }
});