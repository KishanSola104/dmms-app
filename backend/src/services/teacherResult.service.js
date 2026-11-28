const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const SchoolInfo = require('../models/schoolInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const EmployeeInfo = require('../models/employeeInfo.model');
const UserInfo = require('../models/userInfo.model');
const ClassSubjectInfo = require('../models/classSubjectInfo.model');
const ExaminationInfo = require('../models/examinationInfo.model');
const ExaminationClassInfo = require('../models/examinationClassInfo.model');
const ExaminationSubjectInfo = require('../models/examinationSubjectInfo.model');
const ExaminationComponentInfo = require('../models/examinationComponentInfo.model');
const StudentEnrollmentInfo = require('../models/studentEnrollmentInfo.model');
const SubjectTeacherAssignmentInfo = require('../models/subjectTeacherAssignmentInfo.model');
const MarksSubmissionInfo = require('../models/marksSubmissionInfo.model');
const MarksEntryInfo = require('../models/marksEntryInfo.model');
const ExaminationResultInfo = require('../models/examinationResultInfo.model');
const FinalAcademicResultInfo = require('../models/finalAcademicResultInfo.model');
const TeacherAccessService = require('./teacherAccess.service');
const TeacherService = require('./teacher.service');
const TeacherMarksService = require('./teacherMarks.service');
const SchoolResultConfigService = require('./schoolResultConfig.service');

class TeacherResultService {
  /**
   * Helper: Resolve local disk path for /uploads/... assets safely
   */
  static resolveUploadFilePath(relativeUrl) {
    if (!relativeUrl || typeof relativeUrl !== 'string') return null;
    if (!relativeUrl.startsWith('/uploads/')) return null;
    const cleanRel = relativeUrl.replace(/^\/+/, '');
    const fullPath = path.join(__dirname, '../../', cleanRel);
    return fs.existsSync(fullPath) ? fullPath : null;
  }

  /**
   * Helper: Resolve Class Teacher and Head Teacher signature file paths
   */
  static async resolveSignatures({ schoolId, classId, sectionId }) {
    const sId = schoolId.toUpperCase();
    const [cls, sec, htUser] = await Promise.all([
      ClassInfo.findOne({ _id: classId, schoolId: sId }).lean(),
      SectionInfo.findOne({ _id: sectionId, schoolId: sId }).lean(),
      UserInfo.findOne({ schoolId: sId, roleCode: 'HEAD_TEACHER', status: 'ACTIVE' }).lean()
    ]);

    const ctEmpId = sec?.sectionTeacherRef || cls?.classTeacherRef || null;
    const [ctEmp, htEmp] = await Promise.all([
      ctEmpId ? EmployeeInfo.findById(ctEmpId).select('fullName signatureUrl').lean() : Promise.resolve(null),
      htUser?.employeeRef ? EmployeeInfo.findById(htUser.employeeRef).select('fullName signatureUrl').lean() : Promise.resolve(null)
    ]);

    return {
      classTeacherName: ctEmp?.fullName || sec?.sectionTeacherName || cls?.classTeacherName || 'Class Teacher',
      classTeacherSignatureUrl: ctEmp?.signatureUrl || null,
      headTeacherName: htEmp?.fullName || 'Head Teacher',
      headTeacherSignatureUrl: htEmp?.signatureUrl || null
    };
  }

  /**
   * 1. Examination Results Context (Class Teacher Only)
   */
  static async getExaminationResultsContext({ user, academicYearId, examinationId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    const ctSections = await TeacherService.getClassTeacherAssignmentsList(schoolId, employeeRef);

    if (ctSections.length === 0) {
      const err = new Error('Access denied. Only Class Teachers can generate and manage examination results.');
      err.statusCode = 403;
      throw err;
    }

    if (!selectedYear) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        classTeacherSections: ctSections,
        examinations: [],
        readiness: { isReady: false, pendingItems: [] },
        results: []
      };
    }

    const ayId = selectedYear._id;
    let targetSec;
    if (sectionId) {
      targetSec = ctSections.find(
        s => s._id.toString() === String(sectionId) && (!classId || s.classRef.toString() === String(classId))
      );
      if (!targetSec) {
        const err = new Error('Access denied. You are not the assigned Class Teacher for this class and section.');
        err.statusCode = 403;
        throw err;
      }
    } else {
      targetSec = ctSections[0];
    }

    const examsInYear = await ExaminationInfo.find({
      schoolId,
      academicYearRef: ayId,
      status: { $ne: 'CANCELLED' }
    })
      .sort({ startDate: 1, createdAt: 1 })
      .lean();

    const examClassDocs = await ExaminationClassInfo.find({
      schoolId,
      examinationRef: { $in: examsInYear.map(e => e._id) },
      classRef: targetSec.classRef,
      status: 'ACTIVE'
    }).lean();

    const allowedExamIds = new Set(examClassDocs.map(ec => ec.examinationRef.toString()));
    const relevantExams = examsInYear.filter(e => allowedExamIds.has(e._id.toString()));
    const targetExam = relevantExams.find(e => e._id.toString() === String(examinationId)) || relevantExams[0] || null;

    if (!targetExam) {
      return {
        selectedAcademicYear: selectedYear,
        availableAcademicYears: academicYears,
        classTeacherSections: ctSections,
        selectedSection: targetSec,
        examinations: [],
        selectedExamination: null,
        readiness: { isReady: false, pendingItems: ['No examinations configured for this class.'] },
        results: []
      };
    }

    const [examSubjects, enrolledCount, submissions, results, config] = await Promise.all([
      ExaminationSubjectInfo.find({
        schoolId,
        examinationRef: targetExam._id,
        classRef: targetSec.classRef,
        status: 'ACTIVE'
      })
        .sort({ subjectCode: 1 })
        .lean(),
      StudentEnrollmentInfo.countDocuments({
        schoolId,
        academicYearRef: ayId,
        classRef: targetSec.classRef,
        sectionRef: targetSec._id,
        status: 'ACTIVE'
      }),
      MarksSubmissionInfo.find({
        schoolId,
        academicYearRef: ayId,
        examinationRef: targetExam._id,
        classRef: targetSec.classRef,
        sectionRef: targetSec._id
      }).lean(),
      ExaminationResultInfo.find({
        schoolId,
        academicYearRef: ayId,
        examinationRef: targetExam._id,
        classRef: targetSec.classRef,
        sectionRef: targetSec._id
      })
        .sort({ rollNumber: 1, studentName: 1 })
        .lean(),
      SchoolResultConfigService.getOrCreateConfig(schoolId)
    ]);

    const subBySubject = new Map();
    submissions.forEach(s => subBySubject.set(`${s.subjectRef.toString()}_${s.entryType}`, s));

    const pendingItems = [];
    if (examSubjects.length === 0) {
      pendingItems.push('No examination subjects configured by Admin for this class.');
    }
    if (enrolledCount === 0) {
      pendingItems.push('No active enrolled students found in this section.');
    }

    for (const es of examSubjects) {
      const entryType = es.subjectType === 'CO_CURRICULAR' ? 'CO_CURRICULAR_TERM' : 'EXAM_ACADEMIC';
      const sub = subBySubject.get(`${es.subjectRef.toString()}_${entryType}`);
      if (!sub || sub.status !== 'VERIFIED') {
        pendingItems.push(`${es.subjectName} (${sub ? sub.status : 'NOT_SUBMITTED'})`);
      }
    }

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      classTeacherSections: ctSections,
      selectedSection: targetSec,
      examinations: relevantExams,
      selectedExamination: targetExam,
      resultConfig: config,
      readiness: {
        isReady: pendingItems.length === 0,
        enrolledCount,
        configuredSubjectsCount: examSubjects.length,
        pendingItems
      },
      results
    };
  }

  /**
   * 2. Generate Examination Results (Class Teacher Only)
   */
  static async generateExaminationResults({ user, academicYearId, examinationId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const context = await this.getExaminationResultsContext({
      user,
      academicYearId,
      examinationId,
      classId,
      sectionId
    });

    if (!context.readiness.isReady) {
      const err = new Error(
        `Cannot generate examination results yet. Pending items: ${context.readiness.pendingItems.join('; ')}`
      );
      err.statusCode = 400;
      throw err;
    }

    const ayId = context.selectedAcademicYear._id;
    const exam = context.selectedExamination;
    const sec = context.selectedSection;
    const config = context.resultConfig;

    // Prevent overwriting submitted, under-review, approved, or published results
    const lockedResult = await ExaminationResultInfo.findOne({
      schoolId,
      academicYearRef: ayId,
      examinationRef: exam._id,
      classRef: sec.classRef,
      sectionRef: sec._id,
      status: { $in: ['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'] }
    }).lean();

    if (lockedResult) {
      const err = new Error('Examination results are locked while under review, approved, or published.');
      err.statusCode = 403;
      throw err;
    }

    const [examSubjects, enrollments, marksEntries, existingResults] = await Promise.all([
      ExaminationSubjectInfo.find({
        schoolId,
        examinationRef: exam._id,
        classRef: sec.classRef,
        status: 'ACTIVE'
      })
        .sort({ subjectCode: 1 })
        .lean(),
      StudentEnrollmentInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: sec.classRef,
        sectionRef: sec._id,
        status: 'ACTIVE'
      })
        .populate('studentRef', 'admissionNumber firstName middleName lastName')
        .lean(),
      MarksEntryInfo.find({
        schoolId,
        academicYearRef: ayId,
        examinationRef: exam._id,
        classRef: sec.classRef,
        sectionRef: sec._id
      }).lean(),
      ExaminationResultInfo.find({
        schoolId,
        academicYearRef: ayId,
        examinationRef: exam._id,
        classRef: sec.classRef,
        sectionRef: sec._id
      }).lean()
    ]);

    const entryMap = new Map();
    marksEntries.forEach(me => {
      entryMap.set(`${me.studentRef.toString()}_${me.subjectRef.toString()}_${me.entryType}`, me);
    });

    const existingByStudent = new Map();
    existingResults.forEach(r => existingByStudent.set(r.studentRef.toString(), r));

    const academicExamSubjects = examSubjects.filter(es => es.subjectType === 'ACADEMIC');
    const coCurricularExamSubjects = examSubjects.filter(es => es.subjectType === 'CO_CURRICULAR');
    const passingPct = config?.passingRules?.passingPercentage ?? 40;

    const generatedList = [];
    for (const enr of enrollments) {
      if (!enr.studentRef) continue;
      const stu = enr.studentRef;
      const stuIdStr = stu._id.toString();
      const studentName = [stu.firstName, stu.middleName, stu.lastName].filter(Boolean).join(' ');

      let totalMarksObtained = 0;
      let totalMaximumMarks = 0;
      let allAcademicPassing = true;

      const academicSubjects = academicExamSubjects.map(es => {
        const entry = entryMap.get(`${stuIdStr}_${es.subjectRef.toString()}_EXAM_ACADEMIC`);
        const isAbsent = !!entry?.isAbsent;
        const subMax = es.totalMaximumMarks || 0;
        const subObt = isAbsent ? 0 : (Number(entry?.totalMarksObtained) || 0);
        const pct = subMax > 0 ? Math.round((subObt / subMax) * 10000) / 100 : 0;
        const { grade, isPassing } = SchoolResultConfigService.computeGradeFromPercentage(pct, config);
        const subPass = !isAbsent && isPassing && pct >= passingPct;

        if (!subPass) allAcademicPassing = false;
        totalMarksObtained += subObt;
        totalMaximumMarks += subMax;

        return {
          subjectRef: es.subjectRef,
          subjectCode: es.subjectCode,
          subjectName: es.subjectName,
          components: (entry?.componentMarks || []).map(c => ({
            componentName: c.componentName,
            maximumMarks: c.maximumMarks,
            marksObtained: isAbsent ? 0 : (Number(c.marksObtained) || 0)
          })),
          totalMaximumMarks: subMax,
          totalMarksObtained: subObt,
          percentage: pct,
          grade,
          isAbsent,
          isPassing: subPass
        };
      });

      const coCurricularSubjects = coCurricularExamSubjects.map(es => {
        const entry = entryMap.get(`${stuIdStr}_${es.subjectRef.toString()}_CO_CURRICULAR_TERM`);
        return {
          subjectRef: es.subjectRef,
          subjectCode: es.subjectCode,
          subjectName: es.subjectName,
          grade: entry?.isAbsent ? 'AB' : (entry?.grade || ''),
          gradePoint: entry?.gradePoint ?? null,
          isAbsent: !!entry?.isAbsent
        };
      });

      const percentage = totalMaximumMarks > 0 ? Math.round((totalMarksObtained / totalMaximumMarks) * 10000) / 100 : 0;
      const { grade: overallGrade } = SchoolResultConfigService.computeGradeFromPercentage(percentage, config);
      const passedOverall =
        percentage >= passingPct &&
        (!config?.passingRules?.requireAllAcademicSubjectsPass || allAcademicPassing);
      const resultStatus = passedOverall
        ? (config?.passingRules?.passResultLabel || 'PASS')
        : (config?.passingRules?.failResultLabel || 'NEEDS IMPROVEMENT');

      const prev = existingByStudent.get(stuIdStr);
      const nextVersion = prev ? (prev.version || 1) + 1 : 1;

      const saved = await ExaminationResultInfo.findOneAndUpdate(
        {
          schoolId,
          academicYearRef: ayId,
          examinationRef: exam._id,
          classRef: sec.classRef,
          sectionRef: sec._id,
          studentRef: stu._id
        },
        {
          $set: {
            schoolRef,
            examinationCode: exam.examinationCode,
            examinationName: exam.examinationName,
            className: sec.className,
            sectionName: sec.sectionName,
            enrollmentRef: enr._id,
            admissionNumber: stu.admissionNumber,
            studentName,
            rollNumber: enr.rollNumber || '',
            academicSubjects,
            coCurricularSubjects,
            totalMarksObtained,
            totalMaximumMarks,
            percentage,
            overallGrade,
            resultStatus,
            termRemark: prev?.termRemark || '',
            termRemarkApproved: prev?.termRemarkApproved || false,
            status: 'GENERATED',
            returnReason: '',
            returnedByUserRef: null,
            returnedAt: null,
            reviewedByUserRef: null,
            reviewedAt: null,
            version: nextVersion,
            configVersion: config.version || 1,
            configSnapshot: config,
            generatedByUserRef: user._id,
            generatedByEmployeeRef: employeeRef,
            generatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      ).lean();

      generatedList.push(saved);
    }

    await TeacherMarksService.logAudit({
      schoolRef,
      schoolId,
      academicYearRef: ayId,
      examinationRef: exam._id,
      classRef: sec.classRef,
      sectionRef: sec._id,
      action: 'EXAM_RESULT_GENERATED',
      details: `Generated ${exam.examinationName} results for ${sec.className} - ${sec.sectionName} (${generatedList.length} students)`,
      user
    });

    return {
      success: true,
      generatedCount: generatedList.length,
      results: generatedList,
      message: `Generated ${exam.examinationName} results for ${generatedList.length} student(s).`
    };
  }

  /**
   * 3. Suggest & Update Term-Wise Remark (Positive, Student-Friendly, No Subject-Wise Suggestions)
   */
  static buildPositiveTermRemark({ studentName, percentage, absentCount, examinationName }) {
    const pct = Number(percentage) || 0;
    const firstName = (studentName || 'The student').split(' ')[0];
    if (absentCount > 0) {
      return `${firstName} showed dedication in ${examinationName} and will benefit from regular attendance and steady practice to achieve even stronger outcomes.`;
    }
    if (pct >= 90) {
      return `Outstanding performance by ${firstName} in ${examinationName}! Keep up the curiosity, consistency, and enthusiasm for learning.`;
    }
    if (pct >= 80) {
      return `Excellent effort in ${examinationName}. ${firstName} demonstrates strong understanding and steady academic commitment.`;
    }
    if (pct >= 70) {
      return `Very good progress in ${examinationName}. With continued focus and regular revision, ${firstName} can reach even higher milestones.`;
    }
    if (pct >= 60) {
      return `Good effort in ${examinationName}. ${firstName} is building a solid foundation and regular practice will further strengthen confidence.`;
    }
    if (pct >= 40) {
      return `${firstName} has made steady progress in ${examinationName}. Consistent daily revision and active classroom participation will help develop greater confidence.`;
    }
    return `${firstName} shows potential and is encouraged to keep practicing consistently. With guided support and steady effort, stronger results are within reach.`;
  }

  static async updateOrSuggestTermRemark({ user, resultId, termRemark, approve = true, suggestOnly = false }) {
    const schoolId = user.schoolId.toUpperCase();
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const result = await ExaminationResultInfo.findOne({ _id: resultId, schoolId });
    if (!result) {
      const err = new Error('Examination result record not found.');
      err.statusCode = 404;
      throw err;
    }

    const isCT = await TeacherAccessService.isClassTeacherForSection({
      schoolId,
      employeeRef,
      classId: result.classRef,
      sectionId: result.sectionRef
    });
    if (!isCT) {
      const err = new Error('Access denied. Only the Class Teacher can manage term remarks.');
      err.statusCode = 403;
      throw err;
    }

    if (suggestOnly) {
      const absentCount = (result.academicSubjects || []).filter(s => s.isAbsent).length;
      const suggestion = this.buildPositiveTermRemark({
        studentName: result.studentName,
        percentage: result.percentage,
        absentCount,
        examinationName: result.examinationName
      });
      return { success: true, suggestedRemark: suggestion };
    }

    if (['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(result.status)) {
      const err = new Error('Cannot modify remarks once submitted, under review, approved, or published.');
      err.statusCode = 403;
      throw err;
    }

    result.termRemark = typeof termRemark === 'string' ? termRemark.trim() : '';
    result.termRemarkApproved = !!approve;
    await result.save();

    return { success: true, result: result.toObject(), message: 'Term remark saved.' };
  }

  /**
   * 4. Submit Examination Results to Head Teacher for Review
   */
  static async submitExaminationResultsToHeadTeacher({ user, academicYearId, examinationId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const { selectedYear } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) throw new Error('Academic year not found.');

    const isCT = await TeacherAccessService.isClassTeacherForSection({
      schoolId,
      employeeRef,
      classId,
      sectionId
    });
    if (!isCT) {
      const err = new Error('Access denied. Only the Class Teacher can submit examination results.');
      err.statusCode = 403;
      throw err;
    }

    const results = await ExaminationResultInfo.find({
      schoolId,
      academicYearRef: selectedYear._id,
      examinationRef: examinationId,
      classRef: classId,
      sectionRef: sectionId
    });

    if (results.length === 0) {
      const err = new Error('Please generate examination results before submitting to the Head Teacher.');
      err.statusCode = 400;
      throw err;
    }

    const locked = results.some(r => ['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(r.status));
    if (locked) {
      const err = new Error('One or more examination results are already submitted, under review, approved, or published.');
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    await ExaminationResultInfo.updateMany(
      {
        schoolId,
        academicYearRef: selectedYear._id,
        examinationRef: examinationId,
        classRef: classId,
        sectionRef: sectionId,
        status: { $in: ['GENERATED', 'RETURNED'] }
      },
      {
        $set: {
          status: 'SUBMITTED_TO_HEAD_TEACHER',
          submittedByUserRef: user._id,
          submittedAt: now,
          returnReason: '',
          returnedByUserRef: null,
          returnedAt: null
        }
      }
    );

    const exam = await ExaminationInfo.findById(examinationId).lean();
    const sec = await SectionInfo.findById(sectionId).lean();
    const htUsers = await UserInfo.find({ schoolId, roleCode: 'HEAD_TEACHER', status: 'ACTIVE' }).lean();
    const teacherName = user.employeeRef?.fullName || user.fullName || user.userId;

    for (const ht of htUsers) {
      await TeacherMarksService.notifyUser({
        schoolRef,
        schoolId,
        targetUser: ht,
        title: 'Examination Results Submitted for Review',
        message: `${teacherName} submitted ${exam?.examinationName || 'Examination'} results for ${sec?.className || ''} - ${sec?.sectionName || ''} (${results.length} students).`,
        type: 'info'
      });
    }

    await TeacherMarksService.logAudit({
      schoolRef,
      schoolId,
      academicYearRef: selectedYear._id,
      examinationRef: examinationId,
      classRef: classId,
      sectionRef: sectionId,
      action: 'EXAM_RESULT_SUBMITTED',
      details: `Submitted ${exam?.examinationName || 'Examination'} results for ${sec?.className || ''} - ${sec?.sectionName || ''}`,
      user
    });

    return {
      success: true,
      submittedCount: results.length,
      message: 'Examination results submitted to Head Teacher for review.'
    };
  }

  /**
   * 5. Final Result Context & Comprehensive Readiness Check (Class Teacher Only)
   */
  static async getFinalResultContext({ user, academicYearId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    const ctSections = await TeacherService.getClassTeacherAssignmentsList(schoolId, employeeRef);

    if (ctSections.length === 0) {
      const err = new Error('Access denied. Only Class Teachers can generate final academic results.');
      err.statusCode = 403;
      throw err;
    }

    if (!selectedYear) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        classTeacherSections: ctSections,
        readiness: { isReady: false, pendingItems: [] },
        results: []
      };
    }

    const ayId = selectedYear._id;
    let targetSec;
    if (sectionId) {
      targetSec = ctSections.find(
        s => s._id.toString() === String(sectionId) && (!classId || s.classRef.toString() === String(classId))
      );
      if (!targetSec) {
        const err = new Error('Access denied. You are not the assigned Class Teacher for this class and section.');
        err.statusCode = 403;
        throw err;
      }
    } else {
      targetSec = ctSections[0];
    }

    const [config, allExamsInYear, classSubjects, enrolledCount, submissions, examResults, finalResults] = await Promise.all([
      SchoolResultConfigService.getOrCreateConfig(schoolId),
      ExaminationInfo.find({
        schoolId,
        academicYearRef: ayId,
        status: { $ne: 'CANCELLED' }
      })
        .sort({ startDate: 1, createdAt: 1 })
        .lean(),
      ClassSubjectInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: targetSec.classRef,
        status: 'ACTIVE'
      })
        .sort({ subjectCode: 1 })
        .lean(),
      StudentEnrollmentInfo.countDocuments({
        schoolId,
        academicYearRef: ayId,
        classRef: targetSec.classRef,
        sectionRef: targetSec._id,
        status: 'ACTIVE'
      }),
      MarksSubmissionInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: targetSec.classRef,
        sectionRef: targetSec._id
      }).lean(),
      ExaminationResultInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: targetSec.classRef,
        sectionRef: targetSec._id
      }).lean(),
      FinalAcademicResultInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: targetSec.classRef,
        sectionRef: targetSec._id
      })
        .sort({ rollNumber: 1, studentName: 1 })
        .lean()
    ]);

    const examClassDocs = await ExaminationClassInfo.find({
      schoolId,
      examinationRef: { $in: allExamsInYear.map(e => e._id) },
      classRef: targetSec.classRef,
      status: 'ACTIVE'
    }).lean();

    const assignedExamIdSet = new Set(examClassDocs.map(ec => ec.examinationRef.toString()));
    const classExams = allExamsInYear.filter(e => assignedExamIdSet.has(e._id.toString()));

    const examSubjectsAll = await ExaminationSubjectInfo.find({
      schoolId,
      examinationRef: { $in: classExams.map(e => e._id) },
      classRef: targetSec.classRef,
      status: 'ACTIVE'
    }).lean();

    const subMap = new Map();
    submissions.forEach(s => {
      subMap.set(`${s.examinationRef ? s.examinationRef.toString() : 'NULL'}_${s.subjectRef.toString()}_${s.entryType}`, s);
    });

    const pendingItems = [];
    const expectedCount = config?.academicFinalRule?.expectedExamCount ?? 3;

    if (enrolledCount === 0) {
      pendingItems.push('No active enrolled students found in this section.');
    }

    if (classExams.length < expectedCount) {
      pendingItems.push(
        `Configured examinations (${classExams.length}) is fewer than expected (${expectedCount}) for final academic result.`
      );
    }

    for (const ex of classExams) {
      if (ex.status !== 'COMPLETED') {
        pendingItems.push(`Examination "${ex.examinationName}" is '${ex.status}' (must be COMPLETED).`);
      }

      const exSubs = examSubjectsAll.filter(es => es.examinationRef.toString() === ex._id.toString());
      if (exSubs.length === 0) {
        pendingItems.push(`Examination "${ex.examinationName}" has no configured subjects for ${targetSec.className}.`);
      }
      for (const es of exSubs) {
        const entryType = es.subjectType === 'CO_CURRICULAR' ? 'CO_CURRICULAR_TERM' : 'EXAM_ACADEMIC';
        const sub = subMap.get(`${ex._id.toString()}_${es.subjectRef.toString()}_${entryType}`);
        if (!sub || sub.status !== 'VERIFIED') {
          pendingItems.push(`${ex.examinationName} - ${es.subjectName}: ${sub ? sub.status : 'NOT_SUBMITTED'}`);
        }
      }

      const exResCount = examResults.filter(r => r.examinationRef.toString() === ex._id.toString()).length;
      if (exResCount < enrolledCount || enrolledCount === 0) {
        pendingItems.push(`Examination result for "${ex.examinationName}" not generated for all students (${exResCount}/${enrolledCount}).`);
      }
    }

    // Extra / Project components readiness
    const extraSubjects = classSubjects.filter(cs => cs.hasAdditionalComponents && cs.additionalComponents?.length > 0);
    for (const cs of extraSubjects) {
      const sub = subMap.get(`NULL_${cs.subjectRef.toString()}_EXTRA_COMPONENT`);
      if (!sub || sub.status !== 'VERIFIED') {
        pendingItems.push(`Extra/Project Component - ${cs.subjectName}: ${sub ? sub.status : 'NOT_SUBMITTED'}`);
      }
    }

    // Option B Co-curricular Final readiness
    if (config?.coCurricularConfig?.finalWorkflow === 'SEPARATE_SUBMISSION') {
      const ccSubjects = classSubjects.filter(cs => cs.subjectType === 'CO_CURRICULAR');
      for (const cs of ccSubjects) {
        const sub = subMap.get(`NULL_${cs.subjectRef.toString()}_CO_CURRICULAR_FINAL`);
        if (!sub || sub.status !== 'VERIFIED') {
          pendingItems.push(`Final Co-curricular Grade - ${cs.subjectName}: ${sub ? sub.status : 'NOT_SUBMITTED'}`);
        }
      }
    }

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      classTeacherSections: ctSections,
      selectedSection: targetSec,
      examinations: classExams,
      classSubjects,
      resultConfig: config,
      readiness: {
        isReady: pendingItems.length === 0,
        enrolledCount,
        examsCount: classExams.length,
        expectedExamCount: expectedCount,
        pendingItems
      },
      results: finalResults
    };
  }

  /**
   * 6. Generate Comprehensive Final Academic Results (Class Teacher Only)
   */
  static async generateFinalResults({ user, academicYearId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const context = await this.getFinalResultContext({ user, academicYearId, classId, sectionId });

    if (!context.readiness.isReady) {
      const err = new Error(
        `Final result generation blocked. Pending requirements: ${context.readiness.pendingItems.slice(0, 6).join('; ')}`
      );
      err.statusCode = 400;
      throw err;
    }

    const ayId = context.selectedAcademicYear._id;
    const sec = context.selectedSection;
    const config = context.resultConfig;
    const exams = context.examinations;
    const classSubjects = context.classSubjects;

    const locked = await FinalAcademicResultInfo.findOne({
      schoolId,
      academicYearRef: ayId,
      classRef: sec.classRef,
      sectionRef: sec._id,
      status: { $in: ['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'] }
    }).lean();

    if (locked) {
      const err = new Error('Final results are locked while submitted, under review, approved, or published.');
      err.statusCode = 403;
      throw err;
    }

    const [enrollments, examResults, extraEntries, finalCcEntries, existingFinal] = await Promise.all([
      StudentEnrollmentInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: sec.classRef,
        sectionRef: sec._id,
        status: 'ACTIVE'
      })
        .populate('studentRef', 'admissionNumber firstName middleName lastName')
        .lean(),
      ExaminationResultInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: sec.classRef,
        sectionRef: sec._id
      }).lean(),
      MarksEntryInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: sec.classRef,
        sectionRef: sec._id,
        entryType: 'EXTRA_COMPONENT'
      }).lean(),
      MarksEntryInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: sec.classRef,
        sectionRef: sec._id,
        entryType: 'CO_CURRICULAR_FINAL'
      }).lean(),
      FinalAcademicResultInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: sec.classRef,
        sectionRef: sec._id
      }).lean()
    ]);

    const examResultMap = new Map();
    examResults.forEach(er => examResultMap.set(`${er.studentRef.toString()}_${er.examinationRef.toString()}`, er));

    const extraMap = new Map();
    extraEntries.forEach(ee => extraMap.set(`${ee.studentRef.toString()}_${ee.subjectRef.toString()}`, ee));

    const finalCcMap = new Map();
    finalCcEntries.forEach(ce => finalCcMap.set(`${ce.studentRef.toString()}_${ce.subjectRef.toString()}`, ce));

    const existingFinalMap = new Map();
    existingFinal.forEach(ef => existingFinalMap.set(ef.studentRef.toString(), ef));

    const academicClassSubjects = classSubjects.filter(cs => cs.subjectType === 'ACADEMIC');
    const coCurricClassSubjects = classSubjects.filter(cs => cs.subjectType === 'CO_CURRICULAR');
    const passingPct = config?.passingRules?.passingPercentage ?? 40;
    const ccWorkflow = config?.coCurricularConfig?.finalWorkflow || 'AUTO_AVERAGE';

    const generated = [];
    for (const enr of enrollments) {
      if (!enr.studentRef) continue;
      const stu = enr.studentRef;
      const stuIdStr = stu._id.toString();
      const studentName = [stu.firstName, stu.middleName, stu.lastName].filter(Boolean).join(' ');

      const examinationsIncluded = [];
      const termRemarks = [];
      for (const ex of exams) {
        const er = examResultMap.get(`${stuIdStr}_${ex._id.toString()}`);
        examinationsIncluded.push({
          examinationRef: ex._id,
          examinationCode: ex.examinationCode,
          examinationName: ex.examinationName,
          resultRef: er?._id || null
        });
        termRemarks.push({
          examinationRef: ex._id,
          examinationCode: ex.examinationCode,
          examinationName: ex.examinationName,
          remark: er?.termRemark || ''
        });
      }

      let overallTotalObtained = 0;
      let overallMaxMarks = 0;
      let allAcademicPass = true;

      const academicSubjects = academicClassSubjects.map(cs => {
        const subjIdStr = cs.subjectRef.toString();
        const termResults = exams.map(ex => {
          const er = examResultMap.get(`${stuIdStr}_${ex._id.toString()}`);
          const subRes = er?.academicSubjects?.find(s => s.subjectRef.toString() === subjIdStr);
          return {
            examinationRef: ex._id,
            examinationCode: ex.examinationCode,
            examinationName: ex.examinationName,
            components: subRes?.components || [],
            totalObtained: subRes?.totalMarksObtained || 0,
            totalMaximum: subRes?.totalMaximumMarks || 0,
            isAbsent: !!subRes?.isAbsent
          };
        });

        const extraEntry = extraMap.get(`${stuIdStr}_${subjIdStr}`);
        const additionalMarksObtained = extraEntry && !extraEntry.isAbsent ? (Number(extraEntry.totalMarksObtained) || 0) : 0;
        const additionalMarksMax = cs.hasAdditionalComponents ? (cs.totalAdditionalMarks || 0) : 0;

        const computed = SchoolResultConfigService.computeFinalAcademicSubject({
          termEntries: termResults,
          additionalObtained: additionalMarksObtained,
          additionalMax: additionalMarksMax,
          config
        });

        if (!computed.isPassing) allAcademicPass = false;
        overallTotalObtained += computed.finalMarksObtained;
        overallMaxMarks += computed.finalMaxMarks;

        return {
          subjectRef: cs.subjectRef,
          subjectCode: cs.subjectCode,
          subjectName: cs.subjectName,
          termResults,
          additionalComponents: extraEntry?.componentMarks || [],
          additionalMarksObtained,
          additionalMarksMax,
          finalMarksObtained: computed.finalMarksObtained,
          finalMaxMarks: computed.finalMaxMarks,
          percentage: computed.percentage,
          grade: computed.grade,
          isPassing: computed.isPassing
        };
      });

      const coCurricularSubjects = coCurricClassSubjects.map(cs => {
        const subjIdStr = cs.subjectRef.toString();
        const termGrades = exams.map(ex => {
          const er = examResultMap.get(`${stuIdStr}_${ex._id.toString()}`);
          const ccRes = er?.coCurricularSubjects?.find(s => s.subjectRef.toString() === subjIdStr);
          return {
            examinationRef: ex._id,
            examinationCode: ex.examinationCode,
            examinationName: ex.examinationName,
            grade: ccRes?.grade || ''
          };
        });

        let finalGrade = '';
        let finalGradePoint = null;

        if (ccWorkflow === 'SEPARATE_SUBMISSION') {
          const finEntry = finalCcMap.get(`${stuIdStr}_${subjIdStr}`);
          finalGrade = finEntry?.isAbsent ? 'AB' : (finEntry?.grade || '');
          finalGradePoint = finEntry?.gradePoint ?? null;
        } else {
          const calc = SchoolResultConfigService.computeCoCurricularFinalGrade(
            termGrades.map(t => t.grade),
            config
          );
          finalGrade = calc.finalGrade;
          finalGradePoint = calc.finalGradePoint;
        }

        return {
          subjectRef: cs.subjectRef,
          subjectCode: cs.subjectCode,
          subjectName: cs.subjectName,
          termGrades,
          finalGrade,
          finalGradePoint,
          workflowUsed: ccWorkflow
        };
      });

      const finalPercentage =
        overallMaxMarks > 0 ? Math.round((overallTotalObtained / overallMaxMarks) * 10000) / 100 : 0;
      const { grade: overallGrade } = SchoolResultConfigService.computeGradeFromPercentage(finalPercentage, config);
      const passedOverall =
        finalPercentage >= passingPct &&
        (!config?.passingRules?.requireAllAcademicSubjectsPass || allAcademicPass);
      const resultStatus = passedOverall
        ? (config?.passingRules?.passResultLabel || 'PASS')
        : (config?.passingRules?.failResultLabel || 'NEEDS IMPROVEMENT');
      const promotionStatus = passedOverall ? 'PROMOTED' : 'RETAINED';

      const prev = existingFinalMap.get(stuIdStr);
      const nextVersion = prev ? (prev.version || 1) + 1 : 1;

      const saved = await FinalAcademicResultInfo.findOneAndUpdate(
        {
          schoolId,
          academicYearRef: ayId,
          classRef: sec.classRef,
          sectionRef: sec._id,
          studentRef: stu._id
        },
        {
          $set: {
            schoolRef,
            academicYearName: context.selectedAcademicYear.yearName || context.selectedAcademicYear.yearCode,
            className: sec.className,
            sectionName: sec.sectionName,
            enrollmentRef: enr._id,
            admissionNumber: stu.admissionNumber,
            studentName,
            rollNumber: enr.rollNumber || '',
            examinationsIncluded,
            academicSubjects,
            coCurricularSubjects,
            overallTotalObtained,
            overallMaxMarks,
            finalPercentage,
            overallGrade,
            resultStatus,
            promotionStatus,
            termRemarks,
            finalRemark: prev?.finalRemark || '',
            finalRemarkApproved: prev?.finalRemarkApproved || false,
            status: 'GENERATED',
            returnReason: '',
            returnedByUserRef: null,
            returnedAt: null,
            reviewedByUserRef: null,
            reviewedAt: null,
            version: nextVersion,
            configVersion: config.version || 1,
            configSnapshot: config,
            generatedByUserRef: user._id,
            generatedByEmployeeRef: employeeRef,
            generatedAt: new Date()
          }
        },
        { upsert: true, new: true }
      ).lean();

      generated.push(saved);
    }

    await TeacherMarksService.logAudit({
      schoolRef,
      schoolId,
      academicYearRef: ayId,
      classRef: sec.classRef,
      sectionRef: sec._id,
      action: 'FINAL_RESULT_GENERATED',
      details: `Generated Comprehensive Final Results for ${sec.className} - ${sec.sectionName} (${generated.length} students, Config v${config.version})`,
      user
    });

    return {
      success: true,
      generatedCount: generated.length,
      results: generated,
      message: `Generated Final Academic Results for ${generated.length} student(s).`
    };
  }

  /**
   * 7. Suggest & Update Final Overall Remark (Positive, No Subject-Wise Suggestions)
   */
  static async updateOrSuggestFinalRemark({ user, finalResultId, finalRemark, approve = true, suggestOnly = false }) {
    const schoolId = user.schoolId.toUpperCase();
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const result = await FinalAcademicResultInfo.findOne({ _id: finalResultId, schoolId });
    if (!result) {
      const err = new Error('Final academic result record not found.');
      err.statusCode = 404;
      throw err;
    }

    const isCT = await TeacherAccessService.isClassTeacherForSection({
      schoolId,
      employeeRef,
      classId: result.classRef,
      sectionId: result.sectionRef
    });
    if (!isCT) {
      const err = new Error('Access denied. Only the Class Teacher can manage final remarks.');
      err.statusCode = 403;
      throw err;
    }

    if (suggestOnly) {
      const firstName = (result.studentName || 'The student').split(' ')[0];
      const pct = Number(result.finalPercentage) || 0;
      let suggestedRemark = '';
      if (pct >= 90) {
        suggestedRemark = `Congratulations ${firstName} on an outstanding academic year! Your dedication, consistency, and positive attitude are truly commendable.`;
      } else if (pct >= 80) {
        suggestedRemark = `Well done, ${firstName}! You have had an excellent academic year with consistent effort across all terms.`;
      } else if (pct >= 70) {
        suggestedRemark = `Very good overall performance throughout the academic year. ${firstName} has shown commendable growth and enthusiasm.`;
      } else if (pct >= 60) {
        suggestedRemark = `Good progress across the academic year. Continued curiosity and regular practice will help ${firstName} achieve even greater heights.`;
      } else if (pct >= 40) {
        suggestedRemark = `${firstName} has shown steady improvement through the year. Regular revision and active participation will build strong confidence ahead.`;
      } else {
        suggestedRemark = `${firstName} shows genuine potential and benefits from steady encouragement and consistent daily practice. Keep striving forward!`;
      }
      return { success: true, suggestedRemark };
    }

    if (['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(result.status)) {
      const err = new Error('Cannot modify remarks on a submitted, under review, approved, or published final result.');
      err.statusCode = 403;
      throw err;
    }

    result.finalRemark = typeof finalRemark === 'string' ? finalRemark.trim() : '';
    result.finalRemarkApproved = !!approve;
    await result.save();

    return { success: true, result: result.toObject(), message: 'Final overall remark saved.' };
  }

  /**
   * 8. Submit Final Results to Head Teacher
   */
  static async submitFinalResultsToHeadTeacher({ user, academicYearId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const { selectedYear } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) throw new Error('Academic year not found.');

    const isCT = await TeacherAccessService.isClassTeacherForSection({
      schoolId,
      employeeRef,
      classId,
      sectionId
    });
    if (!isCT) {
      const err = new Error('Access denied. Only the Class Teacher can submit final results.');
      err.statusCode = 403;
      throw err;
    }

    const results = await FinalAcademicResultInfo.find({
      schoolId,
      academicYearRef: selectedYear._id,
      classRef: classId,
      sectionRef: sectionId
    });

    if (results.length === 0) {
      const err = new Error('Please generate final academic results before submitting to the Head Teacher.');
      err.statusCode = 400;
      throw err;
    }

    if (results.some(r => ['SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'].includes(r.status))) {
      const err = new Error('Final results are already submitted, under review, approved, or published.');
      err.statusCode = 400;
      throw err;
    }

    await FinalAcademicResultInfo.updateMany(
      {
        schoolId,
        academicYearRef: selectedYear._id,
        classRef: classId,
        sectionRef: sectionId,
        status: { $in: ['GENERATED', 'RETURNED'] }
      },
      {
        $set: {
          status: 'SUBMITTED_TO_HEAD_TEACHER',
          submittedByUserRef: user._id,
          submittedAt: new Date(),
          returnReason: '',
          returnedByUserRef: null,
          returnedAt: null
        }
      }
    );

    const sec = await SectionInfo.findById(sectionId).lean();
    const htUsers = await UserInfo.find({ schoolId, roleCode: 'HEAD_TEACHER', status: 'ACTIVE' }).lean();
    const teacherName = user.employeeRef?.fullName || user.fullName || user.userId;

    for (const ht of htUsers) {
      await TeacherMarksService.notifyUser({
        schoolRef,
        schoolId,
        targetUser: ht,
        title: 'Final Academic Results Submitted for Review',
        message: `${teacherName} submitted Final Academic Results for ${sec?.className || ''} - ${sec?.sectionName || ''} (${results.length} students).`,
        type: 'info'
      });
    }

    await TeacherMarksService.logAudit({
      schoolRef,
      schoolId,
      academicYearRef: selectedYear._id,
      classRef: classId,
      sectionRef: sectionId,
      action: 'FINAL_RESULT_SUBMITTED',
      details: `Submitted Final Academic Results for ${sec?.className || ''} - ${sec?.sectionName || ''}`,
      user
    });

    return {
      success: true,
      submittedCount: results.length,
      message: 'Final academic results submitted to Head Teacher for review.'
    };
  }

  static drawMarksheetOuterFrame(doc) {
    const pw = doc.page.width;
    const ph = doc.page.height;
    doc.save();
    doc.rect(18, 18, pw - 36, ph - 36).strokeColor('#0f172a').lineWidth(1.2).stroke();
    doc.rect(22, 22, pw - 44, ph - 44).strokeColor('#475569').lineWidth(0.5).stroke();
    doc.restore();
  }

  static formatFormulaLegend(configSnapshot = {}, fallbackConfig = {}) {
    const rule = configSnapshot?.academicFinalRule || fallbackConfig?.academicFinalRule || {};
    const addLabel = rule.includeAdditionalComponents !== false ? ' + Project / Additional' : '';
    if (rule.formulaType === 'WEIGHTED_SUM_PLUS_ADDITIONAL') {
      return `Formula: Weighted Sum of Terms${addLabel}`;
    }
    if (rule.formulaType === 'DIRECT_AVERAGE_PLUS_ADDITIONAL') {
      return `Formula: Average of Terms${addLabel}`;
    }
    const divisor = rule.termSumDivisor || 2;
    return `Formula: (Sum of Terms) / ${divisor}${addLabel}`;
  }

  static formatGradingScaleSummary(configSnapshot = {}, fallbackConfig = {}) {
    const scale =
      (Array.isArray(configSnapshot?.gradingScale) && configSnapshot.gradingScale.length > 0
        ? configSnapshot.gradingScale
        : fallbackConfig?.gradingScale) || [];
    if (scale.length === 0) return 'Standard institutional grading scale';

    return [...scale]
      .sort((a, b) => (b.minPercentage ?? 0) - (a.minPercentage ?? 0))
      .map(b => {
        const min = b.minPercentage ?? 0;
        const max = b.maxPercentage ?? 100;
        const range = min === 0 && max < 100 ? `<${max}%` : `${min}-${max}%`;
        return `${b.grade}: ${range}`;
      })
      .join('   |   ');
  }

  static drawSignatureBlock(doc, { xStart, width, sigY, signatures, ctSigPath, htSigPath, showLabels = true }) {
    const colW = Math.floor(width / 3);
    const sigImgW = Math.min(84, colW - 24);

    if (ctSigPath) {
      try {
        doc.image(ctSigPath, xStart + (colW - sigImgW) / 2, sigY - 34, { width: sigImgW, height: 30, fit: [sigImgW, 30] });
      } catch (e) {}
    }
    if (htSigPath) {
      try {
        doc.image(htSigPath, xStart + colW + (colW - sigImgW) / 2, sigY - 34, { width: sigImgW, height: 30, fit: [sigImgW, 30] });
      } catch (e) {}
    }

    doc.save();
    doc.strokeColor('#334155').lineWidth(0.75);
    doc.moveTo(xStart + 14, sigY).lineTo(xStart + colW - 14, sigY).stroke();
    doc.moveTo(xStart + colW + 14, sigY).lineTo(xStart + 2 * colW - 14, sigY).stroke();
    doc.moveTo(xStart + 2 * colW + 14, sigY).lineTo(xStart + 3 * colW - 14, sigY).stroke();
    doc.restore();

    if (showLabels) {
      doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#0f172a');
      doc.text('Class Teacher', xStart + 6, sigY + 4, { width: colW - 12, align: 'center' });
      doc.text('Head Teacher', xStart + colW + 6, sigY + 4, { width: colW - 12, align: 'center' });
      doc.text('Guardian', xStart + 2 * colW + 6, sigY + 4, { width: colW - 12, align: 'center' });

      if (signatures) {
        doc.font('Helvetica').fontSize(7.2).fillColor('#475569');
        doc.text(signatures.classTeacherName || '', xStart + 6, sigY + 15, { width: colW - 12, align: 'center', ellipsis: true });
        doc.text(signatures.headTeacherName || '', xStart + colW + 6, sigY + 15, { width: colW - 12, align: 'center', ellipsis: true });
      }
    }
  }

  /**
   * 9. Generate Individual Term Result Card A4 PDF (Progress and advancement Card Style)
   */
  static async generateTermResultPdf({ user, resultId }) {
    const schoolId = user.schoolId.toUpperCase();
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const result = await ExaminationResultInfo.findOne({ _id: resultId, schoolId })
      .populate('academicYearRef', 'yearName yearCode')
      .lean();

    if (!result) {
      const err = new Error('Examination result record not found.');
      err.statusCode = 404;
      throw err;
    }

    const isCT = await TeacherAccessService.isClassTeacherForSection({
      schoolId,
      employeeRef,
      classId: result.classRef,
      sectionId: result.sectionRef
    });
    if (user.roleCode === 'OFFICE_STAFF') {
      if (result.status !== 'PUBLISHED') {
        const err = new Error('Access denied. Office Staff can only access officially published results.');
        err.statusCode = 403;
        throw err;
      }
    } else if (!isCT && user.roleCode !== 'HEAD_TEACHER' && user.roleCode !== 'ADMIN') {
      const err = new Error('Access denied. You are not authorized to download this marksheet.');
      err.statusCode = 403;
      throw err;
    }

    const [school, signatures, config] = await Promise.all([
      SchoolInfo.findOne({ schoolId }).lean(),
      this.resolveSignatures({ schoolId, classId: result.classRef, sectionId: result.sectionRef }),
      SchoolResultConfigService.getOrCreateConfig(schoolId)
    ]);

    const showESig = config?.useESignaturesOnMarksheet !== false && result.configSnapshot?.useESignaturesOnMarksheet !== false;
    const logoPath = this.resolveUploadFilePath(school?.schoolLogoUrl);
    const ctSigPath = showESig ? this.resolveUploadFilePath(signatures.classTeacherSignatureUrl) : null;
    const htSigPath = showESig ? this.resolveUploadFilePath(signatures.headTeacherSignatureUrl) : null;

    // Collect distinct component columns dynamically and check uniform max marks
    const compNames = [];
    const seenComp = new Set();
    const compMaxValues = new Map();
    let totalMaxUniform = null;
    let totalMaxVaries = false;

    for (const sub of result.academicSubjects || []) {
      const subMax = Number(sub.totalMaximumMarks) || 0;
      if (totalMaxUniform === null) totalMaxUniform = subMax;
      else if (totalMaxUniform !== subMax) totalMaxVaries = true;

      for (const c of sub.components || []) {
        if (!seenComp.has(c.componentName)) {
          seenComp.add(c.componentName);
          compNames.push(c.componentName);
        }
        if (!compMaxValues.has(c.componentName)) compMaxValues.set(c.componentName, new Set());
        compMaxValues.get(c.componentName).add(Number(c.maximumMarks) || 0);
      }
    }

    const buffer = await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'portrait' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        this.drawMarksheetOuterFrame(doc);
        const left = 34;
        const contentW = doc.page.width - 68; // 527pt

        // Header (Classic Centered Progress and advancement Card)
        let headerY = 34;
        if (logoPath) {
          try {
            doc.image(logoPath, left + 4, headerY, { width: 44, height: 44, fit: [44, 44] });
          } catch (e) {}
        }
        doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a').text(
          (school?.schoolName || 'SCHOOL PROGRESS CARD').toUpperCase(),
          left + (logoPath ? 52 : 0),
          headerY + 2,
          { width: contentW - (logoPath ? 52 : 0), align: 'center' }
        );
        if (school?.address) {
          doc.font('Helvetica').fontSize(8).fillColor('#475569').text(
            school.address,
            left + (logoPath ? 52 : 0),
            doc.y + 1,
            { width: contentW - (logoPath ? 52 : 0), align: 'center' }
          );
        }

        doc.y = Math.max(doc.y + 6, headerY + 46);
        doc.rect(left, doc.y, contentW, 20).fillAndStroke('#0f172a', '#0f172a');
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(
          `Progress and advancement Card  —  ${result.examinationName}`,
          left,
          doc.y - 15,
          { width: contentW, align: 'center' }
        );

        doc.y += 10;

        // Student Info Bar
        const infoY = doc.y;
        doc.rect(left, infoY, contentW, 38).fillAndStroke('#ffffff', '#334155');
        doc.fontSize(8.5).fillColor('#0f172a');
        doc.font('Helvetica-Bold').text('Name:', left + 8, infoY + 7);
        doc.font('Helvetica').text(result.studentName, left + 42, infoY + 7, { width: 225, ellipsis: true });
        doc.font('Helvetica-Bold').text('Academic Year:', left + 290, infoY + 7);
        doc.font('Helvetica').text(result.academicYearRef?.yearName || result.academicYearRef?.yearCode || 'N/A', left + 365, infoY + 7);

        doc.font('Helvetica-Bold').text('Class:', left + 8, infoY + 22);
        doc.font('Helvetica').text(result.className || '—', left + 42, infoY + 22);
        doc.font('Helvetica-Bold').text('Sec:', left + 140, infoY + 22);
        doc.font('Helvetica').text(result.sectionName || '—', left + 166, infoY + 22);
        doc.font('Helvetica-Bold').text('Roll No:', left + 250, infoY + 22);
        doc.font('Helvetica').text(result.rollNumber || '—', left + 292, infoY + 22);
        doc.font('Helvetica-Bold').text('Adm No:', left + 365, infoY + 22);
        doc.font('Helvetica').text(result.admissionNumber || '—', left + 410, infoY + 22);

        doc.y = infoY + 48;

        // Table drawing helper (crisp dark borders, exact cell dividers)
        const drawCellRow = (yPos, cells, widths, opts = {}) => {
          const { rowH = 20, fill = '#ffffff', bold = false, fontSize = 8, isHeader = false } = opts;
          doc.save();
          doc.rect(left, yPos, contentW, rowH).fillAndStroke(fill, '#334155');
          let x = left;
          cells.forEach((cell, idx) => {
            if (idx > 0) {
              doc.moveTo(x, yPos).lineTo(x, yPos + rowH).strokeColor('#334155').lineWidth(0.6).stroke();
            }
            const textStr = String(cell ?? '');
            const verticalOffset = isHeader && textStr.includes('\n') ? 4 : Math.max(4, (rowH - fontSize) / 2 - 1);
            doc
              .font(bold || isHeader ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(fontSize)
              .fillColor('#0f172a')
              .text(textStr, x + 3, yPos + verticalOffset, {
                width: widths[idx] - 6,
                align: idx === 0 ? 'left' : 'center',
                lineGap: 1
              });
            x += widths[idx];
          });
          doc.restore();
          return yPos + rowH;
        };

        // Section A: Academic Subjects Two-Tier Table
        const subjW = 148;
        const tailCols = 2; // Total & Grade
        const gradeW = 48;
        const totalColW = 62;
        const compCount = compNames.length;
        const compW = compCount > 0 ? Math.floor((contentW - subjW - totalColW - gradeW) / compCount) : 0;
        const usedW = subjW + compCount * compW + totalColW + gradeW;
        const acadWidths = [subjW + (contentW - usedW), ...compNames.map(() => compW), totalColW, gradeW];

        const renderAcadHeaders = (startY) => {
          // Tier 1 Header: Subject | Examination Name (spanning components + Total) | Grade
          const examSpanW = compCount * compW + totalColW;
          const topY = startY;
          const topH = 18;
          const subH = 24;
          doc.save();
          doc.rect(left, topY, acadWidths[0], topH + subH).fillAndStroke('#e2e8f0', '#0f172a');
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text('Subject', left + 5, topY + 15, { width: acadWidths[0] - 10, align: 'left' });

          doc.rect(left + acadWidths[0], topY, examSpanW, topH).fillAndStroke('#e2e8f0', '#0f172a');
          doc.text(result.examinationName, left + acadWidths[0] + 4, topY + 5, { width: examSpanW - 8, align: 'center', ellipsis: true });

          const gradeX = left + acadWidths[0] + examSpanW;
          doc.rect(gradeX, topY, gradeW, topH + subH).fillAndStroke('#e2e8f0', '#0f172a');
          doc.text('Grade', gradeX + 3, topY + 15, { width: gradeW - 6, align: 'center' });

          // Tier 2 Subheaders for components + Total
          let sx = left + acadWidths[0];
          const compLabels = compNames.map(cn => {
            const maxSet = compMaxValues.get(cn);
            if (maxSet && maxSet.size === 1) {
              const singleMax = Array.from(maxSet)[0];
              return `${cn}\n(${singleMax})`;
            }
            return cn;
          });
          const totalHeaderLabel = !totalMaxVaries && totalMaxUniform !== null ? `Total\n(${totalMaxUniform})` : 'Total\n(Obt/Max)';

          [...compLabels, totalHeaderLabel].forEach((lbl, idx) => {
            const cw = idx < compNames.length ? compW : totalColW;
            doc.rect(sx, topY + topH, cw, subH).fillAndStroke('#f1f5f9', '#0f172a');
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text(lbl, sx + 2, topY + topH + (lbl.includes('\n') ? 3 : 8), {
              width: cw - 4,
              align: 'center'
            });
            sx += cw;
          });
          doc.restore();
          return topY + topH + subH;
        };

        let curY = renderAcadHeaders(doc.y);
        const acadSubjects = result.academicSubjects || [];
        const ccSubjects = result.coCurricularSubjects || [];

        // Compute layout so 1 page is preferred whenever content fits clearly, and max 2 pages is strictly enforced
        const bottomLimit = doc.page.height - 56;
        const summaryAndCommentH = 200; // Summary (70) + gap (8) + Comment & Signatures (122)
        const ccBlockH = (rowH) => (ccSubjects.length > 0 ? 10 + 20 + ccSubjects.length * rowH : 0);

        const fitsOnePageStandard =
          curY + acadSubjects.length * 19 + 20 + ccBlockH(19) + 10 + summaryAndCommentH <= bottomLimit;
        const fitsOnePageCompact =
          curY + acadSubjects.length * 16 + 18 + ccBlockH(16) + 8 + 186 <= bottomLimit;

        const useOnePage = fitsOnePageStandard || fitsOnePageCompact;
        const acadRowH = fitsOnePageStandard ? 19 : (useOnePage ? 16 : Math.max(14, Math.min(19, Math.floor((bottomLimit - curY - 24) / Math.max(1, acadSubjects.length)))));
        const acadFontSize = acadRowH <= 16 ? 7.5 : 8;
        let pageCount = 1;

        for (const sub of acadSubjects) {
          if (curY + acadRowH + 20 > bottomLimit && pageCount < 2) {
            doc.addPage({ size: 'A4', layout: 'portrait', margin: 30 });
            pageCount += 1;
            this.drawMarksheetOuterFrame(doc);
            curY = renderAcadHeaders(40);
          }
          const compVals = compNames.map(cn => {
            const found = (sub.components || []).find(c => c.componentName === cn);
            if (!found) return '—';
            if (sub.isAbsent) return 'AB';
            const maxSet = compMaxValues.get(cn);
            return maxSet && maxSet.size === 1 ? `${found.marksObtained}` : `${found.marksObtained}/${found.maximumMarks}`;
          });
          const totalCell = sub.isAbsent
            ? 'AB'
            : (!totalMaxVaries && totalMaxUniform !== null ? `${sub.totalMarksObtained}` : `${sub.totalMarksObtained}/${sub.totalMaximumMarks}`);
          curY = drawCellRow(
            curY,
            [sub.subjectName, ...compVals, totalCell, sub.grade || '—'],
            acadWidths,
            { rowH: acadRowH, fontSize: acadFontSize }
          );
        }

        // Grand Total row
        const grandCells = [
          'GRAND TOTAL',
          ...compNames.map(() => '—'),
          `${result.totalMarksObtained}/${result.totalMaximumMarks}`,
          result.overallGrade || '—'
        ];
        curY = drawCellRow(curY, grandCells, acadWidths, { rowH: useOnePage && !fitsOnePageStandard ? 18 : 20, fill: '#f1f5f9', bold: true, fontSize: acadFontSize });
        doc.y = curY + (useOnePage ? 10 : 12);

        // Section B: Co-curricular Activities
        let ccRowH = fitsOnePageStandard ? 19 : 16;
        if (ccSubjects.length > 0) {
          const neededCcH = 20 + ccSubjects.length * ccRowH + 10;
          if (!useOnePage && pageCount < 2 && doc.y + neededCcH + 186 > bottomLimit) {
            doc.addPage({ size: 'A4', layout: 'portrait', margin: 30 });
            pageCount += 1;
            this.drawMarksheetOuterFrame(doc);
            doc.y = 40;
          }
          if (pageCount === 2) {
            const availForCcAndTail = bottomLimit - doc.y - 190;
            if (20 + ccSubjects.length * ccRowH > availForCcAndTail && ccSubjects.length > 0) {
              ccRowH = Math.max(13, Math.floor((availForCcAndTail - 20) / ccSubjects.length));
            }
          }
          const ccWidths = [contentW - 140, 140];
          let ccY = drawCellRow(doc.y, ['Co-Curricular Subject / Activity', 'Grade'], ccWidths, {
            rowH: 19,
            fill: '#e2e8f0',
            isHeader: true,
            fontSize: 8.5
          });
          for (const cc of ccSubjects) {
            if (ccY + ccRowH > bottomLimit && pageCount < 2) {
              doc.addPage({ size: 'A4', layout: 'portrait', margin: 30 });
              pageCount += 1;
              this.drawMarksheetOuterFrame(doc);
              ccY = drawCellRow(40, ['Co-Curricular Subject / Activity', 'Grade'], ccWidths, {
                rowH: 19,
                fill: '#e2e8f0',
                isHeader: true,
                fontSize: 8.5
              });
            }
            ccY = drawCellRow(ccY, [cc.subjectName, cc.isAbsent ? 'AB' : (cc.grade || '—')], ccWidths, { rowH: ccRowH, fontSize: ccRowH <= 15 ? 7.5 : 8 });
          }
          doc.y = ccY + (useOnePage ? 8 : 10);
        }

        // Check space for Summary + Grading Scale + Term Comment + Signatures
        const remainingH = bottomLimit - doc.y;
        const compactTail = remainingH < 200;
        const tailNeeded = compactTail ? 176 : 200;
        if (doc.y + tailNeeded > bottomLimit && pageCount < 2) {
          doc.addPage({ size: 'A4', layout: 'portrait', margin: 30 });
          pageCount += 1;
          this.drawMarksheetOuterFrame(doc);
          doc.y = 40;
        }

        // Section C: Summary Box + Grading Scale
        const sumY = doc.y;
        const sumHdrH = compactTail ? 18 : 20;
        const sumBodyH = compactTail ? 24 : 28;
        const scaleH = compactTail ? 20 : 22;
        doc.rect(left, sumY, contentW, sumHdrH).fillAndStroke('#e2e8f0', '#0f172a');
        doc.font('Helvetica-Bold').fontSize(8.8).fillColor('#0f172a').text(`${result.examinationName} — Result Summary`, left + 8, sumY + (compactTail ? 4 : 5));

        doc.rect(left, sumY + sumHdrH, contentW, sumBodyH).fillAndStroke('#ffffff', '#334155');
        const sumTextY = sumY + sumHdrH + (compactTail ? 7 : 9);
        doc.fontSize(8.5).fillColor('#0f172a');
        doc.font('Helvetica-Bold').text('Total Marks:', left + 8, sumTextY);
        doc.font('Helvetica').text(`${result.totalMarksObtained} / ${result.totalMaximumMarks}`, left + 68, sumTextY);
        doc.font('Helvetica-Bold').text('Percentage:', left + 175, sumTextY);
        doc.font('Helvetica').text(`${result.percentage}%`, left + 235, sumTextY);
        doc.font('Helvetica-Bold').text('Grade:', left + 305, sumTextY);
        doc.font('Helvetica').text(result.overallGrade || '—', left + 340, sumTextY);
        doc.font('Helvetica-Bold').text('Result:', left + 395, sumTextY);
        doc.font('Helvetica-Bold').fillColor(result.resultStatus === 'PASS' ? '#047857' : '#be123c').text(
          result.resultStatus || '—',
          left + 434,
          sumTextY,
          { width: 90, ellipsis: true }
        );

        const scaleY = sumY + sumHdrH + sumBodyH;
        const scaleText = this.formatGradingScaleSummary(result.configSnapshot, config);
        doc.rect(left, scaleY, contentW, scaleH).fillAndStroke('#f8fafc', '#334155');
        doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#334155').text('Grading Scale: ', left + 8, scaleY + (compactTail ? 6 : 7), { continued: true });
        doc.font('Helvetica').text(scaleText, { width: contentW - 70, height: scaleH - 6, ellipsis: true });

        doc.y = scaleY + scaleH + (compactTail ? 6 : 10);

        // Section D: Term Comment Box with Class Teacher, Head Teacher, Guardian Signatures
        const commentBoxY = doc.y;
        const commentHdrH = 18;
        const maxAvailCommentH = Math.max(76, bottomLimit - commentBoxY - commentHdrH - 4);
        const commentBoxH = Math.min(compactTail ? 94 : 112, maxAvailCommentH);
        doc.rect(left, commentBoxY, contentW, commentHdrH).fillAndStroke('#f1f5f9', '#0f172a');
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a').text(`Comment: ${result.examinationName}`, left + 8, commentBoxY + 5);
        doc.rect(left, commentBoxY + commentHdrH, contentW, commentBoxH).fillAndStroke('#ffffff', '#334155');
        doc.font('Helvetica').fontSize(8.5).fillColor('#1e293b').text(
          result.termRemark || 'No remarks recorded.',
          left + 10,
          commentBoxY + commentHdrH + 7,
          { width: contentW - 20, height: Math.max(20, commentBoxH - 48), ellipsis: true }
        );

        this.drawSignatureBlock(doc, {
          xStart: left,
          width: contentW,
          sigY: commentBoxY + commentHdrH + commentBoxH - 28,
          signatures,
          ctSigPath,
          htSigPath
        });

        doc.font('Helvetica').fontSize(7.2).fillColor('#64748b').text(
          `Status: ${result.status}  |  Generated: ${new Date(result.generatedAt || Date.now()).toLocaleDateString('en-GB')}`,
          left,
          doc.page.height - 46,
          { width: contentW, align: 'center', lineBreak: false }
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

    return {
      buffer,
      fileName: `Marksheet_${result.examinationCode}_${result.studentName.replace(/\s+/g, '_')}.pdf`
    };
  }

  /**
   * 10. Generate Comprehensive Final Academic Marksheet PDF
   * Matches the 3-page Kishore Bharati Primary School Progress and advancement Card layout:
   * - Page 1 (Landscape A4): Academic Subjects (Two-tier Exam + Component breakdown, Project, Final Marks, Grade)
   * - Page 2 (Portrait A4): Co-Curricular Activities Table + Term-Wise Comment Boxes with Signatures
   * - Page 3 (Portrait A4): Final Result Summary Box, Dynamic Formula & Grading Scale, Final Overall Remark & Official Signatures
   */
  static async generateFinalResultPdf({ user, finalResultId }) {
    const schoolId = user.schoolId.toUpperCase();
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const result = await FinalAcademicResultInfo.findOne({ _id: finalResultId, schoolId }).lean();
    if (!result) {
      const err = new Error('Final academic result record not found.');
      err.statusCode = 404;
      throw err;
    }

    const isCT = await TeacherAccessService.isClassTeacherForSection({
      schoolId,
      employeeRef,
      classId: result.classRef,
      sectionId: result.sectionRef
    });
    if (user.roleCode === 'OFFICE_STAFF') {
      if (result.status !== 'PUBLISHED') {
        const err = new Error('Access denied. Office Staff can only access officially published final marksheets.');
        err.statusCode = 403;
        throw err;
      }
    } else if (!isCT && user.roleCode !== 'HEAD_TEACHER' && user.roleCode !== 'ADMIN') {
      const err = new Error('Access denied. You are not authorized to download this final marksheet.');
      err.statusCode = 403;
      throw err;
    }

    const [school, signatures, config] = await Promise.all([
      SchoolInfo.findOne({ schoolId }).lean(),
      this.resolveSignatures({ schoolId, classId: result.classRef, sectionId: result.sectionRef }),
      SchoolResultConfigService.getOrCreateConfig(schoolId)
    ]);

    const showESig = config?.useESignaturesOnMarksheet !== false && result.configSnapshot?.useESignaturesOnMarksheet !== false;
    const logoPath = this.resolveUploadFilePath(school?.schoolLogoUrl);
    const ctSigPath = showESig ? this.resolveUploadFilePath(signatures.classTeacherSignatureUrl) : null;
    const htSigPath = showESig ? this.resolveUploadFilePath(signatures.headTeacherSignatureUrl) : null;

    const exams = result.examinationsIncluded || [];

    // Inspect per-exam component names & max uniformity across subjects
    // Use normalized key (trimmed, lowercase) to deduplicate component names robustly,
    // preserving the original display name of the first occurrence.
    const examColumnsMeta = exams.map(ex => {
      const compNames = [];
      const seenNormalized = new Set(); // keyed by trimmed-lowercase for robust dedup
      const normalizedToCanonical = new Map(); // maps normalized key -> canonical display name
      const compMaxSet = new Map(); // keyed by canonical display name (from compNames)
      const totalMaxSet = new Set();

      for (const sub of result.academicSubjects || []) {
        const tr = (sub.termResults || []).find(t => String(t.examinationRef) === String(ex.examinationRef));
        if (tr) {
          totalMaxSet.add(Number(tr.totalMaximum) || 0);
          for (const c of tr.components || []) {
            const normalizedKey = (c.componentName || '').trim().toLowerCase();
            if (!normalizedKey) continue;
            let canonicalName;
            if (!seenNormalized.has(normalizedKey)) {
              // First occurrence — this becomes the canonical display name
              seenNormalized.add(normalizedKey);
              canonicalName = c.componentName.trim();
              compNames.push(canonicalName);
              normalizedToCanonical.set(normalizedKey, canonicalName);
            } else {
              // Already seen — use the canonical name from the first occurrence
              canonicalName = normalizedToCanonical.get(normalizedKey);
            }
            // Accumulate max marks under the canonical display name
            if (!compMaxSet.has(canonicalName)) compMaxSet.set(canonicalName, new Set());
            compMaxSet.get(canonicalName).add(Number(c.maximumMarks) || 0);
          }
        }
      }

      return {
        examinationRef: ex.examinationRef,
        examinationName: ex.examinationName,
        compNames,
        compMaxSet,
        uniformTotalMax: totalMaxSet.size === 1 ? Array.from(totalMaxSet)[0] : null
      };
    });

    const hasAdditionalProject = (result.academicSubjects || []).some(s => (Number(s.additionalMarksMax) || 0) > 0);
    const projMaxSet = new Set(
      (result.academicSubjects || [])
        .map(s => Number(s.additionalMarksMax) || 0)
        .filter(v => v > 0)
    );
    const uniformProjMax = projMaxSet.size === 1 ? Array.from(projMaxSet)[0] : null;
    const finalMaxSet = new Set((result.academicSubjects || []).map(s => Number(s.finalMaxMarks) || 0));
    const uniformFinalMax = finalMaxSet.size === 1 ? Array.from(finalMaxSet)[0] : null;

    const buffer = await new Promise((resolve, reject) => {
      try {
        // ======================================================
        // PAGE 1 (LANDSCAPE A4): PROGRESS & ADVANCEMENT CARD - ACADEMIC SCORECARD
        // ======================================================
        const doc = new PDFDocument({ margin: 28, size: 'A4', layout: 'landscape' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        this.drawMarksheetOuterFrame(doc);
        const lLeft = 32;
        const lContentW = doc.page.width - 64; // 778pt on Landscape A4

        // Centered Header with Optional School Logo
        const headerY = 30;
        if (logoPath) {
          try {
            doc.image(logoPath, lLeft + 6, headerY, { width: 42, height: 42, fit: [42, 42] });
          } catch (e) {}
        }
        doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a').text(
          (school?.schoolName || 'SCHOOL PROGRESS CARD').toUpperCase(),
          lLeft + (logoPath ? 52 : 0),
          headerY + 1,
          { width: lContentW - (logoPath ? 52 : 0), align: 'center' }
        );
        if (school?.address) {
          doc.font('Helvetica').fontSize(8).fillColor('#475569').text(
            school.address,
            lLeft + (logoPath ? 52 : 0),
            doc.y + 1,
            { width: lContentW - (logoPath ? 52 : 0), align: 'center' }
          );
        }

        doc.y = Math.max(doc.y + 5, headerY + 42);
        doc.rect(lLeft, doc.y, lContentW, 18).fillAndStroke('#0f172a', '#0f172a');
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#ffffff').text(
          `Progress and advancement Card  —  Academic Session: ${result.academicYearName || ''}`,
          lLeft,
          doc.y - 14,
          { width: lContentW, align: 'center' }
        );
        doc.y += 8;

        // Compact Student Info Strip
        const lInfoY = doc.y;
        doc.rect(lLeft, lInfoY, lContentW, 24).fillAndStroke('#ffffff', '#334155');
        doc.fontSize(8.5).fillColor('#0f172a');
        doc.font('Helvetica-Bold').text('Name:', lLeft + 8, lInfoY + 7);
        doc.font('Helvetica').text(result.studentName, lLeft + 42, lInfoY + 7, { width: 220, ellipsis: true });
        doc.font('Helvetica-Bold').text('Class:', lLeft + 278, lInfoY + 7);
        doc.font('Helvetica').text(result.className || '—', lLeft + 312, lInfoY + 7);
        doc.font('Helvetica-Bold').text('Sec:', lLeft + 392, lInfoY + 7);
        doc.font('Helvetica').text(result.sectionName || '—', lLeft + 418, lInfoY + 7);
        doc.font('Helvetica-Bold').text('Roll No:', lLeft + 492, lInfoY + 7);
        doc.font('Helvetica').text(result.rollNumber || '—', lLeft + 534, lInfoY + 7);
        doc.font('Helvetica-Bold').text('Adm No:', lLeft + 615, lInfoY + 7);
        doc.font('Helvetica').text(result.admissionNumber || '—', lLeft + 660, lInfoY + 7);

        doc.y = lInfoY + 32;

        // Compute dynamic column widths across exams, components, Project, Final Marks, Grade
        const subjW = Math.min(130, Math.max(96, Math.floor(lContentW * 0.16)));
        const projW = hasAdditionalProject ? 42 : 0;
        const finMarksW = 50;
        const finGradeW = 40;
        const totalSubCols = examColumnsMeta.reduce((acc, m) => acc + m.compNames.length + 1, 0);
        const remW = lContentW - subjW - projW - finMarksW - finGradeW;
        const subColW = totalSubCols > 0 ? Math.floor(remW / totalSubCols) : 44;
        const usedTotalW = subjW + totalSubCols * subColW + projW + finMarksW + finGradeW;
        const adjSubjW = subjW + (lContentW - usedTotalW);

        const drawTwoTierAcademicHeaders = (startY) => {
          const topH = 17;
          const subH = 26;
          doc.save();
          // Subject Header
          doc.rect(lLeft, startY, adjSubjW, topH + subH).fillAndStroke('#e2e8f0', '#0f172a');
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('Subject', lLeft + 4, startY + 16, { width: adjSubjW - 8 });

          let curX = lLeft + adjSubjW;
          for (const exMeta of examColumnsMeta) {
            const exCols = exMeta.compNames.length + 1;
            const exW = exCols * subColW;
            doc.rect(curX, startY, exW, topH).fillAndStroke('#e2e8f0', '#0f172a');
            doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a').text(exMeta.examinationName, curX + 2, startY + 5, {
              width: exW - 4,
              align: 'center',
              ellipsis: true
            });

            let scX = curX;
            for (const cn of exMeta.compNames) {
              const cSet = exMeta.compMaxSet.get(cn);
              const shortCn = cn.length > 10 ? cn.replace('Class Assessment', 'Class Assess.') : cn;
              const lbl = cSet && cSet.size === 1 ? `${shortCn}\n(${Array.from(cSet)[0]})` : shortCn;
              doc.rect(scX, startY + topH, subColW, subH).fillAndStroke('#f1f5f9', '#0f172a');
              doc.font('Helvetica-Bold').fontSize(6.6).fillColor('#0f172a').text(lbl, scX + 1.5, startY + topH + (lbl.includes('\n') ? 3 : 8), {
                width: subColW - 3,
                align: 'center'
              });
              scX += subColW;
            }
            const totLbl = exMeta.uniformTotalMax !== null ? `Total\n(${exMeta.uniformTotalMax})` : 'Total';
            doc.rect(scX, startY + topH, subColW, subH).fillAndStroke('#e2e8f0', '#0f172a');
            doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#0f172a').text(totLbl, scX + 1.5, startY + topH + (totLbl.includes('\n') ? 3 : 8), {
              width: subColW - 3,
              align: 'center'
            });
            curX += exW;
          }

          if (hasAdditionalProject) {
            doc.rect(curX, startY, projW, topH).fillAndStroke('#e2e8f0', '#0f172a');
            doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#0f172a').text('Project', curX + 2, startY + 5, { width: projW - 4, align: 'center' });
            doc.rect(curX, startY + topH, projW, subH).fillAndStroke('#f1f5f9', '#0f172a');
            doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#0f172a').text(uniformProjMax !== null ? `(${uniformProjMax})` : 'Obt/Max', curX + 2, startY + topH + 8, {
              width: projW - 4,
              align: 'center'
            });
            curX += projW;
          }

          // Final (Marks + Grade) — always restore fill to dark before drawing text
          doc.rect(curX, startY, finMarksW + finGradeW, topH).fillAndStroke('#e2e8f0', '#0f172a');
          doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a').text('Final', curX + 2, startY + 5, { width: finMarksW + finGradeW - 4, align: 'center' });
          doc.rect(curX, startY + topH, finMarksW, subH).fillAndStroke('#f1f5f9', '#0f172a');
          doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#0f172a').text(uniformFinalMax !== null ? `Marks\n(${uniformFinalMax})` : 'Marks', curX + 2, startY + topH + (uniformFinalMax !== null ? 3 : 8), {
            width: finMarksW - 4,
            align: 'center'
          });
          doc.rect(curX + finMarksW, startY + topH, finGradeW, subH).fillAndStroke('#f1f5f9', '#0f172a');
          doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#0f172a').text('Grade', curX + finMarksW + 2, startY + topH + 8, {
            width: finGradeW - 4,
            align: 'center'
          });

          doc.restore();
          return startY + topH + subH;
        };

        const colWidthsList = [adjSubjW];
        examColumnsMeta.forEach(m => {
          for (let i = 0; i < m.compNames.length + 1; i++) colWidthsList.push(subColW);
        });
        if (hasAdditionalProject) colWidthsList.push(projW);
        colWidthsList.push(finMarksW, finGradeW);

        const drawLandRow = (yPos, cells, opts = {}) => {
          const { rowH = 19, fill = '#ffffff', bold = false, fontSize = null } = opts;
          doc.save();
          doc.rect(lLeft, yPos, lContentW, rowH).fillAndStroke(fill, '#334155');
          let x = lLeft;
          const fs = fontSize || (bold ? 7.6 : 7.4);
          const textOffsetY = Math.max(3, (rowH - fs) / 2 - 1);
          cells.forEach((cell, idx) => {
            if (idx > 0) {
              doc.moveTo(x, yPos).lineTo(x, yPos + rowH).strokeColor('#334155').lineWidth(0.55).stroke();
            }
            doc
              .font(bold ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(fs)
              .fillColor('#0f172a')
              .text(String(cell ?? ''), x + 2.5, yPos + textOffsetY, {
                width: colWidthsList[idx] - 5,
                align: idx === 0 ? 'left' : 'center',
                ellipsis: true,
                lineBreak: false
              });
            x += colWidthsList[idx];
          });
          doc.restore();
          return yPos + rowH;
        };

        let rowY = drawTwoTierAcademicHeaders(doc.y);
        const finalAcadSubjects = result.academicSubjects || [];
        const p1AvailH = doc.page.height - 52 - rowY - 20; // reserve 20pt for Grand Total
        const p1RowH = finalAcadSubjects.length > 0
          ? Math.max(13, Math.min(19, Math.floor(p1AvailH / finalAcadSubjects.length)))
          : 19;
        const p1FontSize = p1RowH < 16 ? 6.8 : 7.4;

        const examTotals = exams.map(() => ({ obt: 0, max: 0 }));
        let projGrandObt = 0;
        let projGrandMax = 0;

        for (const sub of finalAcadSubjects) {
          const rowCells = [sub.subjectName];
          examColumnsMeta.forEach((exMeta, exIdx) => {
            const tr = (sub.termResults || []).find(t => String(t.examinationRef) === String(exMeta.examinationRef));
            for (const cn of exMeta.compNames) {
              // Match by trimmed-lowercase name to handle casing/whitespace variants stored in DB
              const cnLower = cn.toLowerCase();
              const found = (tr?.components || []).find(c => (c.componentName || '').trim().toLowerCase() === cnLower);
              if (!found) rowCells.push('—');
              else if (tr?.isAbsent) rowCells.push('AB');
              else {
                const cSet = exMeta.compMaxSet.get(cn);
                rowCells.push(cSet && cSet.size === 1 ? `${found.marksObtained}` : `${found.marksObtained}/${found.maximumMarks}`);
              }
            }
            if (!tr) {
              rowCells.push('—');
            } else {
              if (!tr.isAbsent) examTotals[exIdx].obt += Number(tr.totalObtained) || 0;
              examTotals[exIdx].max += Number(tr.totalMaximum) || 0;
              rowCells.push(
                tr.isAbsent
                  ? 'AB'
                  : (exMeta.uniformTotalMax !== null ? `${tr.totalObtained}` : `${tr.totalObtained}/${tr.totalMaximum}`)
              );
            }
          });

          if (hasAdditionalProject) {
            if ((sub.additionalMarksMax || 0) > 0) {
              projGrandObt += Number(sub.additionalMarksObtained) || 0;
              projGrandMax += Number(sub.additionalMarksMax) || 0;
              rowCells.push(uniformProjMax !== null ? `${sub.additionalMarksObtained}` : `${sub.additionalMarksObtained}/${sub.additionalMarksMax}`);
            } else {
              rowCells.push('—');
            }
          }

          rowCells.push(uniformFinalMax !== null ? `${sub.finalMarksObtained}` : `${sub.finalMarksObtained}/${sub.finalMaxMarks}`);
          rowCells.push(sub.grade || '—');
          rowY = drawLandRow(rowY, rowCells, { rowH: p1RowH, fontSize: p1FontSize });
        }

        // Grand Total row
        const grandRow = ['GRAND TOTAL'];
        examColumnsMeta.forEach((exMeta, exIdx) => {
          for (let i = 0; i < exMeta.compNames.length; i++) grandRow.push('');
          grandRow.push(`${examTotals[exIdx].obt}/${examTotals[exIdx].max}`);
        });
        if (hasAdditionalProject) grandRow.push(`${projGrandObt}/${projGrandMax}`);
        grandRow.push(`${result.overallTotalObtained}/${result.overallMaxMarks}`, result.overallGrade || '—');
        rowY = drawLandRow(rowY, grandRow, { rowH: 20, fill: '#f1f5f9', bold: true });

        doc.font('Helvetica').fontSize(7.4).fillColor('#475569').text(
          'Page 1 of 2 — Academic Performance Breakdown   |   Continued on Page 2 (Co-Curricular, Remarks & Final Result)',
          lLeft,
          doc.page.height - 44,
          { width: lContentW, align: 'center', lineBreak: false }
        );

        // ======================================================
        // PAGE 2 (PORTRAIT A4): CO-CURRICULAR, TERM REMARKS, FINAL RESULT, POLICY & SIGNATURES
        // Strictly capped at 2 pages total
        // ======================================================
        doc.addPage({ size: 'A4', layout: 'portrait', margin: 30 });
        this.drawMarksheetOuterFrame(doc);
        const pLeft = 34;
        const pContentW = doc.page.width - 68; // 527pt

        const drawPortraitHeader = (subtitle) => {
          doc.rect(pLeft, 30, pContentW, 28).fillAndStroke('#f8fafc', '#0f172a');
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#0f172a').text(
            `${(school?.schoolName || 'SCHOOL PROGRESS CARD').toUpperCase()}  —  ${subtitle}`,
            pLeft + 8,
            35,
            { width: pContentW - 16, align: 'center', ellipsis: true, lineBreak: false }
          );
          doc.font('Helvetica').fontSize(7.8).fillColor('#334155').text(
            `Student: ${result.studentName}   |   Class: ${result.className} - ${result.sectionName}   |   Roll No: ${result.rollNumber || '—'}   |   Adm No: ${result.admissionNumber || '—'}`,
            pLeft + 8,
            47,
            { width: pContentW - 16, align: 'center', ellipsis: true, lineBreak: false }
          );
          return 66;
        };

        let p2Y = drawPortraitHeader('Co-Curricular, Term Evaluations & Final Result');
        const p2BottomLimit = doc.page.height - 44; // ~798pt
        const p2AvailH = p2BottomLimit - p2Y; // ~732pt

        const ccList = result.coCurricularSubjects || [];
        const termRemarksList = (result.termRemarks && result.termRemarks.length > 0)
          ? result.termRemarks
          : exams.map(ex => ({ examinationName: ex.examinationName, remark: '' }));

        // Dynamic sizing to ensure all sections fit cleanly on Page 2
        const baseFixedH = 74 + 54 + 62 + 86; // Final Result (74) + Policy (54) + Final Remark (62) + Signatures (86) = 276pt
        const baseGaps = 36;
        const flexAvail = Math.max(120, p2AvailH - baseFixedH - baseGaps);

        let ccRowH = 18;
        let termBoxH = 62;
        let termGap = 6;
        const rawCcH = ccList.length > 0 ? 14 + 20 + ccList.length * ccRowH : 0;
        const rawTermH = termRemarksList.length > 0 ? 14 + termRemarksList.length * (termBoxH + termGap) : 0;

        if (rawCcH + rawTermH > flexAvail) {
          ccRowH = ccList.length > 0 ? Math.max(13, Math.min(18, Math.floor((flexAvail * 0.42 - 34) / ccList.length))) : 18;
          const usedCc = ccList.length > 0 ? 14 + 20 + ccList.length * ccRowH : 0;
          const remForTerms = Math.max(60, flexAvail - usedCc - 14);
          termGap = 4;
          termBoxH = termRemarksList.length > 0 ? Math.max(38, Math.min(62, Math.floor(remForTerms / termRemarksList.length) - termGap)) : 62;
        }

        const drawPortRow = (yPos, cells, widths, opts = {}) => {
          const { rowH = 18, fill = '#ffffff', bold = false } = opts;
          doc.save();
          doc.rect(pLeft, yPos, pContentW, rowH).fillAndStroke(fill, '#334155');
          let x = pLeft;
          const fs = rowH <= 15 ? 7.4 : 8;
          const textOffsetY = Math.max(3, (rowH - fs) / 2 - 1);
          cells.forEach((cell, idx) => {
            if (idx > 0) {
              doc.moveTo(x, yPos).lineTo(x, yPos + rowH).strokeColor('#334155').lineWidth(0.55).stroke();
            }
            doc
              .font(bold ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(fs)
              .fillColor('#0f172a')
              .text(String(cell ?? ''), x + 4, yPos + textOffsetY, {
                width: widths[idx] - 8,
                align: idx === 0 ? 'left' : 'center',
                ellipsis: true,
                lineBreak: false
              });
            x += widths[idx];
          });
          doc.restore();
          return yPos + rowH;
        };

        if (ccList.length > 0) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('CO-CURRICULAR ACTIVITIES', pLeft, p2Y, { lineBreak: false });
          p2Y += 13;

          const examColsCount = exams.length;
          const ccSubjW = 175;
          const ccFinW = 86;
          const ccTermW = examColsCount > 0 ? Math.floor((pContentW - ccSubjW - ccFinW) / examColsCount) : 90;
          const ccTotalW = ccSubjW + examColsCount * ccTermW + ccFinW;
          const ccWidths = [ccSubjW + (pContentW - ccTotalW), ...exams.map(() => ccTermW), ccFinW];

          p2Y = drawPortRow(p2Y, ['Co-Curricular Subject / Activity', ...exams.map(e => e.examinationName), 'Final Grade'], ccWidths, {
            rowH: 19,
            fill: '#e2e8f0',
            bold: true
          });

          for (const cc of ccList) {
            const tGrades = exams.map(ex => {
              const tg = (cc.termGrades || []).find(t => String(t.examinationRef) === String(ex.examinationRef));
              return tg?.grade || '—';
            });
            p2Y = drawPortRow(p2Y, [cc.subjectName, ...tGrades, cc.finalGrade || '—'], ccWidths, { rowH: ccRowH });
          }
          p2Y += 10;
        }

        // Term-Wise Comments Boxes
        if (termRemarksList.length > 0) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('TERM-WISE OBSERVATIONS & REMARKS', pLeft, p2Y, { lineBreak: false });
          p2Y += 13;

          for (const tr of termRemarksList) {
            const hdrH = 15;
            doc.rect(pLeft, p2Y, pContentW, hdrH).fillAndStroke('#e2e8f0', '#0f172a');
            doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#0f172a').text(
              `Comment: ${tr.examinationName || 'Examination'}`,
              pLeft + 8,
              p2Y + 3.5,
              { width: pContentW - 16, ellipsis: true, lineBreak: false }
            );
            doc.rect(pLeft, p2Y + hdrH, pContentW, termBoxH - hdrH).fillAndStroke('#ffffff', '#334155');
            doc.font('Helvetica').fontSize(7.8).fillColor('#1e293b').text(
              tr.remark && tr.remark.trim() ? tr.remark.trim() : 'No term remark recorded.',
              pLeft + 8,
              p2Y + hdrH + 4,
              { width: pContentW - 16, height: Math.max(14, termBoxH - hdrH - 18), ellipsis: true }
            );
            if (termBoxH >= 52) {
              this.drawSignatureBlock(doc, {
                xStart: pLeft,
                width: pContentW,
                sigY: p2Y + termBoxH - 15,
                signatures: null,
                ctSigPath: null,
                htSigPath: null,
                showLabels: true
              });
            }
            p2Y += termBoxH + termGap;
          }
          p2Y += 4;
        }

        // Final Result Summary Box
        let p3Y = p2Y;
        const remAfterTerms = p2BottomLimit - p3Y;
        const compactBottom = remAfterTerms < 285;
        const finHdrH = compactBottom ? 18 : 20;
        const finBodyH = compactBottom ? 50 : 56;

        doc.rect(pLeft, p3Y, pContentW, finHdrH).fillAndStroke('#0f172a', '#0f172a');
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#ffffff').text('FINAL RESULT', pLeft, p3Y + (compactBottom ? 4.5 : 5.5), {
          width: pContentW,
          align: 'center',
          lineBreak: false
        });

        p3Y += finHdrH;
        doc.rect(pLeft, p3Y, pContentW, finBodyH).fillAndStroke('#ffffff', '#0f172a');
        const r1Y = p3Y + (compactBottom ? 7 : 9);
        const r2Y = p3Y + (compactBottom ? 21 : 24);
        const r3Y = p3Y + (compactBottom ? 35 : 40);
        doc.fontSize(8.8).fillColor('#0f172a');
        doc.font('Helvetica-Bold').text('Total Marks Obtained:', pLeft + 12, r1Y, { lineBreak: false });
        doc.font('Helvetica').text(`${result.overallTotalObtained} / ${result.overallMaxMarks}`, pLeft + 140, r1Y, { lineBreak: false });

        doc.font('Helvetica-Bold').text('Final Percentage:', pLeft + 295, r1Y, { lineBreak: false });
        doc.font('Helvetica-Bold').text(`${result.finalPercentage}%`, pLeft + 405, r1Y, { lineBreak: false });

        doc.font('Helvetica-Bold').text('Overall Grade:', pLeft + 12, r2Y, { lineBreak: false });
        doc.font('Helvetica-Bold').text(result.overallGrade || '—', pLeft + 140, r2Y, { lineBreak: false });

        doc.font('Helvetica-Bold').text('Result Status:', pLeft + 295, r2Y, { lineBreak: false });
        doc.font('Helvetica-Bold').fillColor(result.resultStatus === 'PASS' ? '#047857' : '#be123c').text(
          result.resultStatus || '—',
          pLeft + 405,
          r2Y,
          { width: 115, ellipsis: true, lineBreak: false }
        );

        doc.fillColor('#0f172a').font('Helvetica-Bold').text('Promotion Status:', pLeft + 12, r3Y, { lineBreak: false });
        doc.font('Helvetica-Bold').text(result.promotionStatus || 'PROMOTED', pLeft + 140, r3Y, { lineBreak: false });

        p3Y += finBodyH + (compactBottom ? 6 : 8);

        // Dynamic Formula & Grading Scale Box (from configSnapshot)
        const formulaLegend = this.formatFormulaLegend(result.configSnapshot, config);
        const scaleLegend = this.formatGradingScaleSummary(result.configSnapshot, config);
        const polHdrH = 16;
        const polBodyH = compactBottom ? 34 : 38;

        doc.rect(pLeft, p3Y, pContentW, polHdrH).fillAndStroke('#e2e8f0', '#0f172a');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('ASSESSMENT POLICY & GRADING SCALE', pLeft + 8, p3Y + 4, { lineBreak: false });

        doc.rect(pLeft, p3Y + polHdrH, pContentW, polBodyH).fillAndStroke('#f8fafc', '#334155');
        doc.font('Helvetica-Bold').fontSize(7.6).fillColor('#0f172a').text(formulaLegend, pLeft + 10, p3Y + polHdrH + 5, { width: pContentW - 20, ellipsis: true, lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#334155').text('Grading Scale: ', pLeft + 10, p3Y + polHdrH + 18, { continued: true });
        doc.font('Helvetica').text(scaleLegend, { width: pContentW - 80, height: polBodyH - 20, ellipsis: true });

        p3Y += polHdrH + polBodyH + (compactBottom ? 6 : 8);

        // Single Overall Final Remark (strictly NO subject-wise remarks)
        const remHdrH = 16;
        const remBodyH = compactBottom ? 36 : 44;
        doc.rect(pLeft, p3Y, pContentW, remHdrH).fillAndStroke('#e2e8f0', '#0f172a');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('FINAL OVERALL REMARK', pLeft + 8, p3Y + 4, { lineBreak: false });

        doc.rect(pLeft, p3Y + remHdrH, pContentW, remBodyH).fillAndStroke('#ffffff', '#334155');
        doc.font('Helvetica').fontSize(8.3).fillColor('#1e293b').text(
          result.finalRemark && result.finalRemark.trim()
            ? result.finalRemark.trim()
            : 'Overall performance recorded satisfactorily.',
          pLeft + 10,
          p3Y + remHdrH + 6,
          { width: pContentW - 20, height: remBodyH - 10, ellipsis: true }
        );

        p3Y += remHdrH + remBodyH + (compactBottom ? 6 : 8);

        // Official Final Signatures Section
        const sigHdrH = 16;
        const sigBoxH = Math.max(66, Math.min(86, p2BottomLimit - p3Y - 4));
        doc.rect(pLeft, p3Y, pContentW, sigBoxH).fillAndStroke('#ffffff', '#0f172a');
        doc.rect(pLeft, p3Y, pContentW, sigHdrH).fillAndStroke('#f1f5f9', '#0f172a');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a').text('OFFICIAL VERIFICATION & SIGNATURES', pLeft + 8, p3Y + 4, { lineBreak: false });

        this.drawSignatureBlock(doc, {
          xStart: pLeft,
          width: pContentW,
          sigY: p3Y + sigBoxH - 26,
          signatures,
          ctSigPath,
          htSigPath
        });

        doc.font('Helvetica').fontSize(7.2).fillColor('#64748b').text(
          `Page 2 of 2  |  Status: ${result.status}  |  Policy v${result.configVersion || 1}  |  Generated: ${new Date(result.generatedAt || Date.now()).toLocaleDateString('en-GB')}`,
          pLeft,
          doc.page.height - 42,
          { width: pContentW, align: 'center', lineBreak: false }
        );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

    return {
      buffer,
      fileName: `Final_Marksheet_${result.studentName.replace(/\s+/g, '_')}.pdf`
    };
  }

  /**
   * 11. Result & Performance Analytics (Class Teacher complete class OR Subject Teacher assigned subjects)
   */
  static async getResultAndPerformanceAnalytics({ user, academicYearId, examinationId = 'ALL', classId = 'ALL', sectionId = 'ALL', subjectId = 'ALL' }) {
    const schoolId = user.schoolId.toUpperCase();
    const userRef = user._id;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    const ctSections = await TeacherService.getClassTeacherAssignmentsList(schoolId, employeeRef);

    if (!selectedYear) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        isClassTeacher: ctSections.length > 0,
        classTeacherSections: ctSections,
        subjectAssignments: [],
        examinations: [],
        classPerformance: null,
        subjectPerformance: null
      };
    }

    const ayId = selectedYear._id;
    const [subjectAssignments, examsInYear] = await Promise.all([
      SubjectTeacherAssignmentInfo.find({
        schoolId,
        academicYearRef: ayId,
        status: 'ACTIVE',
        $or: [
          { teacherUserRef: userRef },
          ...(employeeRef ? [{ teacherEmployeeRef: employeeRef }] : [])
        ]
      })
        .sort({ className: 1, sectionName: 1, subjectName: 1 })
        .lean(),
      ExaminationInfo.find({ schoolId, academicYearRef: ayId, status: { $ne: 'CANCELLED' } })
        .sort({ startDate: 1, createdAt: 1 })
        .lean()
    ]);

    // Class Teacher Complete Class Performance (only for ctSections!)
    let classPerformance = null;
    if (ctSections.length > 0) {
      const targetCtSec =
        ctSections.find(s => s._id.toString() === String(sectionId) && (classId === 'ALL' || s.classRef.toString() === String(classId))) ||
        ctSections[0];

      const [examResults, finalResults, enrolledCount] = await Promise.all([
        ExaminationResultInfo.find({
          schoolId,
          academicYearRef: ayId,
          classRef: targetCtSec.classRef,
          sectionRef: targetCtSec._id,
          ...(examinationId && examinationId !== 'ALL' && mongoose.Types.ObjectId.isValid(examinationId)
            ? { examinationRef: examinationId }
            : {})
        })
          .sort({ rollNumber: 1, studentName: 1 })
          .lean(),
        FinalAcademicResultInfo.find({
          schoolId,
          academicYearRef: ayId,
          classRef: targetCtSec.classRef,
          sectionRef: targetCtSec._id
        })
          .sort({ rollNumber: 1, studentName: 1 })
          .lean(),
        StudentEnrollmentInfo.countDocuments({
          schoolId,
          academicYearRef: ayId,
          classRef: targetCtSec.classRef,
          sectionRef: targetCtSec._id,
          status: 'ACTIVE'
        })
      ]);

      const sourceList = finalResults.length > 0 ? finalResults : examResults;
      const pcts = sourceList.map(r => (finalResults.length > 0 ? r.finalPercentage : r.percentage)).filter(v => typeof v === 'number');
      const classAverage = pcts.length > 0 ? Math.round((pcts.reduce((a, b) => a + b, 0) / pcts.length) * 100) / 100 : 0;
      const highestPercentage = pcts.length > 0 ? Math.max(...pcts) : 0;
      const lowestPercentage = pcts.length > 0 ? Math.min(...pcts) : 0;

      // Subject-wise averages across this section
      const subjStatsMap = new Map();
      for (const r of examResults) {
        for (const sub of r.academicSubjects || []) {
          const k = sub.subjectRef.toString();
          if (!subjStatsMap.has(k)) {
            subjStatsMap.set(k, {
              subjectId: sub.subjectRef,
              subjectName: sub.subjectName,
              subjectCode: sub.subjectCode,
              percentages: []
            });
          }
          subjStatsMap.get(k).percentages.push(sub.percentage || 0);
        }
      }
      const subjectWiseSummary = Array.from(subjStatsMap.values()).map(item => ({
        subjectId: item.subjectId,
        subjectName: item.subjectName,
        subjectCode: item.subjectCode,
        averagePercentage:
          item.percentages.length > 0
            ? Math.round((item.percentages.reduce((a, b) => a + b, 0) / item.percentages.length) * 100) / 100
            : 0,
        highestPercentage: item.percentages.length > 0 ? Math.max(...item.percentages) : 0,
        lowestPercentage: item.percentages.length > 0 ? Math.min(...item.percentages) : 0
      }));

      // Examination-wise class summary
      const examSummaryMap = new Map();
      for (const r of examResults) {
        const k = r.examinationRef.toString();
        if (!examSummaryMap.has(k)) {
          examSummaryMap.set(k, {
            examinationId: r.examinationRef,
            examinationName: r.examinationName,
            examinationCode: r.examinationCode,
            percentages: [],
            passCount: 0
          });
        }
        const g = examSummaryMap.get(k);
        g.percentages.push(r.percentage || 0);
        if (r.resultStatus === 'PASS') g.passCount++;
      }
      const examinationWiseSummary = Array.from(examSummaryMap.values()).map(g => ({
        examinationId: g.examinationId,
        examinationName: g.examinationName,
        examinationCode: g.examinationCode,
        studentCount: g.percentages.length,
        averagePercentage:
          g.percentages.length > 0
            ? Math.round((g.percentages.reduce((a, b) => a + b, 0) / g.percentages.length) * 100) / 100
            : 0,
        highestPercentage: g.percentages.length > 0 ? Math.max(...g.percentages) : 0,
        lowestPercentage: g.percentages.length > 0 ? Math.min(...g.percentages) : 0,
        passCount: g.passCount
      }));

      classPerformance = {
        section: targetCtSec,
        enrolledCount,
        classAverage,
        highestPercentage,
        lowestPercentage,
        incompleteCount: Math.max(0, enrolledCount - sourceList.length),
        subjectWiseSummary,
        examinationWiseSummary,
        examResults,
        finalResults
      };
    }

    // Subject Teacher Subject-Wise Performance (strictly scoped to assigned subjects!)
    const allowedAssigns = subjectAssignments.filter(a => {
      if (classId && classId !== 'ALL' && a.classRef.toString() !== String(classId)) return false;
      if (sectionId && sectionId !== 'ALL' && a.sectionRef.toString() !== String(sectionId)) return false;
      if (subjectId && subjectId !== 'ALL' && a.subjectRef.toString() !== String(subjectId)) return false;
      return true;
    });

    const subjectPerformanceRows = [];
    for (const assign of allowedAssigns) {
      const marksQuery = {
        schoolId,
        academicYearRef: ayId,
        classRef: assign.classRef,
        sectionRef: assign.sectionRef,
        subjectRef: assign.subjectRef,
        entryType: assign.subjectType === 'CO_CURRICULAR' ? 'CO_CURRICULAR_TERM' : 'EXAM_ACADEMIC'
      };
      if (examinationId && examinationId !== 'ALL' && mongoose.Types.ObjectId.isValid(examinationId)) {
        marksQuery.examinationRef = examinationId;
      }

      const entries = await MarksEntryInfo.find(marksQuery)
        .populate('examinationRef', 'examinationCode examinationName')
        .populate('studentRef', 'admissionNumber firstName middleName lastName')
        .populate('enrollmentRef', 'rollNumber')
        .lean();

      const byExam = new Map();
      for (const e of entries) {
        const exId = e.examinationRef?._id?.toString() || 'NONE';
        if (!byExam.has(exId)) {
          byExam.set(exId, {
            examinationId: e.examinationRef?._id,
            examinationName: e.examinationRef?.examinationName || 'N/A',
            examinationCode: e.examinationRef?.examinationCode || '',
            students: []
          });
        }
        byExam.get(exId).students.push({
          studentId: e.studentRef?._id,
          rollNumber: e.enrollmentRef?.rollNumber || '—',
          studentName: e.studentRef
            ? [e.studentRef.firstName, e.studentRef.middleName, e.studentRef.lastName].filter(Boolean).join(' ')
            : 'N/A',
          totalMarksObtained: e.totalMarksObtained,
          totalMaximumMarks: e.totalMaximumMarks,
          grade: e.grade,
          isAbsent: e.isAbsent
        });
      }

      const examBreakdowns = Array.from(byExam.values()).map(grp => {
        const numeric = grp.students.filter(s => typeof s.totalMarksObtained === 'number' && s.totalMaximumMarks > 0);
        const avg =
          numeric.length > 0
            ? Math.round((numeric.reduce((sum, s) => sum + (s.totalMarksObtained / s.totalMaximumMarks) * 100, 0) / numeric.length) * 100) / 100
            : 0;
        const maxVal = numeric.length > 0 ? Math.max(...numeric.map(s => s.totalMarksObtained)) : 0;
        const minVal = numeric.length > 0 ? Math.min(...numeric.map(s => s.totalMarksObtained)) : 0;

        return {
          ...grp,
          averagePercentage: avg,
          highestMarks: maxVal,
          lowestMarks: minVal
        };
      });

      subjectPerformanceRows.push({
        assignmentId: assign._id,
        classId: assign.classRef,
        className: assign.className,
        sectionId: assign.sectionRef,
        sectionName: assign.sectionName,
        subjectId: assign.subjectRef,
        subjectCode: assign.subjectCode,
        subjectName: assign.subjectName,
        subjectType: assign.subjectType,
        examBreakdowns
      });
    }

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      isClassTeacher: ctSections.length > 0,
      classTeacherSections: ctSections,
      subjectAssignments,
      examinations: examsInYear,
      classPerformance,
      subjectPerformance: subjectPerformanceRows
    };
  }
}

module.exports = TeacherResultService;
