const express = require("express");
const { registerUser, loginUser, forgotPasswordReset, refreshToken } = require("../controllers/authController");
const validateRegistration = require("../middleware/validate");
const router = express.Router();

router.post("/register", validateRegistration, registerUser);
router.post("/login", loginUser);
router.post("/forgot-password/verify-otp", forgotPasswordReset);
router.post("/refresh-token", refreshToken);

module.exports = router;