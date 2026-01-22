const express = require('express');
const {
  getMyPackage,
  getPackages,
  createPayment,
  getPaymentHistory,
  getPaymentDetail,
  deletePayment,
  verifyPayment,
  switchPackage,
  getPaymentStats,
  getAllPaymentHistory,
} = require('../controllers/paymentController');
const {
  getPackageConfigs,
  updatePackageConfig,
  createPackageConfig,
  deletePackageConfig,
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} = require('../controllers/packageController');
const { protect, requireSuperAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * Admin routes
 */
router.get('/my-package', protect, getMyPackage);
router.get('/packages', protect, getPackages);
router.post('/create', protect, createPayment);
router.post('/switch-package', protect, switchPackage);
router.get('/history', protect, getPaymentHistory);
router.delete('/:id', protect, deletePayment);
router.get('/:id', protect, getPaymentDetail);

/**
 * Super admin routes
 */
router.get('/admin/packages/config', protect, requireSuperAdmin, getPackageConfigs);
router.post('/admin/packages/config', protect, requireSuperAdmin, createPackageConfig);
router.put('/admin/packages/config/:type', protect, requireSuperAdmin, updatePackageConfig);
router.delete('/admin/packages/config/:type', protect, requireSuperAdmin, deletePackageConfig);
router.get('/admin/bank-accounts', protect, requireSuperAdmin, getBankAccounts);
router.post('/admin/bank-accounts', protect, requireSuperAdmin, createBankAccount);
router.put('/admin/bank-accounts/:id', protect, requireSuperAdmin, updateBankAccount);
router.delete('/admin/bank-accounts/:id', protect, requireSuperAdmin, deleteBankAccount);
router.post('/admin/verify', protect, requireSuperAdmin, verifyPayment);
router.get('/admin/stats', protect, requireSuperAdmin, getPaymentStats);
router.get('/admin/history', protect, requireSuperAdmin, getAllPaymentHistory);

module.exports = router;

