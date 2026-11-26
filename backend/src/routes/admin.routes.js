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
const AdminStudentController = require('../controllers/adminStudent.controller');
const AdminStudentImportExportController = require('../controllers/adminStudentImportExport.controller');
const AdminSchoolProfileController = require('../controllers/adminSchoolProfile.controller');
const MarksAndAuditController = require('../controllers/marksAndAudit.controller');
const upload = require('../middlewares/upload.middleware');
const logoUpload = require('../middlewares/logoUpload.middleware');
const multer = require('multer');
const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Enforce authentication for all routes; granular role checks applied below
router.use(verifyUserAuth);

const adminOnly = authorizeRoles('ADMIN');
const adminOrHeadTeacher = authorizeRoles('ADMIN', 'HEAD_TEACHER');

// ==========================================
// 1. USER MANAGEMENT (ADMIN ONLY)
// ==========================================
router.get('/roles', adminOnly, AdminUserController.getRoles);
router.get('/users', adminOnly, AdminUserController.listUsers);
router.post('/users', adminOnly, AdminUserController.createUser);
router.put('/users/:userId', adminOnly, AdminUserController.editUser);
router.post('/users/request-confirmation-code', adminOnly, AdminUserController.requestConfirmationCode);
router.post('/users/deactivate', adminOnly, AdminUserController.deactivateUser);
router.post('/users/activate', adminOnly, AdminUserController.activateUser);
router.post('/users/delete', adminOnly, AdminUserController.deleteUser);

// ==========================================
// 2. ACADEMIC YEAR MANAGEMENT (READ SHARED, WRITE ADMIN ONLY)
// ==========================================
router.get('/academic-years', adminOrHeadTeacher, AdminAcademicYearController.listAcademicYears);
router.post('/academic-years', adminOnly, AdminAcademicYearController.createAcademicYear);
router.put('/academic-years/:yearId', adminOnly, AdminAcademicYearController.editAcademicYear);
router.put('/academic-years/:yearId/set-current', adminOnly, AdminAcademicYearController.setAsCurrent);

// ==========================================
// 3. CLASSES & SECTIONS MANAGEMENT (READ SHARED, WRITE ADMIN ONLY)
// ==========================================
router.get('/teachers', adminOrHeadTeacher, AdminClassSectionController.getEligibleTeachers);

// Classes
router.get('/classes', adminOrHeadTeacher, AdminClassSectionController.listClasses);
router.post('/classes', adminOnly, AdminClassSectionController.createClass);
router.put('/classes/:classId', adminOnly, AdminClassSectionController.editClass);
router.patch('/classes/:classId/status', adminOnly, AdminClassSectionController.toggleClassStatus);

// Sections
router.get('/sections', adminOrHeadTeacher, AdminClassSectionController.listSections);
router.post('/sections', adminOnly, AdminClassSectionController.createSection);
router.put('/sections/:sectionId', adminOnly, AdminClassSectionController.editSection);
router.patch('/sections/:sectionId/status', adminOnly, AdminClassSectionController.toggleSectionStatus);

// ==========================================
// 4. SUBJECTS MANAGEMENT (READ SHARED, WRITE ADMIN ONLY)
// ==========================================
router.get('/subjects', adminOrHeadTeacher, AdminSubjectController.listSubjects);
router.post('/subjects', adminOnly, AdminSubjectController.createSubject);
router.put('/subjects/:subjectId', adminOnly, AdminSubjectController.editSubject);
router.patch('/subjects/:subjectId/status', adminOnly, AdminSubjectController.toggleSubjectStatus);

// ==========================================
// 5. MODULE 3 - SUBJECT ALLOCATION TO CLASSES (ADMIN & HEAD TEACHER)
// ==========================================
router.get('/class-subjects', adminOrHeadTeacher, AdminClassSubjectController.listAllocations);
router.get('/class-subjects/available', adminOrHeadTeacher, AdminClassSubjectController.getAvailableSubjects);
router.post('/class-subjects', adminOrHeadTeacher, AdminClassSubjectController.allocateSubjects);
router.put('/class-subjects/:allocationId', adminOrHeadTeacher, AdminClassSubjectController.updateAllocation);
router.patch('/class-subjects/:allocationId/status', adminOrHeadTeacher, AdminClassSubjectController.toggleAllocationStatus);

// ==========================================
// 6. MODULE 3 - TEACHER ASSIGNMENT TO SUBJECTS (ADMIN & HEAD TEACHER)
// ==========================================
router.get('/teacher-assignments/eligible-options', adminOrHeadTeacher, AdminTeacherAssignmentController.getEligibleOptions);
router.get('/teacher-assignments', adminOrHeadTeacher, AdminTeacherAssignmentController.listAssignments);
router.post('/teacher-assignments', adminOrHeadTeacher, AdminTeacherAssignmentController.assignTeacher);
router.put('/teacher-assignments/:assignmentId', adminOrHeadTeacher, AdminTeacherAssignmentController.reassignTeacher);
router.patch('/teacher-assignments/:assignmentId/status', adminOrHeadTeacher, AdminTeacherAssignmentController.toggleAssignmentStatus);
router.post('/teacher-assignments/:assignmentId/deallocate', adminOrHeadTeacher, AdminTeacherAssignmentController.deallocateAssignment);

