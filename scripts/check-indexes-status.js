/**
 * Script để kiểm tra trạng thái indexes của tất cả collections
 * Chạy: node scripts/check-indexes-status.js
 * Hoặc copy/paste vào mongosh
 */

// ============================================
// KIỂM TRA INDEXES CHO TẤT CẢ COLLECTIONS
// ============================================

print('📊 Kiểm tra indexes cho collection products...\n');
const productIndexes = db.products.getIndexes();
print('Số lượng indexes: ' + productIndexes.length);
productIndexes.forEach(idx => {
  print('  - ' + idx.name + ': ' + JSON.stringify(idx.key));
});

print('\n📊 Kiểm tra indexes cho collection admins...\n');
const adminIndexes = db.admins.getIndexes();
print('Số lượng indexes: ' + adminIndexes.length);
adminIndexes.forEach(idx => {
  print('  - ' + idx.name + ': ' + JSON.stringify(idx.key));
});

print('\n📊 Kiểm tra indexes cho collection payments...\n');
const paymentIndexes = db.payments.getIndexes();
print('Số lượng indexes: ' + paymentIndexes.length);
paymentIndexes.forEach(idx => {
  print('  - ' + idx.name + ': ' + JSON.stringify(idx.key));
});

print('\n✅ Hoàn thành kiểm tra!');

// ============================================
// GỢI Ý XÓA INDEX THỪA (TÙY CHỌN)
// ============================================
print('\n💡 Gợi ý: Nếu muốn xóa index thừa để tiết kiệm storage:');
print('   db.admins.dropIndex("isPublicHidden_1");');
print('   (Index này không cần thiết vì đã có role_1_isPublicHidden_1)');

