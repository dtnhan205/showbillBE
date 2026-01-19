const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // hiển thị: Migul
    slug: { type: String, required: true, trim: true, lowercase: true }, // lưu: migul, cho phép trùng
    isActive: { type: Boolean, default: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true }, // Admin tạo category này
  },
  { timestamps: true },
);

// Index hỗ trợ tìm kiếm theo slug và theo (adminId, slug)
categorySchema.index({ slug: 1 }, { background: true });
categorySchema.index({ adminId: 1, slug: 1 }, { background: true });

module.exports = mongoose.model('Category', categorySchema);

