const ClassSectionService = require('../services/classSection.service');

class AdminClassSectionController {
  static async getEligibleTeachers(req, res, next) {
    try {
      const teachers = await ClassSectionService.getEligibleTeachers(req.user.schoolId);
      return res.json({ success: true, teachers });
    } catch (error) {
      next(error);
    }
  }

  // --- Classes ---
  static async listClasses(req, res, next) {
    try {
      const { search, status, page, limit } = req.query;
      const result = await ClassSectionService.listClasses({
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

  static async createClass(req, res, next) {
    try {
      const { classCode, className, classTeacherId, numberOfSections } = req.body;
      const result = await ClassSectionService.createClass({
        schoolId: req.user.schoolId,
        schoolRef: req.user.schoolRef,
        classCode,
        className,
        classTeacherId,
        numberOfSections
      });
      return res.status(201).json({
        success: true,
        message: 'Class created successfully.',
        class: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async editClass(req, res, next) {
    try {
      const { classId } = req.params;
      const { classCode, className, classTeacherId, numberOfSections } = req.body;
      const result = await ClassSectionService.editClass({
        schoolId: req.user.schoolId,
        classId,
        classCode,
        className,
        classTeacherId,
        numberOfSections
      });
      return res.json({
        success: true,
        message: 'Class updated successfully.',
        class: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleClassStatus(req, res, next) {
    try {
      const { classId } = req.params;
      const { status } = req.body;
      const result = await ClassSectionService.toggleClassStatus({
        schoolId: req.user.schoolId,
        classId,
        status
      });
      return res.json({
        success: true,
        message: `Class status updated to ${result.status}.`,
        class: result
      });
    } catch (error) {
      next(error);
    }
  }

  // --- Sections ---
  static async listSections(req, res, next) {
    try {
      const { search, classId, status, page, limit } = req.query;
      const result = await ClassSectionService.listSections({
        schoolId: req.user.schoolId,
        search,
        classId,
        status,
        page,
        limit
      });
      return res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async createSection(req, res, next) {
    try {
      const { classId, sectionCode, sectionName, sectionTeacherId, maxCapacity } = req.body;
      const result = await ClassSectionService.createSection({
        schoolId: req.user.schoolId,
        schoolRef: req.user.schoolRef,
        classId,
        sectionCode,
        sectionName,
        sectionTeacherId,
        maxCapacity
      });
      return res.status(201).json({
        success: true,
        message: 'Section created successfully.',
        section: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async editSection(req, res, next) {
    try {
      const { sectionId } = req.params;
      const { classId, sectionCode, sectionName, sectionTeacherId, maxCapacity } = req.body;
      const result = await ClassSectionService.editSection({
        schoolId: req.user.schoolId,
        sectionId,
        classId,
        sectionCode,
        sectionName,
        sectionTeacherId,
        maxCapacity
      });
      return res.json({
        success: true,
        message: 'Section updated successfully.',
        section: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleSectionStatus(req, res, next) {
    try {
      const { sectionId } = req.params;
      const { status } = req.body;
      const result = await ClassSectionService.toggleSectionStatus({
        schoolId: req.user.schoolId,
        sectionId,
        status
      });
      return res.json({
        success: true,
        message: `Section status updated to ${result.status}.`,
        section: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminClassSectionController;
