const express = require('express');
const router = express.Router();
const ProfileController = require('../controllers/profile.controller');
const { verifyUserAuth } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const signatureUpload = require('../middlewares/signatureUpload.middleware');

router.get('/me', verifyUserAuth, ProfileController.getProfile);
router.put('/update', verifyUserAuth, ProfileController.updateProfile);
router.post('/upload-image', verifyUserAuth, upload.single('profileImage'), ProfileController.uploadProfileImage);
router.post('/upload-signature', verifyUserAuth, signatureUpload.single('signature'), ProfileController.uploadSignature);
router.delete('/signature', verifyUserAuth, ProfileController.deleteSignature);
router.post('/change-password', verifyUserAuth, ProfileController.changePassword);

module.exports = router;
