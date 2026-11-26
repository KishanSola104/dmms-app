const express = require('express');
const router = express.Router();
const OfficeController = require('../controllers/office.controller');
const { verifyUserAuth, authorizeRoles } = require('../middlewares/auth.middleware');

// Enforce authentication & OFFICE_STAFF (or ADMIN oversight) access
router.use(verifyUserAuth, authorizeRoles('OFFICE_STAFF', 'ADMIN'));

router.get('/dashboard', OfficeController.getDashboard);
router.get('/published-results', OfficeController.listPublishedResults);
router.get('/published-results/class-report/pdf', OfficeController.downloadClassWisePublishedPdf);
router.get('/published-results/:resultId', OfficeController.getPublishedResultDetail);
router.get('/published-results/:resultId/pdf', OfficeController.downloadPublishedStudentPdf);
router.get('/academic-reports', OfficeController.getAcademicReports);
router.get('/academic-reports/pdf', OfficeController.downloadAcademicReportPdf);
router.get('/download-history', OfficeController.listDownloadHistory);

module.exports = router;
