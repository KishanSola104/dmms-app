const express = require('express');
const router = express.Router();
const CommonController = require('../controllers/common.controller');
const { verifyUserAuth } = require('../middlewares/auth.middleware');

router.get('/academic-years', verifyUserAuth, CommonController.getAcademicYears);
router.post('/academic-years/switch', verifyUserAuth, CommonController.switchAcademicYear);
router.get('/notifications', verifyUserAuth, CommonController.getNotifications);
router.put('/notifications/:id/read', verifyUserAuth, CommonController.markNotificationRead);
router.put('/notifications/mark-all-read', verifyUserAuth, CommonController.markAllNotificationsRead);
router.get('/dashboard-stats', verifyUserAuth, CommonController.getDashboardStats);

module.exports = router;
