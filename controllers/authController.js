const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Admin = require('../models/Admin');
const { rateLimit } = require('express-rate-limit');
const { sendWelcomeEmail, sendResetPasswordEmail } = require('../services/emailService');

// Rate limiting for registration (5 requests per 15 minutes per IP)
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many accounts created from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for forgot password (3 requests per 15 minutes per IP)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many password reset requests from this IP, please try again after 15 minutes',
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

    // Gửi email chào mừng (không chặn response nếu lỗi)
    console.log('[register] Attempting to send welcome email to:', e);
    sendWelcomeEmail(e, u)
      .then((result) => {
        if (result.success) {
          console.log('[register] Welcome email sent successfully:', result.messageId);
        } else {
          console.error('[register] Failed to send welcome email:', result.message || result.error);
        }
      })
      .catch((emailError) => {
        console.error('[register] Error sending welcome email:', emailError.message || emailError);
        console.error('[register] Full error:', emailError);
        // Không throw error để không ảnh hưởng đến quá trình đăng ký
      });

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

/**
 * Tạo mã reset password ngẫu nhiên (6 chữ số)
 */
const generateResetToken = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Yêu cầu đặt lại mật khẩu - gửi mã OTP qua email
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email' });
    }

    const e = String(email).trim().toLowerCase();

    if (!isEmailValid(e)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }

    const admin = await Admin.findOne({ email: e });
    
    // Luôn trả về thành công để không tiết lộ email có tồn tại hay không (security best practice)
    if (!admin) {
      console.log('[forgotPassword] Email not found:', e);
      return res.json({
        message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã đặt lại mật khẩu qua email.',
      });
    }

    if (admin.isActive === false) {
      return res.json({
        message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã đặt lại mật khẩu qua email.',
      });
    }

    // Tạo mã reset và lưu vào database
    const resetToken = generateResetToken();
    const resetExpires = new Date();
    resetExpires.setMinutes(resetExpires.getMinutes() + 15); // Hết hạn sau 15 phút

    admin.resetPasswordToken = resetToken;
    admin.resetPasswordExpires = resetExpires;
    await admin.save();

    // Gửi email với mã reset
    console.log('[forgotPassword] Attempting to send reset password email to:', e);
    sendResetPasswordEmail(e, resetToken, admin.username || admin.displayName)
      .then((result) => {
        if (result.success) {
          console.log('[forgotPassword] Reset password email sent successfully:', result.messageId);
        } else {
          console.error('[forgotPassword] Failed to send reset password email:', result.message || result.error);
        }
      })
      .catch((emailError) => {
        console.error('[forgotPassword] Error sending reset password email:', emailError.message || emailError);
      });

    res.json({
      message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã đặt lại mật khẩu qua email.',
    });
  } catch (err) {
    console.error('[forgotPassword] error:', err);
    return res.status(500).json({ message: err?.message || 'Lỗi máy chủ nội bộ' });
  }
};

/**
 * Đặt lại mật khẩu với mã OTP
 */
const resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin (email, mã xác nhận, mật khẩu mới)' });
    }

    const e = String(email).trim().toLowerCase();
    const resetToken = String(token).trim();

    if (!isEmailValid(e)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới tối thiểu 6 ký tự' });
    }

    // Tìm admin với email và token hợp lệ
    const admin = await Admin.findOne({
      email: e,
      resetPasswordToken: resetToken,
      resetPasswordExpires: { $gt: new Date() }, // Token chưa hết hạn
    });

    if (!admin) {
      return res.status(400).json({
        message: 'Mã xác nhận không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới.',
      });
    }

    if (admin.isActive === false) {
      return res.status(403).json({ message: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ admin.' });
    }

    // Đặt lại mật khẩu
    admin.password = newPassword;
    admin.resetPasswordToken = null;
    admin.resetPasswordExpires = null;
    await admin.save();

    console.log('[resetPassword] Password reset successful for:', e);

    res.json({
      message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập với mật khẩu mới.',
    });
  } catch (err) {
    console.error('[resetPassword] error:', err);
    return res.status(500).json({ message: err?.message || 'Lỗi máy chủ nội bộ' });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  registerLimiter,
  forgotPasswordLimiter,
};
