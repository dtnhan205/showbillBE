const mongoose = require('mongoose');

const obVersionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // hiển thị: OB51
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true }, // lưu: ob51
    isActive: { type: Boolean, default: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true }, // Admin tạo OB này
  },
  { timestamps: true },
);

module.exports = mongoose.model('ObVersion', obVersionSchema);

