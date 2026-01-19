/**
 * Script để tạo indexes trên MongoDB cho collection products
 * Chạy: node scripts/create-indexes.js
 * Hoặc copy/paste vào mongosh
 */

const mongoose = require('mongoose');
const db = require('../config/db');

async function createIndexes() {
  try {
    await db.connect();
    const Product = require('../models/Product');
    const collection = Product.collection;

    console.log('📊 Đang tạo indexes cho collection products...\n');

    // Lấy danh sách indexes hiện tại
    const existingIndexes = await collection.indexes();
    console.log('Indexes hiện tại:', existingIndexes.map((idx) => idx.name).join(', '));
    console.log('');

    // Tạo indexes từ schema (Mongoose sẽ tự động tạo khi model được load)
    // Nhưng ta có thể force tạo ngay bằng ensureIndexes
    await Product.ensureIndexes();

    // Kiểm tra lại sau khi tạo
    const newIndexes = await collection.indexes();
    console.log('✅ Indexes sau khi tạo:', newIndexes.map((idx) => idx.name).join(', '));
    console.log('');

    // Hiển thị chi tiết
    console.log('📋 Chi tiết indexes:');
    newIndexes.forEach((idx) => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

    console.log('\n✅ Hoàn thành!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  }
}

createIndexes();

