// routes/productRoutes.js

const express = require('express');
const {
  getProducts,
  getMyProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleHidden,
} = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');
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
router.post('/', protect, upload, createProduct);
router.put('/:id', protect, upload, updateProduct);
router.delete('/:id', protect, deleteProduct);
router.patch('/:id/toggle-hidden', protect, toggleHidden);

module.exports = router;
