const ExaminationService = require('../services/examination.service');

class AdminExaminationController {
  /**
   * List examinations with search, status filter, and pagination
   */
  static async listExaminations(req, res, next) {
    try {
      const { academicYearRef, search, status, page, limit } = req.query;
      const result = await ExaminationService.listExaminations({
        schoolId: req.user.schoolId,
        academicYearRef,
        search,
        status,
        page,
        limit
      });
      return res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single examination details
   */
  static async getExaminationById(req, res, next) {
    try {
      const { examinationId } = req.params;
      const exam = await ExaminationService.getExaminationById({
        schoolId: req.user.schoolId,
        examinationId
      });
      return res.json({ success: true, examination: exam });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create an examination with assigned classes
   */
  static async createExamination(req, res, next) {
    try {
      const {
        academicYearRef,
        examinationCode,
        examinationName,
        description,
        startDate,
        endDate,
        status,
        classIds
      } = req.body;

      const result = await ExaminationService.createExamination({
        schoolId: req.user.schoolId,
        schoolRef: req.user.schoolRef,
        academicYearRef,
        examinationCode,
        examinationName,
        description,
        startDate,
        endDate,
        status,
        classIds
      });

      return res.status(201).json({
        success: true,
        message: 'Examination created and assigned to classes successfully.',
        examination: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Edit an examination and sync assigned classes
   */
  static async editExamination(req, res, next) {
    try {
      const { examinationId } = req.params;
      const {
        examinationCode,
        examinationName,
        description,
        startDate,
        endDate,
        status,
        classIds
      } = req.body;

      const result = await ExaminationService.editExamination({
        schoolId: req.user.schoolId,
        schoolRef: req.user.schoolRef,
        examinationId,
        examinationCode,
        examinationName,
        description,
        startDate,
        endDate,
        status,
        classIds
      });

      return res.json({
        success: true,
        message: 'Examination updated successfully.',
        examination: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle examination status
   */
  static async toggleExaminationStatus(req, res, next) {
    try {
      const { examinationId } = req.params;
      const { status } = req.body;

      const result = await ExaminationService.toggleExaminationStatus({
        schoolId: req.user.schoolId,
        examinationId,
        status
      });

      return res.json({
        success: true,
        message: `Examination status updated to ${result.status}.`,
        examination: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get assigned classes for an examination
   */
  static async getAssignedClasses(req, res, next) {
    try {
      const { examinationId } = req.params;
      const classes = await ExaminationService.getAssignedClassesForExamination({
        schoolId: req.user.schoolId,
        examinationId
      });
      return res.json({ success: true, classes });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminExaminationController;
