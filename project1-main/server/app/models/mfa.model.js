const mongoose = require("mongoose");
const crypto = require("crypto");

// MFA Settings Schema
const MFASettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  enabled: {
    type: Boolean,
    default: false
  },
  methods: [{
    type: {
      type: String,
      enum: ["totp", "sms", "email", "backup_codes"],
      required: true
    },
    enabled: {
      type: Boolean,
      default: false
    },
    verified: {
      type: Boolean,
      default: false
    },
    priority: {
      type: Number,
      default: 0
    },
    config: {
      // TOTP specific
      secret: {
        type: String,
        select: false
      },
      qrCode: String,
      
      // SMS specific
      phoneNumber: String,
      phoneVerified: Boolean,
      
      // Email specific
      emailAddress: String,
      emailVerified: Boolean,
      
      // Backup codes
      codes: [{
        code: String,
        used: Boolean,
        usedAt: Date
      }]
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsedAt: Date
  }],
  enforced: {
    type: Boolean,
    default: false
  },
  gracePeriodEnd: Date,
  trustedDevices: [{
    deviceId: String,
    deviceName: String,
    deviceType: String,
    trustToken: {
      type: String,
      select: false
    },
    lastUsedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date
  }],
  sessionSettings: {
    requireMFAForSensitiveActions: {
      type: Boolean,
      default: true
    },
    mfaSessionDuration: {
      type: Number,
      default: 3600000 // 1 hour in milliseconds
    },
    rememberDeviceDuration: {
      type: Number,
      default: 2592000000 // 30 days in milliseconds
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// MFA Verification Attempts Schema
const MFAVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  sessionId: String,
  method: {
    type: String,
    enum: ["totp", "sms", "email", "backup_codes"],
    required: true
  },
  challenge: {
    type: String,
    select: false
  },
  challengeExpiry: Date,
  attempts: [{
    attemptedAt: {
      type: Date,
      default: Date.now
    },
    success: Boolean,
    ipAddress: String,
    userAgent: String,
    failureReason: String
  }],
  verified: {
    type: Boolean,
    default: false
  },
  verifiedAt: Date,
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 10 * 60 * 1000) // 10 minutes
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// MFA Audit Log Schema
const MFAAuditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  action: {
    type: String,
    enum: [
      "mfa_enabled",
      "mfa_disabled",
      "method_added",
      "method_removed",
      "method_verified",
      "verification_success",
      "verification_failed",
      "backup_codes_generated",
      "backup_code_used",
      "trusted_device_added",
      "trusted_device_removed",
      "settings_changed"
    ],
    required: true
  },
  method: String,
  details: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String,
  sessionId: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Recovery Codes Schema
const RecoveryCodeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  codes: [{
    code: {
      type: String,
      required: true
    },
    hashedCode: {
      type: String,
      select: false
    },
    used: {
      type: Boolean,
      default: false
    },
    usedAt: Date,
    usedByIP: String
  }],
  generatedAt: {
    type: Date,
    default: Date.now
  },
  lastUsedAt: Date
});

// Methods
MFASettingsSchema.methods.generateBackupCodes = function(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push({
      code: code,
      used: false
    });
  }
  return codes;
};

MFASettingsSchema.methods.getTrustedDevice = function(deviceId) {
  return this.trustedDevices.find(device => 
    device.deviceId === deviceId && 
    (!device.expiresAt || device.expiresAt > new Date())
  );
};

MFASettingsSchema.methods.addTrustedDevice = function(deviceInfo) {
  const trustToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
  
  this.trustedDevices.push({
    deviceId: deviceInfo.deviceId,
    deviceName: deviceInfo.deviceName,
    deviceType: deviceInfo.deviceType,
    trustToken: trustToken,
    expiresAt: expiresAt
  });
  
  return trustToken;
};

// Indexes
MFASettingsSchema.index({ userId: 1 });
MFAVerificationSchema.index({ userId: 1, sessionId: 1 });
MFAVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MFAAuditSchema.index({ userId: 1, timestamp: -1 });
MFAAuditSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days retention

// Update timestamps
MFASettingsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = {
  MFASettings: mongoose.model("MFASettings", MFASettingsSchema),
  MFAVerification: mongoose.model("MFAVerification", MFAVerificationSchema),
  MFAAudit: mongoose.model("MFAAudit", MFAAuditSchema),
  RecoveryCodes: mongoose.model("RecoveryCodes", RecoveryCodeSchema)
};