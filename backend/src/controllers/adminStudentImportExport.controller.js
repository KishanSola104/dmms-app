const StudentImportExportService = require('../services/studentImportExport.service');

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
      const { academicYearRef, academicYearId, classRef, classId, sectionRef, sectionId, status, gender, search } =
        req.query;

      const buffer = await StudentImportExportService.exportStudentsToExcel({
        schoolId,
        academicYearRef: academicYearRef || academicYearId,
        classRef: classRef || classId,
        sectionRef: sectionRef || sectionId,
        status,
        gender,
        search
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="DMMS_Students_Export.xlsx"');
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

      const pdfBuffer = await StudentImportExportService.exportClassListToPDF({
        schoolId,
        academicYearRef: academicYearRef || academicYearId,
        classRef: classId,
        sectionRef: sectionId
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="Class_Roster.pdf"');
      return res.status(200).send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminStudentImportExportController;
