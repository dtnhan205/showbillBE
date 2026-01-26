// middleware/rateLimitMiddleware.js
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Rate limiting cho upload (avatar, banner, products)
// Giới hạn: 10 uploads mỗi 15 phút cho mỗi user (dựa trên IP)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Tối đa 10 uploads
  message: {
    error: 'Quá nhiều yêu cầu upload. Vui lòng thử lại sau 15 phút.',
    retryAfter: 15 * 60, // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Sử dụng IP + user ID nếu có để tránh spam từ cùng một user
  // Sử dụng ipKeyGenerator để xử lý đúng IPv6
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    const userId = req.admin?._id?.toString() || 'anonymous';
    return `${ip}:${userId}`;
  },
  // Skip rate limit nếu là super admin (để tránh block admin)
  skip: (req) => {
    return req.admin?.role === 'super';
  },
});

// Rate limiting cho bulk upload (nhiều file cùng lúc)
const bulkUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 5, // Tối đa 5 lần bulk upload mỗi giờ
  message: {
    error: 'Quá nhiều yêu cầu upload hàng loạt. Vui lòng thử lại sau 1 giờ.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Sử dụng ipKeyGenerator để xử lý đúng IPv6
  keyGenerator: (req) => {
    const ip = ipKeyGenerator(req);
    const userId = req.admin?._id?.toString() || 'anonymous';
    return `${ip}:${userId}`;
  },
  skip: (req) => {
    return req.admin?.role === 'super';
  },
});

// Rate limiting cho các API endpoints thông thường
// Tăng giới hạn để tránh block khi chuyển tab nhanh
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 500, // Tối đa 500 requests mỗi 15 phút (tăng từ 100 để tránh block khi chuyển tab)
  message: {
    error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limit cho super admin để tránh block khi quản lý
  skip: (req) => {
    return req.admin?.role === 'super';
  },
  // Sử dụng user ID nếu có để rate limit theo user thay vì IP
  keyGenerator: (req) => {
    const userId = req.admin?._id?.toString();
    if (userId) {
      return `api:${userId}`;
    }
    // Fallback về IP nếu chưa đăng nhập
    return ipKeyGenerator(req);
  },
});

// Rate limiting cho các endpoint admin (nghiêm ngặt hơn)
const adminApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 1000, // Tối đa 1000 requests mỗi 15 phút (tăng từ 200)
  message: {
    error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limit cho super admin
  skip: (req) => {
    return req.admin?.role === 'super';
  },
  // Sử dụng user ID để rate limit theo user
  keyGenerator: (req) => {
    const userId = req.admin?._id?.toString();
    if (userId) {
      return `admin-api:${userId}`;
    }
    return ipKeyGenerator(req);
  },
});

// Rate limiting cho profile update
const profileUpdateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 phút
  max: 10, // Tối đa 10 lần update profile mỗi 5 phút
  message: {
    error: 'Quá nhiều yêu cầu cập nhật profile. Vui lòng thử lại sau 5 phút.',
    retryAfter: 5 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting cho tạo OB và Category
// Giới hạn: 5 lần tạo mỗi phút cho mỗi user
const createObCategoryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 5, // Tối đa 5 lần tạo OB/Category mỗi phút
  message: {
    error: 'Quá nhiều yêu cầu tạo OB/Category. Vui lòng thử lại sau 1 phút.',
    retryAfter: 60, // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Sử dụng user ID để rate limit theo user
  keyGenerator: (req) => {
    const userId = req.admin?._id?.toString();
    if (userId) {
      return `create-ob-category:${userId}`;
    }
    // Fallback về IP nếu chưa đăng nhập (sử dụng ipKeyGenerator cho IPv6)
    const ip = ipKeyGenerator(req);
    return `create-ob-category:${ip}`;
  },
  // Skip rate limit nếu là super admin
  skip: (req) => {
    return req.admin?.role === 'super';
  },
});

module.exports = {
  uploadLimiter,
  bulkUploadLimiter,
  apiLimiter,
  adminApiLimiter,
  profileUpdateLimiter,
  createObCategoryLimiter,
};

