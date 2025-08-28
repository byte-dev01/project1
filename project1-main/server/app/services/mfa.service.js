const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { MFASettings, MFAVerification, MFAAudit, RecoveryCodes } = require('../models/mfa.model');
const twilioClient = require('../config/twilio.config');
const emailService = require('./email.service');
const auditService = require('./audit.service');

class MFAService {
  constructor() {
    this.maxVerificationAttempts = 5;
    this.verificationCodeLength = 6;
    this.backupCodeCount = 10;
  }

  // Initialize MFA for a user
  async initializeMFA(userId) {
    try {
      let mfaSettings = await MFASettings.findOne({ userId });
      
      if (!mfaSettings) {
        mfaSettings = new MFASettings({
          userId,
          enabled: false,
          methods: [],
          enforced: false
        });
        await mfaSettings.save();
        
        await this.logAudit(userId, 'mfa_enabled', null, {
          initialized: true
        });
      }
      
      return mfaSettings;
    } catch (error) {
      console.error('Error initializing MFA:', error);
      throw error;
    }
  }

  // Setup TOTP authentication
  async setupTOTP(userId, appName = 'HealthcareApp') {
    try {
      const secret = speakeasy.generateSecret({
        name: appName,
        length: 32
      });

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
      
      const mfaSettings = await MFASettings.findOne({ userId });
      
      // Remove existing unverified TOTP method
      mfaSettings.methods = mfaSettings.methods.filter(
        m => !(m.type === 'totp' && !m.verified)
      );
      
      // Add new TOTP method
      mfaSettings.methods.push({
        type: 'totp',
        enabled: false,
        verified: false,
        priority: 1,
        config: {
          secret: secret.base32,
          qrCode: qrCodeUrl
        }
      });
      
      await mfaSettings.save();
      
      await this.logAudit(userId, 'method_added', 'totp', {
        setup: true
      });
      
      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32
      };
    } catch (error) {
      console.error('Error setting up TOTP:', error);
      throw error;
    }
  }

  // Verify TOTP token
  async verifyTOTP(userId, token) {
    try {
      const mfaSettings = await MFASettings.findOne({ userId }).select('+methods.config.secret');
      const totpMethod = mfaSettings.methods.find(m => m.type === 'totp');
      
      if (!totpMethod || !totpMethod.config.secret) {
        throw new Error('TOTP not configured');
      }
      
      const verified = speakeasy.totp.verify({
        secret: totpMethod.config.secret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow 2 time steps tolerance
      });
      
      if (verified) {
        // Mark as verified if first time
        if (!totpMethod.verified) {
          totpMethod.verified = true;
          totpMethod.enabled = true;
          mfaSettings.enabled = true;
          await mfaSettings.save();
          
          await this.logAudit(userId, 'method_verified', 'totp');
        }
        
        totpMethod.lastUsedAt = new Date();
        await mfaSettings.save();
        
        await this.logAudit(userId, 'verification_success', 'totp');
        
        return { success: true };
      }
      
      await this.logAudit(userId, 'verification_failed', 'totp', {
        reason: 'Invalid token'
      });
      
      return { success: false, error: 'Invalid token' };
    } catch (error) {
      console.error('Error verifying TOTP:', error);
      throw error;
    }
  }

  // Setup SMS authentication
  async setupSMS(userId, phoneNumber) {
    try {
      const mfaSettings = await MFASettings.findOne({ userId });
      
      // Validate phone number format
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      // Remove existing unverified SMS method
      mfaSettings.methods = mfaSettings.methods.filter(
        m => !(m.type === 'sms' && !m.verified)
      );
      
      // Add new SMS method
      mfaSettings.methods.push({
        type: 'sms',
        enabled: false,
        verified: false,
        priority: 2,
        config: {
          phoneNumber: formattedPhone,
          phoneVerified: false
        }
      });
      
      await mfaSettings.save();
      
      // Send verification code
      const verification = await this.sendSMSVerification(userId, formattedPhone);
      
      await this.logAudit(userId, 'method_added', 'sms', {
        phoneNumber: this.maskPhoneNumber(formattedPhone)
      });
      
      return {
        phoneNumber: this.maskPhoneNumber(formattedPhone),
        verificationId: verification._id
      };
    } catch (error) {
      console.error('Error setting up SMS:', error);
      throw error;
    }
  }

  // Send SMS verification code
  async sendSMSVerification(userId, phoneNumber) {
    try {
      const code = this.generateVerificationCode();
      const hashedCode = this.hashCode(code);
      
      const verification = new MFAVerification({
        userId,
        method: 'sms',
        challenge: hashedCode,
        challengeExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: []
      });
      
      await verification.save();
      
      // Send SMS via Twilio
      if (process.env.TWILIO_ENABLED === 'true') {
        await twilioClient.messages.create({
          body: `Your verification code is: ${code}. Valid for 10 minutes.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });
      } else {
        console.log(`SMS Verification Code for ${phoneNumber}: ${code}`);
      }
      
      return verification;
    } catch (error) {
      console.error('Error sending SMS verification:', error);
      throw error;
    }
  }

  // Verify SMS code
  async verifySMSCode(userId, verificationId, code) {
    try {
      const verification = await MFAVerification.findById(verificationId).select('+challenge');
      
      if (!verification || verification.userId.toString() !== userId.toString()) {
        throw new Error('Invalid verification');
      }
      
      if (verification.challengeExpiry < new Date()) {
        throw new Error('Verification code expired');
      }
      
      if (verification.attempts.length >= this.maxVerificationAttempts) {
        throw new Error('Too many attempts');
      }
      
      const hashedCode = this.hashCode(code);
      const isValid = hashedCode === verification.challenge;
      
      verification.attempts.push({
        success: isValid,
        failureReason: isValid ? null : 'Invalid code'
      });
      
      if (isValid) {
        verification.verified = true;
        verification.verifiedAt = new Date();
        await verification.save();
        
        // Update MFA settings
        const mfaSettings = await MFASettings.findOne({ userId });
        const smsMethod = mfaSettings.methods.find(m => m.type === 'sms');
        
        if (smsMethod) {
          smsMethod.verified = true;
          smsMethod.enabled = true;
          smsMethod.config.phoneVerified = true;
          mfaSettings.enabled = true;
          await mfaSettings.save();
          
          await this.logAudit(userId, 'method_verified', 'sms');
        }
        
        return { success: true };
      }
      
      await verification.save();
      
      return {
        success: false,
        attemptsRemaining: this.maxVerificationAttempts - verification.attempts.length
      };
    } catch (error) {
      console.error('Error verifying SMS code:', error);
      throw error;
    }
  }

  // Generate backup codes
  async generateBackupCodes(userId) {
    try {
      const codes = [];
      const hashedCodes = [];
      
      for (let i = 0; i < this.backupCodeCount; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        codes.push(code);
        hashedCodes.push({
          code: this.maskBackupCode(code),
          hashedCode: this.hashCode(code),
          used: false
        });
      }
      
      // Save to recovery codes collection
      await RecoveryCodes.findOneAndUpdate(
        { userId },
        {
          userId,
          codes: hashedCodes,
          generatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      // Update MFA settings
      const mfaSettings = await MFASettings.findOne({ userId });
      
      // Remove old backup codes method
      mfaSettings.methods = mfaSettings.methods.filter(m => m.type !== 'backup_codes');
      
      // Add new backup codes method
      mfaSettings.methods.push({
        type: 'backup_codes',
        enabled: true,
        verified: true,
        priority: 99,
        config: {
          codes: hashedCodes.map(c => ({
            code: c.code,
            used: false
          }))
        }
      });
      
      await mfaSettings.save();
      
      await this.logAudit(userId, 'backup_codes_generated', null, {
        count: this.backupCodeCount
      });
      
      return codes; // Return unhashed codes to show user once
    } catch (error) {
      console.error('Error generating backup codes:', error);
      throw error;
    }
  }

  // Verify backup code
  async verifyBackupCode(userId, code) {
    try {
      const recoveryCodes = await RecoveryCodes.findOne({ userId }).select('+codes.hashedCode');
      
      if (!recoveryCodes) {
        throw new Error('No backup codes found');
      }
      
      const hashedCode = this.hashCode(code.toUpperCase());
      const codeEntry = recoveryCodes.codes.find(
        c => c.hashedCode === hashedCode && !c.used
      );
      
      if (codeEntry) {
        codeEntry.used = true;
        codeEntry.usedAt = new Date();
        recoveryCodes.lastUsedAt = new Date();
        await recoveryCodes.save();
        
        await this.logAudit(userId, 'backup_code_used', 'backup_codes');
        
        // Check remaining codes
        const remainingCodes = recoveryCodes.codes.filter(c => !c.used).length;
        
        return {
          success: true,
          remainingCodes,
          warning: remainingCodes < 3 ? 'Low on backup codes' : null
        };
      }
      
      await this.logAudit(userId, 'verification_failed', 'backup_codes', {
        reason: 'Invalid code'
      });
      
      return { success: false, error: 'Invalid backup code' };
    } catch (error) {
      console.error('Error verifying backup code:', error);
      throw error;
    }
  }

  // Create MFA challenge for login
  async createChallenge(userId, method) {
    try {
      const mfaSettings = await MFASettings.findOne({ userId });
      
      if (!mfaSettings || !mfaSettings.enabled) {
        throw new Error('MFA not enabled');
      }
      
      const mfaMethod = mfaSettings.methods.find(
        m => m.type === method && m.enabled && m.verified
      );
      
      if (!mfaMethod) {
        throw new Error(`MFA method ${method} not available`);
      }
      
      let challengeData = {};
      
      switch (method) {
        case 'sms':
          const phoneNumber = mfaMethod.config.phoneNumber;
          const verification = await this.sendSMSVerification(userId, phoneNumber);
          challengeData = {
            method: 'sms',
            verificationId: verification._id,
            phoneNumber: this.maskPhoneNumber(phoneNumber)
          };
          break;
          
        case 'totp':
          challengeData = {
            method: 'totp',
            message: 'Enter your authenticator app code'
          };
          break;
          
        case 'backup_codes':
          challengeData = {
            method: 'backup_codes',
            message: 'Enter one of your backup codes'
          };
          break;
          
        default:
          throw new Error('Unsupported MFA method');
      }
      
      return challengeData;
    } catch (error) {
      console.error('Error creating MFA challenge:', error);
      throw error;
    }
  }

  // Verify MFA challenge response
  async verifyChallenge(userId, method, response) {
    try {
      let result;
      
      switch (method) {
        case 'totp':
          result = await this.verifyTOTP(userId, response.token);
          break;
          
        case 'sms':
          result = await this.verifySMSCode(userId, response.verificationId, response.code);
          break;
          
        case 'backup_codes':
          result = await this.verifyBackupCode(userId, response.code);
          break;
          
        default:
          throw new Error('Unsupported MFA method');
      }
      
      if (result.success) {
        // Create MFA session token
        const mfaToken = this.generateMFAToken();
        const mfaSession = {
          userId,
          token: mfaToken,
          method,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000) // 1 hour
        };
        
        // Store in cache or session store
        // await cacheService.set(`mfa:session:${mfaToken}`, mfaSession, 3600);
        
        return {
          success: true,
          mfaToken,
          ...result
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error verifying MFA challenge:', error);
      throw error;
    }
  }

  // Get user's MFA status
  async getUserMFAStatus(userId) {
    try {
      const mfaSettings = await MFASettings.findOne({ userId });
      
      if (!mfaSettings) {
        return {
          enabled: false,
          enforced: false,
          methods: []
        };
      }
      
      const methods = mfaSettings.methods
        .filter(m => m.enabled && m.verified)
        .map(m => ({
          type: m.type,
          priority: m.priority,
          lastUsedAt: m.lastUsedAt
        }))
        .sort((a, b) => a.priority - b.priority);
      
      return {
        enabled: mfaSettings.enabled,
        enforced: mfaSettings.enforced,
        methods,
        trustedDevices: mfaSettings.trustedDevices.length,
        gracePeriodEnd: mfaSettings.gracePeriodEnd
      };
    } catch (error) {
      console.error('Error getting MFA status:', error);
      throw error;
    }
  }

  // Disable MFA method
  async disableMethod(userId, method) {
    try {
      const mfaSettings = await MFASettings.findOne({ userId });
      
      if (!mfaSettings) {
        throw new Error('MFA not configured');
      }
      
      const methodIndex = mfaSettings.methods.findIndex(m => m.type === method);
      
      if (methodIndex === -1) {
        throw new Error('Method not found');
      }
      
      mfaSettings.methods.splice(methodIndex, 1);
      
      // Disable MFA entirely if no methods remain
      if (mfaSettings.methods.filter(m => m.enabled && m.verified).length === 0) {
        mfaSettings.enabled = false;
      }
      
      await mfaSettings.save();
      
      await this.logAudit(userId, 'method_removed', method);
      
      return { success: true };
    } catch (error) {
      console.error('Error disabling MFA method:', error);
      throw error;
    }
  }

  // Helper methods
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  generateMFAToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  hashCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  formatPhoneNumber(phone) {
    // Remove non-digits and add country code if missing
    let formatted = phone.replace(/\D/g, '');
    if (!formatted.startsWith('1') && formatted.length === 10) {
      formatted = '1' + formatted;
    }
    return '+' + formatted;
  }

  maskPhoneNumber(phone) {
    // Show only last 4 digits
    return phone.replace(/\d(?=\d{4})/g, '*');
  }

  maskBackupCode(code) {
    // Show first 2 and last 2 characters
    return code.substring(0, 2) + '****' + code.substring(code.length - 2);
  }

  async logAudit(userId, action, method, details = {}) {
    try {
      await MFAAudit.create({
        userId,
        action,
        method,
        details,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error logging MFA audit:', error);
    }
  }
}

module.exports = new MFAService();