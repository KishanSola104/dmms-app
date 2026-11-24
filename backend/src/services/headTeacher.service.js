const mongoose = require('mongoose');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const SubjectInfo = require('../models/subjectInfo.model');
const AcademicYearInfo = require('../models/academicYearInfo.model');
const StudentEnrollmentInfo = require('../models/studentEnrollmentInfo.model');
const StudentInfo = require('../models/studentInfo.model');
const SubjectTeacherAssignmentInfo = require('../models/subjectTeacherAssignmentInfo.model');
const ClassSubjectInfo = require('../models/classSubjectInfo.model');
const UserInfo = require('../models/userInfo.model');
const EmployeeInfo = require('../models/employeeInfo.model');

class HeadTeacherService {
  /**
   * Helper to resolve academic year for the school
   */
  static async resolveAcademicYear(schoolId, academicYearId) {
    const academicYears = await AcademicYearInfo.find({ schoolId }).sort({ isCurrent: -1, startDate: -1 });
    let selectedYear = null;

    if (academicYearId) {
      selectedYear = academicYears.find(y => y._id.toString() === academicYearId.toString());
    }

    if (!selectedYear) {
      selectedYear = academicYears.find(y => y.isCurrent) || academicYears[0] || null;
    }

    return { selectedYear, academicYears };
  }

  // ==========================================
  // DASHBOARD STATISTICS & OVERVIEW
  // ==========================================

