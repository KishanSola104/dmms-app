const SubjectTeacherAssignmentService = require('../services/subjectTeacherAssignment.service');

class AdminTeacherAssignmentController {
  /**
   * Get eligible sections, allocated subjects, and eligible teachers
   */
  static async getEligibleOptions(req, res, next) {
    try {
      const { academicYearRef, classRef } = req.query;
      const data = await SubjectTeacherAssignmentService.getEligibleOptions({
        schoolId: req.user.schoolId,
        academicYearRef,
        classRef
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List teacher assignments
   */
  static async listAssignments(req, res, next) {
    try {
      const {
        academicYearRef,
        classRef,
        sectionRef,
        subjectRef,
        teacherId,
        status,
        search,
        page,
        limit
      } = req.query;

      const result = await SubjectTeacherAssignmentService.listAssignments({
        schoolId: req.user.schoolId,
        academicYearRef,
        classRef,
        sectionRef,
        subjectRef,
        teacherId,
        status,
        search,
        page,
        limit
      });

      return res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Assign a teacher
   */
  static async assignTeacher(req, res, next) {
    try {
      const {
        academicYearRef,
        classRef,
        sectionRef,
        classSubjectRef,
        teacherEmployeeId
      } = req.body;

      const result = await SubjectTeacherAssignmentService.assignTeacher({
        schoolId: req.user.schoolId,
        schoolRef: req.user.schoolRef,
        academicYearRef,
        classRef,
        sectionRef,
        classSubjectRef,
        teacherEmployeeId,
        actorUser: req.user
      });

      return res.status(201).json({
        success: true,
        message: 'Teacher assigned successfully.',
        assignment: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reassign a teacher
   */
  static async reassignTeacher(req, res, next) {
    try {
      const { assignmentId } = req.params;
      const { newTeacherEmployeeId } = req.body;

      const result = await SubjectTeacherAssignmentService.reassignTeacher({
        schoolId: req.user.schoolId,
        assignmentId,
        newTeacherEmployeeId,
        actorUser: req.user
      });

      return res.json({
        success: true,
        message: 'Teacher reassigned successfully.',
        assignment: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle assignment status
   */
  static async toggleAssignmentStatus(req, res, next) {
    try {
      const { assignmentId } = req.params;
      const { status } = req.body;

      const result = await SubjectTeacherAssignmentService.toggleAssignmentStatus({
        schoolId: req.user.schoolId,
        assignmentId,
        status,
        actorUser: req.user
      });

      return res.json({
        success: true,
        message: `Teacher assignment status updated to ${result.status}.`,
        assignment: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Explicitly deallocate a teacher's subject assignment safely
   */
  static async deallocateAssignment(req, res, next) {
    try {
      const { assignmentId } = req.params;
      const { reason } = req.body || {};

      const result = await SubjectTeacherAssignmentService.deallocateAssignment({
        schoolId: req.user.schoolId,
        assignmentId,
        reason,
        actorUser: req.user
      });

      return res.json({
        success: true,
        message: `Deallocated ${result.subjectName} from ${result.teacherName} while preserving all historical marks and results.`,
        assignment: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminTeacherAssignmentController;
