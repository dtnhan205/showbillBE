const express = require('express');
const {
  getPublicAdmins,
  getPublicAdminDetail,
  incrementAdminViews,
  incrementProductView,
} = require('../controllers/publicController');

const router = express.Router();

router.get('/admins', getPublicAdmins);
router.get('/admins/:id', getPublicAdminDetail);
router.post('/admins/:id/increment-views', incrementAdminViews);
router.post('/products/:id/view', incrementProductView);

module.exports = router;

