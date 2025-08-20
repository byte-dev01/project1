/*
// middleware/auth.js - 整合后的认证中间件
const jwt = require("jsonwebtoken");
const config = require("../config/auth.config.js");
const db = require("../models");
const User = db.user;
const Role = db.role;

// 验证Token - 支持两种token格式以便平滑迁移
const verifyToken = async (req, res, next) => {
  try {
    // 优先检查新格式 (Bearer token)
    let token = req.headers.authorization?.split(' ')[1];
    
    // 兼容旧格式 (x-access-token)
    if (!token) {
      token = req.headers["x-access-token"];
    }
    
    if (!token) {
      return res.status(403).json({
        message: "No token provided!"
      });
    }
    
    // 验证token
    const decoded = jwt.verify(token, config.secret || process.env.JWT_SECRET);
    
    // 获取用户信息
    const user = await User.findById(decoded.id || decoded.userId)
      .populate('roles', '-__v')
      .select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        message: "User not found" 
      });
    }
    
    // 检查用户状态（如果有isActive字段）
    if (user.isActive !== undefined && !user.isActive) {
      return res.status(401).json({ 
        message: "Account is disabled" 
      });
    }
    
    // 设置请求对象属性
    req.user = user;
    req.userId = user._id;
    
    // 处理角色 - 兼容新旧格式
    if (user.role) {
      // 新格式：单一角色字符串
      req.userRole = user.role;
    } else if (user.roles && user.roles.length > 0) {
      // 旧格式：角色数组
      req.userRoles = user.roles.map(role => 
        typeof role === 'object' ? role.name : role
      );
      // 为了兼容，设置主要角色
      req.userRole = req.userRoles[0];
    }
    
    // 设置组织ID（如果存在）
    req.organizationId = user.organizationId;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: "Invalid token!"
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: "Token expired!"
      });
    }
    return res.status(500).json({
      message: "Error verifying token",
      error: error.message
    });
  }
};

// 通用角色验证 - 支持单一角色和角色数组
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: "Unauthorized" 
      });
    }
    
    // 确保 allowedRoles 是数组
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    // 检查新格式（单一角色）
    if (req.userRole && roles.includes(req.userRole)) {
      return next();
    }
    
    // 检查旧格式（角色数组）
    if (req.userRoles && req.userRoles.some(role => roles.includes(role))) {
      return next();
    }
    
    return res.status(403).json({ 
      message: `Require one of these roles: ${roles.join(', ')}` 
    });
  };
};

// 特定角色检查 - 保持向后兼容
const isAdmin = async (req, res, next) => {
  try {
    // 使用通用角色验证
    return requireRole(['admin'])(req, res, next);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const isModerator = async (req, res, next) => {
  try {
    return requireRole(['moderator'])(req, res, next);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const isModeratorOrAdmin = async (req, res, next) => {
  try {
    return requireRole(['moderator', 'admin'])(req, res, next);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 医疗系统特定角色
const isDoctor = (req, res, next) => {
  return requireRole(['doctor'])(req, res, next);
};

const isPatient = (req, res, next) => {
  return requireRole(['patient'])(req, res, next);
};

const isDoctorOrNurse = (req, res, next) => {
  return requireRole(['doctor', 'nurse'])(req, res, next);
};

// 组织验证
const requireSameOrganization = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        message: "Unauthorized" 
      });
    }
    
    // 系统管理员可以访问所有组织
    if (req.userRole === 'admin' || 
        (req.userRoles && req.userRoles.includes('admin'))) {
      return next();
    }
    
    // 获取资源的组织ID
    const resourceOrgId = req.params.organizationId || 
                         req.body.organizationId || 
                         req.query.organizationId;
    
    // 如果没有指定组织ID，允许访问（可能是个人资源）
    if (!resourceOrgId) {
      return next();
    }
    
    // 检查用户是否属于该组织
    const userOrgId = req.organizationId?.toString();
    if (!userOrgId || userOrgId !== resourceOrgId.toString()) {
      return res.status(403).json({ 
        message: "You can only access resources from your organization" 
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 权限验证
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          message: "Unauthorized" 
        });
      }
      
      // 管理员拥有所有权限
      if (req.userRole === 'admin' || 
          (req.userRoles && req.userRoles.includes('admin'))) {
        return next();
      }
      
      // 重新获取用户以确保有最新的权限
      const user = await User.findById(req.userId);
      
      if (!user.permissions || !user.permissions.includes(permission)) {
        return res.status(403).json({ 
          message: `Permission '${permission}' is required to access this resource` 
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
};

// 复合验证 - 角色 + 组织
const requireRoleAndOrganization = (roles) => {
  return async (req, res, next) => {
    try {
      // 先验证角色
      await new Promise((resolve, reject) => {
        requireRole(roles)(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // 再验证组织
      await requireSameOrganization(req, res, next);
    } catch (error) {
      // 错误已经被处理
    }
  };
};

// 导出所有中间件
module.exports = {
  // 基础验证
  verifyToken,
  
  // 角色验证
  requireRole,
  isAdmin,
  isModerator,
  isModeratorOrAdmin,
  
  // 医疗系统角色
  isDoctor,
  isPatient,
  isDoctorOrNurse,
  
  // 组织和权限
  requireSameOrganization,
  requirePermission,
  requireRoleAndOrganization,
  
  // 为了向后兼容，也导出 authJwt 对象
  authJwt: {
    verifyToken,
    isAdmin,
    isModerator,
    isModeratorOrAdmin
  }
};
*/
// 使用示例：
/*
// 在路由中使用
const { verifyToken, requireRole, requireSameOrganization } = require('../middleware/auth');

// 基础保护
router.get('/profile', verifyToken, getProfile);

// 角色保护
router.get('/admin/users', verifyToken, requireRole('admin'), getUsers);

// 医疗角色保护
router.get('/patients', verifyToken, requireRole(['doctor', 'nurse']), getPatients);

// 组织保护
router.get('/organization/:organizationId/data', 
  verifyToken, 
  requireSameOrganization, 
  getOrgData
);

// 复合保护
router.put('/organization/:organizationId/settings', 
  verifyToken, 
  requireRoleAndOrganization(['client_admin']), 
  updateOrgSettings
);

// 权限保护
router.delete('/patient/:id', 
  verifyToken, 
  requirePermission('delete_patient'), 
  deletePatient
);
*/

