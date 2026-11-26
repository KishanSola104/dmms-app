const mongoose = require('mongoose');
const AcademicYearInfo = require('../models/academicYearInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const ExaminationInfo = require('../models/examinationInfo.model');
const ExaminationClassInfo = require('../models/examinationClassInfo.model');
const ExaminationSubjectInfo = require('../models/examinationSubjectInfo.model');
const ClassSubjectInfo = require('../models/classSubjectInfo.model');
const SubjectTeacherAssignmentInfo = require('../models/subjectTeacherAssignmentInfo.model');
const MarksSubmissionInfo = require('../models/marksSubmissionInfo.model');
const UserInfo = require('../models/userInfo.model');
const NotificationInfo = require('../models/notificationInfo.model');
const AuditLogService = require('./auditLog.service');
const TeacherService = require('./teacher.service');

class MarksLockService {
  /**
   * Build the authoritative list of marks-entry units for a school & academic year,
   * supporting Examination, Class, Section, Subject, and Extra/Co-curricular scopes.
   */
  static async resolveTargets({
    schoolId,
    academicYearId,
    examinationId = 'ALL',
    classId = 'ALL',
    sectionId = 'ALL',
    subjectId = 'ALL',
    entryType = 'ALL'
  }) {
    const sId = schoolId.toUpperCase();
    const { selectedYear, academicYears } = await TeacherService.resolveAcademicYear(sId, academicYearId);

    const [classes, sections] = await Promise.all([
      ClassInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ classCode: 1 }).lean(),
      SectionInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ sectionCode: 1 }).lean()
    ]);

    if (!selectedYear) {
      return {
        selectedYear: null,
        academicYears,
        classes,
        sections,
        examinations: [],
        targets: []
      };
    }

    const ayId = selectedYear._id;
    const [examinations, examClasses, examSubjects, classSubjects, assignments, submissions] = await Promise.all([
      ExaminationInfo.find({ schoolId: sId, academicYearRef: ayId, status: { $ne: 'CANCELLED' } })
        .sort({ startDate: 1, createdAt: 1 })
        .lean(),
      ExaminationClassInfo.find({ schoolId: sId, academicYearRef: ayId, status: 'ACTIVE' }).lean(),
      ExaminationSubjectInfo.find({ schoolId: sId, academicYearRef: ayId, status: 'ACTIVE' }).lean(),
      ClassSubjectInfo.find({ schoolId: sId, academicYearRef: ayId, status: 'ACTIVE' }).lean(),
      SubjectTeacherAssignmentInfo.find({ schoolId: sId, academicYearRef: ayId, status: 'ACTIVE' }).lean(),
      MarksSubmissionInfo.find({ schoolId: sId, academicYearRef: ayId }).lean()
    ]);

    const classMap = new Map(classes.map(c => [c._id.toString(), c]));
    const sectionsByClass = new Map();
    for (const sec of sections) {
      const k = sec.classRef.toString();
      if (!sectionsByClass.has(k)) sectionsByClass.set(k, []);
      sectionsByClass.get(k).push(sec);
    }

    const examMap = new Map(examinations.map(e => [e._id.toString(), e]));
    const examClassSet = new Set(examClasses.map(ec => `${ec.examinationRef.toString()}_${ec.classRef.toString()}`));
    const assignMap = new Map();
    for (const a of assignments) {
      assignMap.set(`${a.classRef.toString()}_${a.sectionRef.toString()}_${a.subjectRef.toString()}`, a);
    }

    const subMap = new Map();
    for (const s of submissions) {
      const k = `${s.examinationRef ? s.examinationRef.toString() : 'NULL'}_${s.classRef.toString()}_${s.sectionRef.toString()}_${s.subjectRef.toString()}_${s.entryType}`;
      subMap.set(k, s);
    }

    const targets = [];

    // 1. Examination-based subjects (EXAM_ACADEMIC & CO_CURRICULAR_TERM)
    for (const es of examSubjects) {
      const ex = examMap.get(es.examinationRef.toString());
      if (!ex) continue;
      if (!examClassSet.has(`${ex._id.toString()}_${es.classRef.toString()}`)) continue;
      const cls = classMap.get(es.classRef.toString());
      if (!cls) continue;

      const clsSections = sectionsByClass.get(cls._id.toString()) || [];
      const et = es.subjectType === 'CO_CURRICULAR' ? 'CO_CURRICULAR_TERM' : 'EXAM_ACADEMIC';

      for (const sec of clsSections) {
        const assign = assignMap.get(`${cls._id.toString()}_${sec._id.toString()}_${es.subjectRef.toString()}`);
        const sub = subMap.get(`${ex._id.toString()}_${cls._id.toString()}_${sec._id.toString()}_${es.subjectRef.toString()}_${et}`);
        targets.push({
          key: `${ex._id}_${cls._id}_${sec._id}_${es.subjectRef}_${et}`,
          academicYearId: ayId,
          academicYearName: selectedYear.yearName || selectedYear.yearCode,
          examinationId: ex._id,
          examinationCode: ex.examinationCode,
          examinationName: ex.examinationName,
          classId: cls._id,
          className: cls.className,
          sectionId: sec._id,
          sectionName: sec.sectionName,
          subjectId: es.subjectRef,
          subjectCode: es.subjectCode,
          subjectName: es.subjectName,
          subjectType: es.subjectType,
          entryType: et,
          assignedTeacherName: assign?.teacherName || 'Unassigned',
          assignedTeacherUserRef: assign?.teacherUserRef || null,
          submissionId: sub?._id || null,
          submissionStatus: sub?.status || 'PENDING',
          enteredCount: sub?.enteredCount ?? 0,
          totalStudents: sub?.totalStudents ?? 0,
          isLocked: Boolean(sub?.isLocked),
          lockedByRole: sub?.lockedByRole || null,
          lockedAt: sub?.lockedAt || null,
          lockReason: sub?.lockReason || ''
        });
      }
    }

    // 2. Extra / Project component subjects (EXTRA_COMPONENT)
    for (const cs of classSubjects) {
      if (!cs.hasAdditionalComponents || !cs.additionalComponents?.length) continue;
      const cls = classMap.get(cs.classRef.toString());
      if (!cls) continue;
      const clsSections = sectionsByClass.get(cls._id.toString()) || [];
      for (const sec of clsSections) {
        const assign = assignMap.get(`${cls._id.toString()}_${sec._id.toString()}_${cs.subjectRef.toString()}`);
        const sub = subMap.get(`NULL_${cls._id.toString()}_${sec._id.toString()}_${cs.subjectRef.toString()}_EXTRA_COMPONENT`);
        targets.push({
          key: `NULL_${cls._id}_${sec._id}_${cs.subjectRef}_EXTRA_COMPONENT`,
          academicYearId: ayId,
          academicYearName: selectedYear.yearName || selectedYear.yearCode,
          examinationId: null,
          examinationCode: 'EXTRA',
          examinationName: 'Extra / Project Component',
          classId: cls._id,
          className: cls.className,
          sectionId: sec._id,
          sectionName: sec.sectionName,
          subjectId: cs.subjectRef,
          subjectCode: cs.subjectCode,
          subjectName: cs.subjectName,
          subjectType: cs.subjectType,
          entryType: 'EXTRA_COMPONENT',
          assignedTeacherName: assign?.teacherName || 'Unassigned',
          assignedTeacherUserRef: assign?.teacherUserRef || null,
          submissionId: sub?._id || null,
          submissionStatus: sub?.status || 'PENDING',
          enteredCount: sub?.enteredCount ?? 0,
          totalStudents: sub?.totalStudents ?? 0,
          isLocked: Boolean(sub?.isLocked),
          lockedByRole: sub?.lockedByRole || null,
          lockedAt: sub?.lockedAt || null,
          lockReason: sub?.lockReason || ''
        });
      }
    }

    // Apply optional filters
    let filtered = targets;
    if (examinationId && examinationId !== 'ALL') {
      if (examinationId === 'NONE') {
        filtered = filtered.filter(t => !t.examinationId);
      } else if (mongoose.Types.ObjectId.isValid(examinationId)) {
        filtered = filtered.filter(t => t.examinationId && t.examinationId.toString() === String(examinationId));
      }
    }
    if (classId && classId !== 'ALL' && mongoose.Types.ObjectId.isValid(classId)) {
      filtered = filtered.filter(t => t.classId.toString() === String(classId));
    }
    if (sectionId && sectionId !== 'ALL' && mongoose.Types.ObjectId.isValid(sectionId)) {
      filtered = filtered.filter(t => t.sectionId.toString() === String(sectionId));
    }
    if (subjectId && subjectId !== 'ALL' && mongoose.Types.ObjectId.isValid(subjectId)) {
      filtered = filtered.filter(t => t.subjectId.toString() === String(subjectId));
    }
    if (entryType && entryType !== 'ALL') {
      filtered = filtered.filter(t => t.entryType === entryType.toUpperCase());
    }

    return {
      selectedYear,
      academicYears,
      classes,
      sections,
      examinations,
      targets: filtered
    };
  }

  /**
   * List Marks Entry Lock Overview for Admin / Head Teacher
   */
  static async getLockOverview({
    user,
    academicYearId,
    examinationId = 'ALL',
    classId = 'ALL',
    sectionId = 'ALL',
    subjectId = 'ALL',
    lockStatus = 'ALL'
  }) {
    if (!['ADMIN', 'HEAD_TEACHER'].includes(user.roleCode)) {
      const err = new Error('Access denied. Only Admin or Head Teacher can manage marks-entry lock controls.');
      err.statusCode = 403;
      throw err;
    }

    const resolved = await this.resolveTargets({
      schoolId: user.schoolId,
      academicYearId,
      examinationId,
      classId,
      sectionId,
      subjectId
    });

    const summary = {
      totalTasks: resolved.targets.length,
      openCount: resolved.targets.filter(t => !t.isLocked).length,
      lockedCount: resolved.targets.filter(t => t.isLocked).length,
      submittedCount: resolved.targets.filter(t => t.submissionStatus === 'SUBMITTED').length,
      verifiedCount: resolved.targets.filter(t => t.submissionStatus === 'VERIFIED').length
    };

    let items = resolved.targets;
    if (lockStatus === 'LOCKED') items = items.filter(t => t.isLocked);
    else if (lockStatus === 'OPEN') items = items.filter(t => !t.isLocked);

    // Distinct subjects for dropdown
    const subjectMap = new Map();
    resolved.targets.forEach(t => {
      const id = t.subjectId.toString();
      if (!subjectMap.has(id)) {
        subjectMap.set(id, { _id: t.subjectId, subjectCode: t.subjectCode, subjectName: t.subjectName });
      }
    });

    return {
      selectedAcademicYear: resolved.selectedYear,
      availableAcademicYears: resolved.academicYears,
      classes: resolved.classes,
      sections: resolved.sections,
      examinations: resolved.examinations,
      subjects: Array.from(subjectMap.values()),
      summary,
      items
    };
  }

  /**
   * Lock or Open/Reopen Marks Entry at Examination / Class / Section / Subject scope
   */
  static async updateLockState({
    user,
    action, // 'LOCK' | 'OPEN'
    academicYearId,
    examinationId = 'ALL',
    classId = 'ALL',
    sectionId = 'ALL',
    subjectId = 'ALL',
    entryType = 'ALL',
    reason = ''
  }) {
    if (!['ADMIN', 'HEAD_TEACHER'].includes(user.roleCode)) {
      const err = new Error('Access denied. Only Admin or Head Teacher can control marks-entry locking.');
      err.statusCode = 403;
      throw err;
    }

    const cleanAction = String(action || '').toUpperCase();
    if (!['LOCK', 'OPEN'].includes(cleanAction)) {
      const err = new Error("Action must be 'LOCK' or 'OPEN'.");
      err.statusCode = 400;
      throw err;
    }

    const schoolId = user.schoolId.toUpperCase();
    const schoolRef = user.schoolRef;

    const resolved = await this.resolveTargets({
      schoolId,
      academicYearId,
      examinationId,
      classId,
      sectionId,
      subjectId,
      entryType
    });

    if (!resolved.selectedYear) {
      const err = new Error('Academic year not found.');
      err.statusCode = 404;
      throw err;
    }

    if (resolved.targets.length === 0) {
      const err = new Error('No configured marks-entry records found matching the selected scope.');
      err.statusCode = 404;
      throw err;
    }

    // Head Teacher cannot reopen records locked by Admin
    if (cleanAction === 'OPEN' && user.roleCode === 'HEAD_TEACHER') {
      const adminLocked = resolved.targets.filter(t => t.isLocked && t.lockedByRole === 'ADMIN');
      if (adminLocked.length > 0 && adminLocked.length === resolved.targets.length) {
        const err = new Error(
          'Access denied. These marks-entry records were locked by a School Administrator and can only be reopened by an Administrator.'
        );
        err.statusCode = 403;
        throw err;
      }
    }

    const now = new Date();
    const cleanReason = typeof reason === 'string' ? reason.trim() : '';
    let updatedCount = 0;
    let skippedAdminLocked = 0;
    const affectedTeacherIds = new Set();

    for (const target of resolved.targets) {
      if (cleanAction === 'OPEN' && user.roleCode === 'HEAD_TEACHER' && target.isLocked && target.lockedByRole === 'ADMIN') {
        skippedAdminLocked++;
        continue;
      }

      const filter = {
        schoolId,
        academicYearRef: resolved.selectedYear._id,
        examinationRef: target.examinationId || null,
        classRef: target.classId,
        sectionRef: target.sectionId,
        subjectRef: target.subjectId,
        entryType: target.entryType
      };

      const updateFields =
        cleanAction === 'LOCK'
          ? {
              isLocked: true,
              lockedBy: user._id,
              lockedByRole: user.roleCode,
              lockedAt: now,
              lockReason: cleanReason || `Locked by ${user.roleName || user.roleCode}`
            }
          : {
              isLocked: false,
              unlockedBy: user._id,
              unlockedByRole: user.roleCode,
              unlockedAt: now,
              lockReason: ''
            };

      await MarksSubmissionInfo.findOneAndUpdate(
        filter,
        {
          $set: updateFields,
          $setOnInsert: {
            schoolRef,
            status: 'DRAFT',
            totalStudents: 0,
            enteredCount: 0
          }
        },
        { upsert: true, new: true }
      );

      updatedCount++;
      if (target.assignedTeacherUserRef) {
        affectedTeacherIds.add(target.assignedTeacherUserRef.toString());
      }
    }

    // Notify affected teachers
    if (affectedTeacherIds.size > 0) {
      const teachers = await UserInfo.find({
        _id: { $in: Array.from(affectedTeacherIds) },
        schoolId,
        status: 'ACTIVE'
      }).lean();

      const notifs = teachers.map(t => ({
        schoolRef,
        schoolId,
        targetUserRef: t._id,
        targetUserId: t.userId,
        targetRoleCode: t.roleCode,
        title: cleanAction === 'LOCK' ? 'Marks Entry Locked' : 'Marks Entry Reopened',
        message:
          cleanAction === 'LOCK'
            ? `Marks entry for ${updatedCount} subject record(s) has been locked by ${user.employeeRef?.fullName || user.roleName}.${cleanReason ? ` Note: ${cleanReason}` : ''}`
            : `Marks entry for ${updatedCount} subject record(s) has been opened/reopened by ${user.employeeRef?.fullName || user.roleName}.`,
        type: cleanAction === 'LOCK' ? 'warning' : 'info',
        isRead: false,
        sentByUserRef: user._id,
        sentByName: user.employeeRef?.fullName || user.userId,
        sentByRole: user.roleCode
      }));
      if (notifs.length > 0) {
        await NotificationInfo.insertMany(notifs).catch(() => {});
      }
    }

    await AuditLogService.log({
      schoolRef,
      schoolId,
      academicYearRef: resolved.selectedYear._id,
      examinationRef: examinationId && examinationId !== 'ALL' && examinationId !== 'NONE' ? examinationId : null,
      classRef: classId && classId !== 'ALL' ? classId : null,
      sectionRef: sectionId && sectionId !== 'ALL' ? sectionId : null,
      subjectRef: subjectId && subjectId !== 'ALL' ? subjectId : null,
      module: 'MARKS_ENTRY',
      entityType: 'MarksSubmissionInfo',
      entityId: `${examinationId}_${classId}_${sectionId}_${subjectId}`,
      action: cleanAction === 'LOCK' ? 'MARKS_ENTRY_LOCKED' : 'MARKS_ENTRY_OPENED',
      details: `${cleanAction === 'LOCK' ? 'Locked' : 'Opened/Reopened'} marks entry for ${updatedCount} record(s)${cleanReason ? `. Note: ${cleanReason}` : ''}${skippedAdminLocked ? ` (${skippedAdminLocked} Admin-locked skipped)` : ''}`,
      newValue: { action: cleanAction, updatedCount, skippedAdminLocked, reason: cleanReason },
      user
    });

    return {
      success: true,
      updatedCount,
      skippedAdminLocked,
      message:
        cleanAction === 'LOCK'
          ? `Marks entry locked for ${updatedCount} record(s). Teachers can no longer edit these marks.`
          : `Marks entry opened for ${updatedCount} record(s).${skippedAdminLocked ? ` (${skippedAdminLocked} Admin-locked record(s) remained locked.)` : ''}`
    };
  }
}

module.exports = MarksLockService;
