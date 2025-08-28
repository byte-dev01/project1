const router = require("express").Router();
const mfaController = require("../controllers/mfa.controller");
const { authJwt } = require("../middleware");

// Protected routes - require authentication
router.use(authJwt.verifyToken);

// MFA Status
router.get("/status", mfaController.getMFAStatus);

// TOTP Setup
router.post("/totp/setup", mfaController.setupTOTP);
router.post("/totp/verify", mfaController.verifyTOTP);

// SMS Setup  
router.post("/sms/setup", mfaController.setupSMS);
router.post("/sms/verify", mfaController.verifySMS);
router.post("/sms/resend", mfaController.resendSMS);

// Backup Codes
router.post("/backup-codes/generate", mfaController.generateBackupCodes);

// Trusted Devices
router.get("/trusted-devices", mfaController.getTrustedDevices);
router.delete("/trusted-devices/:deviceId", mfaController.removeTrustedDevice);

// Disable Method
router.delete("/methods/:method", mfaController.disableMethod);

// Public routes for login MFA challenges
router.post("/challenge/create", mfaController.createChallenge);
router.post("/challenge/verify", mfaController.verifyChallenge);

module.exports = router;