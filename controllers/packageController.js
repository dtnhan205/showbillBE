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
        { packageType: 'basic', price: 0, billLimit: 20 },
        { packageType: 'pro', price: 50000, billLimit: 100 },
        { packageType: 'premium', price: 100000, billLimit: -1 }, // -1 = unlimited
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
    const { price, billLimit } = req.body;

    if (!['basic', 'pro', 'premium'].includes(type)) {
      return res.status(400).json({ message: 'Loại gói không hợp lệ.' });
    }

    if (type === 'basic' && price !== 0) {
      return res.status(400).json({ message: 'Gói basic phải có giá 0.' });
    }

    const config = await PackageConfig.findOneAndUpdate(
      { packageType: type },
      { price, billLimit },
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

