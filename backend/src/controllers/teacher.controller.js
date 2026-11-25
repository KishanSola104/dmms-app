const TeacherService = require('../services/teacher.service');
const TeacherMarksService = require('../services/teacherMarks.service');
const TeacherResultService = require('../services/teacherResult.service');

class TeacherController {
  // ==========================================
  // DASHBOARD & ASSIGNMENTS
  // ==========================================
  static async getDashboard(req, res, next) {
    try {
      const data = await TeacherService.getDashboardData({
        user: req.user,
        academicYearId: req.query.academicYearId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getMyClasses(req, res, next) {
    try {
      const data = await TeacherService.getMyClassesAndAssignments({
        user: req.user,
        academicYearId: req.query.academicYearId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getSectionStudents(req, res, next) {
    try {
      const { classId, sectionId } = req.params;
      const data = await TeacherService.getAuthorizedSectionStudents({
        user: req.user,
        academicYearId: req.query.academicYearId,
        classId,
        sectionId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getResultConfig(req, res, next) {
    try {
      const config = await TeacherService.getResultConfig(req.user.schoolId);
      return res.json({ success: true, config });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // MARKS MANAGEMENT (ENTRY, SUBMITTED, EXTRA, CO-CURRICULAR)
  // ==========================================
  static async getSelectionOptions(req, res, next) {
    try {
      const { academicYearId, mode } = req.query;
      const data = await TeacherMarksService.getAuthorizedSelectionOptions({
        user: req.user,
        academicYearId,
        mode: mode || 'EXAM_ACADEMIC'
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getMarksSheet(req, res, next) {
    try {
      const { academicYearId, examinationId, classId, sectionId, subjectId, entryType } = req.query;
      const data = await TeacherMarksService.getMarksEntrySheet({
        user: req.user,
        academicYearId,
        examinationId: examinationId || null,
        classId,
        sectionId,
        subjectId,
        entryType: entryType || 'EXAM_ACADEMIC'
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async saveOrSubmitMarks(req, res, next) {
    try {
      const { academicYearId, examinationId, classId, sectionId, subjectId, entryType, action, entries } = req.body;
      const data = await TeacherMarksService.saveOrSubmitMarks({
        user: req.user,
        academicYearId,
        examinationId: examinationId || null,
        classId,
        sectionId,
        subjectId,
        entryType: entryType || 'EXAM_ACADEMIC',
        action: action || 'DRAFT',
        entries: entries || []
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getSubmittedMarks(req, res, next) {
    try {
      const { academicYearId, examinationId, status, entryType } = req.query;
      const data = await TeacherMarksService.getMySubmittedMarks({
        user: req.user,
        academicYearId,
        examinationId,
        status,
        entryType
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getSubmissionDetails(req, res, next) {
    try {
      const data = await TeacherMarksService.getSubmissionDetails({
        user: req.user,
        submissionId: req.params.submissionId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // CLASS TEACHER: MARKS VERIFICATION
  // ==========================================
  static async getVerificationOverview(req, res, next) {
    try {
      const { academicYearId, examinationId, classId, sectionId } = req.query;
      const data = await TeacherMarksService.getClassTeacherVerificationOverview({
        user: req.user,
        academicYearId,
        examinationId,
        classId,
        sectionId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async verifySubmission(req, res, next) {
    try {
      const data = await TeacherMarksService.verifySubmission({
        user: req.user,
        submissionId: req.params.submissionId
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async returnSubmission(req, res, next) {
    try {
      const data = await TeacherMarksService.returnSubmissionForCorrection({
        user: req.user,
        submissionId: req.params.submissionId,
        reason: req.body.reason
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async requestFinalCoCurricularGrades(req, res, next) {
    try {
      const { academicYearId, classId, sectionId } = req.body;
      const data = await TeacherMarksService.requestFinalCoCurricularGrades({
        user: req.user,
        academicYearId,
        classId,
        sectionId
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // CLASS TEACHER: EXAMINATION & FINAL RESULTS
  // ==========================================
  static async getExaminationResultsContext(req, res, next) {
    try {
      const { academicYearId, examinationId, classId, sectionId } = req.query;
      const data = await TeacherResultService.getExaminationResultsContext({
        user: req.user,
        academicYearId,
        examinationId,
        classId,
        sectionId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async generateExaminationResults(req, res, next) {
    try {
      const { academicYearId, examinationId, classId, sectionId } = req.body;
      const data = await TeacherResultService.generateExaminationResults({
        user: req.user,
        academicYearId,
        examinationId,
        classId,
        sectionId
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async updateTermRemark(req, res, next) {
    try {
      const { termRemark, approve, suggestOnly } = req.body;
      const data = await TeacherResultService.updateOrSuggestTermRemark({
        user: req.user,
        resultId: req.params.resultId,
        termRemark,
        approve,
        suggestOnly
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async submitExaminationResults(req, res, next) {
    try {
      const { academicYearId, examinationId, classId, sectionId } = req.body;
      const data = await TeacherResultService.submitExaminationResultsToHeadTeacher({
        user: req.user,
        academicYearId,
        examinationId,
        classId,
        sectionId
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async downloadTermResultPdf(req, res, next) {
    try {
      const { buffer, fileName } = await TeacherResultService.generateTermResultPdf({
        user: req.user,
        resultId: req.params.resultId
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async getFinalResultContext(req, res, next) {
    try {
      const { academicYearId, classId, sectionId } = req.query;
      const data = await TeacherResultService.getFinalResultContext({
        user: req.user,
        academicYearId,
        classId,
        sectionId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async generateFinalResults(req, res, next) {
    try {
      const { academicYearId, classId, sectionId } = req.body;
      const data = await TeacherResultService.generateFinalResults({
        user: req.user,
        academicYearId,
        classId,
        sectionId
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async updateFinalRemark(req, res, next) {
    try {
      const { finalRemark, approve, suggestOnly } = req.body;
      const data = await TeacherResultService.updateOrSuggestFinalRemark({
        user: req.user,
        finalResultId: req.params.finalResultId,
        finalRemark,
        approve,
        suggestOnly
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async submitFinalResults(req, res, next) {
    try {
      const { academicYearId, classId, sectionId } = req.body;
      const data = await TeacherResultService.submitFinalResultsToHeadTeacher({
        user: req.user,
        academicYearId,
        classId,
        sectionId
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async downloadFinalResultPdf(req, res, next) {
    try {
      const { buffer, fileName } = await TeacherResultService.generateFinalResultPdf({
        user: req.user,
        finalResultId: req.params.finalResultId
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // RESULT & PERFORMANCE ANALYTICS
  // ==========================================
  static async getResultAndPerformance(req, res, next) {
    try {
      const { academicYearId, examinationId, classId, sectionId, subjectId } = req.query;
      const data = await TeacherResultService.getResultAndPerformanceAnalytics({
        user: req.user,
        academicYearId,
        examinationId,
        classId,
        sectionId,
        subjectId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TeacherController;
