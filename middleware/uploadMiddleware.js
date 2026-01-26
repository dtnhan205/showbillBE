// middleware/uploadMiddleware.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Magic bytes để kiểm tra file type thực sự
const imageMagicBytes = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
};

// Helper function: Sanitize filename
const sanitizeFilename = (filename) => {
  // Loại bỏ các ký tự nguy hiểm
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.\./g, '_')
    .substring(0, 255); // Giới hạn độ dài
};

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
    // Tên file: timestamp-random-sanitized extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    // Chỉ giữ lại extension hợp lệ
    const safeExt = ['.jpeg', '.jpg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `product-${uniqueSuffix}${safeExt}`);
  },
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpeg', '.jpg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `avatar-${uniqueSuffix}${safeExt}`);
  },
});

const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, bannersDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpeg', '.jpg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `banner-${uniqueSuffix}${safeExt}`);
  },
});

// Enhanced file filter với validation tốt hơn
const fileFilter = (req, file, cb) => {
  // Kiểm tra extension
  const allowedExtensions = ['.jpeg', '.jpg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  const hasValidExtension = allowedExtensions.includes(ext);

  // Kiểm tra MIME type
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const hasValidMimeType = allowedMimeTypes.includes(file.mimetype.toLowerCase());

  // Kiểm tra filename không chứa ký tự nguy hiểm
  const sanitized = sanitizeFilename(file.originalname);
  const isFilenameSafe = sanitized === file.originalname || sanitized.length > 0;

  if (!hasValidExtension) {
    return cb(new Error(`Định dạng file không được hỗ trợ. Chỉ chấp nhận: ${allowedExtensions.join(', ')}`));
  }

  if (!hasValidMimeType) {
    return cb(new Error(`MIME type không hợp lệ: ${file.mimetype}`));
  }

  if (!isFilenameSafe) {
    return cb(new Error('Tên file chứa ký tự không hợp lệ'));
  }

  // Kiểm tra file size (sẽ được kiểm tra lại bởi multer limits)
  if (file.size && file.size > 50 * 1024 * 1024) {
    return cb(new Error('File quá lớn. Tối đa 50MB'));
  }

  cb(null, true);
};

// Middleware để validate file sau khi upload (kiểm tra magic bytes)
const validateImageFile = (req, res, next) => {
  // Kiểm tra single file
  if (req.file) {
    const filePath = req.file.path;
    try {
      const buffer = fs.readFileSync(filePath);
      const isValid = validateMagicBytes(buffer, req.file.mimetype);
      
      if (!isValid) {
        // Xóa file không hợp lệ
        fs.unlinkSync(filePath);
        return res.status(400).json({ 
          message: 'File không phải là ảnh hợp lệ. Vui lòng kiểm tra lại file.' 
        });
      }
    } catch (err) {
      console.error('[validateImageFile] Error reading file:', err);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(500).json({ message: 'Lỗi khi xử lý file' });
    }
  }

  // Kiểm tra multiple files
  if (req.files && Array.isArray(req.files)) {
    for (const file of req.files) {
      const filePath = file.path;
      try {
        const buffer = fs.readFileSync(filePath);
        const isValid = validateMagicBytes(buffer, file.mimetype);
        
        if (!isValid) {
          // Xóa file không hợp lệ
          fs.unlinkSync(filePath);
          return res.status(400).json({ 
            message: `File "${file.originalname}" không phải là ảnh hợp lệ.` 
          });
        }
      } catch (err) {
        console.error('[validateImageFile] Error reading file:', err);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return res.status(500).json({ message: 'Lỗi khi xử lý file' });
      }
    }
  }

  // Kiểm tra fields (avatar, banner)
  if (req.files && typeof req.files === 'object') {
    for (const fieldName in req.files) {
      const files = req.files[fieldName];
      if (Array.isArray(files)) {
        for (const file of files) {
          const filePath = file.path;
          try {
            const buffer = fs.readFileSync(filePath);
            const isValid = validateMagicBytes(buffer, file.mimetype);
            
            if (!isValid) {
              fs.unlinkSync(filePath);
              return res.status(400).json({ 
                message: `File "${file.originalname}" không phải là ảnh hợp lệ.` 
              });
            }
          } catch (err) {
            console.error('[validateImageFile] Error reading file:', err);
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            return res.status(500).json({ message: 'Lỗi khi xử lý file' });
          }
        }
      }
    }
  }

  next();
};

// Helper: Validate magic bytes
const validateMagicBytes = (buffer, mimetype) => {
  if (!buffer || buffer.length < 4) return false;

  const bytes = Array.from(buffer.slice(0, 12));
  const expectedBytes = imageMagicBytes[mimetype.toLowerCase()];

  if (!expectedBytes) return false;

  // Kiểm tra magic bytes
  for (let i = 0; i < expectedBytes.length; i++) {
    if (bytes[i] !== expectedBytes[i]) {
      // Đặc biệt cho WebP: kiểm tra RIFF header và WEBP signature
      if (mimetype.toLowerCase() === 'image/webp') {
        const hasRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
        const hasWebp = bytes.slice(8, 12).every((b, i) => {
          const webpSig = [0x57, 0x45, 0x42, 0x50];
          return b === webpSig[i];
        });
        return hasRiff && hasWebp;
      }
      return false;
    }
  }

  return true;
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
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ['.jpeg', '.jpg', '.png', '.gif', '.webp'].includes(ext) ? ext : '.jpg';
      const prefix = file.fieldname === 'avatar' ? 'avatar' : 'banner';
      cb(null, `${prefix}-${uniqueSuffix}${safeExt}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter,
}).fields([{ name: 'avatar', maxCount: 1 }, { name: 'banner', maxCount: 1 }]);

// Wrapper để thêm validation sau upload
const wrapUpload = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err) {
        // Xử lý lỗi từ multer
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File quá lớn. Vui lòng chọn file nhỏ hơn.' });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ message: 'Quá nhiều file. Vui lòng giảm số lượng file.' });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ message: 'Field name không hợp lệ.' });
          }
          return res.status(400).json({ message: `Lỗi upload: ${err.message}` });
        }
        return res.status(400).json({ message: err.message || 'Lỗi khi upload file' });
      }
      // Validate file sau khi upload thành công
      validateImageFile(req, res, next);
    });
  };
};

module.exports = wrapUpload(uploadSingle);
module.exports.uploadSingle = wrapUpload(uploadSingle);
module.exports.uploadMultiple = wrapUpload(uploadMultiple);
module.exports.avatarUpload = wrapUpload(avatarUpload.single('avatar'));
module.exports.bannerUpload = wrapUpload(bannerUpload.single('banner'));
module.exports.uploadAvatarAndBanner = wrapUpload(uploadAvatarAndBanner);
module.exports.validateImageFile = validateImageFile;