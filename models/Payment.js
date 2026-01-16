const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    packageType: {
      type: String,
      enum: ['pro', 'premium'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    transferContent: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    bankAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BankAccount',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'expired'],
      default: 'pending',
    },
    completedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
      // Tự động hết hạn sau 24h nếu chưa thanh toán
      default: function() {
        const date = new Date();
        date.setHours(date.getHours() + 24);
        return date;
      },
    },
  },
  { timestamps: true },
);

// Index để tìm payment pending dễ dàng
paymentSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('Payment', paymentSchema);

