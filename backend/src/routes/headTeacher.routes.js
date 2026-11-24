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

module.exports = router;
