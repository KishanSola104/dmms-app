const SubjectService = require('../services/subject.service');

class AdminSubjectController {
  static async listSubjects(req, res, next) {
    try {
      const { search, type, status, page, limit } = req.query;
      const result = await SubjectService.listSubjects({
        schoolId: req.user.schoolId,
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

  static async createSubject(req, res, next) {
    try {
      const { subjectCode, subjectName, subjectType } = req.body;
      const result = await SubjectService.createSubject({
        schoolId: req.user.schoolId,
        schoolRef: req.user.schoolRef,
        subjectCode,
        subjectName,
        subjectType
      });
      return res.status(201).json({
        success: true,
        message: 'Subject created successfully.',
        subject: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async editSubject(req, res, next) {
    try {
      const { subjectId } = req.params;
      const { subjectCode, subjectName, subjectType } = req.body;
      const result = await SubjectService.editSubject({
        schoolId: req.user.schoolId,
        subjectId,
        subjectCode,
        subjectName,
        subjectType
      });
      return res.json({
        success: true,
        message: 'Subject updated successfully.',
        subject: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleSubjectStatus(req, res, next) {
    try {
      const { subjectId } = req.params;
      const { status } = req.body;
      const result = await SubjectService.toggleSubjectStatus({
        schoolId: req.user.schoolId,
        subjectId,
        status
      });
      return res.json({
        success: true,
        message: `Subject status updated to ${result.status}.`,
        subject: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminSubjectController;
