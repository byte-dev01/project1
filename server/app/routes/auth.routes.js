const { verifySignUp } = require("../middleware");
const controller = require("../controllers/auth.controller");
const { body, validationResult } = require('express-validator');

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

  app.post(
    "/api/auth/signup",
    [
      ...validateSignup, // Add input validation FIRST
      verifySignUp.checkDuplicateUsernameOrEmail,
      verifySignUp.checkRolesExisted
    ],
    controller.signup
  );

  app.post(
    "/api/auth/signin", 
    validateSignin, // Add validation to signin too
    controller.signin
  );
};

