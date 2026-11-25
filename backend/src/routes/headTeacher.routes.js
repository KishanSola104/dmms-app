const express = require('express');
const router = express.Router();
const HeadTeacherController = require('../controllers/headTeacher.controller');
const { verifyUserAuth, authorizeRoles } = require('../middlewares/auth.middleware');

// Enforce authentication & HEAD_TEACHER or ADMIN role for academic supervision endpoints
router.use(verifyUserAuth, authorizeRoles('HEAD_TEACHER', 'ADMIN'));

// ==========================================
// HEAD TEACHER DASHBOARD API
// ==========================================
router.get('/dashboard', HeadTeacherController.getDashboardStats);

// ==========================================
// PHASE 1: CLASSES & SECTIONS (READ-ONLY)
// ==========================================
router.get('/classes', HeadTeacherController.listClasses);
router.get('/classes/:classId', HeadTeacherController.getClassDetails);
router.get('/classes/:classId/sections/:sectionId', HeadTeacherController.getSectionDetails);

// ==========================================
// PHASE 2: SUBJECT OVERVIEW (READ-ONLY)
// ==========================================
router.get('/subjects', HeadTeacherController.listSubjects);
router.get('/subjects/:subjectId', HeadTeacherController.getSubjectDetails);
router.get('/subject-allocations', HeadTeacherController.getClassSubjectAllocations);

// ==========================================
// PHASE 3: TEACHER OVERVIEW (READ-ONLY)
// ==========================================
router.get('/teachers', HeadTeacherController.listTeachers);
router.get('/teachers/:teacherUserId', HeadTeacherController.getTeacherProfile);

// ==========================================
// PHASE 4: TEACHER ASSIGNMENTS (READ-ONLY)
// ==========================================
router.get('/teacher-assignments', HeadTeacherController.listTeacherAssignments);
router.get('/teacher-assignments/:assignmentId', HeadTeacherController.getAssignmentDetails);

// ==========================================
// MODULE 2: STUDENT OVERVIEW - PHASE 1 (READ-ONLY)
// ==========================================
router.get('/students', HeadTeacherController.listStudents);

// ==========================================
// MODULE 2: STUDENT OVERVIEW - PHASE 2 (READ-ONLY)
// ==========================================
router.get('/students/:studentId', HeadTeacherController.getStudentProfile);

// ==========================================
// MODULE 2: STUDENT OVERVIEW - PHASE 3 (READ-ONLY)
// ==========================================
router.get('/students/:studentId/performance', HeadTeacherController.getStudentPerformance);

// ==========================================
// MODULE 4: EXAMINATION MANAGEMENT (READ-ONLY)
// ==========================================
router.get('/examinations', HeadTeacherController.listExaminations);
router.get('/examinations/:examinationId', HeadTeacherController.getExaminationDetails);
router.get('/examination-schedule', HeadTeacherController.getExaminationSchedule);
router.get('/subject-configurations', HeadTeacherController.getSubjectConfigurations);
router.get('/marks-entry-monitoring', HeadTeacherController.getMarksEntryMonitoring);
router.get('/marks-entry-monitoring/details', HeadTeacherController.getMarksEntryMonitoringDetails);

// ==========================================
// RESULT REVIEW, APPROVAL, RETURN & PUBLISHING
// ==========================================
router.get('/results/batches', HeadTeacherController.listResultBatches);
router.get('/results/details', HeadTeacherController.getResultBatchDetails);
router.post('/results/review', HeadTeacherController.markResultUnderReview);
router.post('/results/approve', HeadTeacherController.approveResultBatch);
router.post('/results/return', HeadTeacherController.returnResultBatch);
router.post('/results/publish', HeadTeacherController.publishResultBatch);
router.get('/results/examination/:resultId/pdf', HeadTeacherController.downloadExaminationResultPdf);
router.get('/results/final/:finalResultId/pdf', HeadTeacherController.downloadFinalResultPdf);

module.exports = router;
