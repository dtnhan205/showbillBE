const PackageConfig = require('../models/PackageConfig');
const BankAccount = require('../models/BankAccount');

// GET /api/admin/packages/config - Super admin: Lấy cấu hình giá gói
exports.getPackageConfigs = async (req, res) => {
  try {
    if (req.admin.role !== 'super') {
      return res.status(403).json({ message: 'Chỉ super admin mới có quyền truy cập.' });
    }

    const configs = await PackageConfig.find({}).sort({ packageType: 1 });
    
    // Nếu chưa có config, tạo mặc định
    if (configs.length === 0) {
      const defaultConfigs = [
        { packageType: 'basic', price: 0, billLimit: 20, color: '#94a3b8' }, // Xám cho Basic
        { packageType: 'pro', price: 50000, billLimit: 100, color: '#3b82f6' }, // Xanh dương cho Pro
        { packageType: 'premium', price: 100000, billLimit: -1, color: '#f59e0b' }, // Cam cho Premium
      ];
      await PackageConfig.insertMany(defaultConfigs);
      const newConfigs = await PackageConfig.find({}).sort({ packageType: 1 });
      return res.json(newConfigs);
    }

    res.json(configs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/admin/packages/config/:type - Super admin: Cập nhật giá gói
exports.updatePackageConfig = async (req, res) => {
  try {
    if (req.admin.role !== 'super') {
      return res.status(403).json({ message: 'Chỉ super admin mới có quyền truy cập.' });
    }

    const { type } = req.params;
    const { price, billLimit, descriptions } = req.body;

    if (type === 'basic' && price !== 0) {
      return res.status(400).json({ message: 'Gói basic phải có giá 0.' });
    }

    const updateData = { price };
    if (billLimit !== undefined) {
      updateData.billLimit = billLimit;
    }
    if (descriptions !== undefined) {
      updateData.descriptions = Array.isArray(descriptions) ? descriptions : [];
    }

    const config = await PackageConfig.findOneAndUpdate(
      { packageType: type },
      updateData,
      { new: true, upsert: true }
    );

    res.json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/bank-accounts - Super admin: Lấy danh sách tài khoản ngân hàng
exports.getBankAccounts = async (req, res) => {
  try {
    if (req.admin.role !== 'super') {
      return res.status(403).json({ message: 'Chỉ super admin mới có quyền truy cập.' });
    }

    const accounts = await BankAccount.find({}).sort({ createdAt: -1 });
    res.json(accounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/admin/bank-accounts - Super admin: Thêm tài khoản ngân hàng
exports.createBankAccount = async (req, res) => {
  try {
    if (req.admin.role !== 'super') {
      return res.status(403).json({ message: 'Chỉ super admin mới có quyền truy cập.' });
    }

    const { bankName, accountNumber, accountHolder, apiUrl } = req.body;

    if (!bankName || !accountNumber || !accountHolder) {
      return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin.' });
    }

    const account = new BankAccount({
      bankName,
      accountNumber,
      accountHolder,
      apiUrl: apiUrl || '',
    });

    await account.save();
    res.status(201).json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/admin/bank-accounts/:id - Super admin: Cập nhật tài khoản ngân hàng
exports.updateBankAccount = async (req, res) => {
  try {
    if (req.admin.role !== 'super') {
      return res.status(403).json({ message: 'Chỉ super admin mới có quyền truy cập.' });
    }

    const { id } = req.params;
    const { bankName, accountNumber, accountHolder, apiUrl, isActive } = req.body;

    const update = {};
    if (bankName) update.bankName = bankName;
    if (accountNumber) update.accountNumber = accountNumber;
    if (accountHolder) update.accountHolder = accountHolder;
    if (apiUrl !== undefined) update.apiUrl = apiUrl;
    if (typeof isActive !== 'undefined') update.isActive = isActive;

    const account = await BankAccount.findByIdAndUpdate(id, update, { new: true });

    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản ngân hàng.' });
    }

    res.json(account);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/admin/bank-accounts/:id - Super admin: Xóa tài khoản ngân hàng
exports.deleteBankAccount = async (req, res) => {
  try {
    if (req.admin.role !== 'super') {
      return res.status(403).json({ message: 'Chỉ super admin mới có quyền truy cập.' });
    }

    const { id } = req.params;
    const account = await BankAccount.findByIdAndDelete(id);

    if (!account) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản ngân hàng.' });
    }

    res.json({ message: 'Đã xóa tài khoản ngân hàng.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Helper: Random màu đẹp cho gói mới
function generateRandomColor() {
  // Màu sắc đẹp, không quá sáng hoặc quá tối
  const colors = [
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#f59e0b', // Amber
    '#10b981', // Green
    '#ef4444', // Red
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#a855f7', // Violet
    '#eab308', // Yellow
  ];
  
  // Random một màu từ danh sách
  return colors[Math.floor(Math.random() * colors.length)];
}

// POST /api/admin/packages/config - Super admin: Tạo gói mới
exports.createPackageConfig = async (req, res) => {
  try {
    if (req.admin.role !== 'super') {
      return res.status(403).json({ message: 'Chỉ super admin mới có quyền truy cập.' });
    }

    const { packageType, price, billLimit, descriptions } = req.body;

    if (!packageType) {
      return res.status(400).json({ message: 'Vui lòng nhập loại gói.' });
    }

    // Kiểm tra gói đã tồn tại chưa
    const existing = await PackageConfig.findOne({ packageType });
    if (existing) {
      return res.status(400).json({ message: `Gói ${packageType} đã tồn tại.` });
    }

    // Validate
    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ message: 'Giá không hợp lệ.' });
    }

    if (typeof billLimit !== 'number' || (billLimit < -1 && billLimit !== -1)) {
      return res.status(400).json({ message: 'Giới hạn bill không hợp lệ. (-1 = không giới hạn)' });
    }

    // Validate descriptions
    if (descriptions !== undefined && !Array.isArray(descriptions)) {
      return res.status(400).json({ message: 'Descriptions phải là một mảng.' });
    }

    // Xác định màu cho gói
    let packageColor;
    if (packageType === 'pro') {
      packageColor = '#3b82f6'; // Xanh dương cho Pro
    } else if (packageType === 'premium') {
      packageColor = '#f59e0b'; // Cam cho Premium
    } else {
      // Random màu cho gói mới
      packageColor = generateRandomColor();
    }

    const config = new PackageConfig({
      packageType,
      price,
      billLimit: billLimit || (packageType === 'basic' ? 20 : packageType === 'pro' ? 100 : -1),
      color: packageColor,
      descriptions: descriptions || [],
    });

    await config.save();
    res.status(201).json(config);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/admin/packages/config/:type - Super admin: Xóa gói
exports.deletePackageConfig = async (req, res) => {
  try {
    if (req.admin.role !== 'super') {
      return res.status(403).json({ message: 'Chỉ super admin mới có quyền truy cập.' });
    }

    const { type } = req.params;

    // Không cho phép xóa gói basic
    if (type === 'basic') {
      return res.status(400).json({ message: 'Không thể xóa gói Basic.' });
    }

    const config = await PackageConfig.findOneAndDelete({ packageType: type });

    if (!config) {
      return res.status(404).json({ message: 'Không tìm thấy gói.' });
    }

    res.json({ message: 'Đã xóa gói thành công.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

