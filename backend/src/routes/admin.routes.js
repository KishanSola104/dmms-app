const express = require('express');
const router = express.Router();
const { verifyUserAuth, authorizeRoles } = require('../middlewares/auth.middleware');

// Controllers
const AdminUserController = require('../controllers/adminUser.controller');
const AdminAcademicYearController = require('../controllers/adminAcademicYear.controller');
const AdminClassSectionController = require('../controllers/adminClassSection.controller');
const AdminSubjectController = require('../controllers/adminSubject.controller');
const AdminClassSubjectController = require('../controllers/adminClassSubject.controller');
const AdminTeacherAssignmentController = require('../controllers/adminTeacherAssignment.controller');
const AdminExaminationController = require('../controllers/adminExamination.controller');
const AdminExaminationSubjectController = require('../controllers/adminExaminationSubject.controller');

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

// ==========================================
// 5. MODULE 3 - SUBJECT ALLOCATION TO CLASSES
// ==========================================
router.get('/class-subjects', AdminClassSubjectController.listAllocations);
router.get('/class-subjects/available', AdminClassSubjectController.getAvailableSubjects);
router.post('/class-subjects', AdminClassSubjectController.allocateSubjects);
router.put('/class-subjects/:allocationId', AdminClassSubjectController.updateAllocation);
router.patch('/class-subjects/:allocationId/status', AdminClassSubjectController.toggleAllocationStatus);

// ==========================================
// 6. MODULE 3 - TEACHER ASSIGNMENT TO SUBJECTS
// ==========================================
router.get('/teacher-assignments/eligible-options', AdminTeacherAssignmentController.getEligibleOptions);
router.get('/teacher-assignments', AdminTeacherAssignmentController.listAssignments);
router.post('/teacher-assignments', AdminTeacherAssignmentController.assignTeacher);
router.put('/teacher-assignments/:assignmentId', AdminTeacherAssignmentController.reassignTeacher);
router.patch('/teacher-assignments/:assignmentId/status', AdminTeacherAssignmentController.toggleAssignmentStatus);

// ==========================================
// 7. MODULE 3 - EXAMINATION MANAGEMENT
// ==========================================
router.get('/examinations', AdminExaminationController.listExaminations);
router.get('/examinations/:examinationId', AdminExaminationController.getExaminationById);
router.post('/examinations', AdminExaminationController.createExamination);
router.put('/examinations/:examinationId', AdminExaminationController.editExamination);
router.patch('/examinations/:examinationId/status', AdminExaminationController.toggleExaminationStatus);
router.get('/examinations/:examinationId/classes', AdminExaminationController.getAssignedClasses);

// ==========================================
// 8. MODULE 3 - EXAMINATION SUBJECT CONFIGURATION (PHASE 4)
// ==========================================
router.get('/examinations/:examinationId/classes/:classId/subjects', AdminExaminationSubjectController.getClassSubjectsForExam);
router.post('/examinations/:examinationId/classes/:classId/subjects/:subjectId/configure', AdminExaminationSubjectController.configureSubjectMarks);
router.get('/examinations/:examinationId/classes/:classId/subjects/:subjectId', AdminExaminationSubjectController.getSubjectConfiguration);
router.delete('/examinations/subjects/:examinationSubjectId', AdminExaminationSubjectController.removeSubjectConfiguration);
router.post('/examinations/:examinationId/classes/:classId/copy-from/:sourceClassId', AdminExaminationSubjectController.copyClassConfiguration);

module.exports = router;
