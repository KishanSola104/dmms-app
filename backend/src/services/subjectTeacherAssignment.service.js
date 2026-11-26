const mongoose = require('mongoose');
const SubjectTeacherAssignmentInfo = require('../models/subjectTeacherAssignmentInfo.model');
const ClassSubjectInfo = require('../models/classSubjectInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const SubjectInfo = require('../models/subjectInfo.model');
const AcademicYearInfo = require('../models/academicYearInfo.model');
const UserInfo = require('../models/userInfo.model');
const EmployeeInfo = require('../models/employeeInfo.model');
const NotificationInfo = require('../models/notificationInfo.model');
const AuditLogService = require('./auditLog.service');

class SubjectTeacherAssignmentService {
  /**
   * Helper to dispatch assignment notifications to:
   * 1. Assigned Teacher
   * 2. Class Teacher of the class (if configured and distinct)
   * 3. Section Teacher of the section (if configured and distinct)
   * 4. Head Teacher(s) (if configured and distinct)
   * 5. Previous Teacher (if reassigned and distinct)
   * Enforces deduplication if the same person holds multiple responsibilities.
   */
  static async sendAssignmentNotifications({
    isReassignment = false,
    assignment,
    classDoc,
    sectionDoc,
    academicYear,
    newTeacherUser,
    oldTeacherUser = null
  }) {
    try {
      const { schoolRef, schoolId, subjectName, subjectCode, className, sectionName } = assignment;
      const yearName = academicYear.yearName;
      const newTeacherName = newTeacherUser.employeeRef?.fullName || newTeacherUser.userId;

      // Map of unique user IDs to avoid duplicate notifications
      const recipientMap = new Map();

      // 1. Newly assigned teacher
      recipientMap.set(newTeacherUser._id.toString(), {
        user: newTeacherUser,
        isAssignedTeacher: true
      });

      // 2. Previous teacher (if reassignment and different person)
      if (isReassignment && oldTeacherUser && oldTeacherUser._id.toString() !== newTeacherUser._id.toString()) {
        recipientMap.set(oldTeacherUser._id.toString(), {
          user: oldTeacherUser,
          isPreviousTeacher: true
        });
      }

      // 3. Class Teacher (from ClassInfo)
      if (classDoc.classTeacherRef) {
        const ctUser = await UserInfo.findOne({
          schoolId,
          employeeRef: classDoc.classTeacherRef,
          status: 'ACTIVE'
        });
        if (ctUser && !recipientMap.has(ctUser._id.toString())) {
          recipientMap.set(ctUser._id.toString(), {
            user: ctUser,
            isClassTeacher: true
          });
        }
      }

      // 4. Section Teacher (from SectionInfo)
      if (sectionDoc.sectionTeacherRef) {
        const stUser = await UserInfo.findOne({
          schoolId,
          employeeRef: sectionDoc.sectionTeacherRef,
          status: 'ACTIVE'
        });
        if (stUser && !recipientMap.has(stUser._id.toString())) {
          recipientMap.set(stUser._id.toString(), {
            user: stUser,
            isSectionTeacher: true
          });
        }
      }

      // 5. Head Teacher(s)
      const headTeachers = await UserInfo.find({
        schoolId,
        roleCode: 'HEAD_TEACHER',
        status: 'ACTIVE'
      });
      for (const htUser of headTeachers) {
        if (!recipientMap.has(htUser._id.toString())) {
          recipientMap.set(htUser._id.toString(), {
            user: htUser,
            isHeadTeacher: true
          });
        }
      }

      // Create notification for each deduplicated recipient
      const notificationsToInsert = [];
      for (const { user, isAssignedTeacher, isPreviousTeacher } of recipientMap.values()) {
        let title = isReassignment ? 'Subject Assignment Updated' : 'New Subject Assignment';
        let message = '';

        if (isAssignedTeacher) {
          message = `You have been assigned to teach ${subjectName} (${subjectCode}) in ${className}, ${sectionName} for Academic Year ${yearName}.`;
        } else if (isPreviousTeacher) {
          title = 'Subject Assignment Transferred';
          message = `Your assignment to teach ${subjectName} (${subjectCode}) in ${className}, ${sectionName} for Academic Year ${yearName} has been transferred to ${newTeacherName}.`;
        } else {
          message = isReassignment
            ? `${newTeacherName} has been reassigned to teach ${subjectName} (${subjectCode}) in ${className}, ${sectionName} for Academic Year ${yearName}.`
            : `${newTeacherName} has been assigned to teach ${subjectName} (${subjectCode}) in ${className}, ${sectionName} for Academic Year ${yearName}.`;
        }

        notificationsToInsert.push({
          schoolRef,
          schoolId,
          targetUserRef: user._id,
          targetUserId: user.userId,
          targetRoleCode: user.roleCode,
          title,
          message,
          type: 'info',
          isRead: false
        });
      }

      if (notificationsToInsert.length > 0) {
        await NotificationInfo.insertMany(notificationsToInsert);
      }
    } catch (notifErr) {
      console.error('[NotificationService] Warning: Failed to deliver assignment notifications:', notifErr.message);
    }
  }

  /**
   * Fetch eligible sections, allocated subjects, and eligible teachers for assignment modal
   */
  static async getEligibleOptions({ schoolId, academicYearRef, classRef }) {
    if (!academicYearRef || !classRef) {
      throw new Error('Academic Year and Class are required.');
    }

    // 1. Active sections for this class
    const sections = await SectionInfo.find({
      schoolId,
      classRef: new mongoose.Types.ObjectId(classRef),
      status: 'ACTIVE'
    }).sort({ sectionCode: 1 });

    // 2. Active subjects allocated to this class for this academic year
    const allocatedSubjects = await ClassSubjectInfo.find({
      schoolId,
      academicYearRef: new mongoose.Types.ObjectId(academicYearRef),
      classRef: new mongoose.Types.ObjectId(classRef),
      status: 'ACTIVE'
    }).sort({ subjectName: 1 });

    // 3. Eligible active Teachers and Head Teachers
    const eligibleUsers = await UserInfo.find({
      schoolId,
      roleCode: { $in: ['TEACHER', 'HEAD_TEACHER'] },
      status: 'ACTIVE'
    }).populate('employeeRef');

    const teachers = eligibleUsers.map(u => ({
      userId: u.userId,
      employeeId: u.employeeRef?._id,
      fullName: u.employeeRef?.fullName || u.userId,
      roleCode: u.roleCode,
      roleName: u.roleName,
      email: u.email
    }));

    return {
      sections: sections.map(s => ({
        _id: s._id,
        sectionCode: s.sectionCode,
        sectionName: s.sectionName,
        maxCapacity: s.maxCapacity
      })),
      allocatedSubjects: allocatedSubjects.map(sub => ({
        _id: sub._id,
        subjectRef: sub.subjectRef,
        subjectCode: sub.subjectCode,
        subjectName: sub.subjectName,
        subjectType: sub.subjectType,
        hasAdditionalComponents: sub.hasAdditionalComponents,
        totalAdditionalMarks: sub.totalAdditionalMarks
      })),
      teachers
    };
  }

  /**
   * List teacher assignments with search, filters, and pagination
   */
  static async listAssignments({
    schoolId,
    academicYearRef,
    classRef,
    sectionRef,
    subjectRef,
    teacherId,
    status = '',
    search = '',
    page = 1,
    limit = 10
  }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const query = { schoolId };

    if (academicYearRef) {
      query.academicYearRef = new mongoose.Types.ObjectId(academicYearRef);
    }
    if (classRef) {
      query.classRef = new mongoose.Types.ObjectId(classRef);
    }
    if (sectionRef) {
      query.sectionRef = new mongoose.Types.ObjectId(sectionRef);
    }
    if (subjectRef) {
      query.subjectRef = new mongoose.Types.ObjectId(subjectRef);
    }
    if (teacherId) {
      query.teacherEmployeeRef = new mongoose.Types.ObjectId(teacherId);
    }
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    const assignments = await SubjectTeacherAssignmentInfo.find(query)
      .populate('teacherUserRef', 'roleCode roleName')
      .sort({ className: 1, sectionCode: 1, subjectName: 1 });

    const formatted = assignments.map(a => ({
      _id: a._id,
      schoolId: a.schoolId,
      academicYearRef: a.academicYearRef,
      classRef: a.classRef,
      classCode: a.classCode,
      className: a.className,
      sectionRef: a.sectionRef,
      sectionCode: a.sectionCode,
      sectionName: a.sectionName,
      subjectRef: a.subjectRef,
      classSubjectRef: a.classSubjectRef,
      subjectCode: a.subjectCode,
      subjectName: a.subjectName,
      subjectType: a.subjectType,
      teacherEmployeeRef: a.teacherEmployeeRef,
      teacherUserRef: a.teacherUserRef?._id || a.teacherUserRef,
      teacherName: a.teacherName,
      teacherUserId: a.teacherUserId,
      teacherEmail: a.teacherEmail,
      teacherRoleCode: a.teacherUserRef?.roleCode || 'TEACHER',
      teacherRoleName: a.teacherUserRef?.roleName || 'Teacher',
      status: a.status,
      createdAt: a.createdAt
    }));

    let filtered = formatted;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = formatted.filter(a =>
        a.teacherName.toLowerCase().includes(q) ||
        a.subjectName.toLowerCase().includes(q) ||
        a.subjectCode.toLowerCase().includes(q) ||
        a.className.toLowerCase().includes(q) ||
        a.sectionName.toLowerCase().includes(q) ||
        a.teacherUserId.toLowerCase().includes(q)
      );
    }

    const totalRecords = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    return {
      assignments: paginated,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * Assign a teacher to a subject for a specific class section and academic year
   */
  static async assignTeacher({
    schoolId,
    schoolRef,
    academicYearRef,
    classRef,
    sectionRef,
    classSubjectRef,
    teacherEmployeeId,
    actorUser = null
  }) {
    if (!academicYearRef || !classRef || !sectionRef || !classSubjectRef || !teacherEmployeeId) {
      throw new Error('Academic Year, Class, Section, Subject, and Teacher are mandatory.');
    }

    // 1. Validate Academic Year
    const academicYear = await AcademicYearInfo.findOne({
      _id: academicYearRef,
      schoolId
    });
    if (!academicYear) {
      throw new Error('Academic Year not found or does not belong to your school.');
    }

    // 2. Validate Class
    const classDoc = await ClassInfo.findOne({
      _id: classRef,
      schoolId,
      status: 'ACTIVE'
    });
    if (!classDoc) {
      throw new Error('Selected class not found or is currently inactive.');
    }

    // 3. Validate Section belongs to Class and is active
    const sectionDoc = await SectionInfo.findOne({
      _id: sectionRef,
      classRef,
      schoolId,
      status: 'ACTIVE'
    });
    if (!sectionDoc) {
      throw new Error('Selected section not found or does not belong to the selected class.');
    }

    // 4. Validate ClassSubject allocation is active for this class & academic year
    const classSubject = await ClassSubjectInfo.findOne({
      _id: classSubjectRef,
      classRef,
      academicYearRef,
      schoolId,
      status: 'ACTIVE'
    });
    if (!classSubject) {
      throw new Error('The selected subject has not been allocated to this class for the selected academic year.');
    }

    // 5. Validate Teacher: must be active Teacher or Head Teacher in this school
    const teacherUser = await UserInfo.findOne({
      schoolId,
      employeeRef: teacherEmployeeId,
      status: 'ACTIVE',
      roleCode: { $in: ['TEACHER', 'HEAD_TEACHER'] }
    }).populate('employeeRef');

    if (!teacherUser || !teacherUser.employeeRef) {
      throw new Error('Selected teacher is not an active eligible Teacher or Head Teacher in this school.');
    }

    // 6. Enforce ONLY ONE active teacher assignment for this (academicYear, class, section, subject)
    const existingActive = await SubjectTeacherAssignmentInfo.findOne({
      schoolId,
      academicYearRef: new mongoose.Types.ObjectId(academicYearRef),
      classRef: new mongoose.Types.ObjectId(classRef),
      sectionRef: new mongoose.Types.ObjectId(sectionRef),
      subjectRef: classSubject.subjectRef,
      status: 'ACTIVE'
    });

    if (existingActive) {
      throw new Error(
        `Teacher '${existingActive.teacherName}' is already actively assigned to teach ${classSubject.subjectName} in ${classDoc.className}, ${sectionDoc.sectionName} for this academic year.`
      );
    }

    // 7. Create assignment record
    const assignment = new SubjectTeacherAssignmentInfo({
      schoolRef,
      schoolId,
      academicYearRef,
      classSubjectRef: classSubject._id,
      classRef: classDoc._id,
      sectionRef: sectionDoc._id,
      subjectRef: classSubject.subjectRef,
      teacherEmployeeRef: teacherEmployeeId,
      teacherUserRef: teacherUser._id,
      classCode: classDoc.classCode,
      className: classDoc.className,
      sectionCode: sectionDoc.sectionCode,
      sectionName: sectionDoc.sectionName,
      subjectCode: classSubject.subjectCode,
      subjectName: classSubject.subjectName,
      subjectType: classSubject.subjectType,
      teacherName: teacherUser.employeeRef.fullName || teacherUser.userId,
      teacherUserId: teacherUser.userId,
      teacherEmail: teacherUser.email,
      status: 'ACTIVE'
    });

    await assignment.save();

    // 8. Dispatch notifications after successful save
    await SubjectTeacherAssignmentService.sendAssignmentNotifications({
      isReassignment: false,
      assignment,
      classDoc,
      sectionDoc,
      academicYear,
      newTeacherUser: teacherUser,
      oldTeacherUser: null
    });

    if (actorUser) {
      await AuditLogService.log({
        schoolRef,
        schoolId,
        academicYearRef,
        classRef: classDoc._id,
        sectionRef: sectionDoc._id,
        subjectRef: classSubject.subjectRef,
        module: 'TEACHER_ASSIGNMENT',
        entityType: 'SubjectTeacherAssignmentInfo',
        entityId: assignment._id.toString(),
        action: 'TEACHER_ASSIGNED',
        details: `Assigned ${assignment.teacherName} to ${assignment.subjectName} (${assignment.className} - ${assignment.sectionName})`,
        newValue: {
          teacherName: assignment.teacherName,
          teacherUserId: assignment.teacherUserId,
          subjectName: assignment.subjectName,
          className: assignment.className,
          sectionName: assignment.sectionName,
          status: 'ACTIVE'
        },
        user: actorUser
      });
    }

    return assignment;
  }

  /**
   * Reassign a teacher to an existing assignment
   */
  static async reassignTeacher({ schoolId, assignmentId, newTeacherEmployeeId, actorUser = null }) {
    if (!assignmentId || !newTeacherEmployeeId) {
      throw new Error('Assignment ID and new Teacher are required.');
    }

    const assignment = await SubjectTeacherAssignmentInfo.findOne({
      _id: assignmentId,
      schoolId
    });
    if (!assignment) {
      throw new Error('Teacher assignment record not found.');
    }

    if (assignment.teacherEmployeeRef.toString() === newTeacherEmployeeId.toString()) {
      throw new Error('This teacher is already assigned to this subject assignment.');
    }

    // Validate new Teacher
    const newTeacherUser = await UserInfo.findOne({
      schoolId,
      employeeRef: newTeacherEmployeeId,
      status: 'ACTIVE',
      roleCode: { $in: ['TEACHER', 'HEAD_TEACHER'] }
    }).populate('employeeRef');

    if (!newTeacherUser || !newTeacherUser.employeeRef) {
      throw new Error('Selected replacement teacher is not an active eligible Teacher or Head Teacher in this school.');
    }

    // Fetch old teacher user
    const oldTeacherUser = await UserInfo.findOne({
      _id: assignment.teacherUserRef,
      schoolId
    }).populate('employeeRef');

    // Fetch related docs for notification text
    const classDoc = await ClassInfo.findById(assignment.classRef);
    const sectionDoc = await SectionInfo.findById(assignment.sectionRef);
    const academicYear = await AcademicYearInfo.findById(assignment.academicYearRef);

    // Update assignment
    const prevTeacherName = assignment.teacherName;
    const prevTeacherUserId = assignment.teacherUserId;
    assignment.teacherEmployeeRef = newTeacherEmployeeId;
    assignment.teacherUserRef = newTeacherUser._id;
    assignment.teacherName = newTeacherUser.employeeRef.fullName || newTeacherUser.userId;
    assignment.teacherUserId = newTeacherUser.userId;
    assignment.teacherEmail = newTeacherUser.email;
    assignment.status = 'ACTIVE';

    await assignment.save();

    // Dispatch reassignment notifications
    if (classDoc && sectionDoc && academicYear) {
      await SubjectTeacherAssignmentService.sendAssignmentNotifications({
        isReassignment: true,
        assignment,
        classDoc,
        sectionDoc,
        academicYear,
        newTeacherUser,
        oldTeacherUser
      });
    }

    if (actorUser) {
      await AuditLogService.log({
        schoolRef: assignment.schoolRef,
        schoolId,
        academicYearRef: assignment.academicYearRef,
        classRef: assignment.classRef,
        sectionRef: assignment.sectionRef,
        subjectRef: assignment.subjectRef,
        module: 'TEACHER_ASSIGNMENT',
        entityType: 'SubjectTeacherAssignmentInfo',
        entityId: assignment._id.toString(),
        action: 'TEACHER_REASSIGNED',
        details: `Reassigned ${assignment.subjectName} (${assignment.className} - ${assignment.sectionName}) from ${prevTeacherName} to ${assignment.teacherName}`,
        previousValue: { teacherName: prevTeacherName, teacherUserId: prevTeacherUserId },
        newValue: { teacherName: assignment.teacherName, teacherUserId: assignment.teacherUserId },
        user: actorUser
      });
    }

    return assignment;
  }

  /**
   * Deallocate a subject assignment safely (preserves all historical marks & results)
   */
  static async deallocateAssignment({ schoolId, assignmentId, reason = '', actorUser = null }) {
    const assignment = await SubjectTeacherAssignmentInfo.findOne({
      _id: assignmentId,
      schoolId
    });
    if (!assignment) {
      throw new Error('Teacher assignment record not found.');
    }
    if (assignment.status === 'INACTIVE') {
      throw new Error('This subject assignment has already been deallocated.');
    }

    assignment.status = 'INACTIVE';
    await assignment.save();

    try {
      const teacherUser = await UserInfo.findOne({
        _id: assignment.teacherUserRef,
        schoolId,
        status: 'ACTIVE'
      }).lean();

      if (teacherUser) {
        await NotificationInfo.create({
          schoolRef: assignment.schoolRef,
          schoolId,
          targetUserRef: teacherUser._id,
          targetUserId: teacherUser.userId,
          targetRoleCode: teacherUser.roleCode,
          title: 'Subject Assignment Deallocated',
          message: `Your assignment for ${assignment.subjectName} (${assignment.subjectCode}) in ${assignment.className}, ${assignment.sectionName} has been deallocated.${reason ? ` Note: ${reason.trim()}` : ''}`,
          type: 'warning',
          isRead: false,
          sentByUserRef: actorUser?._id || null,
          sentByName: actorUser?.employeeRef?.fullName || actorUser?.userId || 'System',
          sentByRole: actorUser?.roleCode || 'SYSTEM'
        });
      }
    } catch (notifErr) {
      console.warn('[SubjectTeacherAssignmentService] Deallocation notification warning:', notifErr.message);
    }

    if (actorUser) {
      await AuditLogService.log({
        schoolRef: assignment.schoolRef,
        schoolId,
        academicYearRef: assignment.academicYearRef,
        classRef: assignment.classRef,
        sectionRef: assignment.sectionRef,
        subjectRef: assignment.subjectRef,
        module: 'TEACHER_ASSIGNMENT',
        entityType: 'SubjectTeacherAssignmentInfo',
        entityId: assignment._id.toString(),
        action: 'SUBJECT_DEALLOCATED',
        details: `Deallocated ${assignment.subjectName} (${assignment.className} - ${assignment.sectionName}) from ${assignment.teacherName}${reason ? `. Reason: ${reason.trim()}` : ''}`,
        previousValue: { status: 'ACTIVE', teacherName: assignment.teacherName, teacherUserId: assignment.teacherUserId },
        newValue: { status: 'INACTIVE' },
        user: actorUser
      });
    }

    return assignment;
  }

  /**
   * Toggle status of an assignment (ACTIVE / INACTIVE)
   */
  static async toggleAssignmentStatus({ schoolId, assignmentId, status, actorUser = null }) {
    const assignment = await SubjectTeacherAssignmentInfo.findOne({
      _id: assignmentId,
      schoolId
    });
    if (!assignment) {
      throw new Error('Teacher assignment record not found.');
    }

    const cleanStatus = status.toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(cleanStatus)) {
      throw new Error("Status must be either 'ACTIVE' or 'INACTIVE'.");
    }

    // If activating, verify no other active assignment exists for this exact combination
    if (cleanStatus === 'ACTIVE') {
      const conflicting = await SubjectTeacherAssignmentInfo.findOne({
        schoolId,
        academicYearRef: assignment.academicYearRef,
        classRef: assignment.classRef,
        sectionRef: assignment.sectionRef,
        subjectRef: assignment.subjectRef,
        status: 'ACTIVE',
        _id: { $ne: assignment._id }
      });

      if (conflicting) {
        throw new Error(
          `Cannot activate: Teacher '${conflicting.teacherName}' is already actively assigned to this subject and section.`
        );
      }
    }

    const prevStatus = assignment.status;
    assignment.status = cleanStatus;
    await assignment.save();

    if (actorUser) {
      await AuditLogService.log({
        schoolRef: assignment.schoolRef,
        schoolId,
        academicYearRef: assignment.academicYearRef,
        classRef: assignment.classRef,
        sectionRef: assignment.sectionRef,
        subjectRef: assignment.subjectRef,
        module: 'TEACHER_ASSIGNMENT',
        entityType: 'SubjectTeacherAssignmentInfo',
        entityId: assignment._id.toString(),
        action: cleanStatus === 'INACTIVE' ? 'SUBJECT_DEALLOCATED' : 'TEACHER_ASSIGNMENT_ACTIVATED',
        details: `${cleanStatus === 'INACTIVE' ? 'Deallocated' : 'Activated'} ${assignment.subjectName} (${assignment.className} - ${assignment.sectionName}) for ${assignment.teacherName}`,
        previousValue: { status: prevStatus },
        newValue: { status: cleanStatus },
        user: actorUser
      });
    }

    return assignment;
  }
}

module.exports = SubjectTeacherAssignmentService;
