const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const SchoolInfo = require('../models/schoolInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const ExaminationInfo = require('../models/examinationInfo.model');
const ExaminationResultInfo = require('../models/examinationResultInfo.model');
const FinalAcademicResultInfo = require('../models/finalAcademicResultInfo.model');
const TeacherService = require('./teacher.service');
const TeacherResultService = require('./teacherResult.service');

class OfficeResultsService {
  static getModelByType(type) {
    return (type || 'FINAL').toUpperCase() === 'EXAMINATION'
      ? ExaminationResultInfo
      : FinalAcademicResultInfo;
  }

  /**
   * 1. List ONLY Officially PUBLISHED Results for Office Staff
   */
  static async listPublishedResults({
    schoolId,
    academicYearId,
    type = 'FINAL',
    examinationId,
    classId,
    sectionId,
    search
  }) {
    const sId = schoolId.toUpperCase();
    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(sId, academicYearId);

    const [classes, sections] = await Promise.all([
      ClassInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ classCode: 1 }).lean(),
      SectionInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ sectionCode: 1 }).lean()
    ]);

    const examinations = selectedYear
      ? await ExaminationInfo.find({
          schoolId: sId,
          academicYearRef: selectedYear._id,
          status: { $ne: 'CANCELLED' }
        })
          .sort({ startDate: 1, createdAt: 1 })
          .lean()
      : [];

    if (!selectedYear) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        classes,
        sections,
        examinations,
        summary: { totalPublished: 0, passCount: 0, averagePercentage: 0, publishedClassesCount: 0 },
        classSummaries: [],
        results: []
      };
    }

    const normType = (type || 'FINAL').toUpperCase();
    const Model = this.getModelByType(normType);

    // STRICTLY status === 'PUBLISHED' — never expose draft/generated/submitted/under-review/returned/approved
    const query = {
      schoolId: sId,
      academicYearRef: selectedYear._id,
      status: 'PUBLISHED'
    };

    if (normType === 'EXAMINATION' && examinationId && mongoose.Types.ObjectId.isValid(examinationId)) {
      query.examinationRef = examinationId;
    }
    if (classId && classId !== 'ALL' && mongoose.Types.ObjectId.isValid(classId)) {
      query.classRef = classId;
    }
    if (sectionId && sectionId !== 'ALL' && mongoose.Types.ObjectId.isValid(sectionId)) {
      query.sectionRef = sectionId;
    }

    let results = await Model.find(query)
      .sort({ className: 1, sectionName: 1, rollNumber: 1, studentName: 1 })
      .lean();

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(
        r =>
          (r.studentName || '').toLowerCase().includes(q) ||
          (r.admissionNumber || '').toLowerCase().includes(q) ||
          (r.rollNumber || '').toLowerCase().includes(q)
      );
    }

    // Class-section summary for Class-Wise PDF Downloads
    const classMap = new Map();
    let passCount = 0;
    let pctSum = 0;

    for (const r of results) {
      const pct = Number(normType === 'EXAMINATION' ? r.percentage : r.finalPercentage) || 0;
      pctSum += pct;
      if (r.resultStatus === 'PASS') passCount += 1;

      const exKey = normType === 'EXAMINATION' ? String(r.examinationRef || '') : 'FINAL';
      const key = `${r.classRef.toString()}_${r.sectionRef.toString()}_${exKey}`;
      if (!classMap.has(key)) {
        classMap.set(key, {
          key,
          type: normType,
          academicYearId: selectedYear._id,
          academicYearName: selectedYear.yearName || selectedYear.yearCode,
          examinationId: normType === 'EXAMINATION' ? r.examinationRef : null,
          examinationName: normType === 'EXAMINATION' ? r.examinationName : 'Final Academic Result',
          classId: r.classRef,
          className: r.className,
          sectionId: r.sectionRef,
          sectionName: r.sectionName,
          studentCount: 0,
          passCount: 0,
          publishedAt: r.publishedAt || null
        });
      }
      const grp = classMap.get(key);
      grp.studentCount += 1;
      if (r.resultStatus === 'PASS') grp.passCount += 1;
    }

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      classes,
      sections,
      examinations,
      summary: {
        totalPublished: results.length,
        passCount,
        averagePercentage: results.length > 0 ? Math.round((pctSum / results.length) * 100) / 100 : 0,
        publishedClassesCount: classMap.size
      },
      classSummaries: Array.from(classMap.values()),
      results
    };
  }

  /**
   * 2. Get Single Published Result Detail (Strictly PUBLISHED only)
   */
  static async getPublishedResultDetail({ schoolId, resultId, type = 'FINAL' }) {
    const sId = schoolId.toUpperCase();
    const normType = (type || 'FINAL').toUpperCase();
    const Model = this.getModelByType(normType);

    const record = await Model.findOne({ _id: resultId, schoolId: sId }).lean();
    if (!record) {
      const err = new Error('Result record not found.');
      err.statusCode = 404;
      throw err;
    }
    if (record.status !== 'PUBLISHED') {
      const err = new Error('Access denied. This result has not been published by the Head Teacher.');
      err.statusCode = 403;
      throw err;
    }

    return { success: true, type: normType, result: record };
  }

  /**
   * 3. Generate Class-Wise Published Result Report A4 PDF (Strictly PUBLISHED only)
   */
  static async generateClassWisePublishedReportPdf({
    user,
    academicYearId,
    type = 'FINAL',
    examinationId,
    classId,
    sectionId
  }) {
    const schoolId = user.schoolId.toUpperCase();
    const { selectedYear } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) {
      const err = new Error('Academic year not found.');
      err.statusCode = 404;
      throw err;
    }

    if (!classId || !sectionId) {
      const err = new Error('classId and sectionId are required to generate class-wise published report PDF.');
      err.statusCode = 400;
      throw err;
    }

    const normType = (type || 'FINAL').toUpperCase();
    const Model = this.getModelByType(normType);

    const filter = {
      schoolId,
      academicYearRef: selectedYear._id,
      classRef: classId,
      sectionRef: sectionId,
      status: 'PUBLISHED'
    };
    if (normType === 'EXAMINATION') {
      if (!examinationId) {
        const err = new Error('examinationId is required for examination class-wise report.');
        err.statusCode = 400;
        throw err;
      }
      filter.examinationRef = examinationId;
    }

    const results = await Model.find(filter)
      .sort({ rollNumber: 1, studentName: 1 })
      .lean();

    if (results.length === 0) {
      const err = new Error('No officially published results found for the selected class and section.');
      err.statusCode = 404;
      throw err;
    }

    const school = await SchoolInfo.findOne({ schoolId }).lean();
    const logoPath = TeacherResultService.resolveUploadFilePath(school?.schoolLogoUrl);

    const first = results[0];
    const passCount = results.filter(r => r.resultStatus === 'PASS').length;
    const pcts = results.map(r => Number(normType === 'EXAMINATION' ? r.percentage : r.finalPercentage) || 0);
    const avgPct = Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100) / 100;
    const highPct = Math.max(...pcts);
    const scopeTitle =
      normType === 'EXAMINATION'
        ? `PUBLISHED EXAMINATION RESULT REGISTER — ${first.examinationName.toUpperCase()}`
        : 'PUBLISHED FINAL ACADEMIC RESULT REGISTER';

    const buffer = await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 36, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        doc.rect(24, 24, 547, 794).strokeColor('#cbd5e1').lineWidth(1).stroke();

        if (logoPath) {
          try {
            doc.image(logoPath, 40, 36, { width: 48, height: 48 });
          } catch (_) {}
        }

        doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a').text(
          (school?.schoolName || 'SCHOOL NAME').toUpperCase(),
          96,
          40,
          { width: 420, align: 'center' }
        );
        doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text(school?.address || '', 96, doc.y + 2, {
          width: 420,
          align: 'center'
        });

        doc.moveDown(0.7);
        doc.rect(36, doc.y, 523, 22).fill('#1e3a8a');
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(scopeTitle, 36, doc.y - 16, {
          width: 523,
          align: 'center'
        });

        doc.moveDown(0.8);
        const infoY = doc.y;
        doc.rect(36, infoY, 523, 36).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.fillColor('#0f172a').fontSize(8.8);
        doc.font('Helvetica-Bold').text('Class & Section:', 46, infoY + 12);
        doc.font('Helvetica').text(`${first.className} - ${first.sectionName}`, 124, infoY + 12);
        doc.font('Helvetica-Bold').text('Academic Year:', 255, infoY + 12);
        doc.font('Helvetica').text(selectedYear.yearName || selectedYear.yearCode, 330, infoY + 12);
        doc.font('Helvetica-Bold').text('Published:', 435, infoY + 12);
        doc.font('Helvetica').text(
          first.publishedAt ? new Date(first.publishedAt).toLocaleDateString() : new Date().toLocaleDateString(),
          485,
          infoY + 12
        );

        doc.y = infoY + 46;

        // Class Summary Bar
        const sumY = doc.y;
        doc.rect(36, sumY, 523, 28).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fontSize(8.5).fillColor('#0f172a');
        doc.font('Helvetica-Bold').text(`Students: ${results.length}`, 46, sumY + 9);
        doc.font('Helvetica-Bold').text(`Passed: ${passCount}`, 160, sumY + 9);
        doc.font('Helvetica-Bold').text(`Class Average: ${avgPct}%`, 285, sumY + 9);
        doc.font('Helvetica-Bold').text(`Highest: ${highPct}%`, 435, sumY + 9);

        doc.y = sumY + 38;

        const widths = [42, 74, 152, 76, 54, 42, 83];
        const headers = ['Roll', 'Adm No.', 'Student Name', 'Total Marks', '%', 'Grade', 'Result'];

        const drawRow = (yPos, cells, isHeader = false) => {
          const rowH = 19;
          if (yPos + rowH > 725) {
            doc.addPage();
            doc.rect(24, 24, 547, 794).strokeColor('#cbd5e1').lineWidth(1).stroke();
            yPos = 42;
          }
          doc.rect(36, yPos, 523, rowH).fillAndStroke(isHeader ? '#e2e8f0' : '#ffffff', '#cbd5e1');
          let x = 36;
          cells.forEach((cell, idx) => {
            doc
              .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(8)
              .fillColor('#0f172a')
              .text(String(cell ?? ''), x + 4, yPos + 5.5, {
                width: widths[idx] - 8,
                align: idx === 2 ? 'left' : 'center',
                ellipsis: true
              });
            x += widths[idx];
          });
          return yPos + rowH;
        };

        let curY = drawRow(doc.y, headers, true);
        for (const r of results) {
          const tot = r.overallTotalObtained ?? r.totalMarksObtained;
          const max = r.overallMaxMarks ?? r.totalMaximumMarks;
          const pct = r.finalPercentage ?? r.percentage;
          curY = drawRow(curY, [
            r.rollNumber || '—',
            r.admissionNumber || '—',
            r.studentName,
            `${tot} / ${max}`,
            `${pct}%`,
            r.overallGrade || '—',
            r.promotionStatus ? `${r.resultStatus} (${r.promotionStatus})` : r.resultStatus
          ]);
        }

        doc.y = curY + 20;
        if (doc.y > 700) {
          doc.addPage();
          doc.rect(24, 24, 547, 794).strokeColor('#cbd5e1').lineWidth(1).stroke();
        }
        doc.font('Helvetica').fontSize(8).fillColor('#475569').text(
          'Officially Published Class Result Register • Generated via DMMS Office Portal',
          36,
          755,
          { width: 523, align: 'center' }
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

    const filename = `Class_Published_${normType}_${first.className}_${first.sectionName}.pdf`.replace(/\s+/g, '_');
    return { buffer, filename };
  }
}

module.exports = OfficeResultsService;
