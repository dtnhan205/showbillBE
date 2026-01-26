const express = require('express');
const {
  getCategories,
  getMyCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');
const { createObCategoryLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

// Public
router.get('/', getCategories);

// Admin
router.get('/mine', protect, getMyCategories);
router.post('/', protect, createObCategoryLimiter, createCategory);
router.put('/:id', protect, updateCategory);
router.delete('/:id', protect, deleteCategory);

module.exports = router;

