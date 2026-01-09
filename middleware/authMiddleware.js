const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.admin = await Admin.findById(decoded.id).select('-password');

      if (!req.admin) {
        return res.status(401).json({ message: 'Không tìm thấy tài khoản' });
      }

      if (req.admin.isActive === false) {
        return res.status(403).json({ message: 'Tài khoản đã bị tạm khóa. Vui lòng liên hệ admin để biết thêm chi tiết.' });
      }

      return next();
    } catch (err) {
      return res.status(401).json({ message: 'Không được phép truy cập, token không hợp lệ' });
    }
  }

  return res.status(401).json({ message: 'Không được phép truy cập, thiếu token' });
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.admin) {
    return res.status(401).json({ message: 'Không được phép truy cập' });
  }
  if (req.admin.role !== 'super') {
    return res.status(403).json({ message: 'Chỉ admin tổng mới có quyền truy cập' });
  }
  return next();
};

module.exports = { protect, requireSuperAdmin };
