// config/auth.config.js
// server/app/config/auth.config.js
const crypto = require('crypto');

module.exports = {
  // JWT Secret - use environment variable in production
  secret: process.env.JWT_SECRET || "tomatosaucew/sugar",
  
  // JWT options for better security
  jwtOptions: {
    algorithm: 'HS256',
    expiresIn: '12h',
    issuer: 'healthbridge-app',
    audience: 'healthbridge-users'
  },
  
  // Refresh token settings
  refreshTokenExpiry: '7d',
  
  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true
  }
};

/*
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const User = require("../models/User");
const Organization = require("../models/organization");
const { sendEmail } = require("../utils/email");
const crypto = require("crypto");

class AuthController {
  // 注册
  async signup(req, res) {
    try {
      const { username, email, password, role, organizationId } = req.body;
      
      // 验证组织存在（如果提供）
      if (organizationId) {
        const org = await Organization.findById(organizationId);
        if (!org || !org.isActive) {
          return res.status(400).json({ message: "Invalid organization" });
        }
        
        // 检查组织用户限制
        const userCount = await User.countDocuments({ organizationId });
        if (userCount >= org.subscription.userLimit) {
          return res.status(400).json({ 
            message: "Organization has reached user limit" 
          });
        }
      }
      
      // 创建用户
      const hashedPassword = await bcrypt.hash(password, 12);
      const emailToken = crypto.randomBytes(32).toString('hex');
      
      const user = new User({
        username,
        email,
        password: hashedPassword,
        role: role || 'patient',
        organizationId,
        emailVerificationToken: emailToken,
        emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24小时
      });
      
      await user.save();
      
      // 发送验证邮件
      const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${emailToken}`;
      await sendEmail({
        to: email,
        subject: 'Verify your email',
        html: `
          <h1>Welcome to HealthBridge!</h1>
          <p>Please verify your email by clicking the link below:</p>
          <a href="${verificationUrl}">Verify Email</a>
        `
      });
      
      res.status(201).json({ 
        message: "User registered successfully! Please check your email." 
      });
      
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: error.message });
    }
  }
  
  // 登录
  async signin(req, res) {
    try {
      const { username, password, organizationId } = req.body;
      
      // 查找用户
      const user = await User.findOne({ 
        $or: [{ username }, { email: username }],
        ...(organizationId && { organizationId })
      }).populate('organizationId');
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // 检查账户锁定
      if (user.isLocked) {
        return res.status(423).json({ 
          message: "Account is locked due to too many failed attempts" 
        });
      }
      
      // 验证密码
      const isValidPassword = await user.comparePassword(password);
      
      if (!isValidPassword) {
        await user.incLoginAttempts();
        return res.status(401).json({ message: "Invalid password" });
      }
      
      // 检查邮箱验证
      if (!user.isEmailVerified) {
        return res.status(403).json({ 
          message: "Please verify your email first" 
        });
      }

      
      // 检查组织状态
      if (user.organizationId && !user.organizationId.isActive) {
        return res.status(403).json({ 
          message: "Your organization is not active" 
        });
      }
      
      // 检查2FA
      if (user.twoFactorEnabled) {
        // 生成临时token用于2FA验证
        const tempToken = jwt.sign(
          { id: user._id, requires2FA: true },
          process.env.JWT_SECRET,
          { expiresIn: '5m' }
        );
        
        return res.json({
          requires2FA: true,
          tempToken
        });
      }
      
      // 生成tokens
      const accessToken = jwt.sign(
        { 
          id: user._id,
          role: user.role,
          organizationId: user.organizationId
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );
      
      // 更新登录信息
      await user.resetLoginAttempts();
      user.lastLogin = Date.now();
      await user.save();
      
      res.json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          organization: user.organizationId
        },
        accessToken,
        refreshToken
      });
      
    } catch (error) {
      console.error('Signin error:', error);
      res.status(500).json({ message: error.message });
    }
  }
  
  // 2FA验证
  async verify2FA(req, res) {
    try {
      const { tempToken, code } = req.body;
      
      // 验证临时token
      const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      if (!decoded.requires2FA) {
        return res.status(400).json({ message: "Invalid token" });
      }
      
      const user = await User.findById(decoded.id).populate('organizationId');
      
      // 验证2FA代码
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: code,
        window: 2
      });
      
      if (!verified) {
        return res.status(401).json({ message: "Invalid 2FA code" });
      }
      
      // 生成正式tokens
      const accessToken = jwt.sign(
        { 
          id: user._id,
          role: user.role,
          organizationId: user.organizationId
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );
      
      res.json({
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          organization: user.organizationId
        },
        accessToken,
        refreshToken
      });
      
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  
  // 启用2FA
  async enable2FA(req, res) {
    try {
      const user = await User.findById(req.userId);
      
      // 生成secret
      const secret = speakeasy.generateSecret({
        name: `HealthBridge (${user.email})`
      });
      
      // 生成QR码
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
      
      // 暂存secret（用户需要验证后才正式启用）
      user.twoFactorSecret = secret.base32;
      await user.save();
      
      res.json({
        secret: secret.base32,
        qrCode: qrCodeUrl
      });
      
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
  
  // 刷新Token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token required" });
      }
      
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      const user = await User.findById(decoded.id).populate('organizationId');
      
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }
      
      const accessToken = jwt.sign(
        { 
          id: user._id,
          role: user.role,
          organizationId: user.organizationId
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      res.json({ accessToken });
      
    } catch (error) {
      res.status(401).json({ message: "Invalid refresh token" });
    }
  }
  
  // 忘记密码
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      
      if (!user) {
        // 不透露用户是否存在
        return res.json({ 
          message: "If the email exists, a reset link has been sent" 
        });
      }
      
      // 生成重置token
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetToken = resetToken;
      user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1小时
      await user.save();
      
      // 发送邮件
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
      await sendEmail({
        to: email,
        subject: 'Password Reset Request',
        html: `
          <h1>Password Reset</h1>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
        `
      });
      
      res.json({ 
        message: "If the email exists, a reset link has been sent" 
      });
      
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
}

module.exports = new AuthController();
*/