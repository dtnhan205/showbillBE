/**
 * Script đơn giản để copy/paste vào mongosh
 * Tạo TẤT CẢ indexes cần thiết để tối ưu tốc độ query
 * 
 * Cách dùng:
 * 1. Mở mongosh: mongosh
 * 2. Chọn database: use showbill
 * 3. Copy/paste toàn bộ code dưới đây vào mongosh
 */

// ============================================
// INDEXES CHO COLLECTION PRODUCTS
// ============================================
print('📦 Đang tạo indexes cho collection products...');
db.products.createIndex({ createdAt: -1 }, { background: true });
db.products.createIndex({ adminId: 1, createdAt: -1 }, { background: true });
db.products.createIndex({ isHidden: 1, createdAt: -1 }, { background: true });
db.products.createIndex({ obVersion: 1, createdAt: -1 }, { background: true });
db.products.createIndex({ category: 1, createdAt: -1 }, { background: true });
db.products.createIndex({ adminId: 1, obVersion: 1, createdAt: -1 }, { background: true });
db.products.createIndex({ adminId: 1, category: 1, createdAt: -1 }, { background: true });
db.products.createIndex({ isHidden: 1, obVersion: 1, createdAt: -1 }, { background: true });
db.products.createIndex({ isHidden: 1, category: 1, createdAt: -1 }, { background: true });
db.products.createIndex({ adminId: 1, isHidden: 1, createdAt: -1 }, { background: true });
print('✅ Đã tạo 10 indexes cho products\n');

// ============================================
// INDEXES CHO COLLECTION ADMINS
// ============================================
print('👤 Đang tạo indexes cho collection admins...');
// Index cho public admins list (quan trọng nhất)
db.admins.createIndex({ role: 1, isPublicHidden: 1, createdAt: -1 }, { background: true });
// Index riêng cho role và isPublicHidden để tối ưu query $expr (filter trước khi scan)
db.admins.createIndex({ role: 1, isPublicHidden: 1 }, { background: true });
db.admins.createIndex({ activePackage: 1 }, { background: true });
print('✅ Đã tạo 3 indexes cho admins\n');

// ============================================
// INDEXES CHO COLLECTION PAYMENTS
// ============================================
print('💳 Đang tạo indexes cho collection payments...');
db.payments.createIndex({ status: 1, expiresAt: 1 }, { background: true });
db.payments.createIndex({ adminId: 1, createdAt: -1 }, { background: true });
print('✅ Đã tạo 2 indexes cho payments\n');

// ============================================
// KIỂM TRA KẾT QUẢ
// ============================================
print('📋 Tổng kết indexes:\n');

print('📦 Products (' + db.products.getIndexes().length + ' indexes):');
db.products.getIndexes().forEach(idx => {
  print('  - ' + idx.name + ': ' + JSON.stringify(idx.key));
});

print('\n👤 Admins (' + db.admins.getIndexes().length + ' indexes):');
db.admins.getIndexes().forEach(idx => {
  print('  - ' + idx.name + ': ' + JSON.stringify(idx.key));
});

print('\n💳 Payments (' + db.payments.getIndexes().length + ' indexes):');
db.payments.getIndexes().forEach(idx => {
  print('  - ' + idx.name + ': ' + JSON.stringify(idx.key));
});

print('\n✅ Hoàn thành! Tất cả indexes đã được tạo.');
print('⚠️  Lưu ý: Nếu collection lớn, việc tạo indexes có thể mất vài phút nhưng không ảnh hưởng đến database.');

