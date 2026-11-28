const StudentImportExportService = require('../services/studentImportExport.service');
const StudentService = require('../services/student.service');
const AuditLogService = require('../services/auditLog.service');

class AdminStudentImportExportController {
  /**
   * GET /api/admin/students/import/template
   * Download Excel Import Template
   */
  static async downloadTemplate(req, res, next) {
    try {
      const { importType = 'NEW_ADMISSION' } = req.query;
      const buffer = StudentImportExportService.generateImportTemplate(importType);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="DMMS_Student_Import_Template_${importType}.xlsx"`
      );
      return res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/admin/students/import/preview
   * Upload and preview student import with row-level validation
   */
  static async previewImport(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { academicYearRef, academicYearId, importType = 'NEW_ADMISSION' } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload an Excel (.xlsx or .xls) file.'
        });
      }

      const result = await StudentImportExportService.parseAndPreviewImport({
        schoolId,
        academicYearRef: academicYearRef || academicYearId,
        importType,
        fileBuffer: req.file.buffer,
        fileName: req.file.originalname
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
   * POST /api/admin/students/import/commit
   * Commit verified valid rows to database
   */
  static async commitImport(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const schoolRef = req.user?.schoolRef || req.school?._id;
      const userId = req.user?._id;

      const { academicYearRef, academicYearId, importType, fileName, validRows } = req.body;

      const result = await StudentImportExportService.commitImportBatch({
        schoolId,
        schoolRef,
        userId,
        academicYearRef: academicYearRef || academicYearId,
        importType,
        fileName,
        validRows
      });

      await AuditLogService.log({
        schoolRef,
        schoolId,
        academicYearRef: academicYearRef || academicYearId || null,
        module: 'STUDENTS',
        entityType: 'StudentImportBatchInfo',
        entityId: fileName || 'excel-import',
        action: 'STUDENTS_IMPORTED',
        details: `Imported students from '${fileName || 'Excel'}': ${result.successfulRecords} created, ${result.failedRecords} failed`,
        newValue: { successfulRecords: result.successfulRecords, failedRecords: result.failedRecords },
        user: req.user
      });

      return res.status(201).json({
        success: true,
        message: `Import processed: ${result.successfulRecords} created, ${result.failedRecords} failed.`,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/students/export/excel
   * Export students list to Excel
   */
  static async exportStudentsExcel(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const {
        academicYearRef,
        academicYearId,
        classRef,
        classId,
        sectionRef,
        sectionId,
        status,
        enrollmentStatus,
        gender,
        search
      } = req.query;

      const buffer = await StudentImportExportService.exportStudentsToExcel({
        schoolId,
        academicYearRef: academicYearRef || academicYearId,
        classRef: classRef || classId,
        sectionRef: sectionRef || sectionId,
        status,
        enrollmentStatus,
        gender,
        search
      });

      const dateTag = new Date().toISOString().slice(0, 10);
      const fileName = `DMMS_Students_Directory_${schoolId || 'SCHOOL'}_${dateTag}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/students/:studentId/export/pdf
   * Export single student profile to PDF
   */
  static async exportStudentPDF(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { studentId } = req.params;
      const { academicYearRef, academicYearId } = req.query;

      const pdfBuffer = await StudentImportExportService.exportStudentProfileToPDF({
        schoolId,
        studentId,
        academicYearRef: academicYearRef || academicYearId
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Student_${studentId}_Profile.pdf"`);
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/classes/:classId/sections/:sectionId/export/pdf
   * Export class/section student roster to PDF
   */
  static async exportClassListPDF(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { classId, sectionId } = req.params;
      const { academicYearRef, academicYearId } = req.query;

      const ayId = academicYearRef || academicYearId;
      const [summary, pdfBuffer] = await Promise.all([
        StudentService.getSectionEnrollmentSummary({
          schoolId,
          academicYearRef: ayId,
          classRef: classId,
          sectionRef: sectionId
        }),
        StudentImportExportService.exportClassListToPDF({
          schoolId,
          academicYearRef: ayId,
          classRef: classId,
          sectionRef: sectionId
        })
      ]);

      const safePart = (v) => String(v || '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
      const fileName = `Enrollment_Roster_${safePart(summary.class?.classCode || summary.class?.className)}_${safePart(summary.section?.sectionCode || summary.section?.sectionName)}_${safePart(summary.academicYear?.yearName)}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/enrollments/transfers
   * List section transfer records for the selected academic year / class / section
   */
  static async listSectionTransfers(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { academicYearRef, academicYearId, classRef, classId, sectionRef, sectionId } = req.query;
      const data = await StudentService.listSectionTransfers({
        schoolId,
        academicYearRef: academicYearRef || academicYearId,
        classRef: classRef || classId,
        sectionRef: sectionRef || sectionId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/enrollments/transfers/export/pdf
   * Export section transfer roster to PDF
   */
  static async exportSectionTransferRosterPDF(req, res, next) {
    try {
      const schoolId = req.user?.schoolId || req.school?.schoolId;
      const { academicYearRef, academicYearId, classRef, classId, sectionRef, sectionId } = req.query;
      const ayId = academicYearRef || academicYearId;
      const cId = classRef || classId;
      const sId = sectionRef || sectionId;

      const [transferData, pdfBuffer] = await Promise.all([
        StudentService.listSectionTransfers({
          schoolId,
          academicYearRef: ayId,
          classRef: cId,
          sectionRef: sId
        }),
        StudentImportExportService.exportSectionTransferRosterToPDF({
          schoolId,
          academicYearRef: ayId,
          classRef: cId,
          sectionRef: sId
        })
      ]);

      const safePart = (v) => String(v || '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
      const scopePart = transferData.section
        ? `${safePart(transferData.class?.classCode || transferData.class?.className)}_${safePart(transferData.section?.sectionCode || transferData.section?.sectionName)}`
        : transferData.class
          ? safePart(transferData.class?.classCode || transferData.class?.className)
          : 'All_Classes';
      const fileName = `Section_Transfer_Roster_${scopePart}_${safePart(transferData.academicYear?.yearName || 'Session')}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminStudentImportExportController;
