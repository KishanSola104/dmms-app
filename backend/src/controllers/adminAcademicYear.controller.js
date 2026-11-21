const AcademicYearService = require('../services/academicYear.service');

class AdminAcademicYearController {
  static async listAcademicYears(req, res, next) {
    try {
      const { search, status, page, limit } = req.query;
      const result = await AcademicYearService.listAcademicYears({
        schoolId: req.user.schoolId,
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

  static async createAcademicYear(req, res, next) {
    try {
      const { yearName, startDate, endDate, isCurrent } = req.body;
      const result = await AcademicYearService.createAcademicYear({
        schoolId: req.user.schoolId,
        schoolRef: req.user.schoolRef,
        yearName,
        startDate,
        endDate,
        isCurrent: Boolean(isCurrent)
      });
      return res.status(201).json({
        success: true,
        message: 'Academic Year created successfully.',
        academicYear: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async editAcademicYear(req, res, next) {
    try {
      const { yearId } = req.params;
      const { yearName, startDate, endDate, isCurrent } = req.body;
      const result = await AcademicYearService.editAcademicYear({
        schoolId: req.user.schoolId,
        yearId,
        yearName,
        startDate,
        endDate,
        isCurrent
      });
      return res.json({
        success: true,
        message: 'Academic Year updated successfully.',
        academicYear: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async setAsCurrent(req, res, next) {
    try {
      const { yearId } = req.params;
      const result = await AcademicYearService.setAsCurrent({
        schoolId: req.user.schoolId,
        yearId
      });
      return res.json({
        success: true,
        message: `Academic year '${result.yearName}' is now set as the Current Academic Year.`,
        academicYear: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminAcademicYearController;
