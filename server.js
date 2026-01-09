const app = require('./app');
const connectDB = require('./config/db');
const Admin = require('./models/Admin');
const Product = require('./models/Product');

const PORT = process.env.PORT || 5000;

const bootstrapMigration = async () => {
  // Migration: assign adminId for old products
  // Requirement: assign to "admin đầu tiên/1 admin mặc định".
  // Since you want manual super-admin (1B), we pick the first admin with role=super,
  // otherwise fallback to the oldest admin.

  const superAdmin = await Admin.findOne({ role: 'super' }).sort({ createdAt: 1 });
  const fallbackAdmin = await Admin.findOne({}).sort({ createdAt: 1 });
  const targetAdmin = superAdmin || fallbackAdmin;

  if (!targetAdmin) {
    console.log('[bootstrap] No admin exists yet. Skip product migration.');
    return;
  }

  const result = await Product.updateMany(
    { adminId: { $exists: false } },
    { $set: { adminId: targetAdmin._id } },
  );

  if (result?.modifiedCount) {
    console.log(`[bootstrap] Migrated products without adminId: ${result.modifiedCount}`);
  }
};

connectDB()
  .then(async () => {
    try {
      await bootstrapMigration();
    } catch (e) {
      console.error('[bootstrap] Migration error:', e);
    }

    app.listen(PORT, () => {
      console.log(`Server đang chạy trên port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('DB connection failed:', err);
    process.exit(1);
  });
