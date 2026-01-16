const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },

    // Role: super (admin cha) hoặc admin (admin con)
    role: { type: String, enum: ['super', 'admin'], default: 'admin' },

    // Trạng thái tài khoản (cho phép super admin tạm khóa)
    isActive: { type: Boolean, default: true },

    // Public profile fields
    displayName: { type: String, trim: true },
    bio: { type: String, default: '', trim: true },
    avatarBase64: { type: String, default: '' },
    bannerBase64: { type: String, default: '' },
    avatarFrame: { type: String, default: '', trim: true }, // Path to frame image (e.g., 'basic/basic1.gif')

    // Tổng lượt xem profile (client vào trang admin 1 lần = +1, không phụ thuộc số bill)
    profileViews: { type: Number, default: 0 },

    // Package subscription
    package: {
      type: String,
      default: 'basic',
      lowercase: true,
      trim: true,
    },
    packageExpiry: {
      type: Date,
      // null = basic (vĩnh viễn), có date = pro/premium (hết hạn về basic)
    },
    // Gói đang được sử dụng (có thể chọn từ ownedPackages)
    activePackage: {
      type: String,
      default: 'basic',
      lowercase: true,
      trim: true,
    },
    // Danh sách các gói đã mua (với expiry date)
    ownedPackages: [
      {
        packageType: {
          type: String,
          required: true,
          lowercase: true,
          trim: true,
        },
        expiryDate: {
          type: Date,
          required: true,
        },
        purchasedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

adminSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

adminSchema.pre('save', function () {
  if (this.isNew && !this.displayName) {
    this.displayName = this.username;
  }
});

adminSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);
