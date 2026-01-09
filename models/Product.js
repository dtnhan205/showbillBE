const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    imageBase64: { type: String, required: true },

    // Owner admin
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },

    // Free Fire management fields
    obVersion: { type: String, default: 'ob51', trim: true, lowercase: true },
    category: { type: String, default: 'other', trim: true, lowercase: true },

    isHidden: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Product', productSchema);