  static async getDashboardStats({ schoolId, academicYearId }) {
    if (!schoolId) {
      throw new Error('School identification is required.');
    }

    const { selectedYear, academicYears } = await this.resolveAcademicYear(schoolId, academicYearId);
    const yearRef = selectedYear ? selectedYear._id : null;

    // 1. Dashboard Statistics Cards (Section 3.1)
    let totalStudents = 0;
    if (yearRef) {
      totalStudents = await StudentEnrollmentInfo.countDocuments({
        schoolId,
        academicYearRef: yearRef,
        status: 'ACTIVE'
      });
    }

    const totalTeachers = await UserInfo.countDocuments({
      schoolId,
      roleCode: 'TEACHER',
      status: 'ACTIVE'
    });

    const totalClasses = await ClassInfo.countDocuments({
      schoolId,
      status: 'ACTIVE'
    });

    const totalSections = await SectionInfo.countDocuments({
      schoolId,
      status: 'ACTIVE'
    });

    const totalSubjects = await SubjectInfo.countDocuments({
      schoolId,
      status: 'ACTIVE'
    });

    let totalActiveTeacherAssignments = 0;
    if (yearRef) {
      totalActiveTeacherAssignments = await SubjectTeacherAssignmentInfo.countDocuments({
        schoolId,
        academicYearRef: yearRef,
        status: 'ACTIVE'
      });
    }

    // 2. Academic Overview Section (Section 3.2)
    const activeClasses = await ClassInfo.find({ schoolId, status: 'ACTIVE' })
      .populate('classTeacherRef', 'fullName email mobileNumber designation')
      .sort({ className: 1 })
      .lean();

    const activeSections = await SectionInfo.find({ schoolId, status: 'ACTIVE' })
      .populate('sectionTeacherRef', 'fullName email mobileNumber designation')
      .populate('classRef', 'className classCode')
      .sort({ className: 1, sectionName: 1 })
      .lean();

    let classEnrollmentCounts = {};
    let sectionEnrollmentCounts = {};

    if (yearRef) {
      const classAgg = await StudentEnrollmentInfo.aggregate([
        { $match: { schoolId, academicYearRef: yearRef, status: 'ACTIVE' } },
        { $group: { _id: '$classRef', count: { $sum: 1 } } }
      ]);
      classAgg.forEach(item => {
        if (item._id) classEnrollmentCounts[item._id.toString()] = item.count;
      });

      const sectionAgg = await StudentEnrollmentInfo.aggregate([
        { $match: { schoolId, academicYearRef: yearRef, status: 'ACTIVE' } },
        { $group: { _id: '$sectionRef', count: { $sum: 1 } } }
      ]);
      sectionAgg.forEach(item => {
        if (item._id) sectionEnrollmentCounts[item._id.toString()] = item.count;
      });
    }

    const sectionStrengthList = activeSections.map(sec => {
      const studentCount = sectionEnrollmentCounts[sec._id.toString()] || 0;
      const maxCapacity = sec.maxCapacity || 0;
      const availableCapacity = Math.max(0, maxCapacity - studentCount);

      return {
        _id: sec._id,
        sectionCode: sec.sectionCode,
        sectionName: sec.sectionName,
        classId: sec.classRef?._id || sec.classRef,
        classCode: sec.classCode || sec.classRef?.classCode || 'N/A',
        className: sec.className || sec.classRef?.className || 'N/A',
        sectionTeacherName: sec.sectionTeacherRef?.fullName || sec.sectionTeacherName || 'Not Assigned',
        sectionTeacherRef: sec.sectionTeacherRef || null,
        maxCapacity,
        studentCount,
        availableCapacity,
        status: sec.status
      };
    });

    const classStrengthList = activeClasses.map(cls => {
      const classIdStr = cls._id.toString();
      const sectionsOfClass = sectionStrengthList.filter(s => s.classId?.toString() === classIdStr);
      const studentCount = classEnrollmentCounts[classIdStr] || sectionsOfClass.reduce((sum, s) => sum + s.studentCount, 0);
      const totalCapacity = sectionsOfClass.reduce((sum, s) => sum + s.maxCapacity, 0);

      return {
        _id: cls._id,
        classCode: cls.classCode,
        className: cls.className,
        classTeacherName: cls.classTeacherRef?.fullName || cls.classTeacherName || 'Not Assigned',
        classTeacherRef: cls.classTeacherRef || null,
        numberOfSections: sectionsOfClass.length,
        studentCount,
        totalCapacity,
        status: cls.status,
        sections: sectionsOfClass
      };
    });

    const academicSubjectsCount = await SubjectInfo.countDocuments({
      schoolId,
      subjectType: 'ACADEMIC',
      status: 'ACTIVE'
    });

    const coCurricularSubjectsCount = await SubjectInfo.countDocuments({
      schoolId,
      subjectType: 'CO_CURRICULAR',
      status: 'ACTIVE'
    });

    const allActiveSubjects = await SubjectInfo.find({
      schoolId,
      status: 'ACTIVE'
    }).sort({ subjectName: 1 }).lean();

    const classesWithoutClassTeacher = activeClasses
      .filter(c => !c.classTeacherRef)
      .map(c => ({ _id: c._id, classCode: c.classCode, className: c.className }));

    const sectionsWithoutSectionTeacher = activeSections
      .filter(s => !s.sectionTeacherRef)
      .map(s => ({
        _id: s._id,
        sectionCode: s.sectionCode,
        sectionName: s.sectionName,
        className: s.className || s.classRef?.className || 'N/A'
      }));

    let subjectsWithoutAssignments = [];
    if (yearRef) {
      const activeAssignments = await SubjectTeacherAssignmentInfo.find({
        schoolId,
        academicYearRef: yearRef,
        status: 'ACTIVE'
      }).lean();

      const assignedSubjectIdSet = new Set(activeAssignments.map(a => a.subjectRef?.toString()));

      subjectsWithoutAssignments = allActiveSubjects
        .filter(sub => !assignedSubjectIdSet.has(sub._id.toString()))
        .map(sub => ({
          _id: sub._id,
          subjectCode: sub.subjectCode,
          subjectName: sub.subjectName,
          subjectType: sub.subjectType
        }));
    }

    const recentClasses = await ClassInfo.find({ schoolId })
      .populate('classTeacherRef', 'fullName')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const recentSubjects = await SubjectInfo.find({ schoolId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    let recentTeacherAssignments = [];
    let recentAllocations = [];

    if (yearRef) {
      recentTeacherAssignments = await SubjectTeacherAssignmentInfo.find({
        schoolId,
        academicYearRef: yearRef
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      recentAllocations = await ClassSubjectInfo.find({
        schoolId,
        academicYearRef: yearRef
      })
        .populate('classRef', 'className classCode')
        .populate('subjectRef', 'subjectName subjectCode')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(5)
        .lean();
    }

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      stats: {
        totalStudents,
        totalTeachers,
        totalClasses,
        totalSections,
        totalSubjects,
        totalActiveTeacherAssignments
      },
      academicOverview: {
        classStrength: classStrengthList,
        sectionStrength: sectionStrengthList,
        subjectDistribution: {
          academic: academicSubjectsCount,
          coCurricular: coCurricularSubjectsCount,
          total: totalSubjects,
          subjects: allActiveSubjects
        },
        assignmentGaps: {
          classesWithoutClassTeacherCount: classesWithoutClassTeacher.length,
          classesWithoutClassTeacher,
          sectionsWithoutSectionTeacherCount: sectionsWithoutSectionTeacher.length,
          sectionsWithoutSectionTeacher,
          subjectsWithoutAssignmentsCount: subjectsWithoutAssignments.length,
          subjectsWithoutAssignments
        }
      },
      recentActivity: {
        classes: recentClasses.map(c => ({
          _id: c._id,
          classCode: c.classCode,
          className: c.className,
          status: c.status,
          classTeacherName: c.classTeacherRef?.fullName || c.classTeacherName || 'Not Assigned',
          createdAt: c.createdAt
        })),
        subjects: recentSubjects.map(s => ({
          _id: s._id,
          subjectCode: s.subjectCode,
          subjectName: s.subjectName,
          subjectType: s.subjectType,
          status: s.status,
          createdAt: s.createdAt
        })),
        teacherAssignments: recentTeacherAssignments.map(a => ({
          _id: a._id,
          teacherName: a.teacherName,
          className: a.className,
          sectionName: a.sectionName,
          subjectName: a.subjectName,
          status: a.status,
          createdAt: a.createdAt
        })),
        recentAllocations: recentAllocations.map(al => ({
          _id: al._id,
          className: al.classRef?.className || 'N/A',
          subjectName: al.subjectRef?.subjectName || al.subjectName || 'N/A',
          subjectType: al.subjectType,
          updatedAt: al.updatedAt || al.createdAt
        }))
      }
    };
  }

  // ==========================================
  // PHASE 1: CLASSES & SECTIONS (READ-ONLY)
  // ==========================================

  /**
   * 5.1 Class Listing with Student Count & Capacity
   */
  static async listClasses({ schoolId, academicYearId, search = '', status = '', page = 1, limit = 10 }) {
    const { selectedYear } = await this.resolveAcademicYear(schoolId, academicYearId);
    const yearRef = selectedYear ? selectedYear._id : null;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const query = { schoolId };
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }
    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { className: { $regex: term, $options: 'i' } },
        { classCode: { $regex: term, $options: 'i' } }
      ];
    }

    const totalRecords = await ClassInfo.countDocuments(query);
    const classes = await ClassInfo.find(query)
      .populate('classTeacherRef', 'fullName email mobileNumber designation')
      .sort({ className: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const enhanced = await Promise.all(
      classes.map(async (c) => {
        const sections = await SectionInfo.find({ classRef: c._id, schoolId }).lean();
        const activeSections = sections.filter(s => s.status === 'ACTIVE');
        const totalCapacity = activeSections.reduce((sum, s) => sum + (s.maxCapacity || 0), 0);

        let studentCount = 0;
        if (yearRef) {
          studentCount = await StudentEnrollmentInfo.countDocuments({
            schoolId,
            classRef: c._id,
            academicYearRef: yearRef,
            status: 'ACTIVE'
          });
        }

        return {
          _id: c._id,
          classCode: c.classCode,
          className: c.className,
          classTeacherId: c.classTeacherRef?._id || null,
          classTeacherName: c.classTeacherRef?.fullName || c.classTeacherName || 'Not Assigned',
          classTeacherEmail: c.classTeacherRef?.email || '',
          numberOfSections: sections.length,
          activeSectionsCount: activeSections.length,
          totalStudentCount: studentCount,
          totalCapacity,
          status: c.status,
          createdAt: c.createdAt
        };
      })
    );

    return {
      classes: enhanced,
      selectedAcademicYear: selectedYear,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        totalRecords,
        limit: limitNum
      }
    };
  }

  /**
   * 5.2 Class Details & 5.3 Section Listing
   */
  static async getClassDetails({ schoolId, classId, academicYearId }) {
    const { selectedYear } = await this.resolveAcademicYear(schoolId, academicYearId);
    const yearRef = selectedYear ? selectedYear._id : null;

    const classDoc = await ClassInfo.findOne({ _id: classId, schoolId })
      .populate('classTeacherRef', 'fullName email mobileNumber designation')
      .lean();

    if (!classDoc) {
      throw new Error('Class not found for this school.');
    }

    const sections = await SectionInfo.find({ classRef: classId, schoolId })
      .populate('sectionTeacherRef', 'fullName email mobileNumber designation')
      .sort({ sectionName: 1 })
      .lean();

    const sectionsWithDetails = await Promise.all(
      sections.map(async (s) => {
        let studentCount = 0;
        if (yearRef) {
          studentCount = await StudentEnrollmentInfo.countDocuments({
            schoolId,
            sectionRef: s._id,
            academicYearRef: yearRef,
            status: 'ACTIVE'
          });
        }

        const maxCapacity = s.maxCapacity || 0;
        const availableCapacity = Math.max(0, maxCapacity - studentCount);

        return {
          _id: s._id,
          sectionCode: s.sectionCode,
          sectionName: s.sectionName,
          sectionTeacherId: s.sectionTeacherRef?._id || null,
          sectionTeacherName: s.sectionTeacherRef?.fullName || s.sectionTeacherName || 'Not Assigned',
          sectionTeacherEmail: s.sectionTeacherRef?.email || '',
          maxCapacity,
          studentCount,
          availableCapacity,
          status: s.status,
          createdAt: s.createdAt
        };
      })
    );

    const activeSections = sectionsWithDetails.filter(s => s.status === 'ACTIVE');
    const totalCapacity = activeSections.reduce((sum, s) => sum + s.maxCapacity, 0);
    const totalStudentCount = sectionsWithDetails.reduce((sum, s) => sum + s.studentCount, 0);

    return {
      classDetails: {
        _id: classDoc._id,
        classCode: classDoc.classCode,
        className: classDoc.className,
        classTeacherName: classDoc.classTeacherRef?.fullName || classDoc.classTeacherName || 'Not Assigned',
        classTeacherEmail: classDoc.classTeacherRef?.email || '',
        numberOfSections: sections.length,
        totalStudentCount,
        totalCapacity,
        status: classDoc.status,
        createdAt: classDoc.createdAt
      },
      sections: sectionsWithDetails,
      selectedAcademicYear: selectedYear
    };
  }

  /**
   * 5.4 Section Details & Enrolled Students List
   */
  static async getSectionDetails({ schoolId, classId, sectionId, academicYearId }) {
    const { selectedYear } = await this.resolveAcademicYear(schoolId, academicYearId);
    const yearRef = selectedYear ? selectedYear._id : null;

    const section = await SectionInfo.findOne({ _id: sectionId, schoolId })
      .populate('classRef', 'className classCode status')
      .populate('sectionTeacherRef', 'fullName email mobileNumber designation')
      .lean();

    if (!section) {
      throw new Error('Section not found for this school.');
    }

    let enrollments = [];
    if (yearRef) {
      enrollments = await StudentEnrollmentInfo.find({
        schoolId,
        sectionRef: sectionId,
        academicYearRef: yearRef,
        status: 'ACTIVE'
      })
        .populate('studentRef')
        .sort({ rollNumber: 1, enrollmentDate: 1 })
        .lean();
    }

    const studentList = enrollments
      .filter(e => e.studentRef)
      .map(e => ({
        enrollmentId: e._id,
        studentId: e.studentRef._id,
        admissionNumber: e.studentRef.admissionNumber,
        rollNumber: e.rollNumber || '—',
        fullName: `${e.studentRef.firstName || ''} ${e.studentRef.middleName || ''} ${e.studentRef.lastName || ''}`.replace(/\s+/g, ' ').trim(),
        gender: e.studentRef.gender || '—',
        dateOfBirth: e.studentRef.dateOfBirth,
        status: e.status,
        enrollmentDate: e.enrollmentDate,
        photoUrl: e.studentRef.photoUrl || null
      }));

    const maxCapacity = section.maxCapacity || 0;
    const studentCount = studentList.length;
    const availableCapacity = Math.max(0, maxCapacity - studentCount);

    return {
      sectionDetails: {
        _id: section._id,
        sectionCode: section.sectionCode,
        sectionName: section.sectionName,
        parentClassId: section.classRef?._id || section.classRef,
        parentClassName: section.classRef?.className || section.className || 'N/A',
        parentClassCode: section.classRef?.classCode || section.classCode || 'N/A',
        sectionTeacherName: section.sectionTeacherRef?.fullName || section.sectionTeacherName || 'Not Assigned',
        sectionTeacherEmail: section.sectionTeacherRef?.email || '',
        maxCapacity,
        studentCount,
        availableCapacity,
        status: section.status
      },
      students: studentList,
      selectedAcademicYear: selectedYear
    };
  }

  // ==========================================
  // PHASE 2: SUBJECT OVERVIEW (READ-ONLY)
  // ==========================================

  /**
   * 6.1 Subject Listing
   */
  static async listSubjects({ schoolId, search = '', type = '', status = '', page = 1, limit = 10 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const query = { schoolId };
    if (type && type !== 'ALL') {
      query.subjectType = type.toUpperCase();
    }
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }
    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { subjectCode: { $regex: term, $options: 'i' } },
        { subjectName: { $regex: term, $options: 'i' } }
      ];
    }

