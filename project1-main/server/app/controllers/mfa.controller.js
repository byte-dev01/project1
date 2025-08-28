const mfaService = require('../services/mfa.service');
const auditService = require('../services/audit.service');

exports.getMFAStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const status = await mfaService.getUserMFAStatus(userId);
    
    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting MFA status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get MFA status'
    });
  }
};

exports.setupTOTP = async (req, res) => {
  try {
    const userId = req.userId;
    const result = await mfaService.setupTOTP(userId);
    
    await auditService.logActivity({
      userId,
      action: 'MFA_TOTP_SETUP_INITIATED',
      resourceType: 'MFA',
      details: {
        method: 'TOTP'
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(200).json({
      success: true,
      data: {
        secret: result.secret,
        qrCode: result.qrCode,
        manualEntryKey: result.manualEntryKey
      }
    });
  } catch (error) {
    console.error('Error setting up TOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup TOTP'
    });
  }
};

exports.verifyTOTP = async (req, res) => {
  try {
    const userId = req.userId;
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }
    
    const result = await mfaService.verifyTOTP(userId, token);
    
    if (result.success) {
      await auditService.logActivity({
        userId,
        action: 'MFA_TOTP_VERIFIED',
        resourceType: 'MFA',
        details: {
          method: 'TOTP'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(200).json({
        success: true,
        message: 'TOTP verified successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify TOTP'
    });
  }
};

exports.setupSMS = async (req, res) => {
  try {
    const userId = req.userId;
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    const result = await mfaService.setupSMS(userId, phoneNumber);
    
    await auditService.logActivity({
      userId,
      action: 'MFA_SMS_SETUP_INITIATED',
      resourceType: 'MFA',
      details: {
        method: 'SMS',
        phoneNumber: result.phoneNumber
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(200).json({
      success: true,
      data: {
        phoneNumber: result.phoneNumber,
        verificationId: result.verificationId
      }
    });
  } catch (error) {
    console.error('Error setting up SMS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup SMS'
    });
  }
};

exports.verifySMS = async (req, res) => {
  try {
    const userId = req.userId;
    const { verificationId, code } = req.body;
    
    if (!verificationId || !code) {
      return res.status(400).json({
        success: false,
        message: 'Verification ID and code are required'
      });
    }
    
    const result = await mfaService.verifySMSCode(userId, verificationId, code);
    
    if (result.success) {
      await auditService.logActivity({
        userId,
        action: 'MFA_SMS_VERIFIED',
        resourceType: 'MFA',
        details: {
          method: 'SMS'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(200).json({
        success: true,
        message: 'SMS verified successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid verification code',
        attemptsRemaining: result.attemptsRemaining
      });
    }
  } catch (error) {
    console.error('Error verifying SMS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify SMS'
    });
  }
};

exports.resendSMS = async (req, res) => {
  try {
    const userId = req.userId;
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    const verification = await mfaService.sendSMSVerification(userId, phoneNumber);
    
    res.status(200).json({
      success: true,
      data: {
        verificationId: verification._id,
        message: 'Verification code sent'
      }
    });
  } catch (error) {
    console.error('Error resending SMS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend SMS'
    });
  }
};

exports.generateBackupCodes = async (req, res) => {
  try {
    const userId = req.userId;
    const codes = await mfaService.generateBackupCodes(userId);
    
    await auditService.logActivity({
      userId,
      action: 'MFA_BACKUP_CODES_GENERATED',
      resourceType: 'MFA',
      details: {
        count: codes.length
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(200).json({
      success: true,
      data: {
        codes,
        message: 'Store these codes safely. They will not be shown again.'
      }
    });
  } catch (error) {
    console.error('Error generating backup codes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate backup codes'
    });
  }
};

exports.disableMethod = async (req, res) => {
  try {
    const userId = req.userId;
    const { method } = req.params;
    
    const result = await mfaService.disableMethod(userId, method);
    
    await auditService.logActivity({
      userId,
      action: 'MFA_METHOD_DISABLED',
      resourceType: 'MFA',
      details: {
        method
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(200).json({
      success: true,
      message: `${method} authentication disabled`
    });
  } catch (error) {
    console.error('Error disabling MFA method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disable MFA method'
    });
  }
};

exports.createChallenge = async (req, res) => {
  try {
    const { userId, method } = req.body;
    
    if (!userId || !method) {
      return res.status(400).json({
        success: false,
        message: 'User ID and method are required'
      });
    }
    
    const challenge = await mfaService.createChallenge(userId, method);
    
    res.status(200).json({
      success: true,
      data: challenge
    });
  } catch (error) {
    console.error('Error creating MFA challenge:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create MFA challenge'
    });
  }
};

exports.verifyChallenge = async (req, res) => {
  try {
    const { userId, method, response } = req.body;
    
    if (!userId || !method || !response) {
      return res.status(400).json({
        success: false,
        message: 'User ID, method, and response are required'
      });
    }
    
    const result = await mfaService.verifyChallenge(userId, method, response);
    
    if (result.success) {
      await auditService.logActivity({
        userId,
        action: 'MFA_CHALLENGE_VERIFIED',
        resourceType: 'MFA',
        details: {
          method
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      res.status(200).json({
        success: true,
        data: {
          mfaToken: result.mfaToken,
          remainingCodes: result.remainingCodes,
          warning: result.warning
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Challenge verification failed',
        attemptsRemaining: result.attemptsRemaining
      });
    }
  } catch (error) {
    console.error('Error verifying MFA challenge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify challenge'
    });
  }
};

exports.getTrustedDevices = async (req, res) => {
  try {
    const userId = req.userId;
    const mfaSettings = await mfaService.getUserMFAStatus(userId);
    
    const devices = mfaSettings.trustedDevices || [];
    
    res.status(200).json({
      success: true,
      data: devices.map(d => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        lastUsedAt: d.lastUsedAt,
        createdAt: d.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting trusted devices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trusted devices'
    });
  }
};

exports.removeTrustedDevice = async (req, res) => {
  try {
    const userId = req.userId;
    const { deviceId } = req.params;
    
    // Implementation would go here
    
    await auditService.logActivity({
      userId,
      action: 'MFA_TRUSTED_DEVICE_REMOVED',
      resourceType: 'MFA',
      details: {
        deviceId
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(200).json({
      success: true,
      message: 'Trusted device removed'
    });
  } catch (error) {
    console.error('Error removing trusted device:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove trusted device'
    });
  }
};