const jwt = require("jsonwebtoken");
const config = require("../config/auth.config.js");
const db = require("../models");
const User = db.user;
const Role = db.role;

const verifyToken = (req, res, next) => {
  let token = req.headers["x-access-token"] || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(403).send({
      message: "No token provided!"
    });
  }

  jwt.verify(token, config.secret, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        message: "Unauthorized! Token invalid or expired.",
      });
    }
    req.userId = decoded.id;
    req.userInfo = decoded; // Store full user info from token
    next();
  });
};

// Helper function to check roles
const checkRole = async (req, allowedRoles) => {
  try {
    const user = await User.findById(req.userId).populate("roles");
    if (!user) {
      return false;
    }

    const userRoles = user.roles.map(role => role.name);
    return allowedRoles.some(role => userRoles.includes(role));
  } catch (error) {
    return false;
  }
};

const isAdmin = async (req, res, next) => {
  const hasRole = await checkRole(req, ["admin"]);
  if (!hasRole) {
    return res.status(403).send({ message: "Require Admin Role!" });
  }
  next();
};

const isDoctor = async (req, res, next) => {
  const hasRole = await checkRole(req, ["doctor", "admin"]);
  if (!hasRole) {
    return res.status(403).send({ message: "Require Doctor Role!" });
  }
  next();
};

const isModerator = async (req, res, next) => {
  const hasRole = await checkRole(req, ["moderator", "admin"]);
  if (!hasRole) {
    return res.status(403).send({ message: "Require Moderator Role!" });
  }
  next();
};

const isStaff = async (req, res, next) => {
  const hasRole = await checkRole(req, ["staff", "moderator", "doctor", "admin"]);
  if (!hasRole) {
    return res.status(403).send({ message: "Require Staff Role or higher!" });
  }
  next();
};

const isUser = async (req, res, next) => {
  // All authenticated users pass this check
  next();
};

const authJwt = {
  verifyToken,
  isAdmin,
  isDoctor,
  isModerator,
  isStaff,
  isUser
};

module.exports = authJwt;