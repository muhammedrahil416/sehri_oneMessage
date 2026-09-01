const express = require('express');
const {
  registerUser,
  loginUser,
  switchRole,
  forgotPasswordReset,
  refreshToken,
} = require('../controllers/authController');
const validateRegistration = require('../middleware/validate');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', validateRegistration, registerUser);
router.post('/login', loginUser);
router.post('/forgot-password/verify-otp', forgotPasswordReset);
router.post('/refresh-token', refreshToken);

// POST /api/auth/switch-role
// Requires a valid access token — no password re-entry needed.
// Body: { role: 'user' | 'admin' | 'super_admin' }
// The endpoint verifies the caller actually holds the requested role before
// issuing a new token pair scoped to it.
router.post('/switch-role', verifyToken, switchRole);

module.exports = router;
