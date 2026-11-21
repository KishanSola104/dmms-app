const express = require('express');
const router = express.Router();
const SchoolController = require('../controllers/school.controller');
const { verifyUserAuth } = require('../middlewares/auth.middleware');

// Public School routes
router.post('/register', SchoolController.registerSchool);
router.post('/check-uniqueness', SchoolController.checkUniqueness);
router.post('/login', SchoolController.login);
router.post('/forgot-password', SchoolController.forgotPassword);

// Protected School routes (requires logged in Administrator)
router.post('/change-password', verifyUserAuth, SchoolController.changeSchoolPassword);

module.exports = router;
