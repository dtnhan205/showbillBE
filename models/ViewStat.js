const mongoose = require('mongoose');

const viewStatSchema = new mongoose.Schema(
  {
    // Ngày (YYYY-MM-DD format)
    date: { type: String, required: true, unique: true },
    // Admin ID (null nếu là system-wide)
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    // Số lượt xem trong ngày
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Index để query nhanh
viewStatSchema.index({ date: 1, adminId: 1 });

module.exports = mongoose.model('ViewStat', viewStatSchema);

