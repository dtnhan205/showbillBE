const express = require('express');
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  registerLimiter,
  forgotPasswordLimiter,
} = require('../controllers/authController');

const router = express.Router();

// Public - register (with anti-spam rate limit)
router.post('/register', registerLimiter, register);

// Public - login (allow username or email)
router.post('/login', login);

// Public - forgot password (with rate limit)
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);

// Public - reset password with token
router.post('/reset-password', resetPassword);

module.exports = router;
