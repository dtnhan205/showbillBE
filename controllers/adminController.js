const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Product = require('../models/Product');
const ViewStat = require('../models/ViewStat');
const AdminReport = require('../models/AdminReport');
const fs = require('fs');
const path = require('path');

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

// Helper function: Tạo Date object từ ngày Việt Nam và set về 0h theo timezone Việt Nam
function getVietnamDateStart(dateStr) {
  // dateStr format: YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  // Tạo date theo timezone Việt Nam (UTC+7)
  const date = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+07:00`);
  return date;
}

// Helper function: Lấy ngày hiện tại theo timezone Việt Nam và set về 0h
function getVietnamTodayStart() {
  const today = new Date();
  const dateStr = getVietnamDate(today);
  return getVietnamDateStart(dateStr);
}

// GET /api/admin/users (super admin - list all admins)
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({})
      .select('username email role displayName bio avatarBase64 bannerBase64 isActive package packageExpiry activePackage ownedPackages createdAt updatedAt')
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
    const admin = await Admin.findById(req.admin._id)
      .select('-password')
      .lean(); // Dùng lean() để trả về plain object
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Helper: Xác định gói tối thiểu cần thiết cho một khung
function getRequiredPackageForFrame(framePath) {
  if (!framePath) return null;
  
  // Extract package từ frame path (e.g., 'basic/basic1.gif' -> 'basic')
  const framePackage = framePath.split('/')[0].toLowerCase();
  
  // Basic không cần nâng cấp (đã có sẵn)
  if (framePackage === 'basic') {
    return null;
  }
  
  // Trả về tên gói với chữ cái đầu viết hoa
  return framePackage.charAt(0).toUpperCase() + framePackage.slice(1);
}

// Helper: Validate frame theo gói
function validateFrameForPackage(framePath, activePackage) {
  if (!framePath) return true; // Cho phép xóa frame (empty string)
  
  // Extract package từ frame path (e.g., 'basic/basic1.gif' -> 'basic')
  const framePackage = framePath.split('/')[0].toLowerCase();
  const userPackage = (activePackage || 'basic').toLowerCase();
  
  // Logic theo yêu cầu:
  // - Basic: chỉ mở basic, đóng tất cả trả phí
  // - Pro: mở basic + pro, đóng premium + vip
  // - Premium: mở tất cả (basic + pro + premium + vip)
  // - VIP: mở basic + vip, đóng pro + premium
  
  if (userPackage === 'basic') {
    // Basic: chỉ mở basic
    return framePackage === 'basic';
  } else if (userPackage === 'pro') {
    // Pro: mở basic + pro, đóng premium + vip
    return framePackage === 'basic' || framePackage === 'pro';
  } else if (userPackage === 'premium') {
    // Premium: mở tất cả
    return true;
  } else if (userPackage === 'vip') {
    // VIP: mở basic + vip, đóng pro + premium
    return framePackage === 'basic' || framePackage === 'vip';
  } else {
    // Gói tùy chỉnh: chỉ mở frames của chính gói đó
    return framePackage === userPackage;
  }
}

// Helper: Kiểm tra và xóa avatarFrame nếu không phù hợp với gói mới
// Export để các controller khác có thể dùng
exports.validateAndCleanAvatarFrame = function(admin, newPackage) {
  if (!admin || !admin.avatarFrame) {
    return; // Không có frame, không cần xóa
  }
  
  const framePath = String(admin.avatarFrame).trim();
  if (!framePath) {
    return; // Frame đã rỗng, không cần xóa
  }
  
  // Kiểm tra xem frame có phù hợp với gói mới không
  if (!validateFrameForPackage(framePath, newPackage)) {
    // Frame không phù hợp, xóa nó
    admin.avatarFrame = '';
    console.log(`[validateAndCleanAvatarFrame] Đã xóa avatarFrame "${framePath}" vì không phù hợp với gói "${newPackage}"`);
  }
};

// PUT /api/admin/profile (admin update profile)
exports.updateMyProfile = async (req, res) => {
  try {
    const adminId = req.admin._id;
    const { displayName, bio, avatarFrame } = req.body;

    // Lấy admin hiện tại để kiểm tra activePackage và xóa file cũ
    const currentAdmin = await Admin.findById(adminId);
    if (!currentAdmin) {
      return res.status(404).json({ message: 'Không tìm thấy admin.' });
    }

    const update = {};
    if (typeof displayName !== 'undefined') update.displayName = String(displayName).trim();
    if (typeof bio !== 'undefined') update.bio = String(bio);
    
    // Xử lý avatar upload (file) - multer fields trả về object với keys là field names
    if (req.files && req.files.avatar && req.files.avatar.length > 0) {
      // Xóa file avatar cũ nếu có
      if (currentAdmin.avatarUrl && currentAdmin.avatarUrl.startsWith('/uploads/avatars/')) {
        const oldFilePath = path.join(__dirname, '..', currentAdmin.avatarUrl);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      update.avatarUrl = `/uploads/avatars/${req.files.avatar[0].filename}`;
    }
    
    // Xử lý banner upload (file)
    if (req.files && req.files.banner && req.files.banner.length > 0) {
      // Xóa file banner cũ nếu có
      if (currentAdmin.bannerUrl && currentAdmin.bannerUrl.startsWith('/uploads/banners/')) {
        const oldFilePath = path.join(__dirname, '..', currentAdmin.bannerUrl);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      update.bannerUrl = `/uploads/banners/${req.files.banner[0].filename}`;
    }
    
    // Backward compatibility: vẫn hỗ trợ base64 nếu frontend gửi (sẽ migrate sau)
    if (typeof req.body.avatarBase64 !== 'undefined') update.avatarBase64 = String(req.body.avatarBase64);
    if (typeof req.body.bannerBase64 !== 'undefined') update.bannerBase64 = String(req.body.bannerBase64);
    
    // Xử lý avatarFrame
    if (typeof avatarFrame !== 'undefined') {
      const trimmedFrame = String(avatarFrame).trim();
      
      // Nếu có giá trị (không phải empty string), validate theo gói
      if (trimmedFrame) {
        const activePackage = currentAdmin.activePackage || 'basic';
        if (!validateFrameForPackage(trimmedFrame, activePackage)) {
          // Xác định gói cần thiết cho khung này
          const requiredPackage = getRequiredPackageForFrame(trimmedFrame);
          const errorMessage = requiredPackage 
            ? `Vui lòng nâng cấp gói ${requiredPackage} để sử dụng khung này.`
            : 'Vui lòng nâng cấp gói để sử dụng khung này.';
          return res.status(400).json({ 
            message: errorMessage
          });
        }
        
        // Validate format: phải có dạng 'package/filename.gif'
        if (!trimmedFrame.includes('/') || !trimmedFrame.endsWith('.gif')) {
          return res.status(400).json({ 
            message: 'Đường dẫn khung không hợp lệ. Định dạng: package/filename.gif' 
          });
        }
      }
      
      // Lưu avatarFrame (có thể là empty string để xóa frame)
      update.avatarFrame = trimmedFrame;
    }

    const admin = await Admin.findByIdAndUpdate(adminId, update, { new: true })
      .select('-password')
      .lean(); // Dùng lean() để trả về plain object
    
    // Log để debug
    console.log('[updateMyProfile] Updated avatarFrame:', admin?.avatarFrame);
    
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/stats (admin thường: stats của mình)
exports.getMyStats = async (req, res) => {
  try {
    const adminId = req.admin._id;
    const period = req.query.period || 'month';
    const weekParam = req.query.week;
    const monthParam = req.query.month;
    const yearParam = req.query.year;
    
    // Tính ngày bắt đầu và kết thúc dựa trên period (giống chart)
    let startDate = new Date();
    let endDate = new Date();
    const currentYear = new Date().getFullYear();
    
    if (period === 'week') {
      if (weekParam) {
        const parts = weekParam.split(' - ');
        if (parts.length === 2) {
          const part1 = parts[0].trim().split('/');
          const part2 = parts[1].trim().split('/');
          
          if (part1.length === 3 && part2.length === 3) {
            const [day1, month1, year1] = part1.map(Number);
            const [day2, month2, year2] = part2.map(Number);
            startDate = new Date(`${year1}-${String(month1).padStart(2, '0')}-${String(day1).padStart(2, '0')}T00:00:00+07:00`);
            endDate = new Date(`${year2}-${String(month2).padStart(2, '0')}-${String(day2).padStart(2, '0')}T23:59:59+07:00`);
          } else {
            const [day1, month1] = part1.map(Number);
            const [day2, month2] = part2.map(Number);
            const year1 = parseInt(month1) === 12 ? currentYear - 1 : currentYear;
            const year2 = parseInt(month2) === 1 && parseInt(month1) === 12 ? currentYear : currentYear;
            startDate = new Date(`${year1}-${String(month1).padStart(2, '0')}-${String(day1).padStart(2, '0')}T00:00:00+07:00`);
            endDate = new Date(`${year2}-${String(month2).padStart(2, '0')}-${String(day2).padStart(2, '0')}T23:59:59+07:00`);
          }
        }
      } else {
        const today = getVietnamTodayStart();
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(today);
        startDate.setDate(today.getDate() - daysToMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      }
    } else if (period === 'month') {
      if (monthParam) {
        const monthMatch = monthParam.match(/Tháng (\d+)/);
        if (monthMatch) {
          const monthNum = parseInt(monthMatch[1]);
          const year = yearParam ? parseInt(yearParam) : currentYear;
          startDate = new Date(`${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00+07:00`);
          const lastDayOfMonth = new Date(year, monthNum, 0);
          endDate = new Date(`${year}-${String(monthNum).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}T23:59:59+07:00`);
        }
      } else {
        const today = getVietnamTodayStart();
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate = new Date(today.getFullYear(), today.getMonth(), lastDay.getDate());
        endDate.setHours(23, 59, 59, 999);
      }
    } else if (period === 'year') {
      const year = yearParam ? parseInt(yearParam) : currentYear;
      startDate = new Date(`${year}-01-01T00:00:00+07:00`);
      endDate = new Date(`${year}-12-31T23:59:59+07:00`);
    }

    // Tổng bill trong khoảng thời gian
    const totalBills = await Product.countDocuments({ 
      adminId,
      createdAt: { $gte: startDate, $lte: endDate }
    });
    const totalVisibleBills = await Product.countDocuments({ 
      adminId, 
      isHidden: false,
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    // Tổng lượt xem từ ViewStat trong khoảng thời gian (dùng date field)
    const startDateStr = getVietnamDate(startDate);
    const endDateStr = getVietnamDate(endDate);
    const viewsStats = await ViewStat.find({
      adminId: new mongoose.Types.ObjectId(adminId),
      date: { $gte: startDateStr, $lte: endDateStr }
    });
    const totalViews = viewsStats.reduce((sum, stat) => sum + (stat.views || 0), 0);

    res.json({ totalBills, totalVisibleBills, totalViews });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/system-stats (super admin)
exports.getSystemStats = async (req, res) => {
  try {
    const period = req.query.period || 'month';
    const weekParam = req.query.week;
    const monthParam = req.query.month;
    const yearParam = req.query.year;
    
    // Tính ngày bắt đầu và kết thúc dựa trên period (giống chart)
    let startDate = new Date();
    let endDate = new Date();
    const currentYear = new Date().getFullYear();
    
    if (period === 'week') {
      if (weekParam) {
        const parts = weekParam.split(' - ');
        if (parts.length === 2) {
          const part1 = parts[0].trim().split('/');
          const part2 = parts[1].trim().split('/');
          
          if (part1.length === 3 && part2.length === 3) {
            const [day1, month1, year1] = part1.map(Number);
            const [day2, month2, year2] = part2.map(Number);
            startDate = new Date(`${year1}-${String(month1).padStart(2, '0')}-${String(day1).padStart(2, '0')}T00:00:00+07:00`);
            endDate = new Date(`${year2}-${String(month2).padStart(2, '0')}-${String(day2).padStart(2, '0')}T23:59:59+07:00`);
          } else {
            const [day1, month1] = part1.map(Number);
            const [day2, month2] = part2.map(Number);
            const year1 = parseInt(month1) === 12 ? currentYear - 1 : currentYear;
            const year2 = parseInt(month2) === 1 && parseInt(month1) === 12 ? currentYear : currentYear;
            startDate = new Date(`${year1}-${String(month1).padStart(2, '0')}-${String(day1).padStart(2, '0')}T00:00:00+07:00`);
            endDate = new Date(`${year2}-${String(month2).padStart(2, '0')}-${String(day2).padStart(2, '0')}T23:59:59+07:00`);
          }
        }
      } else {
        const today = getVietnamTodayStart();
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(today);
        startDate.setDate(today.getDate() - daysToMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      }
    } else if (period === 'month') {
      if (monthParam) {
        const monthMatch = monthParam.match(/Tháng (\d+)/);
        if (monthMatch) {
          const monthNum = parseInt(monthMatch[1]);
          const year = yearParam ? parseInt(yearParam) : currentYear;
          startDate = new Date(`${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00+07:00`);
          const lastDayOfMonth = new Date(year, monthNum, 0);
          endDate = new Date(`${year}-${String(monthNum).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}T23:59:59+07:00`);
        }
      } else {
        const today = getVietnamTodayStart();
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate = new Date(today.getFullYear(), today.getMonth(), lastDay.getDate());
        endDate.setHours(23, 59, 59, 999);
      }
    } else if (period === 'year') {
      const year = yearParam ? parseInt(yearParam) : currentYear;
      startDate = new Date(`${year}-01-01T00:00:00+07:00`);
      endDate = new Date(`${year}-12-31T23:59:59+07:00`);
    }

    // Tổng admin (không filter theo thời gian)
    const totalAdmins = await Admin.countDocuments({});
    
    // Tổng bill trong khoảng thời gian
    const totalBills = await Product.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    // Tổng lượt xem từ ViewStat trong khoảng thời gian
    // Tính tổng từ tất cả ViewStat của tất cả admin (không chỉ system-wide)
    const startDateStr = getVietnamDate(startDate);
    const endDateStr = getVietnamDate(endDate);
    const viewsStats = await ViewStat.find({
      date: { $gte: startDateStr, $lte: endDateStr }
    });
    let totalViews = viewsStats.reduce((sum, stat) => sum + (stat.views || 0), 0);
    
    // Nếu ViewStat không có dữ liệu, fallback: tính từ products được tạo trong khoảng thời gian
    if (totalViews === 0) {
      const productsInPeriod = await Product.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).select('views');
      totalViews = productsInPeriod.reduce((sum, p) => sum + (p.views || 0), 0);
    }

    res.json({ totalAdmins, totalBills, totalViews });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/chart-data (admin thường: chart data của mình)
exports.getMyChartData = async (req, res) => {
  try {
    const adminId = req.admin._id;
    const period = req.query.period || 'month'; // week, month, year
    const weekParam = req.query.week;
    const monthParam = req.query.month;
    const yearParam = req.query.year;
    
    // Tính ngày bắt đầu và số ngày dựa trên period
    let startDate = new Date();
    let actualDays = 30;
    let groupByMonth = false;
    
    if (period === 'week') {
      if (weekParam) {
        // Parse week string: "29/12/2024 - 04/01/2025" or "29/12 - 04/01"
        const parts = weekParam.split(' - ');
        if (parts.length === 2) {
          const part1 = parts[0].trim().split('/');
          const part2 = parts[1].trim().split('/');
          const currentYear = new Date().getFullYear();
          
          if (part1.length === 3 && part2.length === 3) {
            // Has year: "DD/MM/YYYY - DD/MM/YYYY"
            const [day1, month1, year1] = part1.map(Number);
            startDate = new Date(`${year1}-${String(month1).padStart(2, '0')}-${String(day1).padStart(2, '0')}T00:00:00+07:00`);
          } else {
            // No year: "DD/MM - DD/MM" - determine year
            const [day1, month1] = part1.map(Number);
            const year1 = parseInt(month1) === 12 ? currentYear - 1 : currentYear;
            startDate = new Date(`${year1}-${String(month1).padStart(2, '0')}-${String(day1).padStart(2, '0')}T00:00:00+07:00`);
          }
        }
      } else {
        // Bắt đầu từ thứ 2 của tuần hiện tại
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Chủ nhật, 1 = Thứ 2, ...
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(today);
        startDate.setDate(today.getDate() - daysToMonday);
      }
      startDate.setHours(0, 0, 0, 0);
      actualDays = 7; // Thứ 2 đến Chủ nhật (7 ngày)
    } else if (period === 'month') {
      if (monthParam) {
        // Parse month string: "Tháng 1"
        const monthMatch = monthParam.match(/Tháng (\d+)/);
        if (monthMatch) {
          const monthNum = parseInt(monthMatch[1]); // 1-based
          const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
          // Tạo date theo timezone Việt Nam
          startDate = new Date(`${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00+07:00`);
          const lastDayOfMonth = new Date(year, monthNum, 0); // Tháng tiếp theo, ngày 0 = ngày cuối tháng trước
          actualDays = lastDayOfMonth.getDate();
        }
      } else {
        // Bắt đầu từ ngày 1 của tháng hiện tại (theo timezone Việt Nam)
        const today = getVietnamTodayStart();
        startDate = new Date(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01T00:00:00+07:00`);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        actualDays = lastDayOfMonth.getDate();
      }
    } else if (period === 'year') {
      const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
      // Bắt đầu từ tháng 1 của năm được chọn, group theo tháng
      startDate = new Date(year, 0, 1); // Tháng 0 = tháng 1
      startDate.setHours(0, 0, 0, 0);
      actualDays = 12; // 12 tháng
      groupByMonth = true;
    }

    // Lấy dữ liệu bill theo ngày
    const billsData = await Product.aggregate([
      {
        $match: {
          adminId: new mongoose.Types.ObjectId(adminId),
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Lấy tổng lượt xem của tất cả products (views thực sự)
    const viewsAgg = await Product.aggregate([
      {
        $match: {
          adminId: new mongoose.Types.ObjectId(adminId),
        },
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$views' },
        },
      },
    ]);
    const totalViews = viewsAgg?.[0]?.totalViews ?? 0;

    // Lấy views theo ngày từ ViewStat (views mới mỗi ngày, không tích lũy)
    // Convert startDate sang timezone Việt Nam để query
    const startDateStr = getVietnamDate(startDate);
    const viewsStats = await ViewStat.find({
      adminId: new mongoose.Types.ObjectId(adminId),
      date: {
        $gte: startDateStr,
      },
    }).sort({ date: 1 });

    // Nếu ViewStat chưa có dữ liệu, tính từ products (fallback)
    let viewsMap = new Map(viewsStats.map((item) => [item.date, item.views]));
    
    if (viewsStats.length === 0) {
      // Fallback: Tính views từ products (phân bổ đều cho các ngày)
      const allProducts = await Product.find({
        adminId: new mongoose.Types.ObjectId(adminId),
      }).select('views createdAt');
      
      // Tính tổng views và phân bổ cho các ngày có products
      const productsByDate = new Map();
      for (const product of allProducts) {
        const productDate = new Date(product.createdAt);
        const dateStr = getVietnamDate(productDate);
        const productDateStart = getVietnamDateStart(dateStr);
        
        if (productDateStart >= startDate) {
          if (!productsByDate.has(dateStr)) {
            productsByDate.set(dateStr, []);
          }
          productsByDate.get(dateStr).push(product);
        }
      }
      
      // Tính views mỗi ngày (views hiện tại của products được tạo trong ngày đó)
      for (const [dateStr, products] of productsByDate.entries()) {
        const dayViews = products.reduce((sum, p) => sum + (p.views || 0), 0);
        viewsMap.set(dateStr, dayViews);
      }
    }

    // Tạo mảng đầy đủ các ngày/tháng với views
    const chartData = [];
    
    if (groupByMonth) {
      // Group theo tháng cho period year
      const billsByMonth = new Map();
      for (const item of billsData) {
        const monthKey = item._id.substring(0, 7); // YYYY-MM
        billsByMonth.set(monthKey, (billsByMonth.get(monthKey) || 0) + item.count);
      }
      
      const viewsByMonth = new Map();
      for (const [dateStr, views] of viewsMap.entries()) {
        const monthKey = dateStr.substring(0, 7); // YYYY-MM
        viewsByMonth.set(monthKey, (viewsByMonth.get(monthKey) || 0) + views);
      }
      
      // Tạo data cho 12 tháng
      for (let month = 0; month < 12; month++) {
        const date = new Date(startDate.getFullYear(), month, 1);
        const monthKey = getVietnamDate(date).substring(0, 7); // YYYY-MM
        chartData.push({
          date: monthKey,
          bills: billsByMonth.get(monthKey) || 0,
          views: viewsByMonth.get(monthKey) || 0,
        });
      }
    } else {
      // Group theo ngày cho period week và month
      const billsMap = new Map(billsData.map((item) => [item._id, item.count]));

      for (let i = 0; i < actualDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = getVietnamDate(date);
        
        chartData.push({
          date: dateStr,
          bills: billsMap.get(dateStr) || 0,
          views: viewsMap.get(dateStr) || 0, // Views mới trong ngày này
        });
      }
    }

    res.json({
      viewsTotal: totalViews,
      viewsData: chartData,
      billsData: chartData,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/system-chart-data (super admin: chart data hệ thống)
exports.getSystemChartData = async (req, res) => {
  try {
    const period = req.query.period || 'month'; // week, month, year
    const weekParam = req.query.week;
    const monthParam = req.query.month;
    const yearParam = req.query.year;
    
    // Tính ngày bắt đầu và số ngày dựa trên period
    let startDate = new Date();
    let actualDays = 30;
    let groupByMonth = false;
    
    if (period === 'week') {
      if (weekParam) {
        // Parse week string: "29/12/2024 - 04/01/2025" or "29/12 - 04/01"
        const parts = weekParam.split(' - ');
        if (parts.length === 2) {
          const part1 = parts[0].trim().split('/');
          const part2 = parts[1].trim().split('/');
          const currentYear = new Date().getFullYear();
          
          if (part1.length === 3 && part2.length === 3) {
            // Has year: "DD/MM/YYYY - DD/MM/YYYY"
            const [day1, month1, year1] = part1.map(Number);
            startDate = new Date(`${year1}-${String(month1).padStart(2, '0')}-${String(day1).padStart(2, '0')}T00:00:00+07:00`);
          } else {
            // No year: "DD/MM - DD/MM" - determine year
            const [day1, month1] = part1.map(Number);
            const year1 = parseInt(month1) === 12 ? currentYear - 1 : currentYear;
            startDate = new Date(`${year1}-${String(month1).padStart(2, '0')}-${String(day1).padStart(2, '0')}T00:00:00+07:00`);
          }
        }
      } else {
        // Bắt đầu từ thứ 2 của tuần hiện tại (theo timezone Việt Nam)
        const today = getVietnamTodayStart();
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(today);
        startDate.setDate(today.getDate() - daysToMonday);
      }
      actualDays = 7; // Thứ 2 đến Chủ nhật (7 ngày)
    } else if (period === 'month') {
      if (monthParam) {
        // Parse month string: "Tháng 1"
        const monthMatch = monthParam.match(/Tháng (\d+)/);
        if (monthMatch) {
          const monthNum = parseInt(monthMatch[1]); // 1-based
          const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
          // Tạo date theo timezone Việt Nam
          startDate = new Date(`${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00+07:00`);
          const lastDayOfMonth = new Date(year, monthNum, 0);
          actualDays = lastDayOfMonth.getDate();
        }
      } else {
        // Bắt đầu từ ngày 1 của tháng hiện tại (theo timezone Việt Nam)
        const today = getVietnamTodayStart();
        startDate = new Date(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01T00:00:00+07:00`);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        actualDays = lastDayOfMonth.getDate();
      }
    } else if (period === 'year') {
      const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
      // Bắt đầu từ tháng 1 của năm được chọn, group theo tháng (theo timezone Việt Nam)
      startDate = new Date(`${year}-01-01T00:00:00+07:00`);
      actualDays = 12; // 12 tháng
      groupByMonth = true;
    }

    // Lấy dữ liệu bill theo ngày (tất cả admin)
    const billsData = await Product.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Lấy views theo ngày từ ViewStat (views mới mỗi ngày, không tích lũy) - system-wide
    // Convert startDate sang timezone Việt Nam để query
    const startDateStr = getVietnamDate(startDate);
    const viewsStats = await ViewStat.find({
      adminId: null, // System-wide
      date: {
        $gte: startDateStr,
      },
    }).sort({ date: 1 });

    // Nếu ViewStat chưa có dữ liệu, tính từ products (fallback)
    let viewsMap = new Map(viewsStats.map((item) => [item.date, item.views]));
    
    if (viewsStats.length === 0) {
      // Fallback: Tính views từ products (phân bổ đều cho các ngày)
      const allProducts = await Product.find({}).select('views createdAt');
      
      // Tính tổng views và phân bổ cho các ngày có products
      const productsByDate = new Map();
      for (const product of allProducts) {
        const productDate = new Date(product.createdAt);
        const dateStr = getVietnamDate(productDate);
        const productDateStart = getVietnamDateStart(dateStr);
        
        if (productDateStart >= startDate) {
          if (!productsByDate.has(dateStr)) {
            productsByDate.set(dateStr, []);
          }
          productsByDate.get(dateStr).push(product);
        }
      }
      
      // Tính views mỗi ngày (views hiện tại của products được tạo trong ngày đó)
      for (const [dateStr, products] of productsByDate.entries()) {
        const dayViews = products.reduce((sum, p) => sum + (p.views || 0), 0);
        viewsMap.set(dateStr, dayViews);
      }
    }

    // Lấy dữ liệu admin đăng ký theo ngày
    const adminsData = await Admin.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Tổng lượt xem hệ thống (tổng views của tất cả products)
    const totalViewsAgg = await Product.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$views' } } },
    ]);
    const totalViews = totalViewsAgg?.[0]?.totalViews ?? 0;

    // Tạo mảng đầy đủ các ngày/tháng với views
    const chartData = [];
    
    if (groupByMonth) {
      // Group theo tháng cho period year
      const billsByMonth = new Map();
      for (const item of billsData) {
        const monthKey = item._id.substring(0, 7); // YYYY-MM
        billsByMonth.set(monthKey, (billsByMonth.get(monthKey) || 0) + item.count);
      }
      
      const viewsByMonth = new Map();
      for (const [dateStr, views] of viewsMap.entries()) {
        const monthKey = dateStr.substring(0, 7); // YYYY-MM
        viewsByMonth.set(monthKey, (viewsByMonth.get(monthKey) || 0) + views);
      }
      
      const adminsByMonth = new Map();
      for (const item of adminsData) {
        const monthKey = item._id.substring(0, 7); // YYYY-MM
        adminsByMonth.set(monthKey, (adminsByMonth.get(monthKey) || 0) + item.count);
      }
      
      // Tạo data cho 12 tháng
      for (let month = 0; month < 12; month++) {
        const date = new Date(startDate.getFullYear(), month, 1);
        const monthKey = getVietnamDate(date).substring(0, 7); // YYYY-MM
        chartData.push({
          date: monthKey,
          bills: billsByMonth.get(monthKey) || 0,
          views: viewsByMonth.get(monthKey) || 0,
          admins: adminsByMonth.get(monthKey) || 0,
        });
      }
    } else {
      // Group theo ngày cho period week và month
      const billsMap = new Map(billsData.map((item) => [item._id, item.count]));
      const adminsMap = new Map(adminsData.map((item) => [item._id, item.count]));

      for (let i = 0; i < actualDays; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = getVietnamDate(date);
        
        chartData.push({
          date: dateStr,
          bills: billsMap.get(dateStr) || 0,
          views: viewsMap.get(dateStr) || 0, // Views mới trong ngày này
          admins: adminsMap.get(dateStr) || 0,
        });
      }
    }

    res.json({
      viewsTotal: totalViews,
      viewsData: chartData,
      billsData: chartData,
      adminsData: chartData.map((item) => ({
        date: item.date,
        count: item.admins,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/reports (super admin)
exports.getAdminReports = async (req, res) => {
  try {
    const reportsAgg = await AdminReport.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$targetAdminId',
          count: { $sum: 1 },
          pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          resolvedCount: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          lastReason: { $first: '$reason' },
          lastReporterName: { $first: '$reporterName' },
          lastReporterZalo: { $first: '$reporterZalo' },
          lastStatus: { $first: '$status' },
          lastAt: { $first: '$createdAt' },
        },
      },
      { $sort: { pendingCount: -1, lastAt: -1 } },
    ]);

    const adminIds = reportsAgg.map((r) => r._id).filter(Boolean);
    const admins = await Admin.find({ _id: { $in: adminIds } })
      .select('displayName username email role isActive isPublicHidden reportCount createdAt');
    const adminMap = new Map(admins.map((a) => [String(a._id), a]));

    const result = reportsAgg
      .map((r) => {
        const admin = adminMap.get(String(r._id));
        if (!admin) return null;
        return {
          adminId: admin._id,
          displayName: admin.displayName || admin.username,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          isActive: admin.isActive,
          isPublicHidden: admin.isPublicHidden,
          reportCount: admin.reportCount ?? 0,
          totalReports: r.count,
          pendingReports: r.pendingCount,
          resolvedReports: r.resolvedCount,
          lastReason: r.lastReason,
          lastReporterName: r.lastReporterName,
          lastReporterZalo: r.lastReporterZalo,
          lastStatus: r.lastStatus,
          lastAt: r.lastAt,
          createdAt: admin.createdAt,
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/admin/reports/:id/toggle-hide (super admin)
exports.toggleAdminPublicHidden = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await Admin.findById(id).select('-password');
    if (!admin) return res.status(404).json({ message: 'Không tìm thấy admin' });
    if (admin.role === 'super') return res.status(400).json({ message: 'Không thể ẩn super admin' });

    admin.isPublicHidden = !admin.isPublicHidden;
    await admin.save();

    res.json({
      message: admin.isPublicHidden ? 'Đã ẩn admin khỏi public.' : 'Đã hiển thị lại admin.',
      admin,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/reports/:id/details (super admin) - Lấy chi tiết tất cả reports của một admin
exports.getAdminReportDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query; // Optional filter: 'pending' or 'resolved'
    const admin = await Admin.findById(id).select('displayName username email role');
    if (!admin) return res.status(404).json({ message: 'Không tìm thấy admin' });

    const query = { targetAdminId: id };
    if (status === 'pending' || status === 'resolved') {
      query.status = status;
    }

    const reports = await AdminReport.find(query)
      .sort({ createdAt: -1 })
      .select('reporterName reporterZalo reason status ip userAgent createdAt resolvedAt resolvedBy')
      .populate('resolvedBy', 'username displayName')
      .lean();

    const pendingCount = await AdminReport.countDocuments({ targetAdminId: id, status: 'pending' });
    const resolvedCount = await AdminReport.countDocuments({ targetAdminId: id, status: 'resolved' });

    res.json({
      admin: {
        _id: admin._id,
        displayName: admin.displayName || admin.username,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
      reports: reports.map((r) => ({
        _id: r._id,
        reporterName: r.reporterName,
        reporterZalo: r.reporterZalo,
        reason: r.reason,
        status: r.status,
        ip: r.ip,
        userAgent: r.userAgent,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        resolvedBy: r.resolvedBy ? {
          _id: r.resolvedBy._id,
          username: r.resolvedBy.username,
          displayName: r.resolvedBy.displayName || r.resolvedBy.username,
        } : null,
      })),
      total: reports.length,
      pendingCount,
      resolvedCount,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/admin/reports/:reportId/status (super admin) - Cập nhật trạng thái report
exports.updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Status phải là "pending" hoặc "resolved"' });
    }

    const report = await AdminReport.findById(reportId);
    if (!report) return res.status(404).json({ message: 'Không tìm thấy report' });

    // Không cho phép chuyển từ resolved về pending (chỉ cho phép một chiều)
    if (report.status === 'resolved' && status === 'pending') {
      return res.status(400).json({ message: 'Không thể chuyển report đã xử lý về trạng thái chờ xử lý' });
    }

    // Chỉ cho phép chuyển từ pending sang resolved
    if (report.status === 'pending' && status === 'resolved') {
      report.status = 'resolved';
      report.resolvedAt = new Date();
      report.resolvedBy = req.admin._id;
    } else if (report.status === 'resolved' && status === 'resolved') {
      // Đã resolved rồi, không làm gì cả
      return res.status(400).json({ message: 'Report này đã được xử lý rồi' });
    }

    await report.save();

    res.json({
      message: `Đã đánh dấu report là đã xử lý.`,
      report: {
        _id: report._id,
        status: report.status,
        resolvedAt: report.resolvedAt,
        resolvedBy: report.resolvedBy,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/admin/reports/:id/reset (super admin) - Reset report count và xóa tất cả reports
exports.resetAdminReports = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await Admin.findById(id).select('role reportCount isPublicHidden');
    if (!admin) return res.status(404).json({ message: 'Không tìm thấy admin' });
    if (admin.role === 'super') return res.status(400).json({ message: 'Không thể reset reports của super admin' });

    // Xóa tất cả reports của admin này
    const deleteResult = await AdminReport.deleteMany({ targetAdminId: id });

    // Reset report count và hiển thị lại admin
    admin.reportCount = 0;
    admin.isPublicHidden = false;
    await admin.save();

    res.json({
      message: `Đã xóa ${deleteResult.deletedCount} báo cáo và reset report count của admin.`,
      deletedCount: deleteResult.deletedCount,
      admin: {
        _id: admin._id,
        reportCount: admin.reportCount,
        isPublicHidden: admin.isPublicHidden,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};