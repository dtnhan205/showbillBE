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

    // Kiểm tra hết hạn gói - sử dụng activePackage nếu có
    let currentPackage = admin.activePackage || admin.package || 'basic';
    
    // Nếu activePackage không phải basic, kiểm tra xem còn hợp lệ không
    if (currentPackage !== 'basic') {
      const now = new Date();
      const validPackages = (admin.ownedPackages || []).filter((pkg) => new Date(pkg.expiryDate) > now);
      const activePkg = validPackages.find((pkg) => pkg.packageType === currentPackage);
      
      if (!activePkg) {
        // Gói đang active đã hết hạn, chuyển về basic hoặc gói còn hạn đầu tiên
        if (validPackages.length > 0) {
          currentPackage = validPackages[0].packageType;
        } else {
          currentPackage = 'basic';
        }
        await Admin.findByIdAndUpdate(req.admin._id, {
          activePackage: currentPackage,
          package: currentPackage,
          packageExpiry: currentPackage === 'basic' ? null : validPackages[0]?.expiryDate,
        });
      }
    } else if (admin.packageExpiry && new Date() > admin.packageExpiry) {
      // Backward compatibility: kiểm tra packageExpiry cũ
      currentPackage = 'basic';
      await Admin.findByIdAndUpdate(req.admin._id, {
        activePackage: 'basic',
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
      
      // Kiểm tra số file đang upload (cho bulk upload)
      const filesToUpload = req.files ? req.files.length : (req.file ? 1 : 0);
      const totalAfterUpload = billsUploaded + filesToUpload;
      
      if (billsUploaded >= billLimit) {
        return res.status(403).json({
          message: `Bạn đã upload ${billsUploaded}/${billLimit} bill trong tháng này. Vui lòng nâng cấp gói để tiếp tục upload.`,
          billsUploaded,
          billLimit,
          currentPackage,
        });
      }

      // Kiểm tra nếu upload nhiều file sẽ vượt quá giới hạn
      if (totalAfterUpload > billLimit) {
        const remaining = billLimit - billsUploaded;
        return res.status(403).json({
          message: `Bạn chỉ còn có thể upload ${remaining} bill nữa trong tháng này (đã upload ${billsUploaded}/${billLimit}). Vui lòng giảm số lượng file hoặc nâng cấp gói.`,
          billsUploaded,
          billLimit,
          remaining,
          filesToUpload,
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
    
    // Kiểm tra số file đang upload (cho bulk upload)
    const filesToUpload = req.files ? req.files.length : (req.file ? 1 : 0);
    const totalAfterUpload = billsUploaded + filesToUpload;
    
    if (billsUploaded >= packageConfig.billLimit) {
      return res.status(403).json({
        message: `Bạn đã upload ${billsUploaded}/${packageConfig.billLimit} bill trong tháng này. Vui lòng nâng cấp gói để tiếp tục upload.`,
        billsUploaded,
        billLimit: packageConfig.billLimit,
        currentPackage,
      });
    }

    // Kiểm tra nếu upload nhiều file sẽ vượt quá giới hạn
    if (totalAfterUpload > packageConfig.billLimit) {
      const remaining = packageConfig.billLimit - billsUploaded;
      return res.status(403).json({
        message: `Bạn chỉ còn có thể upload ${remaining} bill nữa trong tháng này (đã upload ${billsUploaded}/${packageConfig.billLimit}). Vui lòng giảm số lượng file hoặc nâng cấp gói.`,
        billsUploaded,
        billLimit: packageConfig.billLimit,
        remaining,
        filesToUpload,
        currentPackage,
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { checkUploadLimit };

