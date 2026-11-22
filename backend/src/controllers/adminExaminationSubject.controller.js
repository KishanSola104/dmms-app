const ExaminationSubjectService = require('../services/examinationSubject.service');

class AdminExaminationSubjectController {
  /**
   * GET /api/admin/examinations/:examinationId/classes/:classId/subjects
   * List all allocated subjects for a class in an exam, with their configuration status
   */
  static async getClassSubjectsForExam(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { examinationId, classId } = req.params;

      const result = await ExaminationSubjectService.getClassSubjectsForExam(
        schoolId,
        examinationId,
        classId
      );

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/examinations/:examinationId/classes/:classId/subjects/:subjectId/configure
   * Configure examination marks components for a subject
   */
  static async configureSubjectMarks(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const schoolRef = req.user?.schoolRef || req.school?._id;
      const { examinationId, classId, subjectId } = req.params;
      const { components } = req.body;

      const result = await ExaminationSubjectService.configureSubjectMarks(
        schoolId,
        schoolRef,
        {
          examinationId,
          classId,
          subjectId,
          components
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Examination marks components configured successfully.',
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/examinations/:examinationId/classes/:classId/subjects/:subjectId
   * Get single subject configuration
   */
  static async getSubjectConfiguration(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { examinationId, classId, subjectId } = req.params;

      const result = await ExaminationSubjectService.getSubjectConfiguration(
        schoolId,
        examinationId,
        classId,
        subjectId
      );

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/examinations/subjects/:examinationSubjectId
   * Remove subject marks configuration
   */
  static async removeSubjectConfiguration(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { examinationSubjectId } = req.params;

      const result = await ExaminationSubjectService.removeSubjectConfiguration(
        schoolId,
        examinationSubjectId
      );

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/examinations/:examinationId/classes/:classId/copy-from/:sourceClassId
   * Copy marks configuration from another class
   */
  static async copyClassConfiguration(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const schoolRef = req.user?.schoolRef || req.school?._id;
      const { examinationId, classId, sourceClassId } = req.params;

      const result = await ExaminationSubjectService.copyClassConfiguration(
        schoolId,
        schoolRef,
        examinationId,
        sourceClassId,
        classId
      );

      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminExaminationSubjectController;
