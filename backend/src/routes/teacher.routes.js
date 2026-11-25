const express = require('express');
const router = express.Router();
const TeacherController = require('../controllers/teacher.controller');
const { verifyUserAuth, authorizeTeacherAccess } = require('../middlewares/auth.middleware');

// Enforce authentication & assignment-based Teacher Panel access
// Allows TEACHER role and HEAD_TEACHER with active teaching/class-teacher assignments
router.use(verifyUserAuth, authorizeTeacherAccess);

// Dashboard & Assignments
router.get('/dashboard', TeacherController.getDashboard);
router.get('/my-classes', TeacherController.getMyClasses);
router.get('/classes/:classId/sections/:sectionId/students', TeacherController.getSectionStudents);
router.get('/result-config', TeacherController.getResultConfig);

// Marks Management (Marks Entry, Submitted Marks, Extra Components, Co-curricular Grades)
router.get('/marks/options', TeacherController.getSelectionOptions);
router.get('/marks/sheet', TeacherController.getMarksSheet);
router.post('/marks/save', TeacherController.saveOrSubmitMarks);
router.get('/marks/submitted', TeacherController.getSubmittedMarks);
router.get('/marks/submissions/:submissionId', TeacherController.getSubmissionDetails);

// Class Teacher: Marks Verification
router.get('/verification/overview', TeacherController.getVerificationOverview);
router.post('/verification/:submissionId/verify', TeacherController.verifySubmission);
router.post('/verification/:submissionId/return', TeacherController.returnSubmission);
router.post('/co-curricular/request-final', TeacherController.requestFinalCoCurricularGrades);

// Class Teacher: Examination Results
router.get('/examination-results', TeacherController.getExaminationResultsContext);
router.post('/examination-results/generate', TeacherController.generateExaminationResults);
router.put('/examination-results/:resultId/remark', TeacherController.updateTermRemark);
router.post('/examination-results/submit', TeacherController.submitExaminationResults);
router.get('/examination-results/:resultId/pdf', TeacherController.downloadTermResultPdf);

// Class Teacher: Final Academic Result
router.get('/final-results', TeacherController.getFinalResultContext);
router.post('/final-results/generate', TeacherController.generateFinalResults);
router.put('/final-results/:finalResultId/remark', TeacherController.updateFinalRemark);
router.post('/final-results/submit', TeacherController.submitFinalResults);
router.get('/final-results/:finalResultId/pdf', TeacherController.downloadFinalResultPdf);

// Result & Performance Analytics
router.get('/performance', TeacherController.getResultAndPerformance);

module.exports = router;
