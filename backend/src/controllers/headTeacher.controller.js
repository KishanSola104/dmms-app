const HeadTeacherService = require('../services/headTeacher.service');

class HeadTeacherController {
  // ==========================================
  // DASHBOARD
  // ==========================================
  static async getDashboardStats(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { academicYearId } = req.query;

      const data = await HeadTeacherService.getDashboardStats({
        schoolId,
        academicYearId
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PHASE 1: CLASSES & SECTIONS
  // ==========================================
  static async listClasses(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { academicYearId, search, status, page, limit } = req.query;

      const data = await HeadTeacherService.listClasses({
        schoolId,
        academicYearId,
        search,
        status,
        page,
        limit
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getClassDetails(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { classId } = req.params;
      const { academicYearId } = req.query;

      const data = await HeadTeacherService.getClassDetails({
        schoolId,
        classId,
        academicYearId
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getSectionDetails(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { classId, sectionId } = req.params;
      const { academicYearId } = req.query;

      const data = await HeadTeacherService.getSectionDetails({
        schoolId,
        classId,
        sectionId,
        academicYearId
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PHASE 2: SUBJECT OVERVIEW
  // ==========================================
  static async listSubjects(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { search, type, status, page, limit } = req.query;

      const data = await HeadTeacherService.listSubjects({
        schoolId,
        search,
        type,
        status,
        page,
        limit
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getSubjectDetails(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { subjectId } = req.params;
      const { academicYearId } = req.query;

      const data = await HeadTeacherService.getSubjectDetails({
        schoolId,
        subjectId,
        academicYearId
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getClassSubjectAllocations(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { academicYearId, classId } = req.query;

      const data = await HeadTeacherService.getClassSubjectAllocations({
        schoolId,
        academicYearId,
        classId
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PHASE 3: TEACHER OVERVIEW
  // ==========================================
  static async listTeachers(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { academicYearId, search, classId, sectionId, subjectId, status, page, limit } = req.query;

      const data = await HeadTeacherService.listTeachers({
        schoolId,
        academicYearId,
        search,
        classId,
        sectionId,
        subjectId,
        status,
        page,
        limit
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getTeacherProfile(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { teacherUserId } = req.params;
      const { academicYearId } = req.query;

      const data = await HeadTeacherService.getTeacherProfile({
        schoolId,
        teacherUserId,
        academicYearId
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PHASE 4: TEACHER ASSIGNMENTS
  // ==========================================
  static async listTeacherAssignments(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { academicYearId, classId, sectionId, subjectId, teacherId, status, search, page, limit } = req.query;

      const data = await HeadTeacherService.listTeacherAssignments({
        schoolId,
        academicYearId,
        classId,
        sectionId,
        subjectId,
        teacherId,
        status,
        search,
        page,
        limit
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getAssignmentDetails(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { assignmentId } = req.params;

      const data = await HeadTeacherService.getAssignmentDetails({
        schoolId,
        assignmentId
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // MODULE 2: STUDENT OVERVIEW - PHASE 1
  // ==========================================
  static async listStudents(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const {
        academicYearId,
        classId,
        sectionId,
        gender,
        enrollmentStatus,
        status,
        search,
        page,
        limit
      } = req.query;

      const data = await HeadTeacherService.listStudents({
        schoolId,
        academicYearId,
        classId,
        sectionId,
        gender,
        enrollmentStatus: enrollmentStatus || status,
        search,
        page,
        limit
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // MODULE 2: STUDENT OVERVIEW - PHASE 2
  // ==========================================
  static async getStudentProfile(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { studentId } = req.params;
      const { academicYearId } = req.query;

      const data = await HeadTeacherService.getStudentProfile({
        schoolId,
        studentId,
        academicYearId
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // MODULE 2: STUDENT OVERVIEW - PHASE 3
  // ==========================================
  static async getStudentPerformance(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { studentId } = req.params;
      const { academicYearId } = req.query;

      const data = await HeadTeacherService.getStudentPerformance({
        schoolId,
        studentId,
        academicYearId
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = HeadTeacherController;
