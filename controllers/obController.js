const ObVersion = require('../models/ObVersion');
const Product = require('../models/Product');

// Public: list OB versions
exports.getObVersions = async (req, res) => {
  try {
    const { includeInactive, adminId, page = 1, limit = 50 } = req.query;
    if (!adminId) {
      return res.json([]);
    }

    const filter = { adminId: String(adminId).trim() };
    if (String(includeInactive).toLowerCase() !== 'true') filter.isActive = true;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (pageNum - 1) * limitNum;

    const obs = await ObVersion.find(filter)
      .select('name slug isActive adminId createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json(obs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: get my OB versions (only for current admin, or all for super admin)
exports.getMyObVersions = async (req, res) => {
  try {
    const { includeInactive, page = 1, limit = 100 } = req.query;
    const filter = { adminId: req.admin?._id };

    if (String(includeInactive).toLowerCase() !== 'true') filter.isActive = true;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const skip = (pageNum - 1) * limitNum;

    const obs = await ObVersion.find(filter)
      .select('name slug isActive adminId createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json(obs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: create OB version
exports.createObVersion = async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ message: 'name và slug là bắt buộc' });
    }

    const item = await ObVersion.create({
      name: String(name).trim(),
      slug: String(slug).trim().toLowerCase(),
      adminId: req.admin._id, // Lưu admin tạo OB
    });

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: update OB version
exports.updateObVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, isActive } = req.body;

    const item = await ObVersion.findById(id);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy OB version' });

    // Chỉ owner hoặc super admin mới được sửa
    const isOwner = String(item.adminId) === String(req.admin._id);
    const isSuper = req.admin.role === 'super';
    if (!isOwner && !isSuper) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa OB này' });
    }

    const update = {};
    if (typeof name !== 'undefined') update.name = String(name).trim();
    if (typeof slug !== 'undefined') update.slug = String(slug).trim().toLowerCase();
    if (typeof isActive !== 'undefined') {
      update.isActive = isActive;
      // Nếu tắt OB thì ẩn tất cả sản phẩm liên quan
      if (isActive === false) {
        await Product.updateMany(
          { obVersion: item.slug, adminId: item.adminId },
          { $set: { isHidden: true } },
        );
      } else if (isActive === true) {
        // Nếu bật lại OB thì bật lại các sản phẩm liên quan
        await Product.updateMany(
          { obVersion: item.slug, adminId: item.adminId },
          { $set: { isHidden: false } },
        );
      }
    }

    const updated = await ObVersion.findByIdAndUpdate(id, update, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: delete OB version
exports.deleteObVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await ObVersion.findById(id);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy OB version' });

    // Chỉ owner hoặc super admin mới được xóa
    const isOwner = String(item.adminId) === String(req.admin._id);
    const isSuper = req.admin.role === 'super';
    if (!isOwner && !isSuper) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa OB này' });
    }

    await ObVersion.findByIdAndDelete(id);
    // Ẩn tất cả sản phẩm liên quan khi xóa OB
    await Product.updateMany(
      { obVersion: item.slug, adminId: item.adminId },
      { $set: { isHidden: true } },
    );
    res.json({ message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

