const Payment = require('../models/Payment');
const PackageConfig = require('../models/PackageConfig');
const BankAccount = require('../models/BankAccount');
const Admin = require('../models/Admin');
const Product = require('../models/Product');
const mongoose = require('mongoose');

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
    const admin = await Admin.findById(req.admin._id).select('package packageExpiry');
    if (!admin) {
      return res.status(404).json({ message: 'Không tìm thấy admin.' });
    }

    // Kiểm tra hết hạn gói
    let currentPackage = admin.package;
    let packageExpiry = admin.packageExpiry;

    if (packageExpiry && new Date() > packageExpiry) {
      // Gói đã hết hạn, về basic
      currentPackage = 'basic';
      packageExpiry = null;
      await Admin.findByIdAndUpdate(req.admin._id, {
        package: 'basic',
        packageExpiry: null,
      });
    }

    // Lấy số bill đã upload trong tháng
    const billsUploaded = await getBillsUploadedThisMonth(req.admin._id);

    // Lấy giới hạn bill của gói hiện tại
    const packageConfig = await PackageConfig.findOne({ packageType: currentPackage });
    const billLimit = packageConfig ? packageConfig.billLimit : 20;

    res.json({
      package: currentPackage,
      packageExpiry,
      billsUploaded,
      billLimit: billLimit === -1 ? null : billLimit, // null = unlimited
      canUpload: billLimit === -1 || billsUploaded < billLimit,
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

    if (!['pro', 'premium'].includes(packageType)) {
      return res.status(400).json({ message: 'Loại gói không hợp lệ.' });
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

    // Lấy giá gói từ config
    const packageConfig = await PackageConfig.findOne({ packageType });
    if (!packageConfig) {
      return res.status(404).json({ message: 'Không tìm thấy cấu hình gói.' });
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

    // Cập nhật gói cho admin
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 1); // Thêm 1 tháng

    await Admin.findByIdAndUpdate(payment.adminId, {
      package: payment.packageType,
      packageExpiry: expiryDate,
    });

    // Cập nhật trạng thái payment
    payment.status = 'completed';
    payment.completedAt = new Date();
    await payment.save();

    res.json({ message: 'Đã xác minh thanh toán thành công.', payment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

