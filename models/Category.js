const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // hiển thị: Migul
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true }, // lưu: migul
    isActive: { type: Boolean, default: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true }, // Admin tạo category này
  },
  { timestamps: true },
);

module.exports = mongoose.model('Category', categorySchema);

