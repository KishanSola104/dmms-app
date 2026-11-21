const express = require('express');
const router = express.Router();
const { verifyUserAuth, authorizeRoles } = require('../middlewares/auth.middleware');

// Controllers
const AdminUserController = require('../controllers/adminUser.controller');
const AdminAcademicYearController = require('../controllers/adminAcademicYear.controller');
const AdminClassSectionController = require('../controllers/adminClassSection.controller');
const AdminSubjectController = require('../controllers/adminSubject.controller');

// Enforce authentication & ADMIN role for all administrative endpoints
router.use(verifyUserAuth, authorizeRoles('ADMIN'));

// ==========================================
// 1. USER MANAGEMENT
// ==========================================
router.get('/roles', AdminUserController.getRoles);
router.get('/users', AdminUserController.listUsers);
router.post('/users', AdminUserController.createUser);
router.put('/users/:userId', AdminUserController.editUser);
router.post('/users/request-confirmation-code', AdminUserController.requestConfirmationCode);
router.post('/users/deactivate', AdminUserController.deactivateUser);
router.post('/users/activate', AdminUserController.activateUser);
router.post('/users/delete', AdminUserController.deleteUser);

// ==========================================
// 2. ACADEMIC YEAR MANAGEMENT
// ==========================================
router.get('/academic-years', AdminAcademicYearController.listAcademicYears);
router.post('/academic-years', AdminAcademicYearController.createAcademicYear);
router.put('/academic-years/:yearId', AdminAcademicYearController.editAcademicYear);
router.put('/academic-years/:yearId/set-current', AdminAcademicYearController.setAsCurrent);

// ==========================================
// 3. CLASSES & SECTIONS MANAGEMENT
// ==========================================
router.get('/teachers', AdminClassSectionController.getEligibleTeachers);

// Classes
router.get('/classes', AdminClassSectionController.listClasses);
router.post('/classes', AdminClassSectionController.createClass);
router.put('/classes/:classId', AdminClassSectionController.editClass);
router.patch('/classes/:classId/status', AdminClassSectionController.toggleClassStatus);

// Sections
router.get('/sections', AdminClassSectionController.listSections);
router.post('/sections', AdminClassSectionController.createSection);
router.put('/sections/:sectionId', AdminClassSectionController.editSection);
router.patch('/sections/:sectionId/status', AdminClassSectionController.toggleSectionStatus);

// ==========================================
// 4. SUBJECTS MANAGEMENT
// ==========================================
router.get('/subjects', AdminSubjectController.listSubjects);
router.post('/subjects', AdminSubjectController.createSubject);
router.put('/subjects/:subjectId', AdminSubjectController.editSubject);
router.patch('/subjects/:subjectId/status', AdminSubjectController.toggleSubjectStatus);

module.exports = router;