    const totalRecords = await SubjectInfo.countDocuments(query);
    const subjects = await SubjectInfo.find(query)
      .sort({ subjectName: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return {
      subjects,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        totalRecords,
        limit: limitNum
      }
    };
  }

  /**
   * 6.2 Subject Details & Allocation Details
   */
  static async getSubjectDetails({ schoolId, subjectId, academicYearId }) {
    const subject = await SubjectInfo.findOne({ _id: subjectId, schoolId }).lean();
    if (!subject) {
      throw new Error('Subject not found for this school.');
    }

    const { selectedYear } = await this.resolveAcademicYear(schoolId, academicYearId);

    // Find all class allocations for this subject across academic years
    const allocations = await ClassSubjectInfo.find({ schoolId, subjectRef: subjectId })
      .populate('classRef', 'className classCode status')
      .populate('academicYearRef', 'yearCode isCurrent')
      .sort({ createdAt: -1 })
      .lean();

    const formattedAllocations = allocations.map(a => ({
      allocationId: a._id,
      academicYearId: a.academicYearRef?._id,
      academicYearCode: a.academicYearRef?.yearCode || 'N/A',
      isCurrentYear: !!a.academicYearRef?.isCurrent,
      classId: a.classRef?._id,
      className: a.classRef?.className || 'N/A',
      classCode: a.classRef?.classCode || 'N/A',
      hasAdditionalComponents: a.hasAdditionalComponents,
      additionalComponents: a.additionalComponents || [],
      totalAdditionalMarks: a.totalAdditionalMarks || 0,
      status: a.status
    }));

    return {
      subject,
      allocations: formattedAllocations,
      selectedAcademicYear: selectedYear
    };
  }

