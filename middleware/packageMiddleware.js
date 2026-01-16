const Admin = require('../models/Admin');
const PackageConfig = require('../models/PackageConfig');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// Helper: Lấy số bill đã upload trong tháng hiện tại
async function getBillsUploadedThisMonth(adminId) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return await Product.countDocuments({
    adminId: new mongoose.Types.ObjectId(adminId),
    createdAt: {
      $gte: startOfMonth,
      $lte: endOfMonth,
    },
  });
}

// Middleware: Kiểm tra giới hạn upload bill
const checkUploadLimit = async (req, res, next) => {
  try {
    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ message: 'Không tìm thấy admin.' });
    }

    // Kiểm tra hết hạn gói
    let currentPackage = admin.package;
    if (admin.packageExpiry && new Date() > admin.packageExpiry) {
      // Gói đã hết hạn, về basic
      currentPackage = 'basic';
      await Admin.findByIdAndUpdate(req.admin._id, {
        package: 'basic',
        packageExpiry: null,
      });
    }

    // Lấy cấu hình gói
    const packageConfig = await PackageConfig.findOne({ packageType: currentPackage });
    if (!packageConfig) {
      // Nếu không có config, mặc định basic = 20
      const billLimit = currentPackage === 'basic' ? 20 : currentPackage === 'pro' ? 100 : -1;
      if (billLimit === -1) {
        return next(); // Premium unlimited
      }

      const billsUploaded = await getBillsUploadedThisMonth(req.admin._id);
      if (billsUploaded >= billLimit) {
        return res.status(403).json({
          message: `Bạn đã upload ${billsUploaded}/${billLimit} bill trong tháng này. Vui lòng nâng cấp gói để tiếp tục upload.`,
          billsUploaded,
          billLimit,
          currentPackage,
        });
      }

      return next();
    }

    // Premium unlimited
    if (packageConfig.billLimit === -1) {
      return next();
    }

    // Kiểm tra số bill đã upload
    const billsUploaded = await getBillsUploadedThisMonth(req.admin._id);
    if (billsUploaded >= packageConfig.billLimit) {
      return res.status(403).json({
        message: `Bạn đã upload ${billsUploaded}/${packageConfig.billLimit} bill trong tháng này. Vui lòng nâng cấp gói để tiếp tục upload.`,
        billsUploaded,
        billLimit: packageConfig.billLimit,
        currentPackage,
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { checkUploadLimit };