// ==========================================
// 7. MODULE 3 - EXAMINATION MANAGEMENT (ADMIN & HEAD TEACHER)
// ==========================================
router.get('/examinations', adminOrHeadTeacher, AdminExaminationController.listExaminations);
router.get('/examinations/:examinationId', adminOrHeadTeacher, AdminExaminationController.getExaminationById);
router.post('/examinations', adminOrHeadTeacher, AdminExaminationController.createExamination);
router.put('/examinations/:examinationId', adminOrHeadTeacher, AdminExaminationController.editExamination);
router.patch('/examinations/:examinationId/status', adminOrHeadTeacher, AdminExaminationController.toggleExaminationStatus);
router.get('/examinations/:examinationId/classes', adminOrHeadTeacher, AdminExaminationController.getAssignedClasses);

// ==========================================
// 8. MODULE 3 - EXAMINATION SUBJECT CONFIGURATION (ADMIN & HEAD TEACHER)
// ==========================================
router.get('/examinations/:examinationId/classes/:classId/subjects', adminOrHeadTeacher, AdminExaminationSubjectController.getClassSubjectsForExam);
router.post('/examinations/:examinationId/classes/:classId/subjects/:subjectId/configure', adminOrHeadTeacher, AdminExaminationSubjectController.configureSubjectMarks);
router.get('/examinations/:examinationId/classes/:classId/subjects/:subjectId', adminOrHeadTeacher, AdminExaminationSubjectController.getSubjectConfiguration);
router.delete('/examinations/subjects/:examinationSubjectId', adminOrHeadTeacher, AdminExaminationSubjectController.removeSubjectConfiguration);
router.post('/examinations/:examinationId/classes/:classId/copy-from/:sourceClassId', adminOrHeadTeacher, AdminExaminationSubjectController.copyClassConfiguration);

// ==========================================
// 9. MODULE 4 - STUDENT MANAGEMENT (ADMIN & HEAD TEACHER)
// ==========================================
router.get('/students/next-admission-number', adminOrHeadTeacher, AdminStudentController.getNextAdmissionNumber);
router.get('/students/next-roll-number', adminOrHeadTeacher, AdminStudentController.getNextRollNumber);
router.post('/students/admission', adminOrHeadTeacher, AdminStudentController.admitStudent);
router.post('/students/upload-photo', adminOrHeadTeacher, upload.single('photo'), AdminStudentController.uploadPhoto);
router.get('/students', adminOrHeadTeacher, AdminStudentController.listStudents);
router.get('/students/:studentId', adminOrHeadTeacher, AdminStudentController.getStudentById);
router.put('/students/:studentId', adminOrHeadTeacher, AdminStudentController.updateStudent);
router.patch('/students/:studentId/status', adminOrHeadTeacher, AdminStudentController.toggleStudentStatus);

// ==========================================
// 10. MODULE 4 - ENROLLMENT & TRANSFER MANAGEMENT (ADMIN & HEAD TEACHER)
// ==========================================
router.get('/enrollments', adminOrHeadTeacher, AdminStudentController.getSectionEnrollmentSummary);
router.get('/enrollments/unenrolled', adminOrHeadTeacher, AdminStudentController.getUnenrolledStudents);
router.post('/enrollments', adminOrHeadTeacher, AdminStudentController.enrollStudent);
router.put('/enrollments/:enrollmentId', adminOrHeadTeacher, AdminStudentController.updateEnrollment);
router.post('/enrollments/:enrollmentId/transfer', adminOrHeadTeacher, AdminStudentController.transferStudentSection);

// ==========================================
// 11. MODULE 4 - STUDENT PROMOTION MANAGEMENT (ADMIN & HEAD TEACHER)
// ==========================================
router.get('/promotions/source-students', adminOrHeadTeacher, AdminStudentController.getSourceStudentsForPromotion);
router.post('/promotions/preview-distribution', adminOrHeadTeacher, AdminStudentController.previewPromotionDistribution);
router.post('/promotions/execute', adminOrHeadTeacher, AdminStudentController.executePromotions);

// ==========================================
// 12. MODULE 4 - EXCEL IMPORT, EXPORT & PDF REPORTS (ADMIN & HEAD TEACHER)
// ==========================================
router.get('/students/import/template', adminOrHeadTeacher, AdminStudentImportExportController.downloadTemplate);
router.post('/students/import/preview', adminOrHeadTeacher, uploadMemory.single('file'), AdminStudentImportExportController.previewImport);
router.post('/students/import/commit', adminOrHeadTeacher, AdminStudentImportExportController.commitImport);
router.get('/students/export/excel', adminOrHeadTeacher, AdminStudentImportExportController.exportStudentsExcel);
router.get('/students/:studentId/export/pdf', adminOrHeadTeacher, AdminStudentImportExportController.exportStudentPDF);
router.get('/classes/:classId/sections/:sectionId/export/pdf', adminOrHeadTeacher, AdminStudentImportExportController.exportClassListPDF);

// ==========================================
// 13. MODULE 4 - SCHOOL PROFILE MANAGEMENT (ADMIN ONLY)
// ==========================================
router.get('/school-profile', adminOnly, AdminSchoolProfileController.getSchoolProfile);
router.put('/school-profile', adminOnly, AdminSchoolProfileController.updateSchoolProfile);
router.post('/school-profile/logo', adminOnly, logoUpload.single('logo'), AdminSchoolProfileController.uploadLogo);
router.get('/result-config', adminOnly, AdminSchoolProfileController.getResultConfig);
router.put('/result-config', adminOnly, AdminSchoolProfileController.updateResultConfig);

// ==========================================
// 14. MARKS ENTRY LOCK CONTROLS & AUDIT LOGS
// ==========================================
router.get('/marks-lock', adminOrHeadTeacher, MarksAndAuditController.getMarksLockOverview);
router.post('/marks-lock/update', adminOrHeadTeacher, MarksAndAuditController.updateMarksLockState);
router.get('/audit-logs', adminOnly, MarksAndAuditController.getAuditLogs);

module.exports = router;
