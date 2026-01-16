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
router.post('/', protect, checkUploadLimit, upload, createProduct);
router.post('/bulk', protect, checkUploadLimit, upload.uploadMultiple, createMultipleProducts);
router.put('/:id', protect, upload, updateProduct);
router.delete('/:id', protect, deleteProduct);
router.patch('/:id/toggle-hidden', protect, toggleHidden);

module.exports = router;
