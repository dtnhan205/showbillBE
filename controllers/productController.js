const Product = require('../models/Product');

/**
 * PUBLIC: GET /api/products
 * Supports query:
 * - adminId=<adminId> (public filter by admin)
 * - obVersion=ob51
 * - category=migul
 * - search=keyword
 * - includeHidden=true (default false)
 */
exports.getProducts = async (req, res) => {
  try {
    const { adminId, obVersion, category, search, includeHidden } = req.query;

    const filter = {};

    // Default: public only visible bills
    if (String(includeHidden).toLowerCase() !== 'true') {
      filter.isHidden = false;
    }

    if (adminId) {
      filter.adminId = String(adminId).trim();
    }

    if (obVersion) {
      filter.obVersion = String(obVersion).trim().toLowerCase();
    }

    if (category) {
      filter.category = String(category).trim().toLowerCase();
    }

    if (search) {
      filter.name = { $regex: String(search).trim(), $options: 'i' };
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * ADMIN: GET /api/products/mine
 * Only bills uploaded by current admin
 */
exports.getMyProducts = async (req, res) => {
  try {
    const adminId = req.admin?._id;
    const products = await Product.find({ adminId }).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * SUPER ADMIN: GET /api/products/all
 * All bills from all admins (only for super admin)
 */
exports.getAllProducts = async (req, res) => {
  try {
    // Chỉ super admin mới được truy cập
    if (req.admin?.role !== 'super') {
      return res.status(403).json({ message: 'Chỉ super admin mới có quyền truy cập' });
    }
    
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: create product (bill) - only name + image + obVersion + category
// Note: checkUploadLimit middleware sẽ được áp dụng ở route level
exports.createProduct = async (req, res) => {
  try {
    const { name, obVersion, category } = req.body;

    if (!name) return res.status(400).json({ message: 'Vui lòng nhập tên bill' });
    if (!req.file) return res.status(400).json({ message: 'Vui lòng upload ảnh bill' });

    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const obSlug = (obVersion ? String(obVersion) : 'ob51').trim().toLowerCase();
    const catSlug = (category ? String(category) : 'other').trim().toLowerCase();

    const product = await Product.create({
      name,
      imageBase64: base64Image,
      obVersion: obSlug,
      category: catSlug,
      adminId: req.admin._id,
      views: 0,
    });

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: update product - only owner (or super)
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, isHidden, obVersion, category } = req.body;

  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy bill' });

    const isOwner = String(product.adminId) === String(req.admin._id);
    const isSuper = req.admin.role === 'super';
    if (!isOwner && !isSuper) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa bill này' });
    }

    if (name) product.name = name;
    if (typeof isHidden !== 'undefined') product.isHidden = isHidden;
    if (typeof obVersion !== 'undefined') product.obVersion = String(obVersion).trim().toLowerCase();
    if (typeof category !== 'undefined') product.category = String(category).trim().toLowerCase();

    if (req.file) {
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      product.imageBase64 = base64Image;
    }

    await product.save();
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: delete product - only owner (or super)
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy bill' });

    const isOwner = String(product.adminId) === String(req.admin._id);
    const isSuper = req.admin.role === 'super';
    if (!isOwner && !isSuper) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa bill này' });
    }

    await Product.findByIdAndDelete(id);
    res.json({ message: 'Xóa bill thành công' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADMIN: toggle hidden - only owner (or super)
exports.toggleHidden = async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy bill' });

    const isOwner = String(product.adminId) === String(req.admin._id);
    const isSuper = req.admin.role === 'super';
    if (!isOwner && !isSuper) {
      return res.status(403).json({ message: 'Bạn không có quyền cập nhật bill này' });
    }

    product.isHidden = !product.isHidden;
    await product.save();
    res.json({ message: 'Cập nhật trạng thái thành công', product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
