const mongoose = require('mongoose');

const obVersionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // hiển thị: OB51
    slug: { type: String, required: true, trim: true, lowercase: true }, // lưu: ob51, cho phép trùng
    isActive: { type: Boolean, default: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true }, // Admin tạo OB này
  },
  { timestamps: true },
);

// Index hỗ trợ tìm kiếm (không unique để cho phép trùng slug)
// Dùng cho các query find({ slug }) và find({ adminId, slug })
obVersionSchema.index({ slug: 1 }, { background: true });
obVersionSchema.index({ adminId: 1, slug: 1 }, { background: true });

module.exports = mongoose.model('ObVersion', obVersionSchema);

