const OfficeResultsService = require('../services/officeResults.service');
const TeacherResultService = require('../services/teacherResult.service');

class OfficeController {
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
      if (normType === 'EXAMINATION') {
        const { buffer, filename } = await TeacherResultService.generateTermResultPdf({
          user: req.user,
          resultId: req.params.resultId
        });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        return res.send(buffer);
      }

      const { buffer, filename } = await TeacherResultService.generateFinalResultPdf({
        user: req.user,
        finalResultId: req.params.resultId
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async downloadClassWisePublishedPdf(req, res, next) {
    try {
      const { academicYearId, type, examinationId, classId, sectionId } = req.query;
      const { buffer, filename } = await OfficeResultsService.generateClassWisePublishedReportPdf({
        user: req.user,
        academicYearId,
        type: type || 'FINAL',
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
}

module.exports = OfficeController;
