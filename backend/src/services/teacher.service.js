const mongoose = require('mongoose');
const AcademicYearInfo = require('../models/academicYearInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const SubjectTeacherAssignmentInfo = require('../models/subjectTeacherAssignmentInfo.model');
const ClassSubjectInfo = require('../models/classSubjectInfo.model');
const StudentEnrollmentInfo = require('../models/studentEnrollmentInfo.model');
const ExaminationInfo = require('../models/examinationInfo.model');
const ExaminationClassInfo = require('../models/examinationClassInfo.model');
const ExaminationSubjectInfo = require('../models/examinationSubjectInfo.model');
const MarksSubmissionInfo = require('../models/marksSubmissionInfo.model');
const MarksAuditLogInfo = require('../models/marksAuditLogInfo.model');
const ExaminationResultInfo = require('../models/examinationResultInfo.model');
const TeacherAccessService = require('./teacherAccess.service');
const SchoolResultConfigService = require('./schoolResultConfig.service');

class TeacherService {
  /**
   * Resolve academic year for the school
   */
  static async resolveAcademicYear(schoolId, academicYearId) {
    const sId = schoolId.toUpperCase();
    const academicYears = await AcademicYearInfo.find({ schoolId: sId })
      .sort({ isCurrent: -1, startDate: -1 })
      .lean();

    let selectedYear = null;
    if (academicYearId && mongoose.Types.ObjectId.isValid(academicYearId)) {
      selectedYear = academicYears.find(y => y._id.toString() === academicYearId.toString()) || null;
    }
    if (!selectedYear) {
      selectedYear = academicYears.find(y => y.isCurrent) || academicYears[0] || null;
    }
    return { selectedYear, academicYears };
  }

  /**
   * Helper: Get all class-section combinations where the user is Class Teacher or Section Teacher
   */
  static async getClassTeacherAssignmentsList(schoolId, employeeRef) {
    const sId = schoolId.toUpperCase();
    if (!employeeRef) return [];
    const empId = employeeRef._id || employeeRef;

    const [directClasses, directSections] = await Promise.all([
      ClassInfo.find({ schoolId: sId, classTeacherRef: empId, status: 'ACTIVE' }).lean(),
      SectionInfo.find({ schoolId: sId, sectionTeacherRef: empId, status: 'ACTIVE' }).lean()
    ]);

    let sectionsOfDirectClasses = [];
    if (directClasses.length > 0) {
      const empStr = empId.toString();
      const raw = await SectionInfo.find({
        schoolId: sId,
        classRef: { $in: directClasses.map(c => c._id) },
        status: 'ACTIVE'
      }).lean();
      sectionsOfDirectClasses = raw.filter(
        sec => !sec.sectionTeacherRef || sec.sectionTeacherRef.toString() === empStr
      );
    }

    const sectionMap = new Map();
    for (const sec of [...directSections, ...sectionsOfDirectClasses]) {
      sectionMap.set(sec._id.toString(), sec);
    }

    return Array.from(sectionMap.values()).sort((a, b) => {
      const clsCmp = (a.className || '').localeCompare(b.className || '');
      if (clsCmp !== 0) return clsCmp;
      return (a.sectionName || '').localeCompare(b.sectionName || '');
    });
  }

  /**
   * 1. Teacher Dashboard Data (100% database-driven)
   */
  static async getDashboardData({ user, academicYearId }) {
    const schoolId = user.schoolId.toUpperCase();
    const userRef = user._id;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const { selectedYear, academicYears } = await this.resolveAcademicYear(schoolId, academicYearId);
    const access = await TeacherAccessService.getTeacherAccessContext(user);
    const classTeacherSections = await this.getClassTeacherAssignmentsList(schoolId, employeeRef);

    if (!selectedYear) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        access,
        summaryCards: {
          totalAssignedClassesSections: 0,
          totalAssignedSubjects: 0,
          pendingMarksEntry: 0,
          submittedMarks: 0,
          pendingMarksVerification: 0,
          generatedExaminationResults: 0,
          totalAssignedTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          submittedTasks: 0,
          returnedTasks: 0,
          lockedTasks: 0
        },
        pendingWorkSummary: {
          totalAssignedTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          submittedTasks: 0,
          returnedTasks: 0,
          lockedTasks: 0
        },
        pendingTasks: [],
        teachingAssignments: [],
        classTeacherSections,
        upcomingExaminations: [],
        marksEntryProgress: { pending: 0, draft: 0, returned: 0, submitted: 0, verified: 0, items: [] },
        recentActivities: []
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
      ExaminationInfo.find({
        schoolId,
        academicYearRef: ayId,
        status: { $ne: 'CANCELLED' }
      })
        .sort({ startDate: 1, createdAt: -1 })
        .lean()
    ]);

    const classSectionKeys = new Set();
    subjectAssignments.forEach(a => classSectionKeys.add(`${a.classRef.toString()}_${a.sectionRef.toString()}`));
    classTeacherSections.forEach(s => classSectionKeys.add(`${s.classRef.toString()}_${s._id.toString()}`));

    const uniqueSubjectIds = new Set(subjectAssignments.map(a => a.subjectRef.toString()));

    // Find relevant examinations for assigned classes
    const assignedClassIds = Array.from(
      new Set([
        ...subjectAssignments.map(a => a.classRef.toString()),
        ...classTeacherSections.map(s => s.classRef.toString())
      ])
    ).map(id => new mongoose.Types.ObjectId(id));

    const examIds = examsInYear.map(e => e._id);
    const [examClassDocs, examSubjectDocs, submissions, extraAllocations] = await Promise.all([
      assignedClassIds.length > 0 && examIds.length > 0
        ? ExaminationClassInfo.find({
            schoolId,
            examinationRef: { $in: examIds },
            classRef: { $in: assignedClassIds },
            status: 'ACTIVE'
          }).lean()
        : Promise.resolve([]),
      assignedClassIds.length > 0 && examIds.length > 0
        ? ExaminationSubjectInfo.find({
            schoolId,
            examinationRef: { $in: examIds },
            classRef: { $in: assignedClassIds },
            status: 'ACTIVE'
          }).lean()
        : Promise.resolve([]),
      MarksSubmissionInfo.find({
        schoolId,
        academicYearRef: ayId
      }).lean(),
      assignedClassIds.length > 0
        ? ClassSubjectInfo.find({
            schoolId,
            academicYearRef: ayId,
            classRef: { $in: assignedClassIds },
            hasAdditionalComponents: true,
            status: 'ACTIVE'
          }).lean()
        : Promise.resolve([])
    ]);

    const submissionMap = new Map();
    for (const sub of submissions) {
      const k = `${sub.examinationRef ? sub.examinationRef.toString() : 'NULL'}_${sub.classRef.toString()}_${sub.sectionRef.toString()}_${sub.subjectRef.toString()}_${sub.entryType}`;
      submissionMap.set(k, sub);
    }

    const examMap = new Map();
    examsInYear.forEach(e => examMap.set(e._id.toString(), e));

    const examSubjectMap = new Map();
    examSubjectDocs.forEach(es => {
      examSubjectMap.set(`${es.examinationRef.toString()}_${es.classRef.toString()}_${es.subjectRef.toString()}`, es);
    });

    const extraAllocSet = new Set(extraAllocations.map(a => `${a.classRef.toString()}_${a.subjectRef.toString()}`));

    // Compute Marks Entry Progress & Pending Work for teacher's assigned subjects
    const resultConfig = await SchoolResultConfigService.getOrCreateConfig(schoolId);
    const isSeparateCoCurricFinal = resultConfig?.coCurricularConfig?.finalWorkflow === 'SEPARATE_SUBMISSION';

    let totalAssignedTasks = 0;
    let pendingCount = 0;
    let draftCount = 0;
    let returnedCount = 0;
    let submittedCount = 0;
    let verifiedCount = 0;
    let lockedCount = 0;
    const progressItems = [];
    const pendingWorkItems = [];

    const resolveEffectiveStatus = (sub) => {
      if (!sub) return 'PENDING';
      if (sub.status === 'DRAFT' && sub.enteredCount === 0 && !sub.lastEnteredBy) return 'PENDING';
      return sub.status;
    };

    const buildTaskRoute = ({ entryType, examId, classId, sectionId, subjectId }) => {
      const qs = new URLSearchParams({
        academicYearId: ayId.toString(),
        classId: classId.toString(),
        sectionId: sectionId.toString(),
        subjectId: subjectId.toString()
      });
      if (examId) qs.set('examinationId', examId.toString());
      if (entryType === 'EXTRA_COMPONENT') {
        return `/teacher/extra-components?${qs.toString()}`;
      }
      if (entryType === 'CO_CURRICULAR_TERM' || entryType === 'CO_CURRICULAR_FINAL') {
        qs.set('entryType', entryType);
        return `/teacher/co-curricular-grades?${qs.toString()}`;
      }
      return `/teacher/marks-entry?${qs.toString()}`;
    };

    const recordTask = ({
      ex = null,
      assign,
      entryType,
      marksEntryType,
      sub
    }) => {
      totalAssignedTasks++;
      const status = resolveEffectiveStatus(sub);
      const isLocked = Boolean(sub?.isLocked);

      if (isLocked) lockedCount++;
      if (status === 'PENDING') pendingCount++;
      else if (status === 'DRAFT') draftCount++;
      else if (status === 'RETURNED') returnedCount++;
      else if (status === 'SUBMITTED') submittedCount++;
      else if (status === 'VERIFIED') verifiedCount++;

      const examName = ex
        ? ex.examinationName
        : (entryType === 'EXTRA_COMPONENT' ? 'Extra / Project Component' : 'Final Co-curricular Grade');
      const examCode = ex
        ? ex.examinationCode
        : (entryType === 'EXTRA_COMPONENT' ? 'PROJECT' : 'FINAL_CC');

      progressItems.push({
        examinationId: ex ? ex._id : null,
        examinationName: examName,
        examinationCode: examCode,
        className: assign.className,
        sectionName: assign.sectionName,
        subjectName: assign.subjectName,
        subjectType: assign.subjectType,
        entryType,
        marksEntryType,
        status,
        isLocked,
        returnReason: sub?.returnReason || ''
      });

      // Pending Work List excludes completed/submitted tasks and locked tasks
      if (!isLocked && ['PENDING', 'DRAFT', 'RETURNED'].includes(status)) {
        pendingWorkItems.push({
          academicYearId: ayId,
          academicYearName: selectedYear.yearName || selectedYear.yearCode,
          examinationId: ex ? ex._id : null,
          examinationName: examName,
          examinationCode: examCode,
          classId: assign.classRef,
          className: assign.className,
          sectionId: assign.sectionRef,
          sectionName: assign.sectionName,
          subjectId: assign.subjectRef,
          subjectName: assign.subjectName,
          subjectCode: assign.subjectCode,
          marksEntryType,
          entryType,
          submissionStatus: status,
          isLocked: false,
          availabilityStatus: 'OPEN',
          pendingAction:
            status === 'RETURNED'
              ? 'Fix Returned Marks'
              : status === 'DRAFT'
              ? 'Complete Draft'
              : 'Enter Marks',
          returnReason: sub?.returnReason || '',
          targetRoute: buildTaskRoute({
            entryType,
            examId: ex ? ex._id : null,
            classId: assign.classRef,
            sectionId: assign.sectionRef,
            subjectId: assign.subjectRef
          })
        });
      }
    };

    for (const assign of subjectAssignments) {
      for (const ex of examsInYear) {
        const es = examSubjectMap.get(`${ex._id.toString()}_${assign.classRef.toString()}_${assign.subjectRef.toString()}`);
        if (!es) continue;

        const entryType = assign.subjectType === 'CO_CURRICULAR' ? 'CO_CURRICULAR_TERM' : 'EXAM_ACADEMIC';
        const subKey = `${ex._id.toString()}_${assign.classRef.toString()}_${assign.sectionRef.toString()}_${assign.subjectRef.toString()}_${entryType}`;
        recordTask({
          ex,
          assign,
          entryType,
          marksEntryType: assign.subjectType === 'CO_CURRICULAR' ? 'Co-curricular Grades' : 'Academic Subject Marks',
          sub: submissionMap.get(subKey)
        });
      }

      // Check extra component task if configured for this class+subject
      if (extraAllocSet.has(`${assign.classRef.toString()}_${assign.subjectRef.toString()}`)) {
        const extraKey = `NULL_${assign.classRef.toString()}_${assign.sectionRef.toString()}_${assign.subjectRef.toString()}_EXTRA_COMPONENT`;
        recordTask({
          ex: null,
          assign,
          entryType: 'EXTRA_COMPONENT',
          marksEntryType: 'Extra Component Marks',
          sub: submissionMap.get(extraKey)
        });
      }

      // Check Final Co-curricular task if Option B is enabled or requested
      if (assign.subjectType === 'CO_CURRICULAR') {
        const ccFinalKey = `NULL_${assign.classRef.toString()}_${assign.sectionRef.toString()}_${assign.subjectRef.toString()}_CO_CURRICULAR_FINAL`;
        const ccFinalSub = submissionMap.get(ccFinalKey);
        if (isSeparateCoCurricFinal || ccFinalSub) {
          recordTask({
            ex: null,
            assign,
            entryType: 'CO_CURRICULAR_FINAL',
            marksEntryType: 'Co-curricular Grades',
            sub: ccFinalSub
          });
        }
      }
    }

    // Prioritize Returned tasks first, then Draft, then Pending
    const priorityRank = { RETURNED: 0, DRAFT: 1, PENDING: 2 };
    pendingWorkItems.sort((a, b) => (priorityRank[a.submissionStatus] ?? 9) - (priorityRank[b.submissionStatus] ?? 9));

    // Class Teacher verification & generated result counts
    let pendingMarksVerification = 0;
    let generatedExaminationResults = 0;

    if (classTeacherSections.length > 0) {
      const ctSectionIds = classTeacherSections.map(s => s._id);
      pendingMarksVerification = await MarksSubmissionInfo.countDocuments({
        schoolId,
        academicYearRef: ayId,
        sectionRef: { $in: ctSectionIds },
        status: 'SUBMITTED'
      });

      generatedExaminationResults = await ExaminationResultInfo.countDocuments({
        schoolId,
        academicYearRef: ayId,
        sectionRef: { $in: ctSectionIds }
      });
    }

    // Relevant Upcoming / Ongoing Examinations
    const relevantExamIds = new Set(examClassDocs.map(ec => ec.examinationRef.toString()));
    const upcomingExaminations = examsInYear
      .filter(ex => relevantExamIds.has(ex._id.toString()) && ['UPCOMING', 'ONGOING'].includes(ex.status))
      .map(ex => ({
        _id: ex._id,
        examinationCode: ex.examinationCode,
        examinationName: ex.examinationName,
        startDate: ex.startDate,
        endDate: ex.endDate,
        status: ex.status
      }));

    // Recent Activities scoped to teacher's sections or performed by user
    const ctSecObjectIds = classTeacherSections.map(s => s._id);
    const assignedSecObjectIds = subjectAssignments.map(a => a.sectionRef);
    const allRelevantSecIds = [...ctSecObjectIds, ...assignedSecObjectIds];

    const recentActivities = await MarksAuditLogInfo.find({
      schoolId,
      academicYearRef: ayId,
      $or: [
        { performedByUserRef: userRef },
        ...(allRelevantSecIds.length > 0 ? [{ sectionRef: { $in: allRelevantSecIds } }] : [])
      ]
    })
      .populate('examinationRef', 'examinationName examinationCode')
      .populate('classRef', 'className')
      .populate('sectionRef', 'sectionName')
      .populate('subjectRef', 'subjectName subjectCode')
      .sort({ performedAt: -1 })
      .limit(12)
      .lean();

    const ctSectionIdSet = new Set(classTeacherSections.map(s => s._id.toString()));

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      access,
      summaryCards: {
        totalAssignedClassesSections: classSectionKeys.size,
        totalAssignedSubjects: uniqueSubjectIds.size,
        pendingMarksEntry: pendingWorkItems.length,
        submittedMarks: submittedCount + verifiedCount,
        pendingMarksVerification,
        generatedExaminationResults,
        totalAssignedTasks,
        completedTasks: verifiedCount,
        pendingTasks: pendingWorkItems.length,
        submittedTasks: submittedCount,
        returnedTasks: pendingWorkItems.filter(t => t.submissionStatus === 'RETURNED').length,
        lockedTasks: lockedCount
      },
      pendingWorkSummary: {
        totalAssignedTasks,
        completedTasks: verifiedCount,
        pendingTasks: pendingWorkItems.length,
        submittedTasks: submittedCount,
        returnedTasks: pendingWorkItems.filter(t => t.submissionStatus === 'RETURNED').length,
        lockedTasks: lockedCount
      },
      pendingTasks: pendingWorkItems,
      teachingAssignments: subjectAssignments.map(a => ({
        _id: a._id,
        classRef: a.classRef,
        className: a.className,
        classCode: a.classCode,
        sectionRef: a.sectionRef,
        sectionName: a.sectionName,
        sectionCode: a.sectionCode,
        subjectRef: a.subjectRef,
        subjectName: a.subjectName,
        subjectCode: a.subjectCode,
        subjectType: a.subjectType,
        isClassTeacherForSection: ctSectionIdSet.has(a.sectionRef.toString())
      })),
      classTeacherSections: classTeacherSections.map(s => ({
        _id: s._id,
        classRef: s.classRef,
        className: s.className,
        classCode: s.classCode,
        sectionName: s.sectionName,
        sectionCode: s.sectionCode
      })),
      upcomingExaminations,
      marksEntryProgress: {
        pending: pendingCount,
        draft: draftCount,
        returned: returnedCount,
        submitted: submittedCount,
        verified: verifiedCount,
        locked: lockedCount,
        items: progressItems.slice(0, 15)
      },
      recentActivities: recentActivities.map(act => ({
        _id: act._id,
        action: act.action,
        details: act.details,
        examinationName: act.examinationRef?.examinationName || null,
        className: act.classRef?.className || null,
        sectionName: act.sectionRef?.sectionName || null,
        subjectName: act.subjectRef?.subjectName || null,
        performedByName: act.performedByName,
        performedAt: act.performedAt
      }))
    };
  }

  /**
   * 2. My Classes & Assignments (Read-Only)
   */
  static async getMyClassesAndAssignments({ user, academicYearId }) {
    const schoolId = user.schoolId.toUpperCase();
    const userRef = user._id;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const { selectedYear, academicYears } = await this.resolveAcademicYear(schoolId, academicYearId);
    const classTeacherSections = await this.getClassTeacherAssignmentsList(schoolId, employeeRef);

    if (!selectedYear) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        classTeacherAssignments: [],
        subjectTeacherAssignments: []
      };
    }

    const ayId = selectedYear._id;
    const subjectAssignments = await SubjectTeacherAssignmentInfo.find({
      schoolId,
      academicYearRef: ayId,
      status: 'ACTIVE',
      $or: [
        { teacherUserRef: userRef },
        ...(employeeRef ? [{ teacherEmployeeRef: employeeRef }] : [])
      ]
    })
      .sort({ className: 1, sectionName: 1, subjectName: 1 })
      .lean();

    const allClassIds = Array.from(
      new Set([
        ...classTeacherSections.map(s => s.classRef.toString()),
        ...subjectAssignments.map(a => a.classRef.toString())
      ])
    ).map(id => new mongoose.Types.ObjectId(id));

    const [enrollmentAgg, classSubjects] = await Promise.all([
      allClassIds.length > 0
        ? StudentEnrollmentInfo.aggregate([
            {
              $match: {
                schoolId,
                academicYearRef: ayId,
                classRef: { $in: allClassIds },
                status: 'ACTIVE'
              }
            },
            {
              $group: {
                _id: { classRef: '$classRef', sectionRef: '$sectionRef' },
                count: { $sum: 1 }
              }
            }
          ])
        : Promise.resolve([]),
      allClassIds.length > 0
        ? ClassSubjectInfo.find({
            schoolId,
            academicYearRef: ayId,
            classRef: { $in: allClassIds },
            status: 'ACTIVE'
          }).lean()
        : Promise.resolve([])
    ]);

    const enrollmentCountMap = new Map();
    enrollmentAgg.forEach(item => {
      enrollmentCountMap.set(`${item._id.classRef.toString()}_${item._id.sectionRef.toString()}`, item.count);
    });

    const classSubjMap = new Map();
    classSubjects.forEach(cs => {
      classSubjMap.set(`${cs.classRef.toString()}_${cs.subjectRef.toString()}`, cs);
    });

    const ctSectionIdSet = new Set(classTeacherSections.map(s => s._id.toString()));

    const formattedClassTeacher = classTeacherSections.map(sec => ({
      _id: sec._id,
      classId: sec.classRef,
      classCode: sec.classCode,
      className: sec.className,
      sectionId: sec._id,
      sectionCode: sec.sectionCode,
      sectionName: sec.sectionName,
      assignmentType: 'CLASS_TEACHER',
      isClassTeacher: true,
      studentCount: enrollmentCountMap.get(`${sec.classRef.toString()}_${sec._id.toString()}`) || 0,
      maxCapacity: sec.maxCapacity
    }));

    const formattedSubjectAssignments = subjectAssignments.map(a => {
      const alloc = classSubjMap.get(`${a.classRef.toString()}_${a.subjectRef.toString()}`);
      return {
        _id: a._id,
        classId: a.classRef,
        classCode: a.classCode,
        className: a.className,
        sectionId: a.sectionRef,
        sectionCode: a.sectionCode,
        sectionName: a.sectionName,
        subjectId: a.subjectRef,
        subjectCode: a.subjectCode,
        subjectName: a.subjectName,
        subjectType: a.subjectType,
        assignmentType: 'SUBJECT_TEACHER',
        isClassTeacher: ctSectionIdSet.has(a.sectionRef.toString()),
        hasAdditionalComponents: !!alloc?.hasAdditionalComponents,
        additionalComponents: alloc?.additionalComponents || [],
        totalAdditionalMarks: alloc?.totalAdditionalMarks || 0,
        studentCount: enrollmentCountMap.get(`${a.classRef.toString()}_${a.sectionRef.toString()}`) || 0
      };
    });

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      classTeacherAssignments: formattedClassTeacher,
      subjectTeacherAssignments: formattedSubjectAssignments
    };
  }

  /**
   * 3. Get Student Roster for an Authorized Class & Section
   */
  static async getAuthorizedSectionStudents({ user, academicYearId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const userRef = user._id;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(sectionId)) {
      const err = new Error('Valid classId and sectionId are required.');
      err.statusCode = 400;
      throw err;
    }

    const { selectedYear } = await this.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) {
      const err = new Error('Academic year not found.');
      err.statusCode = 404;
      throw err;
    }

    const [isCT, hasSubjectAssign] = await Promise.all([
      TeacherAccessService.isClassTeacherForSection({ schoolId, employeeRef, classId, sectionId }),
      SubjectTeacherAssignmentInfo.findOne({
        schoolId,
        academicYearRef: selectedYear._id,
        classRef: classId,
        sectionRef: sectionId,
        status: 'ACTIVE',
        $or: [
          { teacherUserRef: userRef },
          ...(employeeRef ? [{ teacherEmployeeRef: employeeRef }] : [])
        ]
      }).lean()
    ]);

    if (!isCT && !hasSubjectAssign) {
      const err = new Error('Access denied. You are not assigned to this class and section.');
      err.statusCode = 403;
      throw err;
    }

    const enrollments = await StudentEnrollmentInfo.find({
      schoolId,
      academicYearRef: selectedYear._id,
      classRef: classId,
      sectionRef: sectionId,
      status: 'ACTIVE'
    })
      .populate('studentRef', 'admissionNumber firstName middleName lastName gender dateOfBirth status')
      .sort({ rollNumber: 1 })
      .lean();

    const students = enrollments
      .filter(e => e.studentRef)
      .map(e => ({
        _id: e.studentRef._id,
        enrollmentId: e._id,
        admissionNumber: e.studentRef.admissionNumber,
        rollNumber: e.rollNumber || '—',
        fullName: [e.studentRef.firstName, e.studentRef.middleName, e.studentRef.lastName].filter(Boolean).join(' '),
        gender: e.studentRef.gender,
        status: e.status
      }))
      .sort((a, b) => {
        const na = parseInt(a.rollNumber, 10);
        const nb = parseInt(b.rollNumber, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return String(a.rollNumber).localeCompare(String(b.rollNumber));
      });

    return {
      academicYear: selectedYear,
      isClassTeacher: isCT,
      students
    };
  }

  /**
   * 4. Get School Result Config (Read-Only for Teacher Panel)
   */
  static async getResultConfig(schoolId) {
    return SchoolResultConfigService.getOrCreateConfig(schoolId);
  }
}

module.exports = TeacherService;
