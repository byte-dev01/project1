const config = require("../config/auth.config");
const db = require("../models");
const User = db.user;
const Role = db.role;
const mfaService = require("../services/mfa.service");
const auditService = require("../services/audit.service");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 12;

// Password strength validator
function isStrongPassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  return password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
}

exports.signup = async (req, res) => {
  try {
    const { username, email, password, name, clinicId, roles, enableMFA } = req.body;

    // Password validation
    if (!isStrongPassword(password)) {
      return res.status(400).send({ 
        success: false,
        message: "Password must be at least 8 characters with uppercase, lowercase, number, and special character!" 
      });
    }

    // Create user
    const user = new User({
      username,
      email,
      name,
      password: bcrypt.hashSync(password, SALT_ROUNDS),
      clinicId: clinicId || null
    });

    const savedUser = await user.save();

    // Assign roles
    if (roles && roles.length > 0) {
      const foundRoles = await Role.find({ name: { $in: roles } });
      savedUser.roles = foundRoles.map(role => role._id);
    } else {
      // Default to 'user' role
      const userRole = await Role.findOne({ name: "user" });
      savedUser.roles = [userRole._id];
    }

    await savedUser.save();

    // Initialize MFA if requested
    if (enableMFA) {
      await mfaService.initializeMFA(savedUser._id);
    }

    // Log audit
    await auditService.logActivity({
      userId: savedUser._id,
      action: 'USER_REGISTRATION',
      resourceType: 'User',
      details: {
        username,
        email,
        mfaEnabled: enableMFA || false
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(201).json({ 
      success: true,
      message: "User registered successfully!",
      userId: savedUser._id,
      mfaEnabled: enableMFA || false
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).send({ 
      success: false,
      message: error.message 
    });
  }
};

exports.signin = async (req, res) => {
  try {
    const { username, password, clinicId, trustDevice } = req.body;

    // Validate clinic if provided
    if (clinicId) {
      const clinic = await db.clinic.findById(clinicId);
      if (!clinic || !clinic.isActive) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid clinic selection" 
        });
      }
    }

    // Find user and populate roles
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    })
    .select("+password")
    .populate("roles", "-__v")
    .populate("clinicId", "name");

    if (!user) {
      await auditService.logActivity({
        action: 'FAILED_LOGIN_ATTEMPT',
        resourceType: 'Authentication',
        details: {
          username,
          reason: 'User not found'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(404).send({ 
        success: false,
        message: "User not found!" 
      });
    }

    // Verify clinic association
    if (clinicId && user.clinicId?.toString() !== clinicId) {
      return res.status(401).json({
        success: false,
        message: "User not associated with selected clinic"
      });
    }

    // Check if user is active
    if (!user.isActive) {
      await auditService.logActivity({
        userId: user._id,
        action: 'FAILED_LOGIN_ATTEMPT',
        resourceType: 'Authentication',
        details: {
          reason: 'Account deactivated'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(401).send({ 
        success: false,
        message: "Account is deactivated. Please contact admin." 
      });
    }

    // Verify password
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) {
      await auditService.logActivity({
        userId: user._id,
        action: 'FAILED_LOGIN_ATTEMPT',
        resourceType: 'Authentication',
        details: {
          reason: 'Invalid password'
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(401).send({
        success: false,
        message: "Invalid password!"
      });
    }

    // Check if MFA is enabled for user
    const mfaStatus = await mfaService.getUserMFAStatus(user._id);
    
    if (mfaStatus.enabled) {
      // Create temporary session for MFA verification
      const tempToken = jwt.sign(
        { 
          userId: user._id,
          requiresMFA: true,
          timestamp: Date.now()
        },
        config.secret,
        {
          algorithm: 'HS256',
          expiresIn: '10m' // Short-lived for MFA verification
        }
      );

      // Get available MFA methods
      const availableMethods = mfaStatus.methods.map(m => m.type);

      await auditService.logActivity({
        userId: user._id,
        action: 'MFA_REQUIRED',
        resourceType: 'Authentication',
        details: {
          availableMethods
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(200).json({
        success: true,
        requiresMFA: true,
        tempToken,
        availableMethods,
        message: "MFA verification required"
      });
    }

    // No MFA required, generate full access token
    const accessToken = await generateAccessToken(user);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Prepare authorities
    const authorities = [];
    for (let i = 0; i < user.roles.length; i++) {
      authorities.push("ROLE_" + user.roles[i].name.toUpperCase());
    }

    await auditService.logActivity({
      userId: user._id,
      action: 'SUCCESSFUL_LOGIN',
      resourceType: 'Authentication',
      details: {
        clinicId: user.clinicId?._id,
        mfaUsed: false
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).send({
      success: true,
      id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      clinicId: user.clinicId?._id,
      clinicName: user.clinicId?.name,
      roles: authorities,
      accessToken,
      mfaEnabled: false
    });

  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).send({ 
      success: false,
      message: error.message 
    });
  }
};

exports.verifyMFA = async (req, res) => {
  try {
    const { tempToken, method, response } = req.body;

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, config.secret);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired session"
      });
    }

    if (!decoded.requiresMFA) {
      return res.status(400).json({
        success: false,
        message: "Invalid MFA session"
      });
    }

    // Verify MFA challenge
    const result = await mfaService.verifyChallenge(decoded.userId, method, response);

    if (!result.success) {
      await auditService.logActivity({
        userId: decoded.userId,
        action: 'MFA_VERIFICATION_FAILED',
        resourceType: 'Authentication',
        details: {
          method,
          reason: result.error
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(400).json({
        success: false,
        message: result.error,
        attemptsRemaining: result.attemptsRemaining
      });
    }

    // MFA successful, get full user data
    const user = await User.findById(decoded.userId)
      .populate("roles", "-__v")
      .populate("clinicId", "name");

    // Generate full access token
    const accessToken = await generateAccessToken(user);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Prepare authorities
    const authorities = [];
    for (let i = 0; i < user.roles.length; i++) {
      authorities.push("ROLE_" + user.roles[i].name.toUpperCase());
    }

    await auditService.logActivity({
      userId: user._id,
      action: 'SUCCESSFUL_LOGIN',
      resourceType: 'Authentication',
      details: {
        mfaMethod: method,
        mfaUsed: true
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      clinicId: user.clinicId?._id,
      clinicName: user.clinicId?.name,
      roles: authorities,
      accessToken,
      mfaToken: result.mfaToken,
      mfaEnabled: true,
      remainingBackupCodes: result.remainingCodes,
      warning: result.warning
    });

  } catch (error) {
    console.error("MFA verification error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(403).json({
        success: false,
        message: "Refresh Token is required!"
      });
    }

    const user = await User.findOne({ refreshToken }).select('+refreshToken');

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Invalid refresh token!"
      });
    }

    // Verify refresh token
    jwt.verify(refreshToken, config.refreshSecret, async (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: "Refresh token expired!"
        });
      }

      // Generate new access token
      const newAccessToken = await generateAccessToken(user);

      await auditService.logActivity({
        userId: user._id,
        action: 'TOKEN_REFRESHED',
        resourceType: 'Authentication',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      res.status(200).json({
        success: true,
        accessToken: newAccessToken
      });
    });

  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const userId = req.userId;

    // Clear refresh token
    await User.findByIdAndUpdate(userId, { refreshToken: null });

    await auditService.logActivity({
      userId,
      action: 'USER_LOGOUT',
      resourceType: 'Authentication',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.status(200).json({
      success: true,
      message: "Logged out successfully"
    });

  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Helper function to generate access token
async function generateAccessToken(user) {
  return jwt.sign(
    { 
      id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      clinicId: user.clinicId?._id,
      clinicName: user.clinicId?.name
    }, 
    config.secret, 
    {
      algorithm: 'HS256',
      expiresIn: '24h'
    }
  );
}

module.exports = exports;