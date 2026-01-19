const express = require('express');
const {
  getPublicAdmins,
  getPublicAdminDetail,
  incrementAdminViews,
  incrementProductView,
  reportAdmin,
} = require('../controllers/publicController');

const router = express.Router();

router.get('/admins', getPublicAdmins);
router.get('/admins/:id', getPublicAdminDetail);
router.post('/admins/:id/increment-views', incrementAdminViews);
router.post('/admins/:id/report', reportAdmin);
router.post('/products/:id/view', incrementProductView);

module.exports = router;

