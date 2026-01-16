const mongoose = require('mongoose');

const packageConfigSchema = new mongoose.Schema(
  {
    packageType: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    billLimit: {
      type: Number,
      required: true,
      // basic: 20, pro: 100, premium: -1 (unlimited)
    },
    color: {
      type: String,
      default: '#3b82f6', // Màu mặc định (xanh dương)
      trim: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PackageConfig', packageConfigSchema);