  /**
   * 6.3 Class-Wise Subject Allocations
   */
  static async getClassSubjectAllocations({ schoolId, academicYearId, classId }) {
    const { selectedYear } = await this.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) {
      throw new Error('Active academic year not found.');
    }

    const query = {
      schoolId,
      academicYearRef: selectedYear._id
    };

    if (classId && classId !== 'ALL') {
      query.classRef = classId;
    }

    const allocations = await ClassSubjectInfo.find(query)
      .populate('classRef', 'className classCode')
      .populate('subjectRef', 'subjectCode subjectName subjectType status')
      .sort({ className: 1, subjectName: 1 })
      .lean();

    const formatted = allocations.map(a => ({
      _id: a._id,
      classId: a.classRef?._id,
      className: a.classRef?.className || 'N/A',
      classCode: a.classRef?.classCode || 'N/A',
      subjectId: a.subjectRef?._id,
      subjectCode: a.subjectCode || a.subjectRef?.subjectCode || 'N/A',
      subjectName: a.subjectName || a.subjectRef?.subjectName || 'N/A',
      subjectType: a.subjectType || a.subjectRef?.subjectType || 'ACADEMIC',
      hasAdditionalComponents: a.hasAdditionalComponents,
      additionalComponents: a.additionalComponents || [],
      totalAdditionalMarks: a.totalAdditionalMarks || 0,
      status: a.status
    }));

