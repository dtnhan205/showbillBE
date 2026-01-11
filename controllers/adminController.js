const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Product = require('../models/Product');
const ViewStat = require('../models/ViewStat');

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
    // Tổng lượt xem = tổng views của tất cả products (giống với chart)
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
    // Tổng lượt xem hệ thống = tổng views của tất cả products (giống với chart)
    const totalViewsAgg = await Product.aggregate([
      { $group: { _id: null, totalViews: { $sum: '$views' } } },
    ]);
    const totalViews = totalViewsAgg?.[0]?.totalViews ?? 0;

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
        // Parse week string: "29/12 - 04/01"
        const parts = weekParam.split(' - ');
        if (parts.length === 2) {
          const [day1, month1] = parts[0].split('/');
          const [day2, month2] = parts[1].split('/');
          const currentYear = new Date().getFullYear();
          // Determine year for each date
          const year1 = parseInt(month1) === 12 ? currentYear - 1 : currentYear;
          const year2 = parseInt(month2) === 1 && parseInt(month1) === 12 ? currentYear : currentYear;
          startDate = new Date(year1, parseInt(month1) - 1, parseInt(day1));
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
        // Parse week string: "29/12 - 04/01"
        const parts = weekParam.split(' - ');
        if (parts.length === 2) {
          const [day1, month1] = parts[0].split('/');
          const [day2, month2] = parts[1].split('/');
          const currentYear = new Date().getFullYear();
          // Determine year for each date
          const year1 = parseInt(month1) === 12 ? currentYear - 1 : currentYear;
          const year2 = parseInt(month2) === 1 && parseInt(month1) === 12 ? currentYear : currentYear;
          // Tạo date theo timezone Việt Nam
          startDate = new Date(`${year1}-${String(parseInt(month1)).padStart(2, '0')}-${String(parseInt(day1)).padStart(2, '0')}T00:00:00+07:00`);
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