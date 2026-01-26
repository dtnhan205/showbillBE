// middleware/errorHandler.js
// Centralized error handling middleware

const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.admin?._id,
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      message: 'Dữ liệu không hợp lệ',
      errors: messages,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    return res.status(400).json({
      message: `${field} đã tồn tại`,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: 'Token không hợp lệ',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: 'Token đã hết hạn. Vui lòng đăng nhập lại.',
    });
  }

  // Multer errors
  if (err instanceof require('multer').MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File quá lớn. Vui lòng chọn file nhỏ hơn.',
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        message: 'Quá nhiều file. Vui lòng giảm số lượng file.',
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'Field name không hợp lệ.',
      });
    }
  }

  // File system errors
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      message: 'File không tồn tại.',
    });
  }

  // Rate limit errors
  if (err.status === 429) {
    return res.status(429).json({
      message: err.message || 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
    });
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Lỗi máy chủ. Vui lòng thử lại sau.'
    : err.message || 'Lỗi máy chủ';

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;

