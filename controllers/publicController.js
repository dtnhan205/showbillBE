const Admin = require('../models/Admin');
const Product = require('../models/Product');
const ViewStat = require('../models/ViewStat');
const PackageConfig = require('../models/PackageConfig');
const AdminReport = require('../models/AdminReport');
const crypto = require('crypto');

// Cache để lưu mapping giữa short ID và full ObjectId (tránh query $expr chậm)
// Format: { 'shortId': 'fullObjectId' }
// TTL: 1 giờ (3600000ms)
const shortIdCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 giờ

// Helper: Lấy full ObjectId từ short ID (có cache)
async function getAdminIdFromShort(shortId) {
  // Check cache trước
  const cached = shortIdCache.get(shortId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.fullId;
  }

  // Query database (chậm nhưng chỉ chạy lần đầu hoặc khi cache hết hạn)
  // Tối ưu: chỉ query admins thường, không bị ẩn và giới hạn kết quả
  // Thêm filter role: 'admin' để giảm số lượng documents cần scan
  const matchingAdmins = await Admin.find({
    role: 'admin', // Chỉ query admin thường, không query super admin
    isPublicHidden: false,
    $expr: {
      $eq: [
        { $substr: [{ $toString: '$_id' }, 0, shortId.length] },
        shortId
      ]
    }
  })
  .select('_id')
  .limit(2)
  .lean();

  if (matchingAdmins.length === 0) {
    return null;
  }
  
  if (matchingAdmins.length > 1) {
    // Nhiều kết quả → không cache, yêu cầu full ID
    return 'MULTIPLE_MATCH';
  }

  const fullId = matchingAdmins[0]._id.toString();
  
  // Cache kết quả
  shortIdCache.set(shortId, {
    fullId,
    timestamp: Date.now()
  });

  // Cleanup cache cũ (mỗi 1000 requests)
  if (shortIdCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of shortIdCache.entries()) {
      if (now - value.timestamp >= CACHE_TTL) {
        shortIdCache.delete(key);
      }
    }
  }

  return fullId;
}

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
    // Index: { role: 1, isPublicHidden: 1, createdAt: -1 } sẽ được dùng
    const admins = await Admin.find({ role: 'admin', isPublicHidden: false })
      .select('displayName bio avatarUrl avatarBase64 bannerUrl bannerBase64 role createdAt profileViews avatarFrame')
      .sort({ createdAt: -1 })
      .lean(); // Dùng lean() để tăng tốc độ (không cần Mongoose document)

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
        avatarUrl: a.avatarUrl || '', // Chỉ trả về URL nếu có
        avatarBase64: a.avatarBase64 || '', // Trả về base64 riêng để frontend xử lý
        bannerUrl: a.bannerUrl || '', // Chỉ trả về URL nếu có
        bannerBase64: a.bannerBase64 || '', // Trả về base64 riêng để frontend xử lý
        avatarFrame: a.avatarFrame || '',
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
    let adminId = id;
    
    // If id is full length (24 chars), try findById first (nhanh nhất)
    if (id.length === 24) {
      admin = await Admin.findById(id).select('displayName bio avatarUrl avatarBase64 bannerUrl bannerBase64 role createdAt activePackage avatarFrame isPublicHidden');
    } else {
      // Short ID: Dùng cache để tránh query $expr chậm
      const fullId = await getAdminIdFromShort(id);
      
      if (!fullId) {
        return res.status(404).json({ message: 'Không tìm thấy admin' });
      }
      
      if (fullId === 'MULTIPLE_MATCH') {
        return res.status(400).json({ message: 'Có nhiều admin khớp với ID này. Vui lòng sử dụng ID đầy đủ.' });
      }
      
      // Query lại với full ID (nhanh vì dùng index _id)
      adminId = fullId;
      admin = await Admin.findById(fullId).select('displayName bio avatarUrl avatarBase64 bannerUrl bannerBase64 role createdAt activePackage avatarFrame isPublicHidden');
    }
    
    if (!admin) return res.status(404).json({ message: 'Không tìm thấy admin' });
    if (admin.isPublicHidden) return res.status(404).json({ message: 'Không tìm thấy admin' });

    const adminIdStr = admin._id.toString();
    // Only visible bills - với pagination và select để tối ưu
    const { page = 1, limit = 100 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 200);
    const skip = (pageNum - 1) * limitNum;
    
    const products = await Product.find({ adminId: adminIdStr, isHidden: false })
      .select('name imageUrl imageBase64 obVersion category views createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

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
        avatarUrl: admin.avatarUrl || admin.avatarBase64 || '', // Ưu tiên URL, fallback base64
        bannerUrl: admin.bannerUrl || admin.bannerBase64 || '', // Ưu tiên URL, fallback base64
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
    let adminId = id;
    
    // If id is full length (24 chars), try findByIdAndUpdate first (nhanh nhất)
    if (id.length === 24) {
      admin = await Admin.findByIdAndUpdate(
        id,
        { $inc: { profileViews: 1 } },
        { new: true, select: 'profileViews' },
      );
    } else {
      // Short ID: Dùng cache để tránh query $expr chậm
      const fullId = await getAdminIdFromShort(id);
      
      if (!fullId || fullId === 'MULTIPLE_MATCH') {
        return res.status(404).json({ message: 'Không tìm thấy admin' });
      }
      
      // Update với full ID (nhanh vì dùng index _id)
      adminId = fullId;
        admin = await Admin.findByIdAndUpdate(
        adminId,
          { $inc: { profileViews: 1 } },
          { new: true, select: 'profileViews' },
        );
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

// POST /api/public/admins/:id/report
exports.reportAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const reporterName = String(req.body?.reporterName || '').trim();
    const reporterZalo = String(req.body?.reporterZalo || '').trim();
    const reason = String(req.body?.reason || '').trim();

    // Validate required fields
    if (!reporterName || reporterName.length === 0) {
      return res.status(400).json({ message: 'Vui lòng nhập tên người báo cáo' });
    }
    if (reporterName.length < 2) {
      return res.status(400).json({ message: 'Tên phải có ít nhất 2 ký tự' });
    }
    if (reporterName.length > 100) {
      return res.status(400).json({ message: 'Tên không được quá 100 ký tự' });
    }
    
    if (!reporterZalo || reporterZalo.length === 0) {
      return res.status(400).json({ message: 'Vui lòng nhập số Zalo' });
    }
    
    // Loại bỏ các ký tự không phải số để kiểm tra
    const digitsOnly = String(reporterZalo).replace(/[\s+\-()]/g, '');
    
    // Kiểm tra format số điện thoại Việt Nam
    // Format 1: 0xxxxxxxxx (10 số, bắt đầu bằng 0)
    // Format 2: 84xxxxxxxxx (11 số, bắt đầu bằng 84)
    // Format 3: +84xxxxxxxxx (có dấu +)
    const vietnamPhonePattern = /^(0|\+84|84)[1-9]\d{8,9}$/;
    
    if (!vietnamPhonePattern.test(digitsOnly)) {
      return res.status(400).json({ message: 'Số Zalo không hợp lệ. Vui lòng nhập số điện thoại Việt Nam (ví dụ: 0912345678 hoặc +84912345678)' });
    }
    
    // Kiểm tra độ dài sau khi loại bỏ ký tự đặc biệt
    if (digitsOnly.length < 10 || digitsOnly.length > 11) {
      return res.status(400).json({ message: 'Số điện thoại phải có 10 hoặc 11 chữ số' });
    }
    
    if (!reason || reason.length === 0) {
      return res.status(400).json({ message: 'Vui lòng nhập lý do báo cáo' });
    }
    if (reason.length < 10) {
      return res.status(400).json({ message: 'Lý do báo cáo phải có ít nhất 10 ký tự' });
    }
    if (reason.length > 1000) {
      return res.status(400).json({ message: 'Lý do không được quá 1000 ký tự' });
    }

    const admin = await Admin.findById(id).select('role isPublicHidden reportCount');
    if (!admin || admin.role !== 'admin' || admin.isPublicHidden) {
      return res.status(404).json({ message: 'Không tìm thấy admin' });
    }

    const ip =
      (req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0] : '') ||
      req.ip ||
      '';
    const userAgent = String(req.headers['user-agent'] || '');

    const reporterHash = crypto
      .createHash('sha256')
      .update(`${ip}::${userAgent}`)
      .digest('hex')
      .slice(0, 32);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await AdminReport.findOne({ targetAdminId: admin._id, reporterHash, createdAt: { $gte: since } });
    if (existing) {
      return res.json({ message: 'Bạn đã báo cáo admin này rồi. Sẽ xử lý trong 24–72 giờ.' });
    }

    await AdminReport.create({
      targetAdminId: admin._id,
      reporterName: reporterName.slice(0, 100),
      reporterZalo: reporterZalo.slice(0, 20),
      reason: reason.slice(0, 1000),
      reporterHash,
      ip: String(ip).slice(0, 128),
      userAgent: String(userAgent).slice(0, 256),
    });

    const REPORT_THRESHOLD = Number(process.env.REPORT_THRESHOLD || 3);
    const nextCount = Number(admin.reportCount || 0) + 1;
    admin.reportCount = nextCount;
    if (nextCount >= REPORT_THRESHOLD) {
      admin.isPublicHidden = true;
    }
    await admin.save();

    return res.json({
      message: 'Đã nhận báo cáo. Hệ thống sẽ xử lý trong 24–72 giờ.',
      isPublicHidden: admin.isPublicHidden,
      reportCount: admin.reportCount,
      threshold: REPORT_THRESHOLD,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

