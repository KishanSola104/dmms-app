const express = require('express');
const router = express.Router();
const OfficeController = require('../controllers/office.controller');
const { verifyUserAuth, authorizeRoles } = require('../middlewares/auth.middleware');

// Enforce authentication & OFFICE_STAFF (or ADMIN oversight) access
router.use(verifyUserAuth, authorizeRoles('OFFICE_STAFF', 'ADMIN'));

router.get('/published-results', OfficeController.listPublishedResults);
router.get('/published-results/class-report/pdf', OfficeController.downloadClassWisePublishedPdf);
router.get('/published-results/:resultId', OfficeController.getPublishedResultDetail);
router.get('/published-results/:resultId/pdf', OfficeController.downloadPublishedStudentPdf);

module.exports = router;
