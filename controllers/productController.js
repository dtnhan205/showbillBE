const Product = require('../models/Product');
const fs = require('fs');
const path = require('path');

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
    const { adminId, obVersion, category, search, includeHidden, page = 1, limit = 60 } = req.query;

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

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 60, 1), 200);
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(filter)
      .select('name imageUrl imageBase64 obVersion category views isHidden adminId createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

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
    const { page = 1, limit = 200 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find({ adminId })
      .select('name imageUrl imageBase64 obVersion category views isHidden adminId createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
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
    
    const { page = 1, limit = 200 } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find({})
      .select('name imageUrl imageBase64 obVersion category views isHidden adminId createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
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

    // Lưu file và lấy URL path
    const imageUrl = `/uploads/products/${req.file.filename}`;

    const obSlug = (obVersion ? String(obVersion) : 'ob51').trim().toLowerCase();
    const catSlug = (category ? String(category) : 'other').trim().toLowerCase();

    const product = await Product.create({
      name,
      imageUrl,
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

// ADMIN: create multiple products (bulk upload) - upload nhiều bill cùng lúc
// Note: checkUploadLimit middleware sẽ được áp dụng ở route level
exports.createMultipleProducts = async (req, res) => {
  try {
    const { names, obVersions, categories, obVersion, category } = req.body;
    const files = req.files || [];

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'Vui lòng upload ít nhất một ảnh bill' });
    }

    // Parse names nếu là string (JSON)
    let nameArray = [];
    if (typeof names === 'string') {
      try {
        nameArray = JSON.parse(names);
      } catch {
        nameArray = names.split(',').map((n) => n.trim());
      }
    } else if (Array.isArray(names)) {
      nameArray = names;
    } else {
      nameArray = [names || ''];
    }

    // Parse obVersions và categories nếu là string (JSON)
    let obVersionsArray = [];
    if (obVersions) {
      if (typeof obVersions === 'string') {
        try {
          obVersionsArray = JSON.parse(obVersions);
        } catch {
          obVersionsArray = obVersions.split(',').map((ob) => ob.trim());
        }
      } else if (Array.isArray(obVersions)) {
        obVersionsArray = obVersions;
      }
    }

    let categoriesArray = [];
    if (categories) {
      if (typeof categories === 'string') {
        try {
          categoriesArray = JSON.parse(categories);
        } catch {
          categoriesArray = categories.split(',').map((cat) => cat.trim());
        }
      } else if (Array.isArray(categories)) {
        categoriesArray = categories;
      }
    }

    // Fallback: nếu không có arrays, dùng single values (backward compatibility)
    const defaultOb = (obVersion ? String(obVersion) : 'ob51').trim().toLowerCase();
    const defaultCat = (category ? String(category) : 'other').trim().toLowerCase();

    // Tạo products cho mỗi file
    const products = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = nameArray[i] || `Bill ${i + 1}`;
      
      // Lưu file và lấy URL path
      const imageUrl = `/uploads/products/${file.filename}`;

      // Sử dụng OB và Category riêng cho từng bill, fallback về default nếu không có
      const obSlug = (obVersionsArray[i] ? String(obVersionsArray[i]) : defaultOb).trim().toLowerCase();
      const catSlug = (categoriesArray[i] ? String(categoriesArray[i]) : defaultCat).trim().toLowerCase();

      const product = await Product.create({
        name: name.trim(),
        imageUrl,
        obVersion: obSlug,
        category: catSlug,
        adminId: req.admin._id,
        views: 0,
      });

      products.push(product);
    }

    res.status(201).json({
      message: `Đã upload thành công ${products.length} bill`,
      products,
      count: products.length,
    });
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
      // Xóa file cũ nếu có
      if (product.imageUrl && product.imageUrl.startsWith('/uploads/products/')) {
        const oldFilePath = path.join(__dirname, '..', product.imageUrl);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      
      // Lưu file mới và cập nhật URL
      product.imageUrl = `/uploads/products/${req.file.filename}`;
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

    // Xóa file ảnh nếu có
    if (product.imageUrl && product.imageUrl.startsWith('/uploads/products/')) {
      const filePath = path.join(__dirname, '..', product.imageUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
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
