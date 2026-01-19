const Payment = require('../models/Payment');
const PackageConfig = require('../models/PackageConfig');
const BankAccount = require('../models/BankAccount');
const Admin = require('../models/Admin');
const Product = require('../models/Product');
const mongoose = require('mongoose');
const { validateAndCleanAvatarFrame } = require('./adminController');

// Helper: Tạo mã nội dung chuyển khoản unique (dtnxxxxx)
async function generateTransferContent() {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const transferContent = `dtn${randomNum}`;

    const existing = await Payment.findOne({ transferContent });
    if (!existing) {
      return transferContent;
    }

    attempts++;
  }

  throw new Error('Không thể tạo mã nội dung chuyển khoản duy nhất.');
}

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

// GET /api/admin/payment/my-package - Admin: Xem gói hiện tại và số bill đã upload
exports.getMyPackage = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('package packageExpiry activePackage ownedPackages');
    if (!admin) {
      return res.status(404).json({ message: 'Không tìm thấy admin.' });
    }

    // Lọc các gói đã hết hạn
    const now = new Date();
    const validPackages = (admin.ownedPackages || []).filter((pkg) => new Date(pkg.expiryDate) > now);
    
    // Cập nhật ownedPackages nếu có gói hết hạn
    if (admin.ownedPackages.length !== validPackages.length) {
      admin.ownedPackages = validPackages;
    }

    // Kiểm tra activePackage có còn hợp lệ không
    let currentPackage = admin.activePackage || admin.package || 'basic';
    let packageExpiry = null;

    // Nếu activePackage không phải basic, kiểm tra xem còn hợp lệ không
    if (currentPackage !== 'basic') {
      // So sánh không phân biệt hoa thường để tránh lỗi
      const activePkg = validPackages.find(
        (pkg) => pkg.packageType?.toLowerCase() === currentPackage?.toLowerCase()
      );
      if (!activePkg) {
        // Gói đang active đã hết hạn hoặc không có trong ownedPackages, chuyển về basic hoặc gói còn hạn đầu tiên
        if (validPackages.length > 0) {
          currentPackage = validPackages[0].packageType;
          packageExpiry = validPackages[0].expiryDate;
        } else {
          currentPackage = 'basic';
          packageExpiry = null;
        }
        admin.activePackage = currentPackage;
        admin.package = currentPackage;
        admin.packageExpiry = packageExpiry;
        // Kiểm tra và xóa avatarFrame nếu không phù hợp với gói mới
        validateAndCleanAvatarFrame(admin, currentPackage);
        await admin.save();
      } else {
        packageExpiry = activePkg.expiryDate;
      }
    }

    // Lấy số bill đã upload trong tháng
    const billsUploaded = await getBillsUploadedThisMonth(req.admin._id);

    // Lấy giới hạn bill của gói hiện tại
    const packageConfig = await PackageConfig.findOne({ packageType: currentPackage });
    const billLimit = packageConfig ? packageConfig.billLimit : 20;

    // Format ownedPackages để trả về
    const ownedPackagesFormatted = validPackages.map((pkg) => ({
      packageType: pkg.packageType,
      expiryDate: pkg.expiryDate,
      purchasedAt: pkg.purchasedAt,
      isActive: pkg.packageType === currentPackage,
    }));

    res.json({
      package: currentPackage,
      activePackage: currentPackage,
      packageExpiry,
      billsUploaded,
      billLimit: billLimit === -1 ? null : billLimit, // null = unlimited
      canUpload: billLimit === -1 || billsUploaded < billLimit,
      ownedPackages: ownedPackagesFormatted,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/payment/packages - Admin: Xem danh sách gói và giá
exports.getPackages = async (req, res) => {
  try {
    const configs = await PackageConfig.find({}).sort({ packageType: 1 });
    res.json(configs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/admin/payment/create - Admin: Tạo hóa đơn thanh toán
exports.createPayment = async (req, res) => {
  try {
    const { packageType, amount } = req.body;

    // Không cho phép mua gói basic
    if (!packageType || packageType === 'basic') {
      return res.status(400).json({ message: 'Loại gói không hợp lệ.' });
    }

    // Kiểm tra gói có tồn tại trong PackageConfig không
    const packageConfig = await PackageConfig.findOne({ packageType });
    if (!packageConfig) {
      return res.status(400).json({ message: 'Gói không tồn tại trong hệ thống.' });
    }

    // Kiểm tra số lượng đơn chưa thanh toán (pending)
    const pendingPayments = await Payment.countDocuments({
      adminId: req.admin._id,
      status: 'pending',
    });

    if (pendingPayments >= 3) {
      return res.status(400).json({
        message: 'Bạn đã có 3 đơn chưa thanh toán. Vui lòng thanh toán hoặc xóa đơn cũ trước khi tạo đơn mới.',
        pendingCount: pendingPayments,
      });
    }

    // Kiểm tra chống spam: không cho tạo payment mới nếu đã tạo payment PENDING trong 1 giờ gần đây
    // Chỉ chặn nếu có payment pending, không chặn nếu đã thanh toán thành công
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentPendingPayment = await Payment.findOne({
      adminId: req.admin._id,
      status: 'pending', // Chỉ kiểm tra payment pending
      createdAt: { $gte: oneHourAgo },
    }).sort({ createdAt: -1 });

    if (recentPendingPayment) {
      // Tính thời gian còn lại (từ lúc tạo payment gần nhất đến 1 giờ sau)
      const paymentTime = new Date(recentPendingPayment.createdAt);
      const oneHourAfterPayment = new Date(paymentTime.getTime() + 3600000); // +1 giờ
      const now = new Date();
      const timeRemainingMs = oneHourAfterPayment.getTime() - now.getTime();

      if (timeRemainingMs > 0) {
        const timeRemainingMinutes = Math.ceil(timeRemainingMs / 60000);
        return res.status(429).json({
          message: `Bạn đã tạo hóa đơn chưa thanh toán gần đây. Vui lòng đợi ${timeRemainingMinutes} phút nữa hoặc thanh toán/xóa đơn cũ trước khi tạo hóa đơn mới.`,
          timeRemaining: timeRemainingMinutes,
        });
      }
    }

    if (amount !== packageConfig.price) {
      return res.status(400).json({ message: `Số tiền không đúng. Giá gói ${packageType} là ${packageConfig.price.toLocaleString()} VNĐ.` });
    }

    // Lấy tài khoản ngân hàng active
    const bankAccount = await BankAccount.findOne({ isActive: true });
    if (!bankAccount) {
      return res.status(404).json({ message: 'Hiện tại không có tài khoản ngân hàng nào hoạt động.' });
    }

    // Tạo mã nội dung chuyển khoản unique
    const transferContent = await generateTransferContent();

    // Tạo payment
    const payment = new Payment({
      adminId: req.admin._id,
      packageType,
      amount,
      transferContent,
      bankAccountId: bankAccount._id,
    });

    await payment.save();

    // Populate bank account để trả về thông tin đầy đủ
    await payment.populate('bankAccountId');

    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/payment/history - Admin: Xem lịch sử thanh toán
exports.getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.find({ adminId: req.admin._id })
      .populate('bankAccountId')
      .sort({ createdAt: -1 });

    res.json(payments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/payment/:id - Admin: Xem chi tiết hóa đơn
exports.getPaymentDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findOne({
      _id: id,
      adminId: req.admin._id,
    }).populate('bankAccountId');

    if (!payment) {
      return res.status(404).json({ message: 'Không tìm thấy hóa đơn.' });
    }

    res.json(payment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/admin/payment/:id - Admin: Xóa hóa đơn (chỉ được xóa đơn pending)
exports.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findOne({
      _id: id,
      adminId: req.admin._id,
    });

    if (!payment) {
      return res.status(404).json({ message: 'Không tìm thấy hóa đơn.' });
    }

    // Chỉ cho phép xóa đơn pending hoặc expired
    if (payment.status === 'completed') {
      return res.status(400).json({ message: 'Không thể xóa đơn đã thanh toán.' });
    }

    await Payment.findByIdAndDelete(id);

    res.json({ message: 'Đã xóa hóa đơn thành công.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/admin/payment/verify - Super admin: Xác minh thanh toán thủ công (nếu cần)
exports.verifyPayment = async (req, res) => {
  try {
    if (req.admin.role !== 'super') {
      return res.status(403).json({ message: 'Chỉ super admin mới có quyền truy cập.' });
    }

    const { paymentId } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ message: 'Không tìm thấy hóa đơn.' });
    }

    if (payment.status === 'completed') {
      return res.status(400).json({ message: 'Hóa đơn đã được thanh toán.' });
    }

    // Thêm gói vào ownedPackages của admin
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1); // Thêm 1 tháng

    const admin = await Admin.findById(payment.adminId);
    if (admin) {
      // Thêm gói vào ownedPackages nếu chưa có
      const existingPackage = admin.ownedPackages.find(
        (pkg) => pkg.packageType === payment.packageType && pkg.expiryDate.getTime() === expiryDate.getTime()
      );

      if (!existingPackage) {
        admin.ownedPackages.push({
          packageType: payment.packageType,
          expiryDate: expiryDate,
          purchasedAt: new Date(),
        });
      }

      // Nếu chưa có activePackage hoặc activePackage là basic, tự động set gói mới làm active
      if (!admin.activePackage || admin.activePackage === 'basic') {
        admin.activePackage = payment.packageType;
        // Kiểm tra và xóa avatarFrame nếu không phù hợp với gói mới (khi upgrade)
        validateAndCleanAvatarFrame(admin, payment.packageType);
      }

      // Giữ package và packageExpiry để backward compatibility
      admin.package = payment.packageType;
      admin.packageExpiry = expiryDate;

      await admin.save();
    }

    // Cập nhật trạng thái payment
    payment.status = 'completed';
    payment.completedAt = new Date();
    await payment.save();

    res.json({ message: 'Đã xác minh thanh toán thành công.', payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/admin/payment/switch-package - Admin: Chuyển đổi gói đang sử dụng
exports.switchPackage = async (req, res) => {
  try {
    const { packageType } = req.body;

    if (!packageType) {
      return res.status(400).json({ message: 'Vui lòng chọn gói.' });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ message: 'Không tìm thấy admin.' });
    }

    // Nếu chọn basic, luôn cho phép
    if (packageType === 'basic') {
      admin.activePackage = 'basic';
      admin.package = 'basic';
      admin.packageExpiry = null;
      // Kiểm tra và xóa avatarFrame nếu không phù hợp với gói basic
      validateAndCleanAvatarFrame(admin, 'basic');
      await admin.save();
      return res.json({ message: 'Đã chuyển sang gói Basic.', activePackage: 'basic' });
    }

    // Kiểm tra xem gói có tồn tại trong PackageConfig không (cho gói tùy chỉnh)
    const packageConfig = await PackageConfig.findOne({ packageType });
    if (!packageConfig) {
      return res.status(400).json({ message: 'Loại gói không hợp lệ.' });
    }

    // Kiểm tra xem admin có gói này trong ownedPackages không
    const now = new Date();
    const validPackages = (admin.ownedPackages || []).filter((pkg) => new Date(pkg.expiryDate) > now);
    const targetPackage = validPackages.find((pkg) => pkg.packageType === packageType);

    if (!targetPackage) {
      return res.status(400).json({
        message: `Bạn chưa mua gói ${packageType} hoặc gói đã hết hạn. Vui lòng mua gói trước khi chuyển đổi.`,
      });
    }

    // Chuyển đổi gói
    admin.activePackage = packageType;
    admin.package = packageType;
    admin.packageExpiry = targetPackage.expiryDate;
    // Kiểm tra và xóa avatarFrame nếu không phù hợp với gói mới
    validateAndCleanAvatarFrame(admin, packageType);
    await admin.save();

    res.json({
      message: `Đã chuyển sang gói ${packageType}.`,
      activePackage: packageType,
      packageExpiry: targetPackage.expiryDate,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

