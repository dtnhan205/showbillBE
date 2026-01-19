const mongoose = require('mongoose');

const adminReportSchema = new mongoose.Schema(
  {
    targetAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    reporterName: { type: String, required: true, trim: true, maxlength: 100 },
    reporterZalo: { type: String, required: true, trim: true, maxlength: 20 },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'resolved'], default: 'pending', index: true },
    reporterHash: { type: String, required: true, index: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
);

adminReportSchema.index({ targetAdminId: 1, reporterHash: 1, createdAt: -1 });
adminReportSchema.index({ targetAdminId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('AdminReport', adminReportSchema);


