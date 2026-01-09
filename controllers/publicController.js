const Admin = require('../models/Admin');
const Product = require('../models/Product');

// GET /api/public/admins
exports.getPublicAdmins = async (req, res) => {
  try {
    // Chỉ hiển thị admin thường, không hiển thị super admin (không check isActive ở public route)
    const admins = await Admin.find({ role: 'admin' })
      .select('displayName bio avatarBase64 role createdAt profileViews')
      .sort({ createdAt: -1 });

    // Aggregate total bills per admin
    const stats = await Product.aggregate([
      { $match: { isHidden: false } },
      {
        $group: {
          _id: '$adminId',
          totalBills: { $sum: 1 },
        },
      },
    ]);

    const statsMap = new Map(stats.map((s) => [String(s._id), s]));

    const result = admins.map((a) => {
      const s = statsMap.get(String(a._id));
      return {
        _id: a._id,
        displayName: a.displayName || a.username,
        bio: a.bio || '',
        avatarBase64: a.avatarBase64 || '',
        role: a.role,
        stats: {
          totalBills: s?.totalBills ?? 0,
          // Lượt xem hiển thị ngoài client = số lần vào trang profile admin (profileViews)
          totalViews: a.profileViews ?? 0,
        },
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/public/admins/:id
exports.getPublicAdminDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await Admin.findById(id).select('displayName bio avatarBase64 role createdAt');
    if (!admin) return res.status(404).json({ message: 'Không tìm thấy admin' });

    // Only visible bills
    const products = await Product.find({ adminId: id, isHidden: false }).sort({ createdAt: -1 });

    // Unique obs + categories from their products
    const obs = Array.from(new Set(products.map((p) => p.obVersion).filter(Boolean))).sort();
    const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();

    res.json({
      admin: {
        _id: admin._id,
        displayName: admin.displayName,
        bio: admin.bio,
        avatarBase64: admin.avatarBase64,
        role: admin.role,
      },
      obs,
      categories,
      products,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/public/admins/:id/increment-views
exports.incrementAdminViews = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if admin exists
    const admin = await Admin.findByIdAndUpdate(
      id,
      { $inc: { profileViews: 1 } },
      { new: true, select: 'profileViews' },
    );
    if (!admin) return res.status(404).json({ message: 'Không tìm thấy admin' });

    res.json({
      message: 'Views incremented',
      profileViews: admin.profileViews,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/public/products/:id/view
exports.incrementProductView = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Product.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true, select: 'views' },
    );

    if (!updated) return res.status(404).json({ message: 'Không tìm thấy bill' });
    res.json({ views: updated.views });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

