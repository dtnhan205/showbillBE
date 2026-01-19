// middleware/uploadMiddleware.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Tạo thư mục uploads nếu chưa có
const uploadsDir = path.join(__dirname, '..', 'uploads');
const productsDir = path.join(uploadsDir, 'products');
const avatarsDir = path.join(uploadsDir, 'avatars');
const bannersDir = path.join(uploadsDir, 'banners');

[uploadsDir, productsDir, avatarsDir, bannersDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Cấu hình multer để lưu file vào disk
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, productsDir);
  },
  filename: (req, file, cb) => {
    // Tên file: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});

const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, bannersDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `banner-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh (jpeg, jpg, png, gif, webp)!'));
  }
};

// Upload products (bills)
const productUpload = multer({
  storage: productStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter,
});

// Upload avatar
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

// Upload banner
const bannerUpload = multer({
  storage: bannerStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
});

// Upload 1 file product với field name là "image"
const uploadSingle = productUpload.single('image');

// Upload nhiều file products với field name là "images"
const uploadMultiple = productUpload.array('images', 20); // Tối đa 20 file

// Upload avatar và banner cùng lúc
const uploadAvatarAndBanner = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'avatar') {
        cb(null, avatarsDir);
      } else if (file.fieldname === 'banner') {
        cb(null, bannersDir);
      } else {
        cb(new Error('Invalid field name'));
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const prefix = file.fieldname === 'avatar' ? 'avatar' : 'banner';
      cb(null, `${prefix}-${uniqueSuffix}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
}).fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]);

module.exports = uploadSingle;
module.exports.uploadSingle = uploadSingle;
module.exports.uploadMultiple = uploadMultiple;
module.exports.avatarUpload = avatarUpload.single('avatar');
module.exports.bannerUpload = bannerUpload.single('banner');
module.exports.uploadAvatarAndBanner = uploadAvatarAndBanner;