    return {
      allocations: formatted,
      selectedAcademicYear: selectedYear
    };
  }

  // ==========================================
  // PHASE 3: TEACHER OVERVIEW (READ-ONLY)
  // ==========================================

  /**
   * 7.1 Teacher Listing
   */
  static async listTeachers({ schoolId, academicYearId, search = '', classId = '', sectionId = '', subjectId = '', status = '', page = 1, limit = 10 }) {
    const { selectedYear } = await this.resolveAcademicYear(schoolId, academicYearId);
    const yearRef = selectedYear ? selectedYear._id : null;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    const userQuery = {
      schoolId,
      roleCode: 'TEACHER'
    };
    if (status && status !== 'ALL') {
      userQuery.status = status.toUpperCase();
    }

    // Fetch teachers with employee profile
    const users = await UserInfo.find(userQuery)
      .populate('employeeRef')
      .sort({ createdAt: -1 })
      .lean();

    // Fetch assignments for this academic session to cross-reference
    let sessionAssignments = [];
    if (yearRef) {
      sessionAssignments = await SubjectTeacherAssignmentInfo.find({
        schoolId,
        academicYearRef: yearRef,
        status: 'ACTIVE'
      }).lean();
    }

    // Fetch all active classes & sections to check class/section teacher assignments
    const classes = await ClassInfo.find({ schoolId, status: 'ACTIVE' }).lean();
    const sections = await SectionInfo.find({ schoolId, status: 'ACTIVE' }).lean();

    let teacherList = users.map(u => {
      const emp = u.employeeRef || {};
      const empIdStr = emp._id ? emp._id.toString() : '';

      // Assignments for this teacher
      const myAssignments = sessionAssignments.filter(a =>
        a.teacherUserRef?.toString() === u._id.toString() ||
        a.teacherEmployeeRef?.toString() === empIdStr
      );

      const assignedClassSet = new Set(myAssignments.map(a => a.className));
      const assignedSubjectSet = new Set(myAssignments.map(a => a.subjectName));

      // Check class teacher roles
      const myClassTeacherRoles = classes.filter(c => c.classTeacherRef?.toString() === empIdStr);
      // Check section teacher roles
      const mySectionTeacherRoles = sections.filter(s => s.sectionTeacherRef?.toString() === empIdStr);

      return {
        userId: u.userId,
        employeeId: emp._id || 'N/A',
        teacherName: emp.fullName || u.userId,
        email: emp.email || u.email,
        mobileNumber: emp.mobileNumber || '—',
        designation: emp.designation || 'Teacher',
        qualification: emp.qualification || '—',
        joiningDate: emp.joiningDate,
        profileImage: emp.profileImage || null,
        assignedClasses: Array.from(assignedClassSet),
        assignedSubjects: Array.from(assignedSubjectSet),
        classTeacherRoles: myClassTeacherRoles.map(c => c.className),
        sectionTeacherRoles: mySectionTeacherRoles.map(s => `${s.className} (${s.sectionName})`),
        totalAssignmentsCount: myAssignments.length,
        accountStatus: u.status,
        createdAt: u.createdAt
      };
    });

    // Apply search filter
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      teacherList = teacherList.filter(t =>
        t.teacherName.toLowerCase().includes(term) ||
        t.email.toLowerCase().includes(term) ||
        t.userId.toLowerCase().includes(term)
      );
    }

    // Apply class filter
    if (classId && classId !== 'ALL') {
      const targetClass = classes.find(c => c._id.toString() === classId);
      if (targetClass) {
        teacherList = teacherList.filter(t =>
          t.assignedClasses.includes(targetClass.className) ||
          t.classTeacherRoles.includes(targetClass.className)
        );
      }
    }

    // Apply subject filter
    if (subjectId && subjectId !== 'ALL') {
      const targetSubject = await SubjectInfo.findOne({ _id: subjectId, schoolId }).lean();
      if (targetSubject) {
        teacherList = teacherList.filter(t =>
          t.assignedSubjects.includes(targetSubject.subjectName)
        );
      }
    }

    const totalRecords = teacherList.length;
    const paginated = teacherList.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return {
      teachers: paginated,
      selectedAcademicYear: selectedYear,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        totalRecords,
        limit: limitNum
      }
    };
  }

  /**
   * 7.2 Teacher Profile Details (Personal, Account, Academic Responsibilities)
   */
  static async getTeacherProfile({ schoolId, teacherUserId, academicYearId }) {
    const user = await UserInfo.findOne({ userId: teacherUserId, schoolId, roleCode: 'TEACHER' })
      .populate('employeeRef')
      .populate('roleRef')
      .select('-passwordHash')
      .lean();

    if (!user) {
      throw new Error('Teacher account not found for this school.');
    }

    const { selectedYear } = await this.resolveAcademicYear(schoolId, academicYearId);
    const yearRef = selectedYear ? selectedYear._id : null;
    const emp = user.employeeRef || {};
    const empId = emp._id;

    // Academic Responsibilities
    const classTeacherClasses = await ClassInfo.find({ schoolId, classTeacherRef: empId, status: 'ACTIVE' }).lean();
    const sectionTeacherSections = await SectionInfo.find({ schoolId, sectionTeacherRef: empId, status: 'ACTIVE' }).lean();

    let currentAssignments = [];
    let allHistoricalAssignments = [];

    if (yearRef) {
      currentAssignments = await SubjectTeacherAssignmentInfo.find({
        schoolId,
        academicYearRef: yearRef,
        $or: [{ teacherUserRef: user._id }, { teacherEmployeeRef: empId }]
      }).lean();
    }

    allHistoricalAssignments = await SubjectTeacherAssignmentInfo.find({
      schoolId,
      $or: [{ teacherUserRef: user._id }, { teacherEmployeeRef: empId }]
    })
      .populate('academicYearRef', 'yearCode')
      .sort({ createdAt: -1 })
      .lean();

    return {
      personalInfo: {
        teacherName: emp.fullName || user.userId,
        employeeId: emp._id,
        email: emp.email || user.email,
        mobileNumber: emp.mobileNumber || '—',
        designation: emp.designation || 'Teacher',
        address: emp.address || '—',
        qualification: emp.qualification || '—',
        joiningDate: emp.joiningDate,
        profileImage: emp.profileImage || null
      },
      accountInfo: {
        userId: user.userId,
        roleCode: user.roleCode,
        roleName: user.roleName,
        accountStatus: user.status,
        createdAt: user.createdAt
      },
      academicResponsibilities: {
        selectedAcademicYear: selectedYear,
        classTeacherClasses: classTeacherClasses.map(c => ({
          _id: c._id,
          classCode: c.classCode,
          className: c.className
        })),
        sectionTeacherSections: sectionTeacherSections.map(s => ({
          _id: s._id,
          sectionCode: s.sectionCode,
          sectionName: s.sectionName,
          className: s.className
        })),
        currentAssignments: currentAssignments.map(a => ({
          _id: a._id,
          className: a.className,
          sectionName: a.sectionName,
          subjectName: a.subjectName,
          subjectType: a.subjectType,
          status: a.status,
          createdAt: a.createdAt
        })),
        historicalAssignments: allHistoricalAssignments.map(h => ({
          _id: h._id,
          academicYearCode: h.academicYearRef?.yearCode || 'N/A',
          className: h.className,
          sectionName: h.sectionName,
          subjectName: h.subjectName,
          subjectType: h.subjectType,
          status: h.status
        }))
      }
    };
  }

  // ==========================================
  // PHASE 4: TEACHER ASSIGNMENTS (READ-ONLY)
  // ==========================================

  /**
   * 8.1 Assignment Listing & 8.4 Assignment Summary
   */
  static async listTeacherAssignments({ schoolId, academicYearId, classId = '', sectionId = '', subjectId = '', teacherId = '', status = '', search = '', page = 1, limit = 10 }) {
    const { selectedYear } = await this.resolveAcademicYear(schoolId, academicYearId);
    if (!selectedYear) {
      throw new Error('Active academic year not found.');
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const query = {
      schoolId,
      academicYearRef: selectedYear._id
    };

    if (classId && classId !== 'ALL') query.classRef = classId;
    if (sectionId && sectionId !== 'ALL') query.sectionRef = sectionId;
    if (subjectId && subjectId !== 'ALL') query.subjectRef = subjectId;
    if (teacherId && teacherId !== 'ALL') query.teacherEmployeeRef = teacherId;
    if (status && status !== 'ALL') query.status = status.toUpperCase();

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { teacherName: { $regex: term, $options: 'i' } },
        { subjectName: { $regex: term, $options: 'i' } },
        { className: { $regex: term, $options: 'i' } },
        { sectionName: { $regex: term, $options: 'i' } }
      ];
    }

    const totalRecords = await SubjectTeacherAssignmentInfo.countDocuments(query);
    const assignments = await SubjectTeacherAssignmentInfo.find(query)
      .populate('academicYearRef', 'yearCode')
      .sort({ className: 1, sectionName: 1, subjectName: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // 8.4 Assignment Summary Calculation
    const allSessionAssignments = await SubjectTeacherAssignmentInfo.find({
      schoolId,
      academicYearRef: selectedYear._id
    }).lean();

    const activeAssignments = allSessionAssignments.filter(a => a.status === 'ACTIVE');
    const assignedTeachersSet = new Set(activeAssignments.map(a => a.teacherUserRef?.toString()));
    const assignedSubjectsSet = new Set(activeAssignments.map(a => a.subjectRef?.toString()));

    const activeSubjects = await SubjectInfo.find({ schoolId, status: 'ACTIVE' }).lean();
    const subjectsWithAssignedTeachers = activeSubjects.filter(s => assignedSubjectsSet.has(s._id.toString())).length;
    const subjectsWithoutAssignedTeachers = activeSubjects.length - subjectsWithAssignedTeachers;

    const activeClasses = await ClassInfo.find({ schoolId, status: 'ACTIVE' }).lean();
    const activeSections = await SectionInfo.find({ schoolId, status: 'ACTIVE' }).lean();

    // Sections without section teachers
    const sectionsWithoutSectionTeachers = activeSections.filter(s => !s.sectionTeacherRef).length;

    // Check classes with incomplete teacher assignments
    // A class has incomplete assignments if any of its allocated subjects in any of its sections lacks an assignment
    const classAllocations = await ClassSubjectInfo.find({ schoolId, academicYearRef: selectedYear._id, status: 'ACTIVE' }).lean();
    let classesWithIncompleteCount = 0;

    activeClasses.forEach(c => {
      const cId = c._id.toString();
      const myAllocations = classAllocations.filter(al => al.classRef?.toString() === cId);
      const mySections = activeSections.filter(s => s.classRef?.toString() === cId);

      let isComplete = true;
      for (const al of myAllocations) {
        for (const sec of mySections) {
          const hasAssignment = activeAssignments.some(a =>
            a.classRef?.toString() === cId &&
            a.sectionRef?.toString() === sec._id.toString() &&
            a.subjectRef?.toString() === al.subjectRef?.toString()
          );
          if (!hasAssignment) {
            isComplete = false;
            break;
          }
        }
        if (!isComplete) break;
      }
      if (!isComplete) classesWithIncompleteCount++;
    });

    const summary = {
      totalActiveAssignments: activeAssignments.length,
      totalAssignedTeachers: assignedTeachersSet.size,
      subjectsWithAssignedTeachers,
      subjectsWithoutAssignedTeachers,
      classesWithIncompleteAssignments: classesWithIncompleteCount,
      sectionsWithoutSectionTeachers
    };

    return {
      assignments: assignments.map(a => ({
        _id: a._id,
        teacherName: a.teacherName,
        teacherUserId: a.teacherUserId,
        className: a.className,
        classCode: a.classCode,
        sectionName: a.sectionName,
        sectionCode: a.sectionCode,
        subjectName: a.subjectName,
        subjectCode: a.subjectCode,
        subjectType: a.subjectType,
        academicYearCode: a.academicYearRef?.yearCode || 'N/A',
        status: a.status,
        createdAt: a.createdAt
      })),
      summary,
      selectedAcademicYear: selectedYear,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        totalRecords,
        limit: limitNum
      }
    };
  }

  /**
   * 8.2 Assignment Details
   */
  static async getAssignmentDetails({ schoolId, assignmentId }) {
    const assignment = await SubjectTeacherAssignmentInfo.findOne({ _id: assignmentId, schoolId })
      .populate('academicYearRef', 'yearCode')
      .populate('teacherEmployeeRef', 'fullName email mobileNumber designation')
      .populate('subjectRef', 'subjectCode subjectName subjectType')
      .populate('classRef', 'className classCode')
      .populate('sectionRef', 'sectionName sectionCode')
      .lean();

    if (!assignment) {
      throw new Error('Teacher assignment record not found.');
    }

    return {
      _id: assignment._id,
      teacherName: assignment.teacherEmployeeRef?.fullName || assignment.teacherName,
      teacherEmployeeId: assignment.teacherEmployeeRef?._id || 'N/A',
      teacherEmail: assignment.teacherEmployeeRef?.email || assignment.teacherEmail,
      academicYear: assignment.academicYearRef?.yearCode || 'N/A',
      className: assignment.classRef?.className || assignment.className,
      classCode: assignment.classRef?.classCode || assignment.classCode,
      sectionName: assignment.sectionRef?.sectionName || assignment.sectionName,
      sectionCode: assignment.sectionRef?.sectionCode || assignment.sectionCode,
      subjectName: assignment.subjectRef?.subjectName || assignment.subjectName,
      subjectCode: assignment.subjectRef?.subjectCode || assignment.subjectCode,
      subjectType: assignment.subjectRef?.subjectType || assignment.subjectType,
      assignmentStatus: assignment.status,
      createdAt: assignment.createdAt
    };
  }
}

module.exports = HeadTeacherService;
