const express = require('express');
const { register, login, registerLimiter } = require('../controllers/authController');

const router = express.Router();

// Public - register (with anti-spam rate limit)
router.post('/register', registerLimiter, register);

// Public - login (allow username or email)
router.post('/login', login);

module.exports = router;
