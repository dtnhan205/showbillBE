const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true }, // URL path: /uploads/products/filename.jpg
    // Giữ imageBase64 để backward compatibility (sẽ migrate sau)
    imageBase64: { type: String, default: '' },

    // Owner admin
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },

    // Free Fire management fields
    obVersion: { type: String, default: 'ob51', trim: true, lowercase: true },
    category: { type: String, default: 'other', trim: true, lowercase: true },

    isHidden: { type: Boolean, default: false },
    reportCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Indexes to optimize common queries:
// - Sort by createdAt (for getAllProducts, getProducts)
productSchema.index({ createdAt: -1 }, { background: true });

// - Filter by adminId + createdAt (my products)
productSchema.index({ adminId: 1, createdAt: -1 }, { background: true });

// - Filter by isHidden + createdAt (public products)
productSchema.index({ isHidden: 1, createdAt: -1 }, { background: true });

// - Filter by obVersion + createdAt (filter by OB)
productSchema.index({ obVersion: 1, createdAt: -1 }, { background: true });

// - Filter by category + createdAt (filter by category)
productSchema.index({ category: 1, createdAt: -1 }, { background: true });

// - Filter by adminId + obVersion + createdAt
productSchema.index({ adminId: 1, obVersion: 1, createdAt: -1 }, { background: true });

// - Filter by adminId + category + createdAt
productSchema.index({ adminId: 1, category: 1, createdAt: -1 }, { background: true });

// - Filter by isHidden + obVersion + createdAt (public + OB filter)
productSchema.index({ isHidden: 1, obVersion: 1, createdAt: -1 }, { background: true });

// - Filter by isHidden + category + createdAt (public + category filter)
productSchema.index({ isHidden: 1, category: 1, createdAt: -1 }, { background: true });

// - Filter by adminId + isHidden + createdAt (quan trọng cho getPublicAdminDetail)
productSchema.index({ adminId: 1, isHidden: 1, createdAt: -1 }, { background: true });

module.exports = mongoose.model('Product', productSchema);
