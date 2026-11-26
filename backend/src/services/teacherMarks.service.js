const mongoose = require('mongoose');
const SubjectTeacherAssignmentInfo = require('../models/subjectTeacherAssignmentInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const ClassSubjectInfo = require('../models/classSubjectInfo.model');
const ExaminationInfo = require('../models/examinationInfo.model');
const ExaminationClassInfo = require('../models/examinationClassInfo.model');
const ExaminationSubjectInfo = require('../models/examinationSubjectInfo.model');
const ExaminationComponentInfo = require('../models/examinationComponentInfo.model');
const StudentEnrollmentInfo = require('../models/studentEnrollmentInfo.model');
const MarksSubmissionInfo = require('../models/marksSubmissionInfo.model');
const MarksEntryInfo = require('../models/marksEntryInfo.model');
const MarksAuditLogInfo = require('../models/marksAuditLogInfo.model');
const NotificationInfo = require('../models/notificationInfo.model');
const UserInfo = require('../models/userInfo.model');
const TeacherAccessService = require('./teacherAccess.service');
const TeacherService = require('./teacher.service');
const SchoolResultConfigService = require('./schoolResultConfig.service');
const AuditLogService = require('./auditLog.service');

class TeacherMarksService {
  /**
   * Helper: Write audit log entry via centralized AuditLogService
   */
  static async logAudit({
    schoolRef,
    schoolId,
    academicYearRef = null,
    examinationRef = null,
    classRef = null,
    sectionRef = null,
    subjectRef = null,
    submissionRef = null,
    resultRef = null,
    module = 'MARKS_ENTRY',
    entityType = '',
    entityId = '',
    action,
    details = '',
    previousValue = null,
    newValue = null,
    user
  }) {
    return AuditLogService.log({
      schoolRef,
      schoolId,
      academicYearRef,
      examinationRef,
      classRef,
      sectionRef,
      subjectRef,
      submissionRef,
      resultRef,
      module,
      entityType,
      entityId,
      action,
      details,
      previousValue,
      newValue,
      user
    });
  }

  /**
   * Helper: Dispatch in-app notification safely
   */
  static async notifyUser({ schoolRef, schoolId, targetUser, title, message, type = 'info' }) {
    if (!targetUser) return;
    try {
      await NotificationInfo.create({
        schoolRef,
        schoolId: schoolId.toUpperCase(),
        targetUserRef: targetUser._id,
        targetUserId: targetUser.userId,
        targetRoleCode: targetUser.roleCode,
        title,
        message,
        type,
        isRead: false
      });
    } catch (err) {
      console.warn('[Notification] Failed to create notification:', err.message);
    }
  }

  /**
   * Helper: Resolve Class Teacher & Section Teacher UserInfo accounts for notifications
   */
  static async findClassTeacherUsers(schoolId, classId, sectionId) {
    const sId = schoolId.toUpperCase();
    const [cls, sec] = await Promise.all([
      ClassInfo.findOne({ _id: classId, schoolId: sId }).lean(),
      SectionInfo.findOne({ _id: sectionId, schoolId: sId }).lean()
    ]);

    const empIds = new Set();
    if (sec?.sectionTeacherRef) {
      empIds.add(sec.sectionTeacherRef.toString());
    } else if (cls?.classTeacherRef) {
      empIds.add(cls.classTeacherRef.toString());
    }

    if (empIds.size === 0) return [];
    return UserInfo.find({
      schoolId: sId,
      employeeRef: { $in: Array.from(empIds) },
      status: 'ACTIVE'
    }).lean();
  }

  /**
   * 1. Get Authorized Selection Options for Marks Entry / Extra Components / Co-curricular
   */
  static async getAuthorizedSelectionOptions({ user, academicYearId, mode = 'EXAM_ACADEMIC' }) {
    const schoolId = user.schoolId.toUpperCase();
    const userRef = user._id;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        examinations: [],
        assignments: []
      };
    }

    const ayId = selectedYear._id;
    const assignQuery = {
      schoolId,
      academicYearRef: ayId,
      status: 'ACTIVE',
      $or: [
        { teacherUserRef: userRef },
        ...(employeeRef ? [{ teacherEmployeeRef: employeeRef }] : [])
      ]
    };

    if (mode === 'CO_CURRICULAR') {
      assignQuery.subjectType = 'CO_CURRICULAR';
    } else if (mode === 'EXAM_ACADEMIC') {
      assignQuery.subjectType = 'ACADEMIC';
    }

    const assignments = await SubjectTeacherAssignmentInfo.find(assignQuery)
      .sort({ className: 1, sectionName: 1, subjectName: 1 })
      .lean();

    if (assignments.length === 0) {
      return {
        selectedAcademicYear: selectedYear,
        availableAcademicYears: academicYears,
        examinations: [],
        assignments: []
      };
    }

    let filteredAssignments = assignments;
    if (mode === 'EXTRA_COMPONENT') {
      const classIds = Array.from(new Set(assignments.map(a => a.classRef)));
      const [classSubjDocs, examSubjDocs] = await Promise.all([
        ClassSubjectInfo.find({
          schoolId,
          academicYearRef: ayId,
          classRef: { $in: classIds },
          hasAdditionalComponents: true,
          status: 'ACTIVE'
        }).lean(),
        ExaminationSubjectInfo.find({
          schoolId,
          academicYearRef: ayId,
          classRef: { $in: classIds },
          subjectType: 'ACADEMIC',
          status: 'ACTIVE'
        }).lean()
      ]);

      const examComps = examSubjDocs.length > 0
        ? await ExaminationComponentInfo.find({
            schoolId,
            examinationSubjectRef: { $in: examSubjDocs.map(es => es._id) }
          }).lean()
        : [];
      const examSubjIdsWithComps = new Set(examComps.map(c => c.examinationSubjectRef.toString()));

      const extraMap = new Map();
      classSubjDocs.forEach(cs => {
        extraMap.set(`${cs.classRef.toString()}_${cs.subjectRef.toString()}`, cs);
      });

      const examCompsByClassSubj = new Map();
      examSubjDocs.forEach(es => {
        if (!examSubjIdsWithComps.has(es._id.toString())) return;
        const k = `${es.classRef.toString()}_${es.subjectRef.toString()}`;
        if (!examCompsByClassSubj.has(k)) examCompsByClassSubj.set(k, []);
        examCompsByClassSubj.get(k).push(es.examinationRef.toString());
      });

      filteredAssignments = assignments
        .filter(a => {
          const k = `${a.classRef.toString()}_${a.subjectRef.toString()}`;
          return extraMap.has(k) || examCompsByClassSubj.has(k);
        })
        .map(a => {
          const k = `${a.classRef.toString()}_${a.subjectRef.toString()}`;
          const cs = extraMap.get(k);
          return {
            ...a,
            hasClassAdditionalComponents: !!cs,
            additionalComponents: cs?.additionalComponents || [],
            totalAdditionalMarks: cs?.totalAdditionalMarks || 0,
            examIdsWithComponents: examCompsByClassSubj.get(k) || []
          };
        });
    }

    const assignedClassIds = Array.from(new Set(filteredAssignments.map(a => a.classRef.toString())));
    const exams = await ExaminationInfo.find({
      schoolId,
      academicYearRef: ayId,
      status: { $ne: 'CANCELLED' }
    })
      .sort({ startDate: 1, createdAt: 1 })
      .lean();

    const examClassDocs = exams.length > 0 && assignedClassIds.length > 0
      ? await ExaminationClassInfo.find({
          schoolId,
          examinationRef: { $in: exams.map(e => e._id) },
          classRef: { $in: assignedClassIds },
          status: 'ACTIVE'
        }).lean()
      : [];

    const examIdsWithClasses = new Set(examClassDocs.map(ec => ec.examinationRef.toString()));
    const relevantExams = exams.filter(ex => examIdsWithClasses.has(ex._id.toString()));

    const config = await SchoolResultConfigService.getOrCreateConfig(schoolId);

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      examinations: relevantExams.map(e => ({
        _id: e._id,
        examinationCode: e.examinationCode,
        examinationName: e.examinationName,
        status: e.status,
        startDate: e.startDate,
        endDate: e.endDate
      })),
      assignments: filteredAssignments.map(a => ({
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
        hasClassAdditionalComponents: !!a.hasClassAdditionalComponents,
        additionalComponents: a.additionalComponents || [],
        totalAdditionalMarks: a.totalAdditionalMarks || 0,
        examIdsWithComponents: a.examIdsWithComponents || []
      })),
      resultConfig: config
    };
  }

  /**
   * 2. Get Marks / Extra / Co-curricular Entry Sheet for Selected Context
   */
  static async getMarksEntrySheet({
    user,
    academicYearId,
    examinationId = null,
    classId,
    sectionId,
    subjectId,
    entryType = 'EXAM_ACADEMIC'
  }) {
    const schoolId = user.schoolId.toUpperCase();
    const userRef = user._id;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    if (!classId || !sectionId || !subjectId) {
      const err = new Error('Class, Section, and Subject are required.');
      err.statusCode = 400;
      throw err;
    }

    const { selectedYear } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) {
      const err = new Error('Academic year not found.');
      err.statusCode = 404;
      throw err;
    }
    const ayId = selectedYear._id;

    // Strict Backend Authorization: Verify subject teacher assignment
    const assignment = await TeacherAccessService.isSubjectTeacherForAssignment({
      schoolId,
      userRef,
      employeeRef,
      academicYearId: ayId,
      classId,
      sectionId,
      subjectId
    });
    if (!assignment) {
      const err = new Error('Access denied. You are not assigned to teach this subject in the selected class and section.');
      err.statusCode = 403;
      throw err;
    }

    const config = await SchoolResultConfigService.getOrCreateConfig(schoolId);
    let examination = null;
    let components = [];
    let totalMaximumMarks = 0;

    if (entryType === 'EXAM_ACADEMIC' || entryType === 'CO_CURRICULAR_TERM') {
      if (!examinationId || !mongoose.Types.ObjectId.isValid(examinationId)) {
        const err = new Error('Valid Examination ID is required.');
        err.statusCode = 400;
        throw err;
      }

      examination = await ExaminationInfo.findOne({ _id: examinationId, schoolId, academicYearRef: ayId }).lean();
      if (!examination) {
        const err = new Error('Examination not found for this academic year.');
        err.statusCode = 404;
        throw err;
      }

      const examClass = await ExaminationClassInfo.findOne({
        schoolId,
        examinationRef: examination._id,
        classRef: classId,
        status: 'ACTIVE'
      }).lean();
      if (!examClass) {
        const err = new Error('Selected class is not assigned to this examination.');
        err.statusCode = 400;
        throw err;
      }

      const examSubject = await ExaminationSubjectInfo.findOne({
        schoolId,
        examinationRef: examination._id,
        classRef: classId,
        subjectRef: subjectId,
        status: 'ACTIVE'
      }).lean();
      if (!examSubject) {
        const err = new Error('This subject has not been configured for the selected examination and class by the Admin.');
        err.statusCode = 400;
        throw err;
      }

      if (entryType === 'EXAM_ACADEMIC') {
        if (assignment.subjectType !== 'ACADEMIC') {
          const err = new Error('Selected subject is co-curricular. Please use Co-curricular Grades.');
          err.statusCode = 400;
          throw err;
        }
        const compDocs = await ExaminationComponentInfo.find({
          schoolId,
          examinationSubjectRef: examSubject._id
        })
          .sort({ sequence: 1 })
          .lean();

        if (compDocs.length > 0) {
          components = compDocs.map(c => ({
            componentRef: c._id,
            componentName: c.componentName,
            maximumMarks: c.maximumMarks
          }));
          totalMaximumMarks = compDocs.reduce((s, c) => s + c.maximumMarks, 0);
        } else {
          totalMaximumMarks = examSubject.totalMaximumMarks || 0;
          if (totalMaximumMarks > 0) {
            components = [{
              componentRef: null,
              componentName: 'Marks',
              maximumMarks: totalMaximumMarks
            }];
          }
        }
      } else {
        if (assignment.subjectType !== 'CO_CURRICULAR') {
          const err = new Error('Selected subject is academic. Please use Marks Entry.');
          err.statusCode = 400;
          throw err;
        }
      }
    } else if (entryType === 'EXTRA_COMPONENT') {
      const classSubj = await ClassSubjectInfo.findOne({
        schoolId,
        academicYearRef: ayId,
        classRef: classId,
        subjectRef: subjectId,
        status: 'ACTIVE'
      }).lean();

      if (!classSubj || !classSubj.hasAdditionalComponents || !classSubj.additionalComponents?.length) {
        const err = new Error('No extra/project assessment components are configured for this class and subject.');
        err.statusCode = 400;
        throw err;
      }

      components = classSubj.additionalComponents.map(c => ({
        componentRef: c._id,
        componentName: c.componentName,
        maximumMarks: c.maximumMarks
      }));
      totalMaximumMarks = components.reduce((s, c) => s + c.maximumMarks, 0);
    } else if (entryType === 'CO_CURRICULAR_FINAL') {
      if (assignment.subjectType !== 'CO_CURRICULAR') {
        const err = new Error('Selected subject is not a co-curricular subject.');
        err.statusCode = 400;
        throw err;
      }
    }

    // Fetch enrolled students in this section
    const enrollments = await StudentEnrollmentInfo.find({
      schoolId,
      academicYearRef: ayId,
      classRef: classId,
      sectionRef: sectionId,
      status: 'ACTIVE'
    })
      .populate('studentRef', 'admissionNumber firstName middleName lastName status')
      .lean();

    const sortedEnrollments = enrollments
      .filter(e => e.studentRef)
      .sort((a, b) => {
        const ra = parseInt(a.rollNumber, 10);
        const rb = parseInt(b.rollNumber, 10);
        if (!isNaN(ra) && !isNaN(rb)) return ra - rb;
        return String(a.rollNumber || '').localeCompare(String(b.rollNumber || ''));
      });

    // Fetch existing submission & entry rows
    const submissionQuery = {
      schoolId,
      academicYearRef: ayId,
      examinationRef: examination ? examination._id : null,
      classRef: classId,
      sectionRef: sectionId,
      subjectRef: subjectId,
      entryType
    };
    const submission = await MarksSubmissionInfo.findOne(submissionQuery).lean();

    const existingEntries = submission
      ? await MarksEntryInfo.find({ submissionRef: submission._id }).lean()
      : [];
    const entryByStudent = new Map();
    existingEntries.forEach(ent => entryByStudent.set(ent.studentRef.toString(), ent));

    const students = sortedEnrollments.map(enr => {
      const stu = enr.studentRef;
      const existing = entryByStudent.get(stu._id.toString());

      let mergedComponentMarks = [];
      if (components.length > 0) {
        mergedComponentMarks = components.map(c => {
          const match = existing?.componentMarks?.find(
            ec =>
              (c.componentRef && ec.componentRef && ec.componentRef.toString() === c.componentRef.toString()) ||
              ec.componentName.toLowerCase() === c.componentName.toLowerCase()
          );
          return {
            componentRef: c.componentRef,
            componentName: c.componentName,
            maximumMarks: c.maximumMarks,
            marksObtained: match ? match.marksObtained : null
          };
        });
      }

      return {
        studentId: stu._id,
        enrollmentId: enr._id,
        admissionNumber: stu.admissionNumber,
        rollNumber: enr.rollNumber || '—',
        studentName: [stu.firstName, stu.middleName, stu.lastName].filter(Boolean).join(' '),
        componentMarks: mergedComponentMarks,
        totalMaximumMarks,
        totalMarksObtained: existing ? existing.totalMarksObtained : null,
        grade: existing ? existing.grade : '',
        isAbsent: existing ? !!existing.isAbsent : false,
        remarks: existing ? existing.remarks || '' : ''
      };
    });

    const subStatus = submission ? submission.status : 'DRAFT';
    const isLocked = Boolean(submission?.isLocked);

    const passingPercentage = config?.passingRules?.passingPercentage ?? 40;
    const passingMarks = Math.ceil((totalMaximumMarks * passingPercentage) / 100);

    return {
      academicYear: selectedYear,
      examination: examination
        ? {
            _id: examination._id,
            examinationCode: examination.examinationCode,
            examinationName: examination.examinationName,
            status: examination.status
          }
        : null,
      assignment: {
        classId: assignment.classRef,
        className: assignment.className,
        sectionId: assignment.sectionRef,
        sectionName: assignment.sectionName,
        subjectId: assignment.subjectRef,
        subjectCode: assignment.subjectCode,
        subjectName: assignment.subjectName,
        subjectType: assignment.subjectType
      },
      entryType,
      components,
      totalMaximumMarks,
      passingMarks,
      passingPercentage,
      gradeOptions: config?.coCurricularConfig?.gradeOptions || [],
      coCurricularWorkflow: config?.coCurricularConfig?.finalWorkflow || 'AUTO_AVERAGE',
      submission: submission
        ? {
            _id: submission._id,
            status: submission.status,
            isLocked: Boolean(submission.isLocked),
            lockedAt: submission.lockedAt || null,
            lockedByRole: submission.lockedByRole || null,
            lockReason: submission.lockReason || '',
            submittedAt: submission.submittedAt,
            updatedAfterSubmissionAt: submission.updatedAfterSubmissionAt || null,
            verifiedAt: submission.verifiedAt,
            returnedAt: submission.returnedAt,
            returnReason: submission.returnReason,
            requestedAt: submission.requestedAt
          }
        : { status: 'DRAFT', isLocked: false, lockReason: '', returnReason: '' },
      isLocked,
      students
    };
  }

  /**
   * 3. Save Draft or Submit Marks / Extra Components / Co-curricular Grades
   */
  static async saveOrSubmitMarks({
    user,
    academicYearId,
    examinationId = null,
    classId,
    sectionId,
    subjectId,
    entryType = 'EXAM_ACADEMIC',
    action = 'DRAFT', // 'DRAFT' | 'SUBMIT'
    entries = []
  }) {
    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const userRef = user._id;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const cleanAction = String(action || 'DRAFT').toUpperCase();
    if (!['DRAFT', 'SUBMIT'].includes(cleanAction)) {
      const err = new Error("Action must be 'DRAFT' or 'SUBMIT'.");
      err.statusCode = 400;
      throw err;
    }

    // Load authoritative sheet context (enforces assignment, exam, components & enrollments!)
    const sheet = await this.getMarksEntrySheet({
      user,
      academicYearId,
      examinationId,
      classId,
      sectionId,
      subjectId,
      entryType
    });

    if (sheet.isLocked) {
      const err = new Error(
        `Marks entry is locked${sheet.submission?.lockReason ? ` (${sheet.submission.lockReason})` : ''}. You cannot save or update marks until it is reopened by the Head Teacher or Administrator.`
      );
      err.statusCode = 403;
      throw err;
    }

    if (sheet.students.length === 0) {
      const err = new Error('No active enrolled students found in this class and section.');
      err.statusCode = 400;
      throw err;
    }

    const config = await SchoolResultConfigService.getOrCreateConfig(schoolId);
    const isCoCurricular = entryType === 'CO_CURRICULAR_TERM' || entryType === 'CO_CURRICULAR_FINAL';
    const validGradesMap = new Map();
    (config?.coCurricularConfig?.gradeOptions || []).forEach(g => {
      validGradesMap.set(String(g.grade).toUpperCase(), Number(g.points));
    });

    const inputMap = new Map();
    if (Array.isArray(entries)) {
      entries.forEach(item => {
        if (item?.studentId) {
          inputMap.set(item.studentId.toString(), item);
        }
      });
    }

    // Validate all student rows strictly against configured schema
    const validatedRows = [];
    let enteredCount = 0;

    for (const stu of sheet.students) {
      const stuIdStr = stu.studentId.toString();
      const input = inputMap.get(stuIdStr) || {};
      const isAbsent = !!input.isAbsent;
      const remarks = typeof input.remarks === 'string' ? input.remarks.trim() : '';

      if (isCoCurricular) {
        let gradeVal = typeof input.grade === 'string' ? input.grade.trim().toUpperCase() : '';
        if (isAbsent) {
          gradeVal = '';
          enteredCount++;
        } else if (gradeVal) {
          if (!validGradesMap.has(gradeVal)) {
            const err = new Error(
              `Invalid grade '${gradeVal}' for ${stu.studentName}. Allowed grades: ${Array.from(validGradesMap.keys()).join(', ')}.`
            );
            err.statusCode = 400;
            throw err;
          }
          enteredCount++;
        } else if (cleanAction === 'SUBMIT') {
          const err = new Error(`Grade is required for ${stu.studentName} before submission (or mark Absent).`);
          err.statusCode = 400;
          throw err;
        }

        validatedRows.push({
          studentRef: stu.studentId,
          enrollmentRef: stu.enrollmentId,
          componentMarks: [],
          totalMaximumMarks: 0,
          totalMarksObtained: null,
          grade: gradeVal || null,
          gradePoint: gradeVal ? validGradesMap.get(gradeVal) : null,
          isAbsent,
          remarks
        });
      } else {
        // Numerical marks (EXAM_ACADEMIC or EXTRA_COMPONENT)
        if (sheet.components.length === 0 && sheet.totalMaximumMarks === 0) {
          const err = new Error('Subject has 0 configured maximum marks. Please contact Admin to configure assessment components.');
          err.statusCode = 400;
          throw err;
        }

        const inputCompMap = new Map();
        if (Array.isArray(input.componentMarks)) {
          input.componentMarks.forEach(cm => {
            if (cm?.componentName) {
              inputCompMap.set(cm.componentName.toLowerCase(), cm.marksObtained);
            }
          });
        }

        const rowComps = [];
        let rowTotal = 0;
        let allCompsEntered = true;

        for (const cfgComp of sheet.components) {
          let rawVal = inputCompMap.get(cfgComp.componentName.toLowerCase());
          if (isAbsent) {
            rowComps.push({
              componentRef: cfgComp.componentRef,
              componentName: cfgComp.componentName,
              maximumMarks: cfgComp.maximumMarks,
              marksObtained: 0
            });
          } else if (rawVal === undefined || rawVal === null || rawVal === '') {
            allCompsEntered = false;
            if (cleanAction === 'SUBMIT') {
              const err = new Error(
                `Marks for '${cfgComp.componentName}' are required for ${stu.studentName} before submission.`
              );
              err.statusCode = 400;
              throw err;
            }
            rowComps.push({
              componentRef: cfgComp.componentRef,
              componentName: cfgComp.componentName,
              maximumMarks: cfgComp.maximumMarks,
              marksObtained: null
            });
          } else {
            const num = Number(rawVal);
            if (isNaN(num) || !Number.isFinite(num) || num < 0) {
              const err = new Error(
                `Invalid marks for '${cfgComp.componentName}' (${stu.studentName}): marks cannot be negative.`
              );
              err.statusCode = 400;
              throw err;
            }
            if (num > cfgComp.maximumMarks) {
              const err = new Error(
                `Marks for '${cfgComp.componentName}' (${stu.studentName}) cannot exceed maximum marks (${cfgComp.maximumMarks}).`
              );
              err.statusCode = 400;
              throw err;
            }
            rowTotal += num;
            rowComps.push({
              componentRef: cfgComp.componentRef,
              componentName: cfgComp.componentName,
              maximumMarks: cfgComp.maximumMarks,
              marksObtained: num
            });
          }
        }

        if (isAbsent || allCompsEntered) {
          enteredCount++;
        }

        validatedRows.push({
          studentRef: stu.studentId,
          enrollmentRef: stu.enrollmentId,
          componentMarks: rowComps,
          totalMaximumMarks: sheet.totalMaximumMarks,
          totalMarksObtained: isAbsent ? 0 : (allCompsEntered ? rowTotal : null),
          grade: null,
          gradePoint: null,
          isAbsent,
          remarks
        });
      }
    }

    // Find or create submission header
    const ayId = sheet.academicYear._id;
    const examId = sheet.examination ? sheet.examination._id : null;
    const prevStatus = sheet.submission?.status || 'DRAFT';
    const isResubmission = prevStatus === 'RETURNED' && cleanAction === 'SUBMIT';
    const isUpdateAfterSubmission = ['SUBMITTED', 'VERIFIED'].includes(prevStatus);
    const nextStatus = cleanAction === 'SUBMIT'
      ? 'SUBMITTED'
      : (prevStatus === 'RETURNED' ? 'RETURNED' : 'DRAFT');

    let submission = await MarksSubmissionInfo.findOne({
      schoolId,
      academicYearRef: ayId,
      examinationRef: examId,
      classRef: classId,
      sectionRef: sectionId,
      subjectRef: subjectId,
      entryType
    });

    if (submission && submission.isLocked) {
      const err = new Error('Marks entry is locked. You cannot save or update marks.');
      err.statusCode = 403;
      throw err;
    }

    // Track previous values for audit log when updating submitted/verified/returned marks
    let changeDiffs = [];
    if (submission) {
      const prevEntries = await MarksEntryInfo.find({ submissionRef: submission._id }).lean();
      const prevByStu = new Map(prevEntries.map(pe => [pe.studentRef.toString(), pe]));
      const stuNameById = new Map(sheet.students.map(s => [s.studentId.toString(), s.studentName]));
      for (const row of validatedRows) {
        const pe = prevByStu.get(row.studentRef.toString());
        if (!pe) continue;
        const oldVal = pe.isAbsent ? 'AB' : (isCoCurricular ? (pe.grade || '—') : pe.totalMarksObtained);
        const newVal = row.isAbsent ? 'AB' : (isCoCurricular ? (row.grade || '—') : row.totalMarksObtained);
        if (String(oldVal ?? '') !== String(newVal ?? '')) {
          changeDiffs.push({
            student: stuNameById.get(row.studentRef.toString()) || row.studentRef.toString(),
            from: oldVal,
            to: newVal
          });
        }
      }
    }

    const now = new Date();
    if (!submission) {
      submission = new MarksSubmissionInfo({
        schoolRef,
        schoolId,
        academicYearRef: ayId,
        examinationRef: examId,
        classRef: classId,
        sectionRef: sectionId,
        subjectRef: subjectId,
        entryType,
        status: nextStatus,
        totalStudents: sheet.students.length,
        enteredCount,
        lastEnteredBy: userRef,
        submittedBy: cleanAction === 'SUBMIT' ? userRef : null,
        submittedAt: cleanAction === 'SUBMIT' ? now : null
      });
    } else {
      submission.status = nextStatus;
      submission.totalStudents = sheet.students.length;
      submission.enteredCount = enteredCount;
      submission.lastEnteredBy = userRef;
      if (isUpdateAfterSubmission) {
        // Require Class Teacher re-verification whenever already-submitted/verified marks are modified
        submission.verifiedBy = null;
        submission.verifiedAt = null;
        submission.updatedAfterSubmissionAt = now;
      }
      if (cleanAction === 'SUBMIT') {
        submission.submittedBy = userRef;
        submission.submittedAt = now;
        if (isResubmission) {
          submission.resubmittedAt = now;
        }
      }
    }
    await submission.save();

    // Upsert per-student entries
    const bulkOps = validatedRows.map(row => ({
      updateOne: {
        filter: {
          schoolId,
          academicYearRef: ayId,
          examinationRef: examId,
          classRef: classId,
          sectionRef: sectionId,
          subjectRef: subjectId,
          studentRef: row.studentRef,
          entryType
        },
        update: {
          $set: {
            schoolRef,
            submissionRef: submission._id,
            enrollmentRef: row.enrollmentRef,
            componentMarks: row.componentMarks,
            totalMaximumMarks: row.totalMaximumMarks,
            totalMarksObtained: row.totalMarksObtained,
            grade: row.grade,
            gradePoint: row.gradePoint,
            isAbsent: row.isAbsent,
            remarks: row.remarks,
            enteredBy: userRef
          }
        },
        upsert: true
      }
    }));

    if (bulkOps.length > 0) {
      await MarksEntryInfo.bulkWrite(bulkOps);
    }

    // Audit & Notifications
    const label = sheet.examination
      ? `${sheet.examination.examinationName} - ${sheet.assignment.subjectName}`
      : `${entryType === 'EXTRA_COMPONENT' ? 'Extra Components' : 'Final Co-curricular'} - ${sheet.assignment.subjectName}`;

    const auditAction =
      cleanAction === 'SUBMIT'
        ? (isResubmission ? 'MARKS_RESUBMITTED' : (isUpdateAfterSubmission ? 'MARKS_UPDATED_AFTER_SUBMISSION' : 'MARKS_SUBMITTED'))
        : (isUpdateAfterSubmission ? 'MARKS_UPDATED_AFTER_SUBMISSION' : 'MARKS_SAVED_DRAFT');

    await this.logAudit({
      schoolRef,
      schoolId,
      academicYearRef: ayId,
      examinationRef: examId,
      classRef: classId,
      sectionRef: sectionId,
      subjectRef: subjectId,
      submissionRef: submission._id,
      module: 'MARKS_ENTRY',
      entityType: 'MarksSubmissionInfo',
      entityId: submission._id.toString(),
      action: auditAction,
      details: `${label} (${sheet.assignment.className} - ${sheet.assignment.sectionName}) — ${enteredCount}/${sheet.students.length} students${changeDiffs.length ? ` (${changeDiffs.length} updated)` : ''}`,
      previousValue: changeDiffs.length ? { prevStatus, changes: changeDiffs.slice(0, 20).map(c => ({ student: c.student, value: c.from })) } : { prevStatus },
      newValue: changeDiffs.length ? { status: nextStatus, changes: changeDiffs.slice(0, 20).map(c => ({ student: c.student, value: c.to })) } : { status: nextStatus, enteredCount },
      user
    });

    if (cleanAction === 'SUBMIT') {
      const ctUsers = await this.findClassTeacherUsers(schoolId, classId, sectionId);
      const teacherName = user.employeeRef?.fullName || user.fullName || user.userId;
      for (const ct of ctUsers) {
        if (ct._id.toString() === userRef.toString()) continue;
        await this.notifyUser({
          schoolRef,
          schoolId,
          targetUser: ct,
          title: isResubmission
            ? 'Marks Resubmitted for Verification'
            : isUpdateAfterSubmission
            ? 'Submitted Marks Updated — Re-Verification Needed'
            : 'Marks Submitted for Verification',
          message: `${teacherName} ${isResubmission ? 'resubmitted' : (isUpdateAfterSubmission ? 'updated submitted' : 'submitted')} ${label} for ${sheet.assignment.className} - ${sheet.assignment.sectionName}.`,
          type: 'info'
        });
      }
    }

    return {
      submission: submission.toObject(),
      enteredCount,
      totalStudents: sheet.students.length,
      message:
        cleanAction === 'SUBMIT'
          ? (isResubmission
              ? 'Corrected marks resubmitted for verification.'
              : isUpdateAfterSubmission
              ? 'Submitted marks updated successfully. Class Teacher has been notified for review.'
              : 'Marks submitted for verification. Marks remain editable until locked by Head Teacher or Admin.')
          : 'Draft marks saved successfully.'
    };
  }

  /**
   * 4. Submitted Marks List for Subject Teacher
   */
  static async getMySubmittedMarks({
    user,
    academicYearId,
    examinationId = 'ALL',
    status = 'ALL',
    entryType = 'ALL'
  }) {
    const schoolId = user.schoolId.toUpperCase();
    const userRef = user._id;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) {
      return { selectedAcademicYear: null, availableAcademicYears: academicYears, submissions: [] };
    }

    const ayId = selectedYear._id;
    const assignments = await SubjectTeacherAssignmentInfo.find({
      schoolId,
      academicYearRef: ayId,
      status: 'ACTIVE',
      $or: [
        { teacherUserRef: userRef },
        ...(employeeRef ? [{ teacherEmployeeRef: employeeRef }] : [])
      ]
    }).lean();

    if (assignments.length === 0) {
      return { selectedAcademicYear: selectedYear, availableAcademicYears: academicYears, submissions: [] };
    }

    const assignmentKeySet = new Set(
      assignments.map(a => `${a.classRef.toString()}_${a.sectionRef.toString()}_${a.subjectRef.toString()}`)
    );

    const query = { schoolId, academicYearRef: ayId };
    if (examinationId && examinationId !== 'ALL' && mongoose.Types.ObjectId.isValid(examinationId)) {
      query.examinationRef = examinationId;
    }
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }
    if (entryType && entryType !== 'ALL') {
      query.entryType = entryType.toUpperCase();
    }

    const allSubs = await MarksSubmissionInfo.find(query)
      .populate('examinationRef', 'examinationCode examinationName status')
      .populate('classRef', 'classCode className')
      .populate('sectionRef', 'sectionCode sectionName')
      .populate('subjectRef', 'subjectCode subjectName subjectType')
      .sort({ updatedAt: -1 })
      .lean();

    const filtered = allSubs
      .filter(s => assignmentKeySet.has(`${s.classRef?._id.toString()}_${s.sectionRef?._id.toString()}_${s.subjectRef?._id.toString()}`))
      .map(s => ({
        _id: s._id,
        examinationId: s.examinationRef?._id || null,
        examinationCode: s.examinationRef?.examinationCode || (s.entryType === 'EXTRA_COMPONENT' ? 'PROJECT' : 'FINAL'),
        examinationName:
          s.examinationRef?.examinationName ||
          (s.entryType === 'EXTRA_COMPONENT' ? 'Extra / Project Component' : 'Final Co-curricular Grade'),
        classId: s.classRef?._id,
        className: s.classRef?.className || 'N/A',
        sectionId: s.sectionRef?._id,
        sectionName: s.sectionRef?.sectionName || 'N/A',
        subjectId: s.subjectRef?._id,
        subjectCode: s.subjectRef?.subjectCode || '',
        subjectName: s.subjectRef?.subjectName || 'N/A',
        subjectType: s.subjectRef?.subjectType || 'ACADEMIC',
        entryType: s.entryType,
        totalStudents: s.totalStudents,
        marksEntered: s.enteredCount,
        submissionStatus: s.status,
        isLocked: Boolean(s.isLocked),
        lockedAt: s.lockedAt || null,
        lockedByRole: s.lockedByRole || null,
        lockReason: s.lockReason || '',
        verificationStatus: s.status === 'VERIFIED' ? 'VERIFIED' : s.status === 'RETURNED' ? 'RETURNED' : 'PENDING',
        submittedAt: s.submittedAt,
        verifiedAt: s.verifiedAt,
        returnedAt: s.returnedAt,
        returnReason: s.returnReason || ''
      }));

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      submissions: filtered
    };
  }

  /**
   * 5. Get Single Submission Details (for Subject Teacher OR Class Teacher verification view)
   */
  static async getSubmissionDetails({ user, submissionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const userRef = user._id;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      const err = new Error('Valid submission ID is required.');
      err.statusCode = 400;
      throw err;
    }

    const submission = await MarksSubmissionInfo.findOne({ _id: submissionId, schoolId })
      .populate('academicYearRef', 'yearName yearCode')
      .populate('examinationRef', 'examinationCode examinationName status')
      .populate('classRef', 'classCode className')
      .populate('sectionRef', 'sectionCode sectionName')
      .populate('subjectRef', 'subjectCode subjectName subjectType')
      .lean();

    if (!submission) {
      const err = new Error('Submission record not found.');
      err.statusCode = 404;
      throw err;
    }

    const [isCT, isST] = await Promise.all([
      TeacherAccessService.isClassTeacherForSection({
        schoolId,
        employeeRef,
        classId: submission.classRef._id,
        sectionId: submission.sectionRef._id
      }),
      TeacherAccessService.isSubjectTeacherForAssignment({
        schoolId,
        userRef,
        employeeRef,
        academicYearId: submission.academicYearRef._id,
        classId: submission.classRef._id,
        sectionId: submission.sectionRef._id,
        subjectId: submission.subjectRef._id
      })
    ]);

    if (!isCT && !isST) {
      const err = new Error('Access denied. You do not have permission to view this submission.');
      err.statusCode = 403;
      throw err;
    }

    const [entries, auditLogs, assignment] = await Promise.all([
      MarksEntryInfo.find({ submissionRef: submission._id })
        .populate('studentRef', 'admissionNumber firstName middleName lastName')
        .populate('enrollmentRef', 'rollNumber')
        .lean(),
      MarksAuditLogInfo.find({ schoolId, submissionRef: submission._id })
        .sort({ performedAt: -1 })
        .lean(),
      SubjectTeacherAssignmentInfo.findOne({
        schoolId,
        academicYearRef: submission.academicYearRef._id,
        classRef: submission.classRef._id,
        sectionRef: submission.sectionRef._id,
        subjectRef: submission.subjectRef._id,
        status: 'ACTIVE'
      }).lean()
    ]);

    const sortedEntries = entries
      .map(e => ({
        _id: e._id,
        studentId: e.studentRef?._id,
        admissionNumber: e.studentRef?.admissionNumber || '',
        rollNumber: e.enrollmentRef?.rollNumber || '—',
        studentName: e.studentRef
          ? [e.studentRef.firstName, e.studentRef.middleName, e.studentRef.lastName].filter(Boolean).join(' ')
          : 'N/A',
        componentMarks: e.componentMarks || [],
        totalMaximumMarks: e.totalMaximumMarks,
        totalMarksObtained: e.totalMarksObtained,
        grade: e.grade,
        isAbsent: e.isAbsent,
        remarks: e.remarks || ''
      }))
      .sort((a, b) => {
        const ra = parseInt(a.rollNumber, 10);
        const rb = parseInt(b.rollNumber, 10);
        if (!isNaN(ra) && !isNaN(rb)) return ra - rb;
        return String(a.rollNumber).localeCompare(String(b.rollNumber));
      });

    return {
      submission: {
        _id: submission._id,
        academicYearName: submission.academicYearRef?.yearName || '',
        examinationId: submission.examinationRef?._id || null,
        examinationName:
          submission.examinationRef?.examinationName ||
          (submission.entryType === 'EXTRA_COMPONENT' ? 'Extra / Project Component' : 'Final Co-curricular Grade'),
        classId: submission.classRef._id,
        className: submission.classRef.className,
        sectionId: submission.sectionRef._id,
        sectionName: submission.sectionRef.sectionName,
        subjectId: submission.subjectRef._id,
        subjectCode: submission.subjectRef.subjectCode,
        subjectName: submission.subjectRef.subjectName,
        subjectType: submission.subjectRef.subjectType,
        entryType: submission.entryType,
        status: submission.status,
        isLocked: Boolean(submission.isLocked),
        lockedAt: submission.lockedAt || null,
        lockedByRole: submission.lockedByRole || null,
        lockReason: submission.lockReason || '',
        totalStudents: submission.totalStudents,
        enteredCount: submission.enteredCount,
        submittedAt: submission.submittedAt,
        verifiedAt: submission.verifiedAt,
        returnedAt: submission.returnedAt,
        returnReason: submission.returnReason || '',
        assignedTeacherName: assignment?.teacherName || 'Not Assigned'
      },
      permissions: { isClassTeacher: isCT, isSubjectTeacher: !!isST },
      entries: sortedEntries,
      auditHistory: auditLogs
    };
  }

  /**
   * 6. Class Teacher Marks Verification Overview & Examination Readiness
   */
  static async getClassTeacherVerificationOverview({ user, academicYearId, examinationId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    const ctSections = await TeacherService.getClassTeacherAssignmentsList(schoolId, employeeRef);

    if (ctSections.length === 0) {
      const err = new Error('Access denied. Only assigned Class Teachers can access Marks Verification.');
      err.statusCode = 403;
      throw err;
    }

    if (!selectedYear) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        classTeacherSections: ctSections,
        examinations: [],
        items: [],
        readiness: { isReadyForResultGeneration: false, pendingItems: [] }
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

    const targetExam =
      relevantExams.find(e => e._id.toString() === String(examinationId)) ||
      relevantExams[0] ||
      null;

    if (!targetExam) {
      return {
        selectedAcademicYear: selectedYear,
        availableAcademicYears: academicYears,
        classTeacherSections: ctSections,
        selectedSection: targetSec,
        examinations: [],
        selectedExamination: null,
        items: [],
        readiness: { isReadyForResultGeneration: false, pendingItems: ['No examinations assigned to this class yet.'] }
      };
    }

    const [examSubjects, classSubjects, teacherAssignments, enrolledCount, submissions, config] = await Promise.all([
      ExaminationSubjectInfo.find({
        schoolId,
        examinationRef: targetExam._id,
        classRef: targetSec.classRef,
        status: 'ACTIVE'
      })
        .sort({ subjectCode: 1 })
        .lean(),
      ClassSubjectInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: targetSec.classRef,
        status: 'ACTIVE'
      }).lean(),
      SubjectTeacherAssignmentInfo.find({
        schoolId,
        academicYearRef: ayId,
        classRef: targetSec.classRef,
        sectionRef: targetSec._id,
        status: 'ACTIVE'
      }).lean(),
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
        sectionRef: targetSec._id,
        $or: [{ examinationRef: targetExam._id }, { examinationRef: null }]
      }).lean(),
      SchoolResultConfigService.getOrCreateConfig(schoolId)
    ]);

    const assignBySubject = new Map();
    teacherAssignments.forEach(a => assignBySubject.set(a.subjectRef.toString(), a));

    const subMap = new Map();
    submissions.forEach(s => {
      const k = `${s.examinationRef ? s.examinationRef.toString() : 'NULL'}_${s.subjectRef.toString()}_${s.entryType}`;
      subMap.set(k, s);
    });

    const items = [];
    const pendingItems = [];

    // 1. All Examination Subjects (Academic & Co-curricular Term)
    for (const es of examSubjects) {
      const entryType = es.subjectType === 'CO_CURRICULAR' ? 'CO_CURRICULAR_TERM' : 'EXAM_ACADEMIC';
      const sub = subMap.get(`${targetExam._id.toString()}_${es.subjectRef.toString()}_${entryType}`);
      const assign = assignBySubject.get(es.subjectRef.toString());
      const status = sub ? sub.status : 'NOT_SUBMITTED';

      if (status !== 'VERIFIED') {
        pendingItems.push(`${es.subjectName} (${es.subjectType === 'CO_CURRICULAR' ? 'Co-curricular Grade' : 'Exam Marks'}) — ${status}`);
      }

      items.push({
        submissionId: sub?._id || null,
        examinationId: targetExam._id,
        examinationName: targetExam.examinationName,
        classId: targetSec.classRef,
        className: targetSec.className,
        sectionId: targetSec._id,
        sectionName: targetSec.sectionName,
        subjectId: es.subjectRef,
        subjectCode: es.subjectCode,
        subjectName: es.subjectName,
        subjectType: es.subjectType,
        entryType,
        assignedTeacherName: assign?.teacherName || 'Not Assigned',
        totalStudents: sub?.totalStudents ?? enrolledCount,
        marksSubmitted: sub?.enteredCount ?? 0,
        pendingMarks: Math.max(0, (sub?.totalStudents ?? enrolledCount) - (sub?.enteredCount ?? 0)),
        submissionStatus: status,
        verificationStatus: status === 'VERIFIED' ? 'VERIFIED' : status === 'RETURNED' ? 'RETURNED' : 'PENDING',
        returnReason: sub?.returnReason || '',
        submittedAt: sub?.submittedAt || null
      });
    }

    // 2. Also surface Extra Components configured on ClassSubjectInfo so Class Teacher can verify them!
    const extraClassSubjects = classSubjects.filter(cs => cs.hasAdditionalComponents && cs.additionalComponents?.length > 0);
    for (const cs of extraClassSubjects) {
      const sub = subMap.get(`NULL_${cs.subjectRef.toString()}_EXTRA_COMPONENT`);
      const assign = assignBySubject.get(cs.subjectRef.toString());
      const status = sub ? sub.status : 'NOT_SUBMITTED';

      items.push({
        submissionId: sub?._id || null,
        examinationId: null,
        examinationName: 'Extra / Project Component',
        classId: targetSec.classRef,
        className: targetSec.className,
        sectionId: targetSec._id,
        sectionName: targetSec.sectionName,
        subjectId: cs.subjectRef,
        subjectCode: cs.subjectCode,
        subjectName: cs.subjectName,
        subjectType: cs.subjectType,
        entryType: 'EXTRA_COMPONENT',
        assignedTeacherName: assign?.teacherName || 'Not Assigned',
        totalStudents: sub?.totalStudents ?? enrolledCount,
        marksSubmitted: sub?.enteredCount ?? 0,
        pendingMarks: Math.max(0, (sub?.totalStudents ?? enrolledCount) - (sub?.enteredCount ?? 0)),
        submissionStatus: status,
        verificationStatus: status === 'VERIFIED' ? 'VERIFIED' : status === 'RETURNED' ? 'RETURNED' : 'PENDING',
        returnReason: sub?.returnReason || '',
        submittedAt: sub?.submittedAt || null
      });
    }

    // 3. If Co-curricular Option B is enabled, also surface Final Co-curricular Grade submissions
    if (config?.coCurricularConfig?.finalWorkflow === 'SEPARATE_SUBMISSION') {
      const coCurricSubs = classSubjects.filter(cs => cs.subjectType === 'CO_CURRICULAR');
      for (const cs of coCurricSubs) {
        const sub = subMap.get(`NULL_${cs.subjectRef.toString()}_CO_CURRICULAR_FINAL`);
        const assign = assignBySubject.get(cs.subjectRef.toString());
        const status = sub
          ? (sub.status === 'DRAFT' && sub.requestedAt && sub.enteredCount === 0 ? 'REQUESTED' : sub.status)
          : 'NOT_REQUESTED';
        items.push({
          submissionId: sub?._id || null,
          examinationId: null,
          examinationName: 'Final Co-curricular Grade',
          classId: targetSec.classRef,
          className: targetSec.className,
          sectionId: targetSec._id,
          sectionName: targetSec.sectionName,
          subjectId: cs.subjectRef,
          subjectCode: cs.subjectCode,
          subjectName: cs.subjectName,
          subjectType: cs.subjectType,
          entryType: 'CO_CURRICULAR_FINAL',
          assignedTeacherName: assign?.teacherName || 'Not Assigned',
          totalStudents: sub?.totalStudents ?? enrolledCount,
          marksSubmitted: sub?.enteredCount ?? 0,
          pendingMarks: Math.max(0, (sub?.totalStudents ?? enrolledCount) - (sub?.enteredCount ?? 0)),
          submissionStatus: status,
          verificationStatus: status === 'VERIFIED' ? 'VERIFIED' : status === 'RETURNED' ? 'RETURNED' : 'PENDING',
          returnReason: sub?.returnReason || '',
          submittedAt: sub?.submittedAt || null
        });
      }
    }

    const isReadyForResultGeneration = examSubjects.length > 0 && pendingItems.length === 0 && enrolledCount > 0;

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      classTeacherSections: ctSections,
      selectedSection: targetSec,
      examinations: relevantExams,
      selectedExamination: targetExam,
      items,
      readiness: {
        isReadyForResultGeneration,
        totalRequiredExamSubjects: examSubjects.length,
        enrolledCount,
        pendingItems
      }
    };
  }

  /**
   * 7. Class Teacher: Verify Submitted Marks
   */
  static async verifySubmission({ user, submissionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const submission = await MarksSubmissionInfo.findOne({ _id: submissionId, schoolId })
      .populate('subjectRef', 'subjectName subjectCode')
      .populate('classRef', 'className')
      .populate('sectionRef', 'sectionName')
      .populate('examinationRef', 'examinationName');

    if (!submission) {
      const err = new Error('Submission not found.');
      err.statusCode = 404;
      throw err;
    }

    const isCT = await TeacherAccessService.isClassTeacherForSection({
      schoolId,
      employeeRef,
      classId: submission.classRef._id,
      sectionId: submission.sectionRef._id
    });
    if (!isCT) {
      const err = new Error('Access denied. Only the assigned Class Teacher can verify submissions for this class/section.');
      err.statusCode = 403;
      throw err;
    }

    if (submission.status !== 'SUBMITTED') {
      const err = new Error(`Only 'SUBMITTED' marks can be verified (current status: ${submission.status}).`);
      err.statusCode = 400;
      throw err;
    }

    submission.status = 'VERIFIED';
    submission.verifiedBy = user._id;
    submission.verifiedAt = new Date();
    submission.returnReason = '';
    await submission.save();

    const label = submission.examinationRef
      ? `${submission.examinationRef.examinationName} - ${submission.subjectRef.subjectName}`
      : `${submission.subjectRef.subjectName} (${submission.entryType})`;

    await this.logAudit({
      schoolRef,
      schoolId,
      academicYearRef: submission.academicYearRef,
      examinationRef: submission.examinationRef?._id || null,
      classRef: submission.classRef._id,
      sectionRef: submission.sectionRef._id,
      subjectRef: submission.subjectRef._id,
      submissionRef: submission._id,
      action: 'MARKS_VERIFIED',
      details: `Verified ${label} for ${submission.classRef.className} - ${submission.sectionRef.sectionName}`,
      user
    });

    if (submission.submittedBy && submission.submittedBy.toString() !== user._id.toString()) {
      const stUser = await UserInfo.findById(submission.submittedBy).lean();
      await this.notifyUser({
        schoolRef,
        schoolId,
        targetUser: stUser,
        title: 'Marks Verified by Class Teacher',
        message: `Your submission for ${label} (${submission.classRef.className} - ${submission.sectionRef.sectionName}) has been verified.`,
        type: 'success'
      });
    }

    return {
      success: true,
      message: 'Submission verified successfully.',
      submission: submission.toObject()
    };
  }

  /**
   * 8. Class Teacher: Return Submission for Correction (Mandatory Reason)
   */
  static async returnSubmissionForCorrection({ user, submissionId, reason }) {
    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const cleanReason = typeof reason === 'string' ? reason.trim() : '';
    if (!cleanReason) {
      const err = new Error('A mandatory correction reason is required when returning marks.');
      err.statusCode = 400;
      throw err;
    }

    const submission = await MarksSubmissionInfo.findOne({ _id: submissionId, schoolId })
      .populate('subjectRef', 'subjectName subjectCode')
      .populate('classRef', 'className')
      .populate('sectionRef', 'sectionName')
      .populate('examinationRef', 'examinationName');

    if (!submission) {
      const err = new Error('Submission not found.');
      err.statusCode = 404;
      throw err;
    }

    const isCT = await TeacherAccessService.isClassTeacherForSection({
      schoolId,
      employeeRef,
      classId: submission.classRef._id,
      sectionId: submission.sectionRef._id
    });
    if (!isCT) {
      const err = new Error('Access denied. Only the assigned Class Teacher can return submissions for this class/section.');
      err.statusCode = 403;
      throw err;
    }

    if (submission.status !== 'SUBMITTED') {
      const err = new Error(`Only 'SUBMITTED' marks can be returned for correction (current status: ${submission.status}).`);
      err.statusCode = 400;
      throw err;
    }

    submission.status = 'RETURNED';
    submission.returnedBy = user._id;
    submission.returnedAt = new Date();
    submission.returnReason = cleanReason;
    await submission.save();

    const label = submission.examinationRef
      ? `${submission.examinationRef.examinationName} - ${submission.subjectRef.subjectName}`
      : `${submission.subjectRef.subjectName} (${submission.entryType})`;

    await this.logAudit({
      schoolRef,
      schoolId,
      academicYearRef: submission.academicYearRef,
      examinationRef: submission.examinationRef?._id || null,
      classRef: submission.classRef._id,
      sectionRef: submission.sectionRef._id,
      subjectRef: submission.subjectRef._id,
      submissionRef: submission._id,
      action: 'MARKS_RETURNED',
      details: `Returned ${label} for correction. Reason: ${cleanReason}`,
      user
    });

    // Notify assigned subject teacher (or submitter)
    const assignment = await SubjectTeacherAssignmentInfo.findOne({
      schoolId,
      academicYearRef: submission.academicYearRef,
      classRef: submission.classRef._id,
      sectionRef: submission.sectionRef._id,
      subjectRef: submission.subjectRef._id,
      status: 'ACTIVE'
    }).lean();

    const notifyUserId = assignment?.teacherUserRef || submission.submittedBy;
    if (notifyUserId) {
      const stUser = await UserInfo.findById(notifyUserId).lean();
      await this.notifyUser({
        schoolRef,
        schoolId,
        targetUser: stUser,
        title: 'Marks Returned for Correction',
        message: `${label} (${submission.classRef.className} - ${submission.sectionRef.sectionName}) was returned by the Class Teacher. Reason: ${cleanReason}`,
        type: 'warning'
      });
    }

    return {
      success: true,
      message: 'Submission returned to subject teacher for correction.',
      submission: submission.toObject()
    };
  }

  /**
   * 9. Class Teacher: Request Final Co-curricular Grade Submissions (Option B)
   */
  static async requestFinalCoCurricularGrades({ user, academicYearId, classId, sectionId }) {
    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;
    const employeeRef = user.employeeRef?._id || user.employeeRef;

    const { selectedYear } = await TeacherService.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) {
      const err = new Error('Academic year not found.');
      err.statusCode = 404;
      throw err;
    }

    const isCT = await TeacherAccessService.isClassTeacherForSection({
      schoolId,
      employeeRef,
      classId,
      sectionId
    });
    if (!isCT) {
      const err = new Error('Access denied. Only the Class Teacher can request final co-curricular grade submissions.');
      err.statusCode = 403;
      throw err;
    }

    const coCurricAssigns = await SubjectTeacherAssignmentInfo.find({
      schoolId,
      academicYearRef: selectedYear._id,
      classRef: classId,
      sectionRef: sectionId,
      subjectType: 'CO_CURRICULAR',
      status: 'ACTIVE'
    }).lean();

    if (coCurricAssigns.length === 0) {
      const err = new Error('No co-curricular subject teacher assignments found for this class and section.');
      err.statusCode = 400;
      throw err;
    }

    let requestedCount = 0;
    for (const assign of coCurricAssigns) {
      await MarksSubmissionInfo.findOneAndUpdate(
        {
          schoolId,
          academicYearRef: selectedYear._id,
          examinationRef: null,
          classRef: classId,
          sectionRef: sectionId,
          subjectRef: assign.subjectRef,
          entryType: 'CO_CURRICULAR_FINAL'
        },
        {
          $setOnInsert: {
            schoolRef,
            status: 'DRAFT',
            totalStudents: 0,
            enteredCount: 0
          },
          $set: {
            requestedBy: user._id,
            requestedAt: new Date()
          }
        },
        { upsert: true, new: true }
      );

      const stUser = await UserInfo.findById(assign.teacherUserRef).lean();
      await this.notifyUser({
        schoolRef,
        schoolId,
        targetUser: stUser,
        title: 'Final Co-curricular Grade Submission Requested',
        message: `Please submit final co-curricular grades for ${assign.subjectName} (${assign.className} - ${assign.sectionName}).`,
        type: 'info'
      });

      await this.logAudit({
        schoolRef,
        schoolId,
        academicYearRef: selectedYear._id,
        classRef: classId,
        sectionRef: sectionId,
        subjectRef: assign.subjectRef,
        action: 'CO_CURRICULAR_FINAL_REQUESTED',
        details: `Requested final co-curricular grade submission for ${assign.subjectName}`,
        user
      });

      requestedCount++;
    }

    return {
      success: true,
      requestedCount,
      message: `Notifications sent to ${requestedCount} co-curricular subject teacher(s).`
    };
  }
}

module.exports = TeacherMarksService;
