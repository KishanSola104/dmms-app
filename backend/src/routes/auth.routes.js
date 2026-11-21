const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/auth.controller');
const { verifySchoolSession } = require('../middlewares/schoolAuth.middleware');
const { verifyUserAuth } = require('../middlewares/auth.middleware');

// Public role discovery from dynamic role_info collection
router.get('/roles', AuthController.getAvailableRoles);

// School session required routes
router.get('/current-school', verifySchoolSession, AuthController.getCurrentSchool);
router.post('/user/login', verifySchoolSession, AuthController.userLogin);
router.post('/user/forgot-password', verifySchoolSession, AuthController.userForgotPassword);

// User auth required routes
router.post('/user/first-login-change-password', verifyUserAuth, AuthController.firstLoginChangePassword);

module.exports = router;
