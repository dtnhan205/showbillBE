// middleware/uploadMiddleware.js

const multer = require('multer');
const path = require('path');

// Cấu hình multer để lưu tạm file vào memory (không lưu ra disk)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // Giới hạn 50MB mỗi file
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh (jpeg, jpg, png, gif, webp)!'));
    }
  },
});

// Upload 1 file với field name là "image" (cho update)
const uploadSingle = upload.single('image');

// Upload nhiều file với field name là "images" (cho bulk upload)
const uploadMultiple = upload.array('images', 20); // Tối đa 20 file

module.exports = uploadSingle;
module.exports.uploadSingle = uploadSingle;
module.exports.uploadMultiple = uploadMultiple;