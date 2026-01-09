const Admin = require('../models/Admin');
const Product = require('../models/Product');

// GET /api/admin/users (super admin - list all admins)
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({})
      .select('username email role displayName bio avatarBase64 isActive createdAt updatedAt')
      .sort({ createdAt: -1 });

    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/admin/users/:id/toggle-active (super admin - lock/unlock admin)
exports.toggleAdminActive = async (req, res) => {
  try {
    const { id } = req.params;

    // Không cho tự khóa chính mình
    if (String(id) === String(req.admin._id)) {
      return res.status(400).json({ message: 'Không thể tự khóa tài khoản của chính bạn.' });
    }

    const admin = await Admin.findById(id).select('-password');
    if (!admin) {
      return res.status(404).json({ message: 'Không tìm thấy admin' });
    }

    // Không cho khóa super admin
    if (admin.role === 'super') {
      return res.status(400).json({ message: 'Không thể khóa super admin.' });
    }

    admin.isActive = admin.isActive === false ? true : false;
    await admin.save();

    res.json({
      message: admin.isActive ? 'Đã mở khóa tài khoản admin.' : 'Đã tạm khóa tài khoản admin.',
      admin,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/profile
exports.getMyProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password');
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/admin/profile (admin update profile)
exports.updateMyProfile = async (req, res) => {
  try {
    const adminId = req.admin._id;
    const { displayName, bio, avatarBase64 } = req.body;

    const update = {};
    if (typeof displayName !== 'undefined') update.displayName = String(displayName).trim();
    if (typeof bio !== 'undefined') update.bio = String(bio);
    if (typeof avatarBase64 !== 'undefined') update.avatarBase64 = String(avatarBase64);

    const admin = await Admin.findByIdAndUpdate(adminId, update, { new: true }).select('-password');
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/stats (admin thường: stats của mình)
exports.getMyStats = async (req, res) => {
  try {
    const adminId = req.admin._id;

    // Tổng bill và bill hiển thị vẫn lấy từ Product
    const totalBills = await Product.countDocuments({ adminId });
    const totalVisibleBills = await Product.countDocuments({ adminId, isHidden: false });
    // Tổng lượt xem dashboard = số lần profile admin được xem (profileViews)
    const admin = await Admin.findById(adminId).select('profileViews');
    const totalViews = admin?.profileViews ?? 0;

    res.json({ totalBills, totalVisibleBills, totalViews });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/system-stats (super admin)
exports.getSystemStats = async (req, res) => {
  try {
    const totalAdmins = await Admin.countDocuments({});
    const totalBills = await Product.countDocuments({});
    // Tổng lượt xem hệ thống = sum(profileViews) của tất cả admin
    const totalViewsAgg = await Admin.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$profileViews' } } },
    ]);
    const totalViews = totalViewsAgg?.[0]?.totalViews ?? 0;

    res.json({ totalAdmins, totalBills, totalViews });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
