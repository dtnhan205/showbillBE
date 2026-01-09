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

    const update = {};
    if (typeof name !== 'undefined') update.name = String(name).trim();
    if (typeof slug !== 'undefined') update.slug = String(slug).trim().toLowerCase();
    if (typeof isActive !== 'undefined') update.isActive = isActive;

    const item = await Category.findByIdAndUpdate(id, update, { new: true });
    if (!item) return res.status(404).json({ message: 'Không tìm thấy category' });

    res.json(item);
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
    const item = await Category.findByIdAndDelete(id);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy category' });
    res.json({ message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

