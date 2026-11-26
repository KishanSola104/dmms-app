const mongoose = require('mongoose');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const SchoolInfo = require('../models/schoolInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const SubjectInfo = require('../models/subjectInfo.model');
const UserInfo = require('../models/userInfo.model');
const ExaminationInfo = require('../models/examinationInfo.model');
const ExaminationClassInfo = require('../models/examinationClassInfo.model');
const ExaminationSubjectInfo = require('../models/examinationSubjectInfo.model');
const MarksSubmissionInfo = require('../models/marksSubmissionInfo.model');
const ExaminationResultInfo = require('../models/examinationResultInfo.model');
const FinalAcademicResultInfo = require('../models/finalAcademicResultInfo.model');
const NotificationInfo = require('../models/notificationInfo.model');
const TeacherService = require('./teacher.service');
const AuditLogService = require('./auditLog.service');

class HeadTeacherModule6Service {
  /**
   * 1. Head Teacher Academic Reports (Reuses existing examination, marks, and result records)
   */
  static async getAcademicReports({
    schoolId,
    academicYearId,
    examinationId = 'ALL',
    classId = 'ALL',
    sectionId = 'ALL',
    subjectId = 'ALL'
  }) {
    const sId = schoolId.toUpperCase();
    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(sId, academicYearId);

    const [classes, sections, subjects] = await Promise.all([
      ClassInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ classCode: 1 }).lean(),
      SectionInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ sectionCode: 1 }).lean(),
      SubjectInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ subjectCode: 1 }).lean()
    ]);

    if (!selectedYear) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        classes,
        sections,
        subjects,
        examinations: [],
        overview: {
          totalExamResults: 0,
          totalFinalResults: 0,
          publishedCount: 0,
          pendingApprovalCount: 0,
          averagePercentage: 0,
          passRate: 0
        },
        classWisePerformance: [],
        examWisePerformance: [],
        subjectWisePerformance: [],
        studentPerformanceList: [],
        finalResultSummaries: [],
        publishedAndPendingSummary: { exam: {}, final: {} },
        marksCompletionReport: []
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

    const baseResFilter = { schoolId: sId, academicYearRef: ayId };
    if (classId && classId !== 'ALL' && mongoose.Types.ObjectId.isValid(classId)) baseResFilter.classRef = classId;
    if (sectionId && sectionId !== 'ALL' && mongoose.Types.ObjectId.isValid(sectionId)) baseResFilter.sectionRef = sectionId;

    const examResFilter = { ...baseResFilter };
    if (examinationId && examinationId !== 'ALL' && mongoose.Types.ObjectId.isValid(examinationId)) {
      examResFilter.examinationRef = examinationId;
    }

    const [examResults, finalResults, submissions, examClasses, examSubjects] = await Promise.all([
      ExaminationResultInfo.find(examResFilter).sort({ className: 1, sectionName: 1, rollNumber: 1 }).lean(),
      FinalAcademicResultInfo.find(baseResFilter).sort({ className: 1, sectionName: 1, rollNumber: 1 }).lean(),
      MarksSubmissionInfo.find({ schoolId: sId, academicYearRef: ayId }).lean(),
      ExaminationClassInfo.find({ schoolId: sId, academicYearRef: ayId, status: 'ACTIVE' }).lean(),
      ExaminationSubjectInfo.find({ schoolId: sId, academicYearRef: ayId, status: 'ACTIVE' }).lean()
    ]);

    // Class-wise Academic Performance
    const classPerfSource = finalResults.length > 0 ? finalResults : examResults;
    const classMap = new Map();
    for (const r of classPerfSource) {
      const k = `${r.classRef}_${r.sectionRef}`;
      if (!classMap.has(k)) {
        classMap.set(k, {
          classId: r.classRef,
          className: r.className,
          sectionId: r.sectionRef,
          sectionName: r.sectionName,
          studentCount: 0,
          passCount: 0,
          publishedCount: 0,
          pcts: []
        });
      }
      const g = classMap.get(k);
      g.studentCount++;
      if (r.resultStatus === 'PASS') g.passCount++;
      if (r.status === 'PUBLISHED') g.publishedCount++;
      g.pcts.push(Number(r.finalPercentage ?? r.percentage) || 0);
    }
    const classWisePerformance = Array.from(classMap.values()).map(g => ({
      ...g,
      passRate: g.studentCount > 0 ? Math.round((g.passCount / g.studentCount) * 1000) / 10 : 0,
      averagePercentage: g.pcts.length > 0 ? Math.round((g.pcts.reduce((a, b) => a + b, 0) / g.pcts.length) * 100) / 100 : 0,
      highestPercentage: g.pcts.length > 0 ? Math.max(...g.pcts) : 0,
      lowestPercentage: g.pcts.length > 0 ? Math.min(...g.pcts) : 0
    }));

    // Examination-wise Performance
    const examMap = new Map();
    for (const r of examResults) {
      const k = `${r.examinationRef}_${r.classRef}_${r.sectionRef}`;
      if (!examMap.has(k)) {
        examMap.set(k, {
          examinationId: r.examinationRef,
          examinationName: r.examinationName,
          examinationCode: r.examinationCode,
          className: r.className,
          sectionName: r.sectionName,
          studentCount: 0,
          passCount: 0,
          publishedCount: 0,
          pcts: []
        });
      }
      const g = examMap.get(k);
      g.studentCount++;
      if (r.resultStatus === 'PASS') g.passCount++;
      if (r.status === 'PUBLISHED') g.publishedCount++;
      g.pcts.push(Number(r.percentage) || 0);
    }
    const examWisePerformance = Array.from(examMap.values()).map(g => ({
      ...g,
      passRate: g.studentCount > 0 ? Math.round((g.passCount / g.studentCount) * 1000) / 10 : 0,
      averagePercentage: g.pcts.length > 0 ? Math.round((g.pcts.reduce((a, b) => a + b, 0) / g.pcts.length) * 100) / 100 : 0,
      highestPercentage: g.pcts.length > 0 ? Math.max(...g.pcts) : 0
    }));

    // Subject-wise Performance (from existing ExaminationResultInfo / FinalAcademicResultInfo)
    const subjMap = new Map();
    for (const r of examResults) {
      for (const s of r.academicSubjects || []) {
        if (subjectId && subjectId !== 'ALL' && s.subjectRef.toString() !== String(subjectId)) continue;
        const k = `${s.subjectRef}_${r.classRef}`;
        if (!subjMap.has(k)) {
          subjMap.set(k, {
            subjectId: s.subjectRef,
            subjectCode: s.subjectCode,
            subjectName: s.subjectName,
            className: r.className,
            entriesCount: 0,
            passCount: 0,
            pcts: []
          });
        }
        const g = subjMap.get(k);
        g.entriesCount++;
        if (s.isPassing) g.passCount++;
        g.pcts.push(Number(s.percentage) || 0);
      }
    }
    const subjectWisePerformance = Array.from(subjMap.values()).map(g => ({
      ...g,
      passRate: g.entriesCount > 0 ? Math.round((g.passCount / g.entriesCount) * 1000) / 10 : 0,
      averagePercentage: g.pcts.length > 0 ? Math.round((g.pcts.reduce((a, b) => a + b, 0) / g.pcts.length) * 100) / 100 : 0,
      highestPercentage: g.pcts.length > 0 ? Math.max(...g.pcts) : 0,
      lowestPercentage: g.pcts.length > 0 ? Math.min(...g.pcts) : 0
    }));

    // Final Result Summaries
    const finalMap = new Map();
    for (const r of finalResults) {
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
          publishedCount: 0,
          approvedCount: 0,
          pendingCount: 0,
          pcts: []
        });
      }
      const g = finalMap.get(k);
      g.studentCount++;
      if (r.resultStatus === 'PASS') g.passCount++;
      if (r.promotionStatus === 'PROMOTED') g.promotedCount++;
      else if (r.promotionStatus === 'RETAINED') g.retainedCount++;
      if (r.status === 'PUBLISHED') g.publishedCount++;
      else if (r.status === 'APPROVED') g.approvedCount++;
      else g.pendingCount++;
      g.pcts.push(Number(r.finalPercentage) || 0);
    }
    const finalResultSummaries = Array.from(finalMap.values()).map(g => ({
      ...g,
      passRate: g.studentCount > 0 ? Math.round((g.passCount / g.studentCount) * 1000) / 10 : 0,
      averagePercentage: g.pcts.length > 0 ? Math.round((g.pcts.reduce((a, b) => a + b, 0) / g.pcts.length) * 100) / 100 : 0
    }));

    // Student Academic Performance list
    const studentMap = new Map();
    for (const r of examResults) {
      const sk = String(r.studentRef);
      if (!studentMap.has(sk)) {
        studentMap.set(sk, {
          studentId: r.studentRef,
          studentName: r.studentName,
          admissionNumber: r.admissionNumber,
          rollNumber: r.rollNumber,
          className: r.className,
          sectionName: r.sectionName,
          examCount: 0,
          examAvgPercentage: 0,
          _examPcts: [],
          finalPercentage: null,
          overallGrade: r.overallGrade,
          resultStatus: r.resultStatus,
          promotionStatus: null,
          resultState: r.status
        });
      }
      const st = studentMap.get(sk);
      st.examCount++;
      st._examPcts.push(Number(r.percentage) || 0);
    }
    for (const r of finalResults) {
      const sk = String(r.studentRef);
      if (!studentMap.has(sk)) {
        studentMap.set(sk, {
          studentId: r.studentRef,
          studentName: r.studentName,
          admissionNumber: r.admissionNumber,
          rollNumber: r.rollNumber,
          className: r.className,
          sectionName: r.sectionName,
          examCount: 0,
          examAvgPercentage: 0,
          _examPcts: [],
          finalPercentage: r.finalPercentage,
          overallGrade: r.overallGrade,
          resultStatus: r.resultStatus,
          promotionStatus: r.promotionStatus,
          resultState: r.status
        });
      } else {
        const st = studentMap.get(sk);
        st.finalPercentage = r.finalPercentage;
        st.overallGrade = r.overallGrade;
        st.resultStatus = r.resultStatus;
        st.promotionStatus = r.promotionStatus;
        st.resultState = r.status;
      }
    }
    const studentPerformanceList = Array.from(studentMap.values()).map(({ _examPcts, ...st }) => ({
      ...st,
      examAvgPercentage:
        _examPcts.length > 0 ? Math.round((_examPcts.reduce((a, b) => a + b, 0) / _examPcts.length) * 100) / 100 : null
    }));

    // Published and Pending Result Status Summaries
    const countStatuses = (arr) => {
      const counts = { GENERATED: 0, SUBMITTED_TO_HEAD_TEACHER: 0, UNDER_REVIEW: 0, RETURNED: 0, APPROVED: 0, PUBLISHED: 0 };
      for (const item of arr) {
        if (counts[item.status] !== undefined) counts[item.status]++;
      }
      return counts;
    };
    const examStatusCounts = countStatuses(examResults);
    const finalStatusCounts = countStatuses(finalResults);

    // Marks-Entry & Result-Completion Report per Class-Section
    const classLookup = new Map(classes.map(c => [c._id.toString(), c]));
    const sectionsByClass = new Map();
    for (const s of sections) {
      const k = s.classRef.toString();
      if (!sectionsByClass.has(k)) sectionsByClass.set(k, []);
      sectionsByClass.get(k).push(s);
    }

    const marksCompletionReport = [];
    for (const cls of classes) {
      if (classId && classId !== 'ALL' && cls._id.toString() !== String(classId)) continue;
      const clsSecs = sectionsByClass.get(cls._id.toString()) || [];
      for (const sec of clsSecs) {
        if (sectionId && sectionId !== 'ALL' && sec._id.toString() !== String(sectionId)) continue;
        const secSubs = submissions.filter(
          s =>
            s.classRef.toString() === cls._id.toString() &&
            s.sectionRef.toString() === sec._id.toString() &&
            (examinationId === 'ALL' || !s.examinationRef || s.examinationRef.toString() === String(examinationId))
        );
        const secExamRes = examResults.filter(
          r => r.classRef.toString() === cls._id.toString() && r.sectionRef.toString() === sec._id.toString()
        );
        const secFinalRes = finalResults.filter(
          r => r.classRef.toString() === cls._id.toString() && r.sectionRef.toString() === sec._id.toString()
        );

        const configuredTasks = examClasses
          .filter(ec => ec.classRef.toString() === cls._id.toString())
          .reduce((acc, ec) => {
            const subCount = examSubjects.filter(
              es => es.examinationRef.toString() === ec.examinationRef.toString() && es.classRef.toString() === cls._id.toString()
            ).length;
            return acc + subCount;
          }, 0);

        marksCompletionReport.push({
          classId: cls._id,
          className: classLookup.get(cls._id.toString())?.className || cls.className,
          sectionId: sec._id,
          sectionName: sec.sectionName,
          expectedExamSubjectTasks: configuredTasks,
          submittedCount: secSubs.filter(s => s.status === 'SUBMITTED').length,
          verifiedCount: secSubs.filter(s => s.status === 'VERIFIED').length,
          returnedCount: secSubs.filter(s => s.status === 'RETURNED').length,
          draftCount: secSubs.filter(s => s.status === 'DRAFT' && s.enteredCount > 0).length,
          lockedCount: secSubs.filter(s => s.isLocked).length,
          examResultsGenerated: secExamRes.length,
          examResultsPublished: secExamRes.filter(r => r.status === 'PUBLISHED').length,
          finalResultsGenerated: secFinalRes.length,
          finalResultsPublished: secFinalRes.filter(r => r.status === 'PUBLISHED').length
        });
      }
    }

    const allPcts = classPerfSource.map(r => Number(r.finalPercentage ?? r.percentage) || 0);
    const totalPasses = classPerfSource.filter(r => r.resultStatus === 'PASS').length;
    const publishedTotal = examStatusCounts.PUBLISHED + finalStatusCounts.PUBLISHED;
    const pendingApprovalTotal =
      examStatusCounts.SUBMITTED_TO_HEAD_TEACHER +
      examStatusCounts.UNDER_REVIEW +
      finalStatusCounts.SUBMITTED_TO_HEAD_TEACHER +
      finalStatusCounts.UNDER_REVIEW;

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      classes,
      sections,
      subjects,
      examinations,
      overview: {
        totalExamResults: examResults.length,
        totalFinalResults: finalResults.length,
        publishedCount: publishedTotal,
        pendingApprovalCount: pendingApprovalTotal,
        averagePercentage: allPcts.length > 0 ? Math.round((allPcts.reduce((a, b) => a + b, 0) / allPcts.length) * 100) / 100 : 0,
        passRate: classPerfSource.length > 0 ? Math.round((totalPasses / classPerfSource.length) * 1000) / 10 : 0
      },
      classWisePerformance,
      examWisePerformance,
      subjectWisePerformance,
      studentPerformanceList,
      finalResultSummaries,
      publishedAndPendingSummary: {
        exam: examStatusCounts,
        final: finalStatusCounts
      },
      marksCompletionReport
    };
  }

  /**
   * 2. Export Head Teacher Academic Report as A4 PDF
   */
  static async generateAcademicReportPdf({ user, academicYearId, reportSection = 'CLASS_WISE', examinationId = 'ALL', classId = 'ALL', sectionId = 'ALL', subjectId = 'ALL' }) {
    const data = await this.getAcademicReports({
      schoolId: user.schoolId,
      academicYearId,
      examinationId,
      classId,
      sectionId,
      subjectId
    });
    if (!data.selectedAcademicYear) {
      const err = new Error('Academic year not found.');
      err.statusCode = 404;
      throw err;
    }

    const school = await SchoolInfo.findOne({ schoolId: user.schoolId.toUpperCase() }).lean();
    const normSection = String(reportSection || 'CLASS_WISE').toUpperCase();
    const titles = {
      CLASS_WISE: 'CLASS-WISE ACADEMIC PERFORMANCE REPORT',
      EXAM_WISE: 'EXAMINATION-WISE PERFORMANCE REPORT',
      SUBJECT_WISE: 'SUBJECT-WISE PERFORMANCE REPORT',
      FINAL_SUMMARY: 'FINAL RESULT SUMMARY REPORT',
      COMPLETION: 'MARKS-ENTRY & RESULT COMPLETION REPORT'
    };

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
        doc.rect(36, doc.y, 523, 22).fill('#4c1d95');
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(titles[normSection] || titles.CLASS_WISE, 36, doc.y - 16, { width: 523, align: 'center' });
        doc.moveDown(0.9);
        doc.font('Helvetica-Bold').fontSize(8.8).fillColor('#0f172a').text(
          `Academic Year: ${data.selectedAcademicYear.yearName || data.selectedAcademicYear.yearCode}   |   Avg: ${data.overview.averagePercentage}%   |   Pass Rate: ${data.overview.passRate}%`,
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
          doc.rect(36, yPos, 523, rowH).fillAndStroke(isHeader ? '#ede9fe' : '#ffffff', '#cbd5e1');
          let x = 36;
          cells.forEach((c, idx) => {
            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#0f172a')
              .text(String(c ?? ''), x + 4, yPos + 6, { width: widths[idx] - 8, align: idx === 0 ? 'left' : 'center', ellipsis: true });
            x += widths[idx];
          });
          return yPos + rowH;
        };

        let curY = doc.y;
        if (normSection === 'EXAM_WISE') {
          const w = [140, 110, 65, 68, 70, 70];
          curY = drawRow(curY, ['Examination', 'Class - Sec', 'Students', 'Pass %', 'Avg %', 'Highest %'], w, true);
          for (const r of data.examWisePerformance) {
            curY = drawRow(curY, [r.examinationName, `${r.className} - ${r.sectionName}`, r.studentCount, `${r.passRate}%`, `${r.averagePercentage}%`, `${r.highestPercentage}%`], w);
          }
        } else if (normSection === 'SUBJECT_WISE') {
          const w = [145, 95, 65, 70, 74, 74];
          curY = drawRow(curY, ['Subject', 'Class', 'Entries', 'Pass %', 'Avg %', 'High / Low'], w, true);
          for (const r of data.subjectWisePerformance) {
            curY = drawRow(curY, [`${r.subjectName} (${r.subjectCode})`, r.className, r.entriesCount, `${r.passRate}%`, `${r.averagePercentage}%`, `${r.highestPercentage}% / ${r.lowestPercentage}%`], w);
          }
        } else if (normSection === 'FINAL_SUMMARY') {
          const w = [135, 65, 65, 65, 65, 65, 63];
          curY = drawRow(curY, ['Class - Section', 'Students', 'Promoted', 'Retained', 'Published', 'Avg %', 'Pass %'], w, true);
          for (const r of data.finalResultSummaries) {
            curY = drawRow(curY, [`${r.className} - ${r.sectionName}`, r.studentCount, r.promotedCount, r.retainedCount, r.publishedCount, `${r.averagePercentage}%`, `${r.passRate}%`], w);
          }
        } else if (normSection === 'COMPLETION') {
          const w = [125, 68, 68, 68, 65, 65, 64];
          curY = drawRow(curY, ['Class - Section', 'Expected', 'Submitted', 'Verified', 'Returned', 'Locked', 'Final Pub.'], w, true);
          for (const r of data.marksCompletionReport) {
            curY = drawRow(curY, [`${r.className} - ${r.sectionName}`, r.expectedExamSubjectTasks, r.submittedCount, r.verifiedCount, r.returnedCount, r.lockedCount, r.finalResultsPublished], w);
          }
        } else {
          const w = [150, 72, 72, 75, 77, 77];
          curY = drawRow(curY, ['Class - Section', 'Students', 'Passed', 'Pass Rate', 'Avg %', 'Highest %'], w, true);
          for (const r of data.classWisePerformance) {
            curY = drawRow(curY, [`${r.className} - ${r.sectionName}`, r.studentCount, r.passCount, `${r.passRate}%`, `${r.averagePercentage}%`, `${r.highestPercentage}%`], w);
          }
        }

        doc.font('Helvetica').fontSize(7.5).fillColor('#64748b').text(
          `Head Teacher Academic Report • Generated on ${new Date().toLocaleString('en-GB')}`,
          36,
          765,
          { width: 523, align: 'center' }
        );
        doc.end();
      } catch (e) {
        reject(e);
      }
    });

    await AuditLogService.log({
      schoolRef: user.schoolRef,
      schoolId: user.schoolId,
      academicYearRef: data.selectedAcademicYear._id,
      module: 'REPORTS',
      entityType: 'AcademicReport',
      entityId: normSection,
      action: 'ACADEMIC_REPORT_EXPORTED',
      details: `Exported Head Teacher academic report PDF (${normSection})`,
      user
    });

    return {
      buffer,
      fileName: `HT_Academic_Report_${normSection}_${data.selectedAcademicYear.yearCode || 'Session'}.pdf`.replace(/\s+/g, '_')
    };
  }

  /**
   * 3. Head Teacher Notifications List (Categorized & Paginated)
   */
  static async getNotifications({ user, type = 'ALL', unreadOnly = 'false', page = 1, limit = 20 }) {
    const schoolId = user.schoolId.toUpperCase();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const query = {
      schoolId,
      $or: [
        { targetUserRef: user._id },
        { targetRoleCode: user.roleCode },
        { targetRoleCode: 'ALL' }
      ]
    };
    if (type && type !== 'ALL') query.type = type.toLowerCase();
    if (unreadOnly === 'true') query.isRead = false;

    const [totalRecords, notifications, unreadCount] = await Promise.all([
      NotificationInfo.countDocuments(query),
      NotificationInfo.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      NotificationInfo.countDocuments({
        schoolId,
        isRead: false,
        $or: [
          { targetUserRef: user._id },
          { targetRoleCode: user.roleCode },
          { targetRoleCode: 'ALL' }
        ]
      })
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * 4. Eligible Recipients within the Same School ONLY
   */
  static async getNotificationRecipients(schoolId) {
    const sId = schoolId.toUpperCase();
    const users = await UserInfo.find({
      schoolId: sId,
      status: 'ACTIVE',
      roleCode: { $in: ['TEACHER', 'OFFICE_STAFF'] }
    })
      .populate('employeeRef', 'fullName designation')
      .select('_id userId roleCode roleName email employeeRef')
      .sort({ roleCode: 1, userId: 1 })
      .lean();

    return users.map(u => ({
      _id: u._id,
      userId: u.userId,
      fullName: u.employeeRef?.fullName || u.userId,
      designation: u.employeeRef?.designation || u.roleName,
      roleCode: u.roleCode,
      roleName: u.roleName,
      email: u.email
    }));
  }

  /**
   * 5. Head Teacher Send Notifications (Strictly School-Scoped)
   */
  static async sendNotification({
    user,
    title,
    message,
    type = 'info',
    recipientMode = 'ROLE', // 'ROLE' | 'USERS'
    targetRoleCode = 'TEACHER', // 'TEACHER' | 'OFFICE_STAFF' | 'ALL_STAFF'
    targetUserIds = []
  }) {
    if (!title || !title.trim()) {
      const err = new Error('Notification title is required.');
      err.statusCode = 400;
      throw err;
    }
    if (!message || !message.trim()) {
      const err = new Error('Notification message is required.');
      err.statusCode = 400;
      throw err;
    }

    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const cleanType = ['info', 'success', 'warning', 'alert'].includes(String(type).toLowerCase())
      ? String(type).toLowerCase()
      : 'info';
    const batchId = crypto.randomUUID ? crypto.randomUUID() : `BATCH_${Date.now()}`;
    const senderName = user.employeeRef?.fullName || user.fullName || user.userId;

    let recipients = [];
    if (String(recipientMode).toUpperCase() === 'USERS') {
      if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
        const err = new Error('Please select at least one recipient user.');
        err.statusCode = 400;
        throw err;
      }
      const validIds = targetUserIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      // Strictly verify all recipients belong to the same school and permitted roles
      recipients = await UserInfo.find({
        _id: { $in: validIds },
        schoolId,
        status: 'ACTIVE',
        roleCode: { $in: ['TEACHER', 'OFFICE_STAFF'] }
      }).lean();

      if (recipients.length === 0) {
        const err = new Error('No valid permitted recipients found within your school.');
        err.statusCode = 400;
        throw err;
      }
    } else {
      const roleKey = String(targetRoleCode || '').toUpperCase();
      const allowedRoleFilter =
        roleKey === 'ALL_STAFF'
          ? ['TEACHER', 'OFFICE_STAFF']
          : ['TEACHER', 'OFFICE_STAFF'].includes(roleKey)
          ? [roleKey]
          : null;

      if (!allowedRoleFilter) {
        const err = new Error('Invalid recipient role. Head Teacher can notify Teachers or Office Staff within their school.');
        err.statusCode = 400;
        throw err;
      }

      recipients = await UserInfo.find({
        schoolId,
        status: 'ACTIVE',
        roleCode: { $in: allowedRoleFilter }
      }).lean();

      if (recipients.length === 0) {
        const err = new Error(`No active users found for role '${roleKey}' in your school.`);
        err.statusCode = 404;
        throw err;
      }
    }

    const docs = recipients.map(r => ({
      schoolRef,
      schoolId,
      targetUserRef: r._id,
      targetUserId: r.userId,
      targetRoleCode: r.roleCode,
      title: title.trim(),
      message: message.trim(),
      type: cleanType,
      isRead: false,
      sentByUserRef: user._id,
      sentByName: senderName,
      sentByRole: user.roleCode,
      batchId
    }));

    await NotificationInfo.insertMany(docs);

    await AuditLogService.log({
      schoolRef,
      schoolId,
      module: 'NOTIFICATIONS',
      entityType: 'NotificationInfo',
      entityId: batchId,
      action: 'NOTIFICATION_SENT',
      details: `Sent notification '${title.trim()}' to ${docs.length} recipient(s) (${recipientMode === 'USERS' ? 'Selected Users' : targetRoleCode})`,
      newValue: { title: title.trim(), recipientCount: docs.length, targetRoleCode, recipientMode },
      user
    });

    return {
      success: true,
      sentCount: docs.length,
      batchId,
      message: `Notification sent successfully to ${docs.length} user(s).`
    };
  }

  /**
   * 6. Sent Notification History for Head Teacher
   */
  static async getSentNotificationsHistory({ schoolId, page = 1, limit = 15 }) {
    const sId = schoolId.toUpperCase();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10) || 15));

    const sentDocs = await NotificationInfo.find({
      schoolId: sId,
      sentByRole: 'HEAD_TEACHER'
    })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    const batchMap = new Map();
    for (const d of sentDocs) {
      const key = d.batchId || d._id.toString();
      if (!batchMap.has(key)) {
        batchMap.set(key, {
          batchId: key,
          title: d.title,
          message: d.message,
          type: d.type,
          sentByName: d.sentByName,
          sentAt: d.createdAt,
          recipientCount: 0,
          readCount: 0,
          targetRoles: new Set(),
          recipientsPreview: []
        });
      }
      const b = batchMap.get(key);
      b.recipientCount++;
      if (d.isRead) b.readCount++;
      b.targetRoles.add(d.targetRoleCode);
      if (b.recipientsPreview.length < 5 && d.targetUserId) {
        b.recipientsPreview.push(d.targetUserId);
      }
    }

    const allBatches = Array.from(batchMap.values()).map(b => ({
      ...b,
      targetRoles: Array.from(b.targetRoles)
    }));

    const totalRecords = allBatches.length;
    const skip = (pageNum - 1) * limitNum;
    const history = allBatches.slice(skip, skip + limitNum);

    return {
      history,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }
}

module.exports = HeadTeacherModule6Service;
