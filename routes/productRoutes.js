// routes/productRoutes.js

const express = require('express');
const {
  getProducts,
  getMyProducts,
  getAllProducts,
  createProduct,
  createMultipleProducts,
  updateProduct,
  deleteProduct,
  toggleHidden,
} = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');
const { checkUploadLimit } = require('../middleware/packageMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { uploadLimiter, bulkUploadLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

/**
 * PUBLIC (Client)
 */
router.get('/', getProducts);

/**
 * PROTECTED (Admin)
 */
router.get('/mine', protect, getMyProducts);
router.get('/all', protect, getAllProducts);
router.post('/', protect, uploadLimiter, checkUploadLimit, upload, createProduct);
router.post('/bulk', protect, bulkUploadLimiter, checkUploadLimit, upload.uploadMultiple, createMultipleProducts);
router.put('/:id', protect, uploadLimiter, upload, updateProduct);
router.delete('/:id', protect, deleteProduct);
router.patch('/:id/toggle-hidden', protect, toggleHidden);

module.exports = router;
