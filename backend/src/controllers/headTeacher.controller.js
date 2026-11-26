const HeadTeacherService = require('../services/headTeacher.service');
const HeadTeacherResultService = require('../services/headTeacherResult.service');
const HeadTeacherModule6Service = require('../services/headTeacherModule6.service');
const TeacherResultService = require('../services/teacherResult.service');

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

  // ==========================================
  // MODULE 4: EXAMINATION MANAGEMENT (READ-ONLY)
  // ==========================================
  static async listExaminations(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { academicYearId, examinationId, classId, status, search, page, limit } = req.query;

      const data = await HeadTeacherService.listExaminations({
        schoolId,
        academicYearId,
        examinationId,
        classId,
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

  static async getExaminationDetails(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { examinationId } = req.params;

      const data = await HeadTeacherService.getExaminationDetails({
        schoolId,
        examinationId
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getExaminationSchedule(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const {
        academicYearId,
        examinationId,
        classId,
        subjectId,
        dateFrom,
        dateTo,
        search,
        page,
        limit
      } = req.query;

      const data = await HeadTeacherService.getExaminationSchedule({
        schoolId,
        academicYearId,
        examinationId,
        classId,
        subjectId,
        dateFrom,
        dateTo,
        search,
        page,
        limit
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getSubjectConfigurations(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const {
        academicYearId,
        examinationId,
        classId,
        subjectId,
        configStatus,
        search,
        page,
        limit
      } = req.query;

      const data = await HeadTeacherService.getSubjectConfigurations({
        schoolId,
        academicYearId,
        examinationId,
        classId,
        subjectId,
        configStatus,
        search,
        page,
        limit
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getMarksEntryMonitoring(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const {
        academicYearId,
        examinationId,
        classId,
        subjectId,
        teacherId,
        submissionStatus,
        search,
        page,
        limit
      } = req.query;

      const data = await HeadTeacherService.getMarksEntryMonitoring({
        schoolId,
        academicYearId,
        examinationId,
        classId,
        subjectId,
        teacherId,
        submissionStatus,
        search,
        page,
        limit
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getMarksEntryMonitoringDetails(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const { examinationId, classId, sectionId, subjectId } = req.query;

      const data = await HeadTeacherService.getMarksEntryMonitoringDetails({
        schoolId,
        examinationId,
        classId,
        sectionId,
        subjectId
      });

      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // RESULT REVIEW, APPROVAL, RETURN & PUBLISHING
  // ==========================================
  static async listResultBatches(req, res, next) {
    try {
      const { academicYearId, type, examinationId, classId, status } = req.query;
      const data = await HeadTeacherResultService.listClassResultBatches({
        schoolId: req.user.schoolId,
        academicYearId,
        type: type || 'FINAL',
        examinationId,
        classId,
        status
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getResultBatchDetails(req, res, next) {
    try {
      const { academicYearId, type, examinationId, classId, sectionId } = req.query;
      const data = await HeadTeacherResultService.getClassResultDetails({
        schoolId: req.user.schoolId,
        academicYearId,
        type: type || 'FINAL',
        examinationId,
        classId,
        sectionId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async markResultUnderReview(req, res, next) {
    try {
      const { academicYearId, type, examinationId, classId, sectionId } = req.body;
      const data = await HeadTeacherResultService.markUnderReview({
        user: req.user,
        type: type || 'FINAL',
        academicYearId,
        examinationId,
        classId,
        sectionId
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async approveResultBatch(req, res, next) {
    try {
      const { academicYearId, type, examinationId, classId, sectionId } = req.body;
      const data = await HeadTeacherResultService.approveResults({
        user: req.user,
        type: type || 'FINAL',
        academicYearId,
        examinationId,
        classId,
        sectionId
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async returnResultBatch(req, res, next) {
    try {
      const { academicYearId, type, examinationId, classId, sectionId, reason } = req.body;
      const data = await HeadTeacherResultService.returnResults({
        user: req.user,
        type: type || 'FINAL',
        academicYearId,
        examinationId,
        classId,
        sectionId,
        reason
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async publishResultBatch(req, res, next) {
    try {
      const { academicYearId, type, examinationId, classId, sectionId } = req.body;
      const data = await HeadTeacherResultService.publishResults({
        user: req.user,
        type: type || 'FINAL',
        academicYearId,
        examinationId,
        classId,
        sectionId
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async downloadExaminationResultPdf(req, res, next) {
    try {
      const { buffer, fileName } = await TeacherResultService.generateTermResultPdf({
        user: req.user,
        resultId: req.params.resultId
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName || 'exam-result.pdf'}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async downloadFinalResultPdf(req, res, next) {
    try {
      const { buffer, fileName } = await TeacherResultService.generateFinalResultPdf({
        user: req.user,
        finalResultId: req.params.finalResultId
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName || 'final-result.pdf'}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // MODULE 6: ACADEMIC REPORTS & NOTIFICATIONS
  // ==========================================
  static async getAcademicReports(req, res, next) {
    try {
      const { academicYearId, examinationId, classId, sectionId, subjectId } = req.query;
      const data = await HeadTeacherModule6Service.getAcademicReports({
        schoolId: req.user.schoolId,
        academicYearId,
        examinationId,
        classId,
        sectionId,
        subjectId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async downloadAcademicReportPdf(req, res, next) {
    try {
      const {
        academicYearId,
        reportSection,
        examinationId,
        classId,
        sectionId,
        subjectId
      } = req.query;

      const { buffer, fileName } = await HeadTeacherModule6Service.generateAcademicReportPdf({
        user: req.user,
        academicYearId,
        reportSection,
        examinationId,
        classId,
        sectionId,
        subjectId
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'academic-report.pdf'}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async getNotifications(req, res, next) {
    try {
      const { type, unreadOnly, page, limit } = req.query;
      const data = await HeadTeacherModule6Service.getNotifications({
        user: req.user,
        type,
        unreadOnly,
        page,
        limit
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getNotificationRecipients(req, res, next) {
    try {
      const recipients = await HeadTeacherModule6Service.getNotificationRecipients(req.user.schoolId);
      return res.json({ success: true, recipients });
    } catch (error) {
      next(error);
    }
  }

  static async sendNotification(req, res, next) {
    try {
      const { title, message, type, recipientMode, targetRoleCode, targetUserIds } = req.body;
      const data = await HeadTeacherModule6Service.sendNotification({
        user: req.user,
        title,
        message,
        type,
        recipientMode,
        targetRoleCode,
        targetUserIds
      });
      return res.status(201).json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getSentNotificationsHistory(req, res, next) {
    try {
      const { page, limit } = req.query;
      const data = await HeadTeacherModule6Service.getSentNotificationsHistory({
        schoolId: req.user.schoolId,
        page,
        limit
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = HeadTeacherController;
