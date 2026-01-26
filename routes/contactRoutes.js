// routes/contactRoutes.js
const express = require('express');
const { sendContactMessage } = require('../controllers/contactController');
const { protect } = require('../middleware/authMiddleware');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Rate limiting cho contact form: 5 tin nhắn mỗi 15 phút cho mỗi user
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Tối đa 5 tin nhắn
  message: {
    error: 'Quá nhiều tin nhắn. Vui lòng thử lại sau 15 phút.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Sử dụng user ID để rate limit theo user thay vì IP
  // Sử dụng ipKeyGenerator khi fallback về IP để xử lý đúng IPv6
  keyGenerator: (req) => {
    const userId = req.admin?._id?.toString();
    if (userId) {
      return `contact:${userId}`;
    }
    // Fallback về IP nếu chưa đăng nhập (sử dụng ipKeyGenerator cho IPv6)
    const ip = ipKeyGenerator(req);
    return `contact:${ip}`;
  },
});

const router = express.Router();

// Yêu cầu đăng nhập để gửi tin nhắn
router.post('/', protect, contactLimiter, sendContactMessage);

module.exports = router;

