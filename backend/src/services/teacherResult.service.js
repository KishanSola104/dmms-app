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

  /**
   * 9. Generate Individual Term Result Card A4 PDF
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

    // Collect distinct component columns dynamically
    const compNames = [];
    const seenComp = new Set();
    for (const sub of result.academicSubjects || []) {
      for (const c of sub.components || []) {
        if (!seenComp.has(c.componentName)) {
          seenComp.add(c.componentName);
          compNames.push(c.componentName);
        }
      }
    }

    const buffer = await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 36, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Outer Border
        doc.rect(24, 24, 547, 794).strokeColor('#cbd5e1').lineWidth(1).stroke();

        // Header
        let headerY = 38;
        if (logoPath) {
          try {
            doc.image(logoPath, 42, headerY, { width: 48, height: 48, fit: [48, 48] });
          } catch (e) {}
        }
        doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a').text(school?.schoolName || 'SCHOOL MARKSHEET', 96, headerY + 2, {
          width: 420,
          align: 'center'
        });
        doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text(school?.address || '', 96, doc.y + 2, {
          width: 420,
          align: 'center'
        });

        doc.moveDown(0.7);
        doc.rect(36, doc.y, 523, 22).fill('#1e3a8a');
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#ffffff').text(
          `PROGRESS AND ADVANCEMENT CARD — ${result.examinationName.toUpperCase()}`,
          36,
          doc.y - 16,
          { width: 523, align: 'center' }
        );

        doc.moveDown(1);

        // Student Info Grid
        const infoY = doc.y;
        doc.rect(36, infoY, 523, 52).fillColor('#f8fafc').fillAndStroke('#f8fafc', '#cbd5e1');
        doc.fillColor('#0f172a').fontSize(9);
        doc.font('Helvetica-Bold').text('Student Name:', 46, infoY + 10);
        doc.font('Helvetica').text(result.studentName, 122, infoY + 10);
        doc.font('Helvetica-Bold').text('Academic Year:', 330, infoY + 10);
        doc.font('Helvetica').text(result.academicYearRef?.yearName || result.academicYearRef?.yearCode || 'N/A', 415, infoY + 10);

        doc.font('Helvetica-Bold').text('Class & Section:', 46, infoY + 29);
        doc.font('Helvetica').text(`${result.className} - ${result.sectionName}`, 128, infoY + 29);
        doc.font('Helvetica-Bold').text('Roll No:', 330, infoY + 29);
        doc.font('Helvetica').text(result.rollNumber || '—', 378, infoY + 29);
        doc.font('Helvetica-Bold').text('Adm No:', 430, infoY + 29);
        doc.font('Helvetica').text(result.admissionNumber || '—', 475, infoY + 29);

        doc.y = infoY + 64;

        // Section A: Academic Subjects
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e3a8a').text('ACADEMIC PERFORMANCE', 36, doc.y);
        doc.moveDown(0.35);

        const drawTableRow = (yPos, cells, widths, isHeader = false) => {
          const rowH = 20;
          if (yPos + rowH > 740) {
            doc.addPage();
            yPos = 40;
          }
          doc.rect(36, yPos, 523, rowH).fillAndStroke(isHeader ? '#e2e8f0' : '#ffffff', '#cbd5e1');
          let x = 36;
          cells.forEach((cell, idx) => {
            doc
              .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
              .fontSize(8.2)
              .fillColor('#0f172a')
              .text(String(cell ?? ''), x + 5, yPos + 6, {
                width: widths[idx] - 10,
                align: idx === 0 ? 'left' : 'center',
                ellipsis: true
              });
            x += widths[idx];
          });
          return yPos + rowH;
        };

        const subjColW = 165;
        const tailCols = 3; // Total, Max, Grade
        const tailW = 58;
        const compCount = compNames.length;
        const compW = compCount > 0 ? Math.floor((523 - subjColW - tailCols * tailW) / compCount) : 0;
        const usedW = subjColW + compCount * compW + tailCols * tailW;
        const adjSubjW = subjColW + (523 - usedW);
        const acadWidths = [adjSubjW, ...compNames.map(() => compW), tailW, tailW, tailW];

        let curY = drawTableRow(
          doc.y,
          ['Subject', ...compNames, 'Obtained', 'Max', 'Grade'],
          acadWidths,
          true
        );

        for (const sub of result.academicSubjects || []) {
          const compVals = compNames.map(cn => {
            const found = (sub.components || []).find(c => c.componentName === cn);
            if (!found) return '—';
            return sub.isAbsent ? 'AB' : `${found.marksObtained}/${found.maximumMarks}`;
          });
          curY = drawTableRow(
            curY,
            [
              sub.subjectName,
              ...compVals,
              sub.isAbsent ? 'AB' : sub.totalMarksObtained,
              sub.totalMaximumMarks,
              sub.grade || '—'
            ],
            acadWidths,
            false
          );
        }

        doc.y = curY + 12;

        // Section B: Co-curricular Performance
        if ((result.coCurricularSubjects || []).length > 0) {
          if (doc.y > 650) doc.addPage();
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#1e3a8a').text('CO-CURRICULAR ACTIVITIES', 36, doc.y);
          doc.moveDown(0.35);
          const ccWidths = [363, 160];
          let ccY = drawTableRow(doc.y, ['Subject / Activity', 'Grade'], ccWidths, true);
          for (const cc of result.coCurricularSubjects) {
            ccY = drawTableRow(ccY, [cc.subjectName, cc.isAbsent ? 'AB' : (cc.grade || '—')], ccWidths, false);
          }
          doc.y = ccY + 12;
        }

        // Summary Box
        if (doc.y > 650) doc.addPage();
        const sumY = doc.y;
        doc.rect(36, sumY, 523, 38).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fontSize(9).fillColor('#0f172a');
        doc.font('Helvetica-Bold').text('Total Marks:', 46, sumY + 13);
        doc.font('Helvetica').text(`${result.totalMarksObtained} / ${result.totalMaximumMarks}`, 110, sumY + 13);
        doc.font('Helvetica-Bold').text('Percentage:', 205, sumY + 13);
        doc.font('Helvetica').text(`${result.percentage}%`, 265, sumY + 13);
        doc.font('Helvetica-Bold').text('Grade:', 325, sumY + 13);
        doc.font('Helvetica').text(result.overallGrade || '—', 362, sumY + 13);
        doc.font('Helvetica-Bold').text('Result:', 410, sumY + 13);
        doc.font('Helvetica-Bold').fillColor(result.resultStatus === 'PASS' ? '#047857' : '#be123c').text(
          result.resultStatus,
          448,
          sumY + 13,
          { width: 105 }
        );

        doc.y = sumY + 50;

        // Term Remark
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9.5).text('Class Teacher Remarks:', 36, doc.y);
        doc.moveDown(0.25);
        const remY = doc.y;
        doc.rect(36, remY, 523, 38).strokeColor('#cbd5e1').stroke();
        doc.font('Helvetica').fontSize(8.8).fillColor('#334155').text(
          result.termRemark || 'No remarks recorded.',
          44,
          remY + 8,
          { width: 507 }
        );

        // Signatures Area at bottom (with safe page-break guard for dynamic subject counts)
        if (doc.y > 650) {
          doc.addPage();
          doc.rect(24, 24, 547, 794).strokeColor('#cbd5e1').lineWidth(1).stroke();
        }
        const sigY = 710;
        if (ctSigPath) {
          try {
            doc.image(ctSigPath, 60, sigY - 36, { width: 90, height: 32, fit: [90, 32] });
          } catch (e) {}
        }
        if (htSigPath) {
          try {
            doc.image(htSigPath, 240, sigY - 36, { width: 90, height: 32, fit: [90, 32] });
          } catch (e) {}
        }

        doc.strokeColor('#64748b').lineWidth(0.8);
        doc.moveTo(46, sigY).lineTo(176, sigY).stroke();
        doc.moveTo(226, sigY).lineTo(356, sigY).stroke();
        doc.moveTo(406, sigY).lineTo(546, sigY).stroke();

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a');
        doc.text('Class Teacher', 46, sigY + 6, { width: 130, align: 'center' });
        doc.text('Head Teacher', 226, sigY + 6, { width: 130, align: 'center' });
        doc.text("Guardian's Signature", 406, sigY + 6, { width: 140, align: 'center' });

        doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
        doc.text(signatures.classTeacherName, 46, sigY + 18, { width: 130, align: 'center' });
        doc.text(signatures.headTeacherName, 226, sigY + 18, { width: 130, align: 'center' });

        doc.fontSize(7.5).text(
          `Status: ${result.status} | Generated: ${new Date(result.generatedAt).toLocaleDateString('en-GB')}`,
          36,
          770,
          { width: 523, align: 'center' }
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
   * 10. Generate Comprehensive Final Academic Marksheet A4 PDF
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

    const buffer = await new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 36, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc.rect(24, 24, 547, 794).strokeColor('#cbd5e1').lineWidth(1).stroke();

        // Header
        let headerY = 36;
        if (logoPath) {
          try {
            doc.image(logoPath, 42, headerY, { width: 46, height: 46, fit: [46, 46] });
          } catch (e) {}
        }
        doc.font('Helvetica-Bold').fontSize(15).fillColor('#0f172a').text(school?.schoolName || 'FINAL MARKSHEET', 96, headerY + 2, {
          width: 420,
          align: 'center'
        });
        doc.font('Helvetica').fontSize(8.5).fillColor('#475569').text(school?.address || '', 96, doc.y + 2, {
          width: 420,
          align: 'center'
        });

        doc.moveDown(0.6);
        doc.rect(36, doc.y, 523, 22).fill('#1e3a8a');
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#ffffff').text(
          'STUDENT PROGRESS AND ADVANCEMENT CARD (FINAL ACADEMIC RESULT)',
          36,
          doc.y - 16,
          { width: 523, align: 'center' }
        );

        doc.moveDown(0.9);

        // Student Info
        const infoY = doc.y;
        doc.rect(36, infoY, 523, 48).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.fillColor('#0f172a').fontSize(9);
        doc.font('Helvetica-Bold').text('Student Name:', 46, infoY + 8);
        doc.font('Helvetica').text(result.studentName, 122, infoY + 8);
        doc.font('Helvetica-Bold').text('Academic Year:', 330, infoY + 8);
        doc.font('Helvetica').text(result.academicYearName, 415, infoY + 8);

        doc.font('Helvetica-Bold').text('Class & Section:', 46, infoY + 26);
        doc.font('Helvetica').text(`${result.className} - ${result.sectionName}`, 128, infoY + 26);
        doc.font('Helvetica-Bold').text('Roll No:', 330, infoY + 26);
        doc.font('Helvetica').text(result.rollNumber || '—', 378, infoY + 26);
        doc.font('Helvetica-Bold').text('Adm No:', 430, infoY + 26);
        doc.font('Helvetica').text(result.admissionNumber || '—', 475, infoY + 26);

        doc.y = infoY + 58;

        const drawTableRow = (yPos, cells, widths, isHeader = false) => {
          const rowH = 19;
          if (yPos + rowH > 720) {
            doc.addPage();
            yPos = 40;
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
                align: idx === 0 ? 'left' : 'center',
                ellipsis: true
              });
            x += widths[idx];
          });
          return yPos + rowH;
        };

        // Section A: Academic Subjects
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1e3a8a').text('SECTION A – ACADEMIC SUBJECTS', 36, doc.y);
        doc.moveDown(0.3);

        const examColsCount = exams.length;
        const subjW = 135;
        const projW = 62;
        const finW = 72;
        const grdW = 44;
        const termW = examColsCount > 0 ? Math.floor((523 - subjW - projW - finW - grdW) / examColsCount) : 70;
        const totalW = subjW + examColsCount * termW + projW + finW + grdW;
        const acadWidths = [subjW + (523 - totalW), ...exams.map(() => termW), projW, finW, grdW];

        let curY = drawTableRow(
          doc.y,
          ['Subject', ...exams.map(e => e.examinationName), 'Project', 'Final Marks', 'Grade'],
          acadWidths,
          true
        );

        for (const sub of result.academicSubjects || []) {
          const termVals = exams.map(ex => {
            const tr = (sub.termResults || []).find(t => t.examinationRef.toString() === ex.examinationRef.toString());
            if (!tr) return '—';
            return tr.isAbsent ? 'AB' : `${tr.totalObtained}/${tr.totalMaximum}`;
          });
          const projStr = sub.additionalMarksMax > 0 ? `${sub.additionalMarksObtained}/${sub.additionalMarksMax}` : '—';
          curY = drawTableRow(
            curY,
            [
              sub.subjectName,
              ...termVals,
              projStr,
              `${sub.finalMarksObtained}/${sub.finalMaxMarks}`,
              sub.grade || '—'
            ],
            acadWidths,
            false
          );
        }

        doc.y = curY + 10;

        // Section B: Co-curricular Subjects
        if ((result.coCurricularSubjects || []).length > 0) {
          if (doc.y > 620) doc.addPage();
          doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1e3a8a').text('SECTION B – CO-CURRICULAR SUBJECTS', 36, doc.y);
          doc.moveDown(0.3);
          const ccSubjW = 160;
          const ccFinW = 90;
          const ccTermW = examColsCount > 0 ? Math.floor((523 - ccSubjW - ccFinW) / examColsCount) : 90;
          const ccTotalW = ccSubjW + examColsCount * ccTermW + ccFinW;
          const ccWidths = [ccSubjW + (523 - ccTotalW), ...exams.map(() => ccTermW), ccFinW];

          let ccY = drawTableRow(
            doc.y,
            ['Subject', ...exams.map(e => `${e.examinationName}`), 'Final Grade'],
            ccWidths,
            true
          );

          for (const cc of result.coCurricularSubjects) {
            const tGrades = exams.map(ex => {
              const tg = (cc.termGrades || []).find(t => t.examinationRef.toString() === ex.examinationRef.toString());
              return tg?.grade || '—';
            });
            ccY = drawTableRow(ccY, [cc.subjectName, ...tGrades, cc.finalGrade || '—'], ccWidths, false);
          }
          doc.y = ccY + 10;
        }

        // Section C: Overall Final Result
        if (doc.y > 640) doc.addPage();
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1e3a8a').text('SECTION C – OVERALL FINAL RESULT', 36, doc.y);
        doc.moveDown(0.3);
        const sumY = doc.y;
        doc.rect(36, sumY, 523, 44).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fontSize(8.8).fillColor('#0f172a');
        doc.font('Helvetica-Bold').text('Overall Total:', 46, sumY + 8);
        doc.font('Helvetica').text(`${result.overallTotalObtained} / ${result.overallMaxMarks}`, 115, sumY + 8);
        doc.font('Helvetica-Bold').text('Final Percentage:', 225, sumY + 8);
        doc.font('Helvetica').text(`${result.finalPercentage}%`, 312, sumY + 8);
        doc.font('Helvetica-Bold').text('Overall Grade:', 400, sumY + 8);
        doc.font('Helvetica').text(result.overallGrade || '—', 475, sumY + 8);

        doc.font('Helvetica-Bold').text('Result Status:', 46, sumY + 26);
        doc.font('Helvetica-Bold').fillColor(result.resultStatus === 'PASS' ? '#047857' : '#be123c').text(
          result.resultStatus,
          115,
          sumY + 26
        );
        doc.fillColor('#0f172a').font('Helvetica-Bold').text('Promotion Status:', 225, sumY + 26);
        doc.font('Helvetica-Bold').text(result.promotionStatus || 'PROMOTED', 315, sumY + 26);

        doc.y = sumY + 54;

        // Section D: Final Class Teacher Remarks
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9.5).text('SECTION D – FINAL CLASS TEACHER REMARKS', 36, doc.y);
        doc.moveDown(0.25);
        const remY = doc.y;
        doc.rect(36, remY, 523, 36).strokeColor('#cbd5e1').stroke();
        doc.font('Helvetica').fontSize(8.5).fillColor('#334155').text(
          result.finalRemark || 'No final remark recorded.',
          44,
          remY + 8,
          { width: 507 }
        );

        // Section E: Signatures (with safe page-break guard for dynamic subject counts)
        if (doc.y > 655) {
          doc.addPage();
          doc.rect(24, 24, 547, 794).strokeColor('#cbd5e1').lineWidth(1).stroke();
        }
        const sigY = 718;
        if (ctSigPath) {
          try {
            doc.image(ctSigPath, 60, sigY - 36, { width: 90, height: 32, fit: [90, 32] });
          } catch (e) {}
        }
        if (htSigPath) {
          try {
            doc.image(htSigPath, 240, sigY - 36, { width: 90, height: 32, fit: [90, 32] });
          } catch (e) {}
        }

        doc.strokeColor('#64748b').lineWidth(0.8);
        doc.moveTo(46, sigY).lineTo(176, sigY).stroke();
        doc.moveTo(226, sigY).lineTo(356, sigY).stroke();
        doc.moveTo(406, sigY).lineTo(546, sigY).stroke();

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0f172a');
        doc.text('Class Teacher Signature', 46, sigY + 6, { width: 130, align: 'center' });
        doc.text('Head Teacher Signature', 226, sigY + 6, { width: 130, align: 'center' });
        doc.text("Guardian's Signature", 406, sigY + 6, { width: 140, align: 'center' });

        doc.font('Helvetica').fontSize(7.5).fillColor('#64748b');
        doc.text(signatures.classTeacherName, 46, sigY + 18, { width: 130, align: 'center' });
        doc.text(signatures.headTeacherName, 226, sigY + 18, { width: 130, align: 'center' });

        doc.fontSize(7.5).text(
          `Status: ${result.status} | Policy v${result.configVersion} | Generated: ${new Date(result.generatedAt).toLocaleDateString('en-GB')}`,
          36,
          772,
          { width: 523, align: 'center' }
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
