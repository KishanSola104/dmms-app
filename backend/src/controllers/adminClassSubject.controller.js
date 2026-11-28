const ClassSubjectService = require('../services/classSubject.service');
const AuditLogService = require('../services/auditLog.service');

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
      await AuditLogService.log({
        schoolRef: req.user.schoolRef,
        schoolId: req.user.schoolId,
        academicYearRef,
        classRef,
        module: 'ACADEMIC',
        entityType: 'ClassSubjectInfo',
        entityId: classRef,
        action: 'SUBJECTS_ALLOCATED',
        details: `Allocated ${result.length} subject(s) to class`,
        newValue: { count: result.length },
        user: req.user
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
      await AuditLogService.log({
        schoolRef: req.user.schoolRef,
        schoolId: req.user.schoolId,
        academicYearRef: result.academicYearRef,
        classRef: result.classRef,
        subjectRef: result.subjectRef,
        module: 'ACADEMIC',
        entityType: 'ClassSubjectInfo',
        entityId: result._id.toString(),
        action: 'SUBJECT_ALLOCATION_UPDATED',
        details: `Updated subject allocation for ${result.subjectName}`,
        user: req.user
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
   * Toggle allocation status (ACTIVE / INACTIVE)
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

      await AuditLogService.log({
        schoolRef: req.user.schoolRef,
        schoolId: req.user.schoolId,
        academicYearRef: result.academicYearRef,
        classRef: result.classRef,
        subjectRef: result.subjectRef,
        module: 'ACADEMIC',
        entityType: 'ClassSubjectInfo',
        entityId: result._id.toString(),
        action: result.status === 'INACTIVE' ? 'CLASS_SUBJECT_DEALLOCATED' : 'CLASS_SUBJECT_REACTIVATED',
        details: `${result.status === 'INACTIVE' ? 'Deallocated' : 'Reactivated'} subject ${result.subjectName} (${result.subjectCode}) for class`,
        newValue: { status: result.status },
        user: req.user
      });

      return res.json({
        success: true,
        message:
          result.status === 'INACTIVE'
            ? `Subject '${result.subjectName}' deallocated from this class for the selected academic year. Historical marks and results are preserved.`
            : `Subject '${result.subjectName}' re-allocated to this class.`,
        allocation: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Explicitly deallocate a subject from a class for the selected academic year
   */
  static async deallocateAllocation(req, res, next) {
    try {
      const { allocationId } = req.params;
      const result = await ClassSubjectService.deallocateAllocation({
        schoolId: req.user.schoolId,
        allocationId
      });

      await AuditLogService.log({
        schoolRef: req.user.schoolRef,
        schoolId: req.user.schoolId,
        academicYearRef: result.academicYearRef,
        classRef: result.classRef,
        subjectRef: result.subjectRef,
        module: 'ACADEMIC',
        entityType: 'ClassSubjectInfo',
        entityId: result._id.toString(),
        action: 'CLASS_SUBJECT_DEALLOCATED',
        details: `Deallocated subject ${result.subjectName} (${result.subjectCode}) from class while preserving historical records`,
        previousValue: { status: 'ACTIVE' },
        newValue: { status: 'INACTIVE' },
        user: req.user
      });

      return res.json({
        success: true,
        message: `Subject '${result.subjectName}' deallocated from this class for the selected academic year. Historical marks and results are preserved.`,
        allocation: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminClassSubjectController;
