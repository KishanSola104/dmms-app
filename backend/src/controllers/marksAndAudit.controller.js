const MarksLockService = require('../services/marksLock.service');
const AuditLogService = require('../services/auditLog.service');

class MarksAndAuditController {
  static async getMarksLockOverview(req, res, next) {
    try {
      const {
        academicYearId,
        examinationId,
        classId,
        sectionId,
        subjectId,
        lockStatus
      } = req.query;

      const data = await MarksLockService.getLockOverview({
        user: req.user,
        academicYearId,
        examinationId,
        classId,
        sectionId,
        subjectId,
        lockStatus
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async updateMarksLockState(req, res, next) {
    try {
      const {
        action,
        academicYearId,
        examinationId,
        classId,
        sectionId,
        subjectId,
        entryType,
        reason
      } = req.body;

      const data = await MarksLockService.updateLockState({
        user: req.user,
        action,
        academicYearId,
        examinationId,
        classId,
        sectionId,
        subjectId,
        entryType,
        reason
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getAuditLogs(req, res, next) {
    try {
      const {
        userId,
        role,
        module,
        action,
        startDate,
        endDate,
        search,
        page,
        limit
      } = req.query;

      const data = await AuditLogService.queryLogs({
        viewer: req.user,
        userId,
        role,
        module,
        action,
        startDate,
        endDate,
        search,
        page,
        limit
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MarksAndAuditController;
