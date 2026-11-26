const OfficeResultsService = require('../services/officeResults.service');
const TeacherResultService = require('../services/teacherResult.service');
const ExaminationResultInfo = require('../models/examinationResultInfo.model');
const FinalAcademicResultInfo = require('../models/finalAcademicResultInfo.model');

class OfficeController {
  static async getDashboard(req, res, next) {
    try {
      const data = await OfficeResultsService.getOfficeDashboard({
        user: req.user,
        academicYearId: req.query.academicYearId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async listPublishedResults(req, res, next) {
    try {
      const { academicYearId, type, examinationId, classId, sectionId, search } = req.query;
      const data = await OfficeResultsService.listPublishedResults({
        schoolId: req.user.schoolId,
        academicYearId,
        type: type || 'FINAL',
        examinationId,
        classId,
        sectionId,
        search
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async getPublishedResultDetail(req, res, next) {
    try {
      const { type } = req.query;
      const data = await OfficeResultsService.getPublishedResultDetail({
        schoolId: req.user.schoolId,
        resultId: req.params.resultId,
        type: type || 'FINAL'
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  }

  static async downloadPublishedStudentPdf(req, res, next) {
    try {
      const normType = (req.query.type || 'FINAL').toUpperCase();
      const recordDownloadFlag = req.query.preview !== 'true';

      if (normType === 'EXAMINATION') {
        const resultDoc = await ExaminationResultInfo.findOne({
          _id: req.params.resultId,
          schoolId: req.user.schoolId.toUpperCase(),
          status: 'PUBLISHED'
        })
          .populate('academicYearRef', 'yearName yearCode')
          .lean();
        if (!resultDoc) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Only officially published examination marksheets are accessible.'
          });
        }

        const { buffer, fileName } = await TeacherResultService.generateTermResultPdf({
          user: req.user,
          resultId: req.params.resultId
        });

        if (recordDownloadFlag) {
          await OfficeResultsService.recordDownload({
            user: req.user,
            academicYearId: resultDoc.academicYearRef?._id || resultDoc.academicYearRef,
            academicYearName: resultDoc.academicYearRef?.yearName || resultDoc.academicYearRef?.yearCode || '',
            classId: resultDoc.classRef,
            className: resultDoc.className,
            sectionId: resultDoc.sectionRef,
            sectionName: resultDoc.sectionName,
            examinationId: resultDoc.examinationRef,
            documentName: fileName,
            documentType: 'EXAMINATION_MARKSHEET',
            resultType: 'EXAMINATION',
            recordId: resultDoc._id
          });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        return res.send(buffer);
      }

      const finalDoc = await FinalAcademicResultInfo.findOne({
        _id: req.params.resultId,
        schoolId: req.user.schoolId.toUpperCase(),
        status: 'PUBLISHED'
      }).lean();
      if (!finalDoc) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Only officially published final marksheets are accessible.'
        });
      }

      const { buffer, fileName } = await TeacherResultService.generateFinalResultPdf({
        user: req.user,
        finalResultId: req.params.resultId
      });

      if (recordDownloadFlag) {
        await OfficeResultsService.recordDownload({
          user: req.user,
          academicYearId: finalDoc.academicYearRef,
          academicYearName: finalDoc.academicYearName || '',
          classId: finalDoc.classRef,
          className: finalDoc.className,
          sectionId: finalDoc.sectionRef,
          sectionName: finalDoc.sectionName,
          documentName: fileName,
          documentType: 'FINAL_MARKSHEET',
          resultType: 'FINAL',
          recordId: finalDoc._id
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async downloadClassWisePublishedPdf(req, res, next) {
    try {
      const { academicYearId, type, examinationId, classId, sectionId } = req.query;
      const normType = (type || 'FINAL').toUpperCase();
      const { buffer, filename, meta } = await OfficeResultsService.generateClassWisePublishedReportPdf({
        user: req.user,
        academicYearId,
        type: normType,
        examinationId,
        classId,
        sectionId
      });

      await OfficeResultsService.recordDownload({
        user: req.user,
        academicYearId: meta?.academicYearId,
        academicYearName: meta?.academicYearName,
        classId: meta?.classId,
        className: meta?.className,
        sectionId: meta?.sectionId,
        sectionName: meta?.sectionName,
        examinationId: meta?.examinationId,
        documentName: filename,
        documentType: normType === 'EXAMINATION' ? 'CLASS_EXAM_REPORT' : 'CLASS_FINAL_REPORT',
        resultType: normType
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async getAcademicReports(req, res, next) {
    try {
      const { academicYearId, examinationId, classId, sectionId } = req.query;
      const data = await OfficeResultsService.getAcademicReports({
        schoolId: req.user.schoolId,
        academicYearId,
        examinationId,
        classId,
        sectionId
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      next(error);
    }
  }

  static async downloadAcademicReportPdf(req, res, next) {
    try {
      const { academicYearId, reportType, examinationId, classId, sectionId } = req.query;
      const { buffer, filename } = await OfficeResultsService.generateAcademicSummaryPdf({
        user: req.user,
        academicYearId,
        reportType,
        examinationId,
        classId,
        sectionId
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async listDownloadHistory(req, res, next) {
    try {
      const { academicYearId, documentType, search, page, limit } = req.query;
      const data = await OfficeResultsService.listDownloadHistory({
        user: req.user,
        academicYearId,
        documentType,
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

module.exports = OfficeController;
