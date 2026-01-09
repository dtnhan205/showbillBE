const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { rateLimit } = require('express-rate-limit');

// Rate limiting for registration (5 requests per 15 minutes per IP)
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many accounts created from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

const isEmailValid = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
};

const ensureJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim().length < 10) {
    // require something non-trivial
    const err = new Error('Missing or weak JWT_SECRET');
    err.code = 'MISSING_JWT_SECRET';
    throw err;
  }
  return secret;
};

const formatMongoDuplicateKey = (err) => {
  // Try to extract which field duplicated
  const keyValue = err?.keyValue;
  if (keyValue) {
    const field = Object.keys(keyValue)[0];
    const value = keyValue[field];
    return `${field} đã tồn tại: ${value}`;
  }
  return 'Username hoặc email đã tồn tại';
};

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
    }

    const u = String(username).trim().toLowerCase();
    const e = String(email).trim().toLowerCase();

    if (u.length < 3) {
      return res.status(400).json({ message: 'Username tối thiểu 3 ký tự' });
    }

    if (!isEmailValid(e)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password tối thiểu 6 ký tự' });
    }

    const existingUser = await Admin.findOne({ $or: [{ username: u }, { email: e }] });
    if (existingUser) {
      return res.status(409).json({ message: 'Tên đăng nhập hoặc email đã tồn tại' });
    }

    const admin = new Admin({
      username: u,
      email: e,
      password,
      displayName: u,
      role: 'admin',
    });

    await admin.save();

    const secret = ensureJwtSecret();
    const token = jwt.sign({ id: admin._id }, secret, { expiresIn: '7d' });

    const userData = admin.toObject();
    delete userData.password;

    res.status(201).json({
      message: 'Đăng ký thành công',
      token,
      admin: userData,
    });
  } catch (err) {
    // Better error outputs for debugging
    if (err?.code === 11000) {
      return res.status(409).json({ message: formatMongoDuplicateKey(err) });
    }

    if (err?.code === 'MISSING_JWT_SECRET') {
      return res.status(500).json({ message: 'Server thiếu JWT_SECRET (kiểm tra Backend/.env)' });
    }

    // Mongoose validation errors
    if (err?.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }

    console.error('[register] error:', err);
    return res.status(500).json({ message: err?.message || 'Lỗi máy chủ nội bộ' });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập/email và mật khẩu' });
    }

    const key = String(username).trim().toLowerCase();

    const admin = await Admin.findOne({ $or: [{ username: key }, { email: key }] });
    if (!admin) {
      return res.status(401).json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    if (admin.isActive === false) {
      return res.status(403).json({ message: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ admin để biết thêm chi tiết.' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Sai tên đăng nhập hoặc mật khẩu' });
    }

    const secret = ensureJwtSecret();
    const token = jwt.sign({ id: admin._id }, secret, { expiresIn: '7d' });

    const userData = admin.toObject();
    delete userData.password;

    res.json({
      message: 'Đăng nhập thành công',
      token,
      admin: userData,
    });
  } catch (err) {
    if (err?.code === 'MISSING_JWT_SECRET') {
      return res.status(500).json({ message: 'Server thiếu JWT_SECRET (kiểm tra Backend/.env)' });
    }

    console.error('[login] error:', err);
    return res.status(500).json({ message: err?.message || 'Lỗi máy chủ nội bộ' });
  }
};

module.exports = {
  register,
  login,
  registerLimiter,
};
