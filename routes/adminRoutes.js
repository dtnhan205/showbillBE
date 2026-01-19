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
  getAdminReports,
  toggleAdminPublicHidden,
  getAdminReportDetails,
  resetAdminReports,
  updateReportStatus,
} = require('../controllers/adminController');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Super admin - manage admins
router.get('/users', protect, requireSuperAdmin, getAllAdmins);
router.patch('/users/:id/toggle-active', protect, requireSuperAdmin, toggleAdminActive);
router.get('/reports', protect, requireSuperAdmin, getAdminReports);
router.get('/reports/:id/details', protect, requireSuperAdmin, getAdminReportDetails);
router.patch('/reports/:id/toggle-hide', protect, requireSuperAdmin, toggleAdminPublicHidden);
router.patch('/reports/report/:reportId/status', protect, requireSuperAdmin, updateReportStatus);
router.delete('/reports/:id/reset', protect, requireSuperAdmin, resetAdminReports);

// Profile
router.get('/profile', protect, getMyProfile);
router.put('/profile', protect, upload.uploadAvatarAndBanner, updateMyProfile);

// Stats
router.get('/stats', protect, getMyStats);
router.get('/system-stats', protect, requireSuperAdmin, getSystemStats);

// Chart data
router.get('/chart-data', protect, getMyChartData);
router.get('/system-chart-data', protect, requireSuperAdmin, getSystemChartData);

module.exports = router;
