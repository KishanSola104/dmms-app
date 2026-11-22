const ClassSubjectService = require('../services/classSubject.service');

class AdminClassSubjectController {
  /**
   * List allocated subjects for class & academic year
   */
  static async listAllocations(req, res, next) {
    try {
      const { academicYearRef, classRef, search, type, status, page, limit } = req.query;
      const result = await ClassSubjectService.listAllocations({
        schoolId: req.user.schoolId,
        academicYearRef,
        classRef,
        search,
        type,
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
   * Get available subjects from school pool with allocation status
   */
  static async getAvailableSubjects(req, res, next) {
    try {
      const { academicYearRef, classRef } = req.query;
      const subjects = await ClassSubjectService.getAvailableSubjectsForClass({
        schoolId: req.user.schoolId,
        academicYearRef,
        classRef
      });
      return res.json({ success: true, subjects });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Allocate subjects to class
   */
  static async allocateSubjects(req, res, next) {
    try {
      const { academicYearRef, classRef, allocations } = req.body;
      const result = await ClassSubjectService.allocateSubjects({
        schoolId: req.user.schoolId,
        schoolRef: req.user.schoolRef,
        academicYearRef,
        classRef,
        allocations
      });
      return res.status(201).json({
        success: true,
        message: `${result.length} subject(s) successfully allocated.`,
        allocations: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an existing subject allocation (e.g. additional components)
   */
  static async updateAllocation(req, res, next) {
    try {
      const { allocationId } = req.params;
      const { hasAdditionalComponents, additionalComponents } = req.body;
      const result = await ClassSubjectService.updateAllocation({
        schoolId: req.user.schoolId,
        allocationId,
        hasAdditionalComponents,
        additionalComponents
      });
      return res.json({
        success: true,
        message: 'Subject allocation updated successfully.',
        allocation: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle allocation status
   */
  static async toggleAllocationStatus(req, res, next) {
    try {
      const { allocationId } = req.params;
      const { status } = req.body;
      const result = await ClassSubjectService.toggleAllocationStatus({
        schoolId: req.user.schoolId,
        allocationId,
        status
      });
      return res.json({
        success: true,
        message: `Subject allocation status changed to ${result.status}.`,
        allocation: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminClassSubjectController;
