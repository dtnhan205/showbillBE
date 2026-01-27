const app = require('./app');
const connectDB = require('./config/db');
const Admin = require('./models/Admin');
const Product = require('./models/Product');
const { checkAndUpdatePayments } = require('./services/bankTransactionService');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen trên tất cả interfaces để có thể truy cập từ bên ngoài

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

    app.listen(PORT, HOST, () => {
      console.log(`Server đang chạy trên ${HOST}:${PORT}`);
      console.log('[Cron] Đang khởi động cron job kiểm tra thanh toán mỗi 15 giây...');
    });

    // Cron job: Check thanh toán mỗi 15 giây
    setInterval(async () => {
      try {
        const result = await checkAndUpdatePayments();
        if (result.checked > 0) {
          console.log(`[Cron] ✓ Đã kiểm tra ${result.checked} payment(s)`);
        }
        if (result.updated > 0) {
          console.log(`[Cron] ✓ Đã cập nhật ${result.updated} payment(s) thành công!`);
        }
        if (result.error) {
          console.error(`[Cron] ✗ Lỗi: ${result.error}`);
        }
      } catch (error) {
        console.error('[Cron] ✗ Lỗi khi check thanh toán:', error.message);
      }
    }, 15000); // 15 giây

    // Chạy ngay lần đầu sau 5 giây khi server start
    setTimeout(async () => {
      try {
        console.log('[Cron] Chạy kiểm tra thanh toán lần đầu...');
        const result = await checkAndUpdatePayments();
        console.log(`[Cron] ✓ Lần đầu: Đã kiểm tra ${result.checked} payment(s), cập nhật ${result.updated} payment(s).`);
      } catch (error) {
        console.error('[Cron] ✗ Lỗi khi check thanh toán lần đầu:', error.message);
      }
    }, 5000); // 5 giây
  })
  .catch((err) => {
    console.error('DB connection failed:', err);
    process.exit(1);
  });
