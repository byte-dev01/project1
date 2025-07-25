const { verifySignUp } = require("../middleware");
const controller = require("../controllers/auth.controller");
const { body, validationResult } = require('express-validator');

const authJwt = require("../middleware/authJwt");
// Input validation middleware
const validateSignup = [
  body('username')
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters')
    .trim() // Remove whitespace
    .escape(), // Prevent XSS attacks
  
  body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(), // Normalize email (lowercase, remove dots in gmail, etc.)
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  
  // Check validation results and return errors if any
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array()
      });
    }
    next();
  }
];

const validateSignin = [
  body('username')
    .trim()
    .escape(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  // Check validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  // ✅ CRITICAL: This is the missing route causing your 404 error
  app.get("/api/auth/verify", authJwt.verifyToken, (req, res) => {
    console.log("✅ Token verification successful for user:", req.user.username);
    res.status(200).json({
      success: true,
      message: "Token is valid",
      user: req.user
    });
  });

  // Signin route
  app.post(
    "/api/auth/signin",
    controller.signin
  );

  // Signup route
  app.post(
    "/api/auth/signup",
    [
      verifySignUp.checkDuplicateUsernameOrEmail,
      verifySignUp.checkRolesExisted
    ],
    controller.signup
  );

  // Signout route
  app.post("/api/auth/signout", controller.signout);

  // Test route to verify auth system is working
  app.get("/api/auth/test", (req, res) => {
    res.status(200).json({ 
      message: "Auth routes are working!",
      timestamp: new Date().toISOString()
    });
  });

  // Protected test route
  app.get("/api/auth/user", authJwt.verifyToken, (req, res) => {
    res.status(200).json({
      message: "User content.",
      user: req.user
    });
  });

  // Admin test route
  app.get("/api/auth/admin", 
    [authJwt.verifyToken, authJwt.isAdmin], 
    (req, res) => {
      res.status(200).json({ message: "Admin Board." });
    }
  );

  // Moderator test route
  app.get("/api/auth/mod",
    [authJwt.verifyToken, authJwt.isModerator],
    (req, res) => {
      res.status(200).json({ message: "Moderator Board." });
    }
  );
};