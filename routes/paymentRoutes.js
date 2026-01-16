const express = require('express');
const {
  getMyPackage,
  getPackages,
  createPayment,
  getPaymentHistory,
  getPaymentDetail,
  deletePayment,
  verifyPayment,
} = require('../controllers/paymentController');
const {
  getPackageConfigs,
  updatePackageConfig,
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
router.get('/history', protect, getPaymentHistory);
router.delete('/:id', protect, deletePayment);
router.get('/:id', protect, getPaymentDetail);

/**
 * Super admin routes
 */
router.get('/admin/packages/config', protect, requireSuperAdmin, getPackageConfigs);
router.put('/admin/packages/config/:type', protect, requireSuperAdmin, updatePackageConfig);
router.get('/admin/bank-accounts', protect, requireSuperAdmin, getBankAccounts);
router.post('/admin/bank-accounts', protect, requireSuperAdmin, createBankAccount);
router.put('/admin/bank-accounts/:id', protect, requireSuperAdmin, updateBankAccount);
router.delete('/admin/bank-accounts/:id', protect, requireSuperAdmin, deleteBankAccount);
router.post('/admin/verify', protect, requireSuperAdmin, verifyPayment);

module.exports = router;

