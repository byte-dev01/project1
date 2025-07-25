const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  // 基础信息
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  
  // 角色和权限
  role: {
    type: String,
    enum: ['user', 'doctor', 'admin', 'client_admin', 'moderator', 'staff'],
    default: 'user'
  },
  permissions: [{
    type: String
  }],
  
  // 多租户支持
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false
  },
  
  // 医生特有字段
  specialization: {
    type: String,
    required: function() { return this.role === 'doctor'; }
  },
  licenseNumber: {
    type: String,
    required: function() { return this.role === 'doctor'; }
  },
  
  // 患者特有字段
  dateOfBirth: {
    type: Date,
    required: function() { return this.role === 'patient'; }
  },
  medicalRecordNumber: {
    type: String,
    required: function() { return this.role === 'patient'; }
  },
  
  // 账户状态
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // 安全相关
  passwordResetToken: String,
  passwordResetExpires: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  twoFactorSecret: String,
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  
  // OAuth支持
  googleId: String,
  
  // 审计信息
  lastLogin: Date,
  lastPasswordChange: Date,
  
}, {
  timestamps: true
});

// 索引
UserSchema.index({ email: 1, organizationId: 1 });
UserSchema.index({ role: 1, organizationId: 1 });

// 虚拟属性
UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// 方法
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.incLoginAttempts = function() {
  // 如果有锁定且已过期，重置
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 1 * 60 * 60 * 1000; // 1小时
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

UserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

module.exports = mongoose.model('User', UserSchema);
