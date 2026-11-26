const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const SchoolInfo = require('../models/schoolInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const ExaminationInfo = require('../models/examinationInfo.model');
const ExaminationResultInfo = require('../models/examinationResultInfo.model');
const FinalAcademicResultInfo = require('../models/finalAcademicResultInfo.model');
const DownloadHistoryInfo = require('../models/downloadHistoryInfo.model');
const NotificationInfo = require('../models/notificationInfo.model');
const TeacherService = require('./teacher.service');
const TeacherResultService = require('./teacherResult.service');
const AuditLogService = require('./auditLog.service');

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
    return {
      buffer,
      filename,
      meta: {
        academicYearId: selectedYear._id,
        academicYearName: selectedYear.yearName || selectedYear.yearCode,
        classId: first.classRef,
        className: first.className,
        sectionId: first.sectionRef,
        sectionName: first.sectionName,
        examinationId: normType === 'EXAMINATION' ? first.examinationRef : null
      }
    };
  }

  /**
   * 4. Record Download Activity (Strictly for Published / Authorized Documents)
   */
  static async recordDownload({
    user,
    academicYearId = null,
    academicYearName = '',
    classId = null,
    className = '',
    sectionId = null,
    sectionName = '',
    examinationId = null,
    documentName,
    documentType,
    resultType = '',
    recordId = ''
  }) {
    if (!user || !user._id || !documentName) return null;
    try {
      const entry = await DownloadHistoryInfo.create({
        schoolRef: user.schoolRef,
        schoolId: user.schoolId.toUpperCase(),
        academicYearRef: academicYearId || null,
        academicYearName: academicYearName || '',
        classRef: classId || null,
        className: className || '',
        sectionRef: sectionId || null,
        sectionName: sectionName || '',
        examinationRef: examinationId || null,
        documentName,
        documentType: String(documentType || 'REPORT').toUpperCase(),
        resultType: String(resultType || ''),
        recordId: recordId ? String(recordId) : '',
        downloadedByUserRef: user._id,
        downloadedByUserId: user.userId,
        downloadedByName: user.employeeRef?.fullName || user.fullName || user.userId,
        downloadedByRole: user.roleCode,
        downloadedAt: new Date()
      });

      await AuditLogService.log({
        schoolRef: user.schoolRef,
        schoolId: user.schoolId,
        academicYearRef: academicYearId || null,
        examinationRef: examinationId || null,
        classRef: classId || null,
        sectionRef: sectionId || null,
        module: 'REPORTS',
        entityType: 'DownloadHistoryInfo',
        entityId: entry._id.toString(),
        action: 'DOCUMENT_DOWNLOADED',
        details: `Downloaded ${documentType}: ${documentName}`,
        newValue: { documentName, documentType, className, sectionName, academicYearName },
        user
      });

      return entry;
    } catch (err) {
      console.warn('[OfficeResultsService] Failed to record download:', err.message);
      return null;
    }
  }

  /**
   * 5. Office Staff Dashboard (100% live school + academic-year scoped data)
   */
  static async getOfficeDashboard({ user, academicYearId }) {
    const sId = user.schoolId.toUpperCase();
    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(sId, academicYearId);

    const notificationsPromise = NotificationInfo.find({
      schoolId: sId,
      $or: [
        { targetUserRef: user._id },
        { targetRoleCode: user.roleCode },
        { targetRoleCode: 'ALL' }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    const recentDownloadsPromise = DownloadHistoryInfo.find({
      schoolId: sId,
      downloadedByUserRef: user._id,
      ...(selectedYear ? { $or: [{ academicYearRef: selectedYear._id }, { academicYearRef: null }] } : {})
    })
      .sort({ downloadedAt: -1 })
      .limit(6)
      .lean();

    if (!selectedYear) {
      const [notifications, recentDownloads] = await Promise.all([notificationsPromise, recentDownloadsPromise]);
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        stats: {
          totalPublishedFinalResults: 0,
          totalPublishedExamResults: 0,
          availableAcademicReportsCount: 0,
          myTotalDownloads: recentDownloads.length,
          unreadNotifications: notifications.filter(n => !n.isRead).length
        },
        recentlyPublishedResults: [],
        availableReports: [],
        recentDownloads,
        notifications
      };
    }

    const ayId = selectedYear._id;
    const [publishedFinal, publishedExam, notifications, recentDownloads, totalDownloadsCount] = await Promise.all([
      FinalAcademicResultInfo.find({ schoolId: sId, academicYearRef: ayId, status: 'PUBLISHED' })
        .sort({ publishedAt: -1 })
        .lean(),
      ExaminationResultInfo.find({ schoolId: sId, academicYearRef: ayId, status: 'PUBLISHED' })
        .sort({ publishedAt: -1 })
        .lean(),
      notificationsPromise,
      recentDownloadsPromise,
      DownloadHistoryInfo.countDocuments({ schoolId: sId, downloadedByUserRef: user._id, academicYearRef: ayId })
    ]);

    // Group recently published batches
    const batchMap = new Map();
    for (const r of publishedFinal) {
      const k = `FINAL_${r.classRef}_${r.sectionRef}`;
      if (!batchMap.has(k)) {
        batchMap.set(k, {
          key: k,
          type: 'FINAL',
          title: `Final Academic Result`,
          className: r.className,
          sectionName: r.sectionName,
          studentCount: 0,
          passCount: 0,
          publishedAt: r.publishedAt || r.updatedAt
        });
      }
      const b = batchMap.get(k);
      b.studentCount++;
      if (r.resultStatus === 'PASS') b.passCount++;
    }
    for (const r of publishedExam) {
      const k = `EXAM_${r.examinationRef}_${r.classRef}_${r.sectionRef}`;
      if (!batchMap.has(k)) {
        batchMap.set(k, {
          key: k,
          type: 'EXAMINATION',
          title: r.examinationName,
          className: r.className,
          sectionName: r.sectionName,
          studentCount: 0,
          passCount: 0,
          publishedAt: r.publishedAt || r.updatedAt
        });
      }
      const b = batchMap.get(k);
      b.studentCount++;
      if (r.resultStatus === 'PASS') b.passCount++;
    }

    const recentlyPublishedResults = Array.from(batchMap.values())
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
      .slice(0, 8);

    const availableReports = [
      { key: 'CLASS_WISE', label: 'Class-Wise Published Reports', count: new Set([...publishedFinal, ...publishedExam].map(r => `${r.classRef}_${r.sectionRef}`)).size },
      { key: 'EXAM_WISE', label: 'Examination-Wise Reports', count: new Set(publishedExam.map(r => String(r.examinationRef))).size },
      { key: 'FINAL_RESULT', label: 'Final Result Summaries', count: publishedFinal.length },
      { key: 'STUDENT_REPORTS', label: 'Student Academic Reports', count: new Set([...publishedFinal, ...publishedExam].map(r => String(r.studentRef))).size }
    ];

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      stats: {
        totalPublishedFinalResults: publishedFinal.length,
        totalPublishedExamResults: publishedExam.length,
        availableAcademicReportsCount: availableReports.filter(a => a.count > 0).length,
        myTotalDownloads: totalDownloadsCount,
        unreadNotifications: notifications.filter(n => !n.isRead).length
      },
      recentlyPublishedResults,
      availableReports,
      recentDownloads,
      notifications
    };
  }

  /**
   * 6. Office Academic Reports (Strictly PUBLISHED only)
   */
  static async getAcademicReports({
    schoolId,
    academicYearId,
    examinationId = 'ALL',
    classId = 'ALL',
    sectionId = 'ALL'
  }) {
    const sId = schoolId.toUpperCase();
    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(sId, academicYearId);

    const [classes, sections] = await Promise.all([
      ClassInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ classCode: 1 }).lean(),
      SectionInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ sectionCode: 1 }).lean()
    ]);

    if (!selectedYear) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        classes,
        sections,
        examinations: [],
        overview: { totalPublishedFinal: 0, totalPublishedExam: 0, overallPassRate: 0, overallAveragePercentage: 0 },
        classWiseReports: [],
        examWiseReports: [],
        finalResultReports: [],
        studentReports: []
      };
    }

    const ayId = selectedYear._id;
    const examinations = await ExaminationInfo.find({
      schoolId: sId,
      academicYearRef: ayId,
      status: { $ne: 'CANCELLED' }
    })
      .sort({ startDate: 1, createdAt: 1 })
      .lean();

    const baseFilter = { schoolId: sId, academicYearRef: ayId, status: 'PUBLISHED' };
    if (classId && classId !== 'ALL' && mongoose.Types.ObjectId.isValid(classId)) baseFilter.classRef = classId;
    if (sectionId && sectionId !== 'ALL' && mongoose.Types.ObjectId.isValid(sectionId)) baseFilter.sectionRef = sectionId;

    const examFilter = { ...baseFilter };
    if (examinationId && examinationId !== 'ALL' && mongoose.Types.ObjectId.isValid(examinationId)) {
      examFilter.examinationRef = examinationId;
    }

    const [publishedExam, publishedFinal] = await Promise.all([
      ExaminationResultInfo.find(examFilter).sort({ className: 1, sectionName: 1, rollNumber: 1 }).lean(),
      FinalAcademicResultInfo.find(baseFilter).sort({ className: 1, sectionName: 1, rollNumber: 1 }).lean()
    ]);

    // Class-wise aggregation (combining final if available, else exam)
    const classMap = new Map();
    const sourceForClass = publishedFinal.length > 0 ? publishedFinal : publishedExam;
    for (const r of sourceForClass) {
      const k = `${r.classRef}_${r.sectionRef}`;
      if (!classMap.has(k)) {
        classMap.set(k, {
          classId: r.classRef,
          className: r.className,
          sectionId: r.sectionRef,
          sectionName: r.sectionName,
          sourceType: publishedFinal.length > 0 ? 'FINAL' : 'EXAMINATION',
          studentCount: 0,
          passCount: 0,
          promotedCount: 0,
          pcts: []
        });
      }
      const g = classMap.get(k);
      g.studentCount++;
      if (r.resultStatus === 'PASS') g.passCount++;
      if (r.promotionStatus === 'PROMOTED') g.promotedCount++;
      g.pcts.push(Number(r.finalPercentage ?? r.percentage) || 0);
    }
    const classWiseReports = Array.from(classMap.values()).map(g => ({
      ...g,
      passRate: g.studentCount > 0 ? Math.round((g.passCount / g.studentCount) * 1000) / 10 : 0,
      averagePercentage: g.pcts.length > 0 ? Math.round((g.pcts.reduce((a, b) => a + b, 0) / g.pcts.length) * 100) / 100 : 0,
      highestPercentage: g.pcts.length > 0 ? Math.max(...g.pcts) : 0,
      lowestPercentage: g.pcts.length > 0 ? Math.min(...g.pcts) : 0
    }));

    // Exam-wise aggregation
    const examMap = new Map();
    for (const r of publishedExam) {
      const k = `${r.examinationRef}_${r.classRef}_${r.sectionRef}`;
      if (!examMap.has(k)) {
        examMap.set(k, {
          examinationId: r.examinationRef,
          examinationName: r.examinationName,
          examinationCode: r.examinationCode,
          classId: r.classRef,
          className: r.className,
          sectionId: r.sectionRef,
          sectionName: r.sectionName,
          studentCount: 0,
          passCount: 0,
          pcts: [],
          publishedAt: r.publishedAt
        });
      }
      const g = examMap.get(k);
      g.studentCount++;
      if (r.resultStatus === 'PASS') g.passCount++;
      g.pcts.push(Number(r.percentage) || 0);
    }
    const examWiseReports = Array.from(examMap.values()).map(g => ({
      ...g,
      passRate: g.studentCount > 0 ? Math.round((g.passCount / g.studentCount) * 1000) / 10 : 0,
      averagePercentage: g.pcts.length > 0 ? Math.round((g.pcts.reduce((a, b) => a + b, 0) / g.pcts.length) * 100) / 100 : 0,
      highestPercentage: g.pcts.length > 0 ? Math.max(...g.pcts) : 0
    }));

    // Final result reports
    const finalMap = new Map();
    for (const r of publishedFinal) {
      const k = `${r.classRef}_${r.sectionRef}`;
      if (!finalMap.has(k)) {
        finalMap.set(k, {
          classId: r.classRef,
          className: r.className,
          sectionId: r.sectionRef,
          sectionName: r.sectionName,
          studentCount: 0,
          passCount: 0,
          promotedCount: 0,
          retainedCount: 0,
          pcts: [],
          publishedAt: r.publishedAt
        });
      }
      const g = finalMap.get(k);
      g.studentCount++;
      if (r.resultStatus === 'PASS') g.passCount++;
      if (r.promotionStatus === 'PROMOTED') g.promotedCount++;
      else if (r.promotionStatus === 'RETAINED') g.retainedCount++;
      g.pcts.push(Number(r.finalPercentage) || 0);
    }
    const finalResultReports = Array.from(finalMap.values()).map(g => ({
      ...g,
      passRate: g.studentCount > 0 ? Math.round((g.passCount / g.studentCount) * 1000) / 10 : 0,
      averagePercentage: g.pcts.length > 0 ? Math.round((g.pcts.reduce((a, b) => a + b, 0) / g.pcts.length) * 100) / 100 : 0,
      highestPercentage: g.pcts.length > 0 ? Math.max(...g.pcts) : 0
    }));

    // Student academic reports (published)
    const studentMap = new Map();
    for (const r of publishedExam) {
      const sKey = String(r.studentRef);
      if (!studentMap.has(sKey)) {
        studentMap.set(sKey, {
          studentId: r.studentRef,
          studentName: r.studentName,
          admissionNumber: r.admissionNumber,
          rollNumber: r.rollNumber,
          classId: r.classRef,
          className: r.className,
          sectionId: r.sectionRef,
          sectionName: r.sectionName,
          examResultsCount: 0,
          latestExamResultId: r._id,
          latestExamName: r.examinationName,
          latestExamPercentage: r.percentage,
          finalResultId: null,
          finalPercentage: null,
          overallGrade: r.overallGrade,
          resultStatus: r.resultStatus,
          promotionStatus: null
        });
      }
      const st = studentMap.get(sKey);
      st.examResultsCount++;
    }
    for (const r of publishedFinal) {
      const sKey = String(r.studentRef);
      if (!studentMap.has(sKey)) {
        studentMap.set(sKey, {
          studentId: r.studentRef,
          studentName: r.studentName,
          admissionNumber: r.admissionNumber,
          rollNumber: r.rollNumber,
          classId: r.classRef,
          className: r.className,
          sectionId: r.sectionRef,
          sectionName: r.sectionName,
          examResultsCount: 0,
          latestExamResultId: null,
          latestExamName: '',
          latestExamPercentage: null,
          finalResultId: r._id,
          finalPercentage: r.finalPercentage,
          overallGrade: r.overallGrade,
          resultStatus: r.resultStatus,
          promotionStatus: r.promotionStatus
        });
      } else {
        const st = studentMap.get(sKey);
        st.finalResultId = r._id;
        st.finalPercentage = r.finalPercentage;
        st.overallGrade = r.overallGrade;
        st.resultStatus = r.resultStatus;
        st.promotionStatus = r.promotionStatus;
      }
    }

    const allPcts = sourceForClass.map(r => Number(r.finalPercentage ?? r.percentage) || 0);
    const totalPasses = sourceForClass.filter(r => r.resultStatus === 'PASS').length;

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      classes,
      sections,
      examinations,
      overview: {
        totalPublishedFinal: publishedFinal.length,
        totalPublishedExam: publishedExam.length,
        overallPassRate: sourceForClass.length > 0 ? Math.round((totalPasses / sourceForClass.length) * 1000) / 10 : 0,
        overallAveragePercentage: allPcts.length > 0 ? Math.round((allPcts.reduce((a, b) => a + b, 0) / allPcts.length) * 100) / 100 : 0
      },
      classWiseReports,
      examWiseReports,
      finalResultReports,
      studentReports: Array.from(studentMap.values())
    };
  }

  /**
   * 7. Generate Published Academic Summary Report PDF for Office Staff
   */
  static async generateAcademicSummaryPdf({ user, academicYearId, reportType = 'CLASS_WISE', examinationId = 'ALL', classId = 'ALL', sectionId = 'ALL' }) {
    const data = await this.getAcademicReports({
      schoolId: user.schoolId,
      academicYearId,
      examinationId,
      classId,
      sectionId
    });

    if (!data.selectedAcademicYear) {
      const err = new Error('Academic year not found.');
      err.statusCode = 404;
      throw err;
    }

    const school = await SchoolInfo.findOne({ schoolId: user.schoolId.toUpperCase() }).lean();
    const normReport = String(reportType || 'CLASS_WISE').toUpperCase();
    const titleMap = {
      CLASS_WISE: 'PUBLISHED CLASS-WISE ACADEMIC PERFORMANCE REPORT',
      EXAM_WISE: 'PUBLISHED EXAMINATION-WISE PERFORMANCE REPORT',
      FINAL_RESULT: 'PUBLISHED FINAL RESULT SUMMARY REPORT',
      STUDENT_REPORTS: 'PUBLISHED STUDENT ACADEMIC SUMMARY REPORT'
    };
    const reportTitle = titleMap[normReport] || titleMap.CLASS_WISE;

    const buffer = await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 36, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        doc.rect(24, 24, 547, 794).strokeColor('#cbd5e1').lineWidth(1).stroke();
        doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a').text((school?.schoolName || 'SCHOOL').toUpperCase(), 36, 38, { width: 523, align: 'center' });
        doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text(school?.address || '', 36, doc.y + 2, { width: 523, align: 'center' });
        doc.moveDown(0.6);
        doc.rect(36, doc.y, 523, 22).fill('#1e3a8a');
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(reportTitle, 36, doc.y - 16, { width: 523, align: 'center' });
        doc.moveDown(0.9);

        doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(
          `Academic Year: ${data.selectedAcademicYear.yearName || data.selectedAcademicYear.yearCode}   |   Published Final: ${data.overview.totalPublishedFinal}   |   Published Exam: ${data.overview.totalPublishedExam}   |   Avg: ${data.overview.overallAveragePercentage}%`,
          36,
          doc.y,
          { width: 523, align: 'center' }
        );
        doc.moveDown(0.8);

        const drawRow = (yPos, cells, widths, isHeader = false) => {
          const rowH = 20;
          if (yPos + rowH > 750) {
            doc.addPage();
            doc.rect(24, 24, 547, 794).strokeColor('#cbd5e1').lineWidth(1).stroke();
            yPos = 42;
          }
          doc.rect(36, yPos, 523, rowH).fillAndStroke(isHeader ? '#e2e8f0' : '#ffffff', '#cbd5e1');
          let x = 36;
          cells.forEach((c, idx) => {
            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#0f172a')
              .text(String(c ?? ''), x + 4, yPos + 6, { width: widths[idx] - 8, align: idx === 0 ? 'left' : 'center', ellipsis: true });
            x += widths[idx];
          });
          return yPos + rowH;
        };

        let curY = doc.y;
        if (normReport === 'EXAM_WISE') {
          const w = [135, 110, 68, 60, 75, 75];
          curY = drawRow(curY, ['Examination', 'Class - Sec', 'Students', 'Pass %', 'Avg %', 'Highest %'], w, true);
          for (const r of data.examWiseReports) {
            curY = drawRow(curY, [r.examinationName, `${r.className} - ${r.sectionName}`, r.studentCount, `${r.passRate}%`, `${r.averagePercentage}%`, `${r.highestPercentage}%`], w);
          }
        } else if (normReport === 'FINAL_RESULT') {
          const w = [143, 68, 68, 72, 72, 100];
          curY = drawRow(curY, ['Class - Section', 'Students', 'Promoted', 'Retained', 'Avg %', 'Pass Rate'], w, true);
          for (const r of data.finalResultReports) {
            curY = drawRow(curY, [`${r.className} - ${r.sectionName}`, r.studentCount, r.promotedCount, r.retainedCount, `${r.averagePercentage}%`, `${r.passRate}%`], w);
          }
        } else if (normReport === 'STUDENT_REPORTS') {
          const w = [145, 90, 68, 65, 65, 90];
          curY = drawRow(curY, ['Student Name', 'Class - Sec', 'Adm No.', 'Final %', 'Grade', 'Status'], w, true);
          for (const r of data.studentReports) {
            curY = drawRow(curY, [r.studentName, `${r.className} - ${r.sectionName}`, r.admissionNumber || '—', `${r.finalPercentage ?? r.latestExamPercentage ?? '—'}%`, r.overallGrade || '—', r.promotionStatus || r.resultStatus], w);
          }
        } else {
          const w = [155, 75, 75, 75, 70, 73];
          curY = drawRow(curY, ['Class - Section', 'Students', 'Passed', 'Pass %', 'Avg %', 'Highest %'], w, true);
          for (const r of data.classWiseReports) {
            curY = drawRow(curY, [`${r.className} - ${r.sectionName}`, r.studentCount, r.passCount, `${r.passRate}%`, `${r.averagePercentage}%`, `${r.highestPercentage}%`], w);
          }
        }

        doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(
          `Officially Published Academic Report • Generated on ${new Date().toLocaleString('en-GB')}`,
          36,
          765,
          { width: 523, align: 'center' }
        );
        doc.end();
      } catch (e) {
        reject(e);
      }
    });

    const filename = `Office_Academic_Report_${normReport}_${data.selectedAcademicYear.yearCode || 'Session'}.pdf`.replace(/\s+/g, '_');

    await this.recordDownload({
      user,
      academicYearId: data.selectedAcademicYear._id,
      academicYearName: data.selectedAcademicYear.yearName || data.selectedAcademicYear.yearCode,
      classId: classId !== 'ALL' ? classId : null,
      sectionId: sectionId !== 'ALL' ? sectionId : null,
      examinationId: examinationId !== 'ALL' ? examinationId : null,
      documentName: filename,
      documentType: 'ACADEMIC_REPORT',
      resultType: normReport
    });

    return { buffer, filename };
  }

  /**
   * 8. User-Scoped Download History for Office Staff
   */
  static async listDownloadHistory({ user, academicYearId = 'ALL', documentType = 'ALL', search = '', page = 1, limit = 15 }) {
    const sId = user.schoolId.toUpperCase();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 15));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      schoolId: sId,
      downloadedByUserRef: user._id
    };

    if (academicYearId && academicYearId !== 'ALL' && mongoose.Types.ObjectId.isValid(academicYearId)) {
      query.academicYearRef = academicYearId;
    }
    if (documentType && documentType !== 'ALL') {
      query.documentType = documentType.toUpperCase();
    }
    if (search && search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { documentName: regex },
        { className: regex },
        { sectionName: regex },
        { academicYearName: regex }
      ];
    }

    const [totalRecords, records, academicYears] = await Promise.all([
      DownloadHistoryInfo.countDocuments(query),
      DownloadHistoryInfo.find(query).sort({ downloadedAt: -1 }).skip(skip).limit(limitNum).lean(),
      TeacherService.resolveAcademicYear(sId, null).then(r => r.academicYears)
    ]);

    return {
      availableAcademicYears: academicYears,
      downloads: records,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }
}

module.exports = OfficeResultsService;
