const mongoose = require('mongoose');

const packageConfigSchema = new mongoose.Schema(
  {
    packageType: {
      type: String,
      enum: ['basic', 'pro', 'premium'],
      required: true,
      unique: true,
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
  },
  { timestamps: true },
);

module.exports = mongoose.model('PackageConfig', packageConfigSchema);

