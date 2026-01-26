const express = require('express');
const {
  getObVersions,
  getMyObVersions,
  createObVersion,
  updateObVersion,
  deleteObVersion,
} = require('../controllers/obController');
const { protect } = require('../middleware/authMiddleware');
const { createObCategoryLimiter } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

// Public
router.get('/', getObVersions);

// Admin
router.get('/mine', protect, getMyObVersions);
router.post('/', protect, createObCategoryLimiter, createObVersion);
router.put('/:id', protect, updateObVersion);
router.delete('/:id', protect, deleteObVersion);

module.exports = router;

