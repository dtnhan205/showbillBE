const Admin = require('../models/Admin');
const Product = require('../models/Product');
const ViewStat = require('../models/ViewStat');
const PackageConfig = require('../models/PackageConfig');

// Helper function: Lấy ngày theo timezone Việt Nam (UTC+7)
function getVietnamDate(date = new Date()) {
  // Convert sang timezone Việt Nam (UTC+7)
  const vietnamTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  // Format: YYYY-MM-DD
  const year = vietnamTime.getFullYear();
  const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  const day = String(vietnamTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// GET /api/public/admins
exports.getPublicAdmins = async (req, res) => {
  try {
    // Chỉ hiển thị admin thường, không hiển thị super admin (không check isActive ở public route)
    const admins = await Admin.find({ role: 'admin' })
      .select('displayName bio avatarBase64 bannerBase64 role createdAt profileViews')
      .sort({ createdAt: -1 });

    // Aggregate total bills và views per admin
    const stats = await Product.aggregate([
      { $match: { isHidden: false } },
      {
        $group: {
          _id: '$adminId',
          totalBills: { $sum: 1 },
          totalViews: { $sum: '$views' }, // Tổng views của tất cả products
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
        bannerBase64: a.bannerBase64 || '',
        role: a.role,
        stats: {
          totalBills: s?.totalBills ?? 0,
          // Lượt xem hiển thị ngoài client = tổng views của tất cả products (giống admin dashboard)
          totalViews: s?.totalViews ?? 0,
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

    let admin;
    
    // If id is full length (24 chars), try findById first
    if (id.length === 24) {
      admin = await Admin.findById(id).select('displayName bio avatarBase64 bannerBase64 role createdAt activePackage avatarFrame');
    }
    
    // If not found or id is shorter than 24 chars, try to find by prefix
    if (!admin && id.length < 24) {
      // Use $expr to convert ObjectId to string and match prefix
      const matchingAdmins = await Admin.find({
        $expr: {
          $eq: [
            { $substr: [{ $toString: '$_id' }, 0, id.length] },
            id
          ]
        }
      }).select('displayName bio avatarBase64 bannerBase64 role createdAt activePackage avatarFrame');
      
      if (matchingAdmins.length === 1) {
        admin = matchingAdmins[0];
      } else if (matchingAdmins.length > 1) {
        return res.status(400).json({ message: 'Có nhiều admin khớp với ID này. Vui lòng sử dụng ID đầy đủ.' });
      }
    }
    
    if (!admin) return res.status(404).json({ message: 'Không tìm thấy admin' });

    const adminId = admin._id.toString();
    // Only visible bills
    const products = await Product.find({ adminId: adminId, isHidden: false }).sort({ createdAt: -1 });

    // Unique obs + categories from their products
    const obs = Array.from(new Set(products.map((p) => p.obVersion).filter(Boolean))).sort();
    const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort();

    // Lấy màu của gói từ PackageConfig
    const packageType = admin.activePackage || 'basic';
    const packageConfig = await PackageConfig.findOne({ packageType });
    const packageColor = packageConfig?.color || (packageType === 'pro' ? '#3b82f6' : packageType === 'premium' ? '#f59e0b' : '#94a3b8');

    res.json({
      admin: {
        _id: admin._id,
        displayName: admin.displayName,
        bio: admin.bio,
        avatarBase64: admin.avatarBase64,
        bannerBase64: admin.bannerBase64,
        role: admin.role,
        activePackage: packageType,
        packageColor: packageColor,
        avatarFrame: admin.avatarFrame || '',
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
    
    let admin;
    
    // If id is full length (24 chars), try findByIdAndUpdate first
    if (id.length === 24) {
      admin = await Admin.findByIdAndUpdate(
        id,
        { $inc: { profileViews: 1 } },
        { new: true, select: 'profileViews' },
      );
    }
    
    // If not found or id is shorter than 24 chars, try to find by prefix
    if (!admin && id.length < 24) {
      // Use $expr to convert ObjectId to string and match prefix
      const matchingAdmins = await Admin.find({
        $expr: {
          $eq: [
            { $substr: [{ $toString: '$_id' }, 0, id.length] },
            id
          ]
        }
      });
      
      if (matchingAdmins.length === 1) {
        admin = await Admin.findByIdAndUpdate(
          matchingAdmins[0]._id,
          { $inc: { profileViews: 1 } },
          { new: true, select: 'profileViews' },
        );
      } else if (matchingAdmins.length > 1) {
        return res.status(400).json({ message: 'Có nhiều admin khớp với ID này. Vui lòng sử dụng ID đầy đủ.' });
      }
    }
    
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
    const product = await Product.findById(id);
    
    if (!product) return res.status(404).json({ message: 'Không tìm thấy bill' });

    // Tăng views của product
    const updated = await Product.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true, select: 'views adminId' },
    );

    // Track views theo ngày (theo timezone Việt Nam)
    const dateStr = getVietnamDate();

    // Tăng views cho admin của product
    await ViewStat.findOneAndUpdate(
      { date: dateStr, adminId: product.adminId },
      { $inc: { views: 1 } },
      { upsert: true, new: true },
    );

    // Tăng views cho system-wide (adminId = null)
    await ViewStat.findOneAndUpdate(
      { date: dateStr, adminId: null },
      { $inc: { views: 1 } },
      { upsert: true, new: true },
    );

    res.json({ views: updated.views });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

