const Category = require('../models/Category');

// Public: list categories
exports.getCategories = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const filter = {};
    if (String(includeInactive).toLowerCase() !== 'true') filter.isActive = true;

    const categories = await Category.find(filter).sort({ createdAt: -1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: get my categories (only for current admin, or all for super admin)
exports.getMyCategories = async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const filter = {};
    
    // Super admin có thể xem tất cả, admin thường chỉ xem của mình
    if (req.admin?.role !== 'super') {
      filter.adminId = req.admin?._id;
    }
    
    if (String(includeInactive).toLowerCase() !== 'true') filter.isActive = true;

    const categories = await Category.find(filter).sort({ createdAt: -1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: create category
exports.createCategory = async (req, res) => {
  try {
    const { name, slug } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ message: 'name và slug là bắt buộc' });
    }

    const item = await Category.create({
      name: String(name).trim(),
      slug: String(slug).trim().toLowerCase(),
      adminId: req.admin._id, // Lưu admin tạo category
    });

    res.status(201).json(item);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'slug đã tồn tại' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Admin: update category
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, isActive } = req.body;

    const item = await Category.findById(id);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy category' });

    // Chỉ owner hoặc super admin mới được sửa
    const isOwner = String(item.adminId) === String(req.admin._id);
    const isSuper = req.admin.role === 'super';
    if (!isOwner && !isSuper) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa category này' });
    }

    const update = {};
    if (typeof name !== 'undefined') update.name = String(name).trim();
    if (typeof slug !== 'undefined') update.slug = String(slug).trim().toLowerCase();
    if (typeof isActive !== 'undefined') update.isActive = isActive;

    const updated = await Category.findByIdAndUpdate(id, update, { new: true });
    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'slug đã tồn tại' });
    }
    res.status(500).json({ message: err.message });
  }
};

// Admin: delete category
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Category.findById(id);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy category' });

    // Chỉ owner hoặc super admin mới được xóa
    const isOwner = String(item.adminId) === String(req.admin._id);
    const isSuper = req.admin.role === 'super';
    if (!isOwner && !isSuper) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa category này' });
    }

    await Category.findByIdAndDelete(id);
    res.json({ message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

