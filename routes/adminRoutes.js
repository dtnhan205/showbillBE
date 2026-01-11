const express = require('express');
const { protect, requireSuperAdmin } = require('../middleware/authMiddleware');
const {
  getAllAdmins,
  toggleAdminActive,
  getMyProfile,
  updateMyProfile,
  getMyStats,
  getSystemStats,
  getMyChartData,
  getSystemChartData,
} = require('../controllers/adminController');

const router = express.Router();

// Super admin - manage admins
router.get('/users', protect, requireSuperAdmin, getAllAdmins);
router.patch('/users/:id/toggle-active', protect, requireSuperAdmin, toggleAdminActive);

// Profile
router.get('/profile', protect, getMyProfile);
router.put('/profile', protect, updateMyProfile);

// Stats
router.get('/stats', protect, getMyStats);
router.get('/system-stats', protect, requireSuperAdmin, getSystemStats);

// Chart data
router.get('/chart-data', protect, getMyChartData);
router.get('/system-chart-data', protect, requireSuperAdmin, getSystemChartData);

module.exports = router;
