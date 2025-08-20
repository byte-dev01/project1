const config = require("../config/auth.config");
const db = require("../models");
const User = db.user;
const Role = db.role;

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
    const { username, email, password, name, clinicId, roles } = req.body;

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

    res.status(201).json({ 
      success: true,
      message: "User registered successfully!" 
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).send({ 
      success: false,
      message: error.message 
    });
  }
};
/*
exports.signin = async (req, res) => {
  try {
    console.log("Signin req.body =", req.body);

    const { username, password, clinicId } = req.body;
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
    .select("+password")  // ✅ 关键：强制返回 password 字段
    .populate("roles", "-__v")
    .populate("clinicId", "name");

    if (!user) {
      return res.status(404).send({ 
        success: false,
        message: "User not found!" 
      });
    }
        if (clinicId && user.clinicId?.toString() !== clinicId) {
      return res.status(401).json({
        success: false,
        message: "User not associated with selected clinic"
      });
    }
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).send({ 
        success: false,
        message: "Account is deactivated. Please contact admin." 
      });
    }

    // Verify password
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) {
      return res.status(401).send({
        success: false,
        message: "Invalid password!"
      });
    }

    // Generate JWT token with user info
    const token = jwt.sign(
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

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Prepare authorities
    const authorities = [];
    for (let i = 0; i < user.roles.length; i++) {
      authorities.push("ROLE_" + user.roles[i].name.toUpperCase());
    }

    res.status(200).send({
      success: true,
      id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      clinicId: user.clinicId?._id,
      clinicName: user.clinicId?.name,
      roles: authorities,
      accessToken: token
    });

  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).send({ 
      success: false,
      message: error.message 
    });
  }
};
*/

exports.signin = async (req, res) => {
  try {
    console.log("Signin req.body =", req.body);

    const { username, password, clinicId } = req.body;

    console.log("🔍 Looking for user:", username);

    // 查找用户（支持用户名或邮箱登录）
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    })
      .select("+password")              // 手动包含 password 字段
      .populate("roles", "-__v")        // 角色信息
      .populate("clinicId", "name");    // 诊所信息（只取 name 字段）

    console.log("👤 User found:", user ? user.username : 'None');

    // 用户不存在
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).send({
        success: false,
        message: "User not found!"
      });
    }

    // 账户被停用
    if (!user.isActive) {
      console.log("❌ User inactive");
      return res.status(401).send({
        success: false,
        message: "Account is deactivated. Please contact admin."
      });
    }

    console.log("🔐 Checking password...");

    // 密码错误
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) {
      console.log("❌ Invalid password");
      return res.status(401).send({
        success: false,
        message: "Invalid password!"
      });
    }

    console.log("✅ Password valid, generating token...");

    // 🎭 Handle clinic (demo mode - accepts any clinic ID)
    let clinicInfo = {
      id: clinicId || null,
      name: "Demo Clinic"
    };

    if (clinicId) {
      const demoNames = {
        '1': 'Downtown Medical Clinic',
        '2': 'Westside Health Center', 
        '3': 'Eastside Clinic',
        '4': 'Community Hospital',
        '687210715b2d0f7e909a7df4': 'Main Medical Center'
      };
      clinicInfo.name = demoNames[clinicId] || user.clinicId?.name || 'Selected Clinic';
      console.log("🏥 Demo clinic:", clinicInfo.name);
    }

    // 生成 JWT 令牌
    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        clinicId: clinicInfo.id,
        clinicName: clinicInfo.name
      },
      config.secret,
      {
        algorithm: 'HS256',
        expiresIn: '24h'
      }
    );

    console.log("🎫 Token generated");

    // 更新最后登录时间
    user.lastLogin = new Date();
    await user.save();

    // 提取角色信息
    const authorities = user.roles.map(role => "ROLE_" + role.name.toUpperCase());

    console.log("👑 User roles:", authorities);

    // ✅ SUCCESS RESPONSE (this was missing!)
    const successResponse = {
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        name: user.name,
        clinicId: clinicInfo.id,
        clinicName: clinicInfo.name,
        roles: authorities,
        role: authorities[0]?.replace('ROLE_', '').toLowerCase() || 'user'
      },
      accessToken: token,
      refreshToken: token, // Add if your frontend expects it
      // Backward compatibility fields
      id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      clinicId: clinicInfo.id,
      clinicName: clinicInfo.name,
      roles: authorities
    };

    console.log("🎉 Sending success response for user:", user.username);
    
    res.status(200).send(successResponse);

  } catch (error) {
    console.error("💥 Signin error:", error);
    res.status(500).send({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};
  exports.verifyToken = async (req, res) => {
  const token = req.headers["x-access-token"] || req.headers.authorization?.split(' ')[1];
  if (token && token.startsWith("Bearer ")) {
    token = token.slice(7, token.length);
  }

  if (!token) {
    return res.status(403).send({ 
      success: false,
      message: "No token provided!" 
    });
  }

  jwt.verify(token, config.secret, async (err, decoded) => {
    if (err) {
      return res.status(401).send({ 
        success: false,
        message: "Unauthorized! Token expired or invalid." 
      });
    }

    try {
      const user = await User.findById(decoded.id)
        .populate("roles", "-__v")
        .populate("clinicId", "name");

      if (!user || !user.isActive) {
        return res.status(404).send({ 
          success: false,
          message: "User not found or inactive" 
        });
      }

      const authorities = [];
      for (let i = 0; i < user.roles.length; i++) {
        authorities.push("ROLE_" + user.roles[i].name.toUpperCase());
      }

      res.status(200).send({
        success: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name,
          clinicId: user.clinicId?._id || null,
          clinicName: user.clinicId?.name || null,
          accessToken: token

        }
      });
    } catch (error) {
      res.status(500).send({ 
        success: false,
        message: error.message 
      });
    }
  });
};


exports.signout = async (req, res) => {
  try {
    // 清除 cookie 或会话（如果有的话）
    req.session?.destroy?.();  // 如果使用 session
    res.clearCookie("token");  // 如果使用 cookie
    res.status(200).send({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Signout error:", error);
    res.status(500).send({ success: false, message: "Logout failed" });
  }
};
