const StudentService = require('../services/student.service');
const AuditLogService = require('../services/auditLog.service');

class AdminStudentController {
  /**
   * GET /api/admin/students/next-admission-number
   * Retrieve the next automatically generated admission number
   */
  static async getNextAdmissionNumber(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const nextAdmissionNumber = await StudentService.generateAdmissionNumber(schoolId);

      return res.status(200).json({
        success: true,
        nextAdmissionNumber
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/students/next-roll-number
   * Retrieve the next sequential roll number for a section and academic year
   */
  static async getNextRollNumber(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { academicYearRef, classRef, sectionRef } = req.query;

      if (!academicYearRef || !classRef || !sectionRef) {
        return res.status(400).json({
          success: false,
          message: 'academicYearRef, classRef, and sectionRef are required query parameters.'
        });
      }

      const nextRollNumber = await StudentService.getNextRollNumber(
        schoolId,
        academicYearRef,
        classRef,
        sectionRef
      );

      return res.status(200).json({
        success: true,
        nextRollNumber
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/students/admission
   * Admit a new student into the school with initial enrollment
   */
  static async admitStudent(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const schoolRef = req.user?.schoolRef || req.school?._id;
      const userId = req.user?._id;

      const result = await StudentService.admitStudent(
        schoolId,
        schoolRef,
        userId,
        req.body
      );

      await AuditLogService.log({
        schoolRef,
        schoolId,
        academicYearRef: result.enrollment?.academicYearRef || null,
        classRef: result.enrollment?.classRef || null,
        sectionRef: result.enrollment?.sectionRef || null,
        module: 'STUDENTS',
        entityType: 'StudentInfo',
        entityId: result.student.admissionNumber,
        action: 'STUDENT_ADMITTED',
        details: `Admitted student '${result.student.firstName} ${result.student.lastName}' (${result.student.admissionNumber})`,
        newValue: { admissionNumber: result.student.admissionNumber, name: `${result.student.firstName} ${result.student.lastName}` },
        user: req.user
      });

      return res.status(201).json({
        success: true,
        message: `Student '${result.student.firstName} ${result.student.lastName}' (Admission No: ${result.student.admissionNumber}) admitted successfully.`,
        student: result.student,
        enrollment: result.enrollment
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/students/upload-photo
   * Upload student profile photograph
   */
  static async uploadPhoto(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No photo file uploaded.'
        });
      }

      const photoUrl = `/uploads/profiles/${req.file.filename}`;
      return res.status(200).json({
        success: true,
        message: 'Photo uploaded successfully.',
        photoUrl
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/students
   * List students with academic year placement, search, filters & pagination
   */
  static async listStudents(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const {
        academicYearId,
        academicYearRef,
        classId,
        classRef,
        sectionId,
        sectionRef,
        status,
        gender,
        search,
        page,
        limit
      } = req.query;

      const result = await StudentService.listStudents({
        schoolId,
        academicYearRef: academicYearRef || academicYearId,
        classRef: classRef || classId,
        sectionRef: sectionRef || sectionId,
        status,
        gender,
        search,
        page,
        limit
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/students/:studentId
   * Retrieve single student complete profile and academic history
   */
  static async getStudentById(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { studentId } = req.params;
      const { academicYearRef, academicYearId } = req.query;

      const result = await StudentService.getStudentById(
        schoolId,
        studentId,
        academicYearRef || academicYearId
      );

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/students/:studentId
   * Update student master details (personal, contact, guardians, photo)
   */
  static async updateStudent(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { studentId } = req.params;

      const updated = await StudentService.updateStudent(
        schoolId,
        studentId,
        req.body
      );

      await AuditLogService.log({
        schoolRef: req.user.schoolRef,
        schoolId,
        module: 'STUDENTS',
        entityType: 'StudentInfo',
        entityId: updated.admissionNumber || studentId,
        action: 'STUDENT_UPDATED',
        details: `Updated student '${updated.firstName} ${updated.lastName}' (${updated.admissionNumber || studentId})`,
        user: req.user
      });

      return res.status(200).json({
        success: true,
        message: `Student '${updated.firstName} ${updated.lastName}' details updated successfully.`,
        student: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/admin/students/:studentId/status
   * Toggle student master status (ACTIVE / INACTIVE / TRANSFERRED / ALUMNI)
   */
  static async toggleStudentStatus(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { studentId } = req.params;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required.'
        });
      }

      const result = await StudentService.toggleStudentStatus(
        schoolId,
        studentId,
        status
      );

      await AuditLogService.log({
        schoolRef: req.user.schoolRef,
        schoolId,
        module: 'STUDENTS',
        entityType: 'StudentInfo',
        entityId: result.admissionNumber || studentId,
        action: 'STUDENT_STATUS_UPDATED',
        details: `Updated student '${result.admissionNumber || studentId}' status to ${result.status}`,
        newValue: { status: result.status },
        user: req.user
      });

      return res.status(200).json({
        success: true,
        message: `Student status updated to ${result.status}.`,
        student: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/enrollments
   * Section enrollment summary with capacity metrics and student list
   */
  static async getSectionEnrollmentSummary(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { academicYearRef, academicYearId, classRef, classId, sectionRef, sectionId } = req.query;

      const result = await StudentService.getSectionEnrollmentSummary({
        schoolId,
        academicYearRef: academicYearRef || academicYearId,
        classRef: classRef || classId,
        sectionRef: sectionRef || sectionId
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/enrollments/unenrolled
   * Get list of active students in school who have no enrollment in the given academic year
   */
  static async getUnenrolledStudents(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { academicYearRef, academicYearId, search } = req.query;

      const students = await StudentService.getUnenrolledStudents({
        schoolId,
        academicYearRef: academicYearRef || academicYearId,
        search
      });

      return res.status(200).json({
        success: true,
        students
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/enrollments
   * Enroll an existing student in an academic year
   */
  static async enrollStudent(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const schoolRef = req.user?.schoolRef || req.school?._id;
      const userId = req.user?._id;

      const {
        studentId,
        academicYearRef,
        academicYearId,
        classRef,
        classId,
        sectionRef,
        sectionId,
        rollNumber,
        enrollmentDate,
        remarks
      } = req.body;

      const result = await StudentService.enrollStudent({
        schoolId,
        schoolRef,
        userId,
        studentId,
        academicYearRef: academicYearRef || academicYearId,
        classRef: classRef || classId,
        sectionRef: sectionRef || sectionId,
        rollNumber,
        enrollmentDate,
        remarks
      });

      await AuditLogService.log({
        schoolRef,
        schoolId,
        academicYearRef: academicYearRef || academicYearId || null,
        classRef: classRef || classId || null,
        sectionRef: sectionRef || sectionId || null,
        module: 'STUDENTS',
        entityType: 'StudentEnrollmentInfo',
        entityId: result.enrollment?._id?.toString() || studentId,
        action: 'STUDENT_ENROLLED',
        details: `Enrolled student '${studentId}' into ${result.enrollment?.className || ''} - ${result.enrollment?.sectionName || ''}`,
        user: req.user
      });

      return res.status(201).json({
        success: true,
        message: 'Student enrolled successfully.',
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/admin/enrollments/:enrollmentId
   * Update enrollment roll number, status, or remarks
   */
  static async updateEnrollment(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { enrollmentId } = req.params;
      const { rollNumber, remarks, status } = req.body;

      const updated = await StudentService.updateEnrollment({
        schoolId,
        enrollmentId,
        rollNumber,
        remarks,
        status
      });

      return res.status(200).json({
        success: true,
        message: 'Enrollment updated successfully.',
        enrollment: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/enrollments/:enrollmentId/transfer
   * Same-year section or class transfer with audit log
   */
  static async transferStudentSection(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const userId = req.user?._id;
      const { enrollmentId } = req.params;
      const { newClassRef, newClassId, newSectionRef, newSectionId, newRollNumber, remarks } = req.body;

      const result = await StudentService.transferStudentSection({
        schoolId,
        userId,
        enrollmentId,
        newClassRef: newClassRef || newClassId,
        newSectionRef: newSectionRef || newSectionId,
        newRollNumber,
        remarks
      });

      await AuditLogService.log({
        schoolRef: req.user.schoolRef,
        schoolId,
        academicYearRef: result.enrollment?.academicYearRef || null,
        classRef: result.enrollment?.classRef || null,
        sectionRef: result.enrollment?.sectionRef || null,
        module: 'STUDENTS',
        entityType: 'StudentEnrollmentInfo',
        entityId: enrollmentId,
        action: 'STUDENT_TRANSFERRED',
        details: `Transferred student to ${result.enrollment.className} - ${result.enrollment.sectionName}`,
        newValue: { className: result.enrollment.className, sectionName: result.enrollment.sectionName, rollNumber: result.enrollment.rollNumber },
        user: req.user
      });

      return res.status(200).json({
        success: true,
        message: `Student transferred successfully to ${result.enrollment.className} - ${result.enrollment.sectionName}.`,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/promotions/source-students
   * Load students from previous academic year and class/section for promotion
   */
  static async getSourceStudentsForPromotion(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const {
        previousAcademicYearRef,
        previousAcademicYearId,
        nextAcademicYearRef,
        nextAcademicYearId,
        classRef,
        classId,
        sectionRef,
        sectionId
      } = req.query;

      const result = await StudentService.getSourceStudentsForPromotion({
        schoolId,
        previousAcademicYearRef: previousAcademicYearRef || previousAcademicYearId,
        nextAcademicYearRef: nextAcademicYearRef || nextAcademicYearId,
        classRef: classRef || classId,
        sectionRef: sectionRef || sectionId
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/promotions/preview-distribution
   * Compute balanced section distribution & sequential roll numbers preview
   */
  static async previewPromotionDistribution(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const {
        nextAcademicYearRef,
        nextAcademicYearId,
        destinationClassRef,
        destinationClassId,
        targetSectionRefs,
        students,
        rollNumberMethod
      } = req.body;

      const result = await StudentService.previewPromotionDistribution({
        schoolId,
        nextAcademicYearRef: nextAcademicYearRef || nextAcademicYearId,
        destinationClassRef: destinationClassRef || destinationClassId,
        targetSectionRefs,
        students,
        rollNumberMethod
      });

      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/promotions/execute
   * Execute batch or individual student promotions / repetition
   */
  static async executePromotions(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const schoolRef = req.user?.schoolRef || req.school?._id;
      const userId = req.user?._id;

      const {
        previousAcademicYearRef,
        previousAcademicYearId,
        nextAcademicYearRef,
        nextAcademicYearId,
        promotions
      } = req.body;

      const result = await StudentService.executePromotions({
        schoolId,
        schoolRef,
        userId,
        previousAcademicYearRef: previousAcademicYearRef || previousAcademicYearId,
        nextAcademicYearRef: nextAcademicYearRef || nextAcademicYearId,
        promotions
      });

      await AuditLogService.log({
        schoolRef,
        schoolId,
        academicYearRef: nextAcademicYearRef || nextAcademicYearId || null,
        module: 'STUDENTS',
        entityType: 'StudentPromotion',
        entityId: String(nextAcademicYearRef || nextAcademicYearId || ''),
        action: 'STUDENTS_PROMOTED',
        details: `Executed student promotions (${result.successful} successful, ${result.failed} failed)`,
        newValue: { successful: result.successful, failed: result.failed },
        user: req.user
      });

      return res.status(200).json({
        success: true,
        message: `Promotion processed: ${result.successful} successful, ${result.failed} failed.`,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminStudentController;
