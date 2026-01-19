/**
 * Script MongoDB để tạo indexes cho collection products
 * Copy/paste toàn bộ vào mongosh hoặc chạy: mongosh <your-db-name> < mongodb-indexes.js
 */

// Chọn database (thay 'showbill' bằng tên database của bạn)
use('showbill');

print('📊 Đang tạo indexes cho collection products...\n');

// Lấy danh sách indexes hiện tại
print('Indexes hiện tại:');
db.products.getIndexes().forEach(idx => {
  print(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
});
print('');

// Tạo indexes
print('Đang tạo indexes...\n');

// 1. Index cho sort theo createdAt (quan trọng nhất)
db.products.createIndex({ createdAt: -1 }, { background: true, name: 'createdAt_-1' });
print('✅ Index: createdAt_-1');

// 2. Index cho adminId + createdAt
db.products.createIndex({ adminId: 1, createdAt: -1 }, { background: true, name: 'adminId_1_createdAt_-1' });
print('✅ Index: adminId_1_createdAt_-1');

// 3. Index cho isHidden + createdAt (public products)
db.products.createIndex({ isHidden: 1, createdAt: -1 }, { background: true, name: 'isHidden_1_createdAt_-1' });
print('✅ Index: isHidden_1_createdAt_-1');

// 4. Index cho obVersion + createdAt
db.products.createIndex({ obVersion: 1, createdAt: -1 }, { background: true, name: 'obVersion_1_createdAt_-1' });
print('✅ Index: obVersion_1_createdAt_-1');

// 5. Index cho category + createdAt
db.products.createIndex({ category: 1, createdAt: -1 }, { background: true, name: 'category_1_createdAt_-1' });
print('✅ Index: category_1_createdAt_-1');

// 6. Index cho adminId + obVersion + createdAt
db.products.createIndex({ adminId: 1, obVersion: 1, createdAt: -1 }, { background: true, name: 'adminId_1_obVersion_1_createdAt_-1' });
print('✅ Index: adminId_1_obVersion_1_createdAt_-1');

// 7. Index cho adminId + category + createdAt
db.products.createIndex({ adminId: 1, category: 1, createdAt: -1 }, { background: true, name: 'adminId_1_category_1_createdAt_-1' });
print('✅ Index: adminId_1_category_1_createdAt_-1');

// 8. Index cho isHidden + obVersion + createdAt
db.products.createIndex({ isHidden: 1, obVersion: 1, createdAt: -1 }, { background: true, name: 'isHidden_1_obVersion_1_createdAt_-1' });
print('✅ Index: isHidden_1_obVersion_1_createdAt_-1');

// 9. Index cho isHidden + category + createdAt
db.products.createIndex({ isHidden: 1, category: 1, createdAt: -1 }, { background: true, name: 'isHidden_1_category_1_createdAt_-1' });
print('✅ Index: isHidden_1_category_1_createdAt_-1');

print('\n📋 Kiểm tra lại indexes sau khi tạo:');
db.products.getIndexes().forEach(idx => {
  print(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
});

print('\n📊 Đang tạo indexes cho collection admins...\n');

// Indexes cho Admin collection
db.admins.createIndex({ role: 1, isPublicHidden: 1, createdAt: -1 }, { background: true, name: 'role_1_isPublicHidden_1_createdAt_-1' });
print('✅ Index: role_1_isPublicHidden_1_createdAt_-1');

// Index riêng cho role + isPublicHidden để tối ưu query $expr (filter trước khi scan)
db.admins.createIndex({ role: 1, isPublicHidden: 1 }, { background: true, name: 'role_1_isPublicHidden_1' });
print('✅ Index: role_1_isPublicHidden_1');

db.admins.createIndex({ activePackage: 1 }, { background: true, name: 'activePackage_1' });
print('✅ Index: activePackage_1');

print('\n📊 Đang tạo indexes cho collection payments...\n');

// Indexes cho Payment collection (đã có trong model nhưng đảm bảo tạo lại)
db.payments.createIndex({ status: 1, expiresAt: 1 }, { background: true, name: 'status_1_expiresAt_1' });
print('✅ Index: status_1_expiresAt_1');

db.payments.createIndex({ adminId: 1, createdAt: -1 }, { background: true, name: 'adminId_1_createdAt_-1' });
print('✅ Index: adminId_1_createdAt_-1');

print('\n📋 Kiểm tra lại tất cả indexes:');
print('\n📦 Products:');
db.products.getIndexes().forEach(idx => {
  print(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
});

print('\n👤 Admins:');
db.admins.getIndexes().forEach(idx => {
  print(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
});

print('\n💳 Payments:');
db.payments.getIndexes().forEach(idx => {
  print(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
});

print('\n✅ Hoàn thành!');

