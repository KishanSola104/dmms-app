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
const StudentEnrollmentHistoryInfo = require('../models/studentEnrollmentHistoryInfo.model');
const ExaminationInfo = require('../models/examinationInfo.model');
const ExaminationClassInfo = require('../models/examinationClassInfo.model');
const ExaminationSubjectInfo = require('../models/examinationSubjectInfo.model');
const ExaminationComponentInfo = require('../models/examinationComponentInfo.model');
const MarksSubmissionInfo = require('../models/marksSubmissionInfo.model');
const MarksEntryInfo = require('../models/marksEntryInfo.model');
const ExaminationResultInfo = require('../models/examinationResultInfo.model');
const FinalAcademicResultInfo = require('../models/finalAcademicResultInfo.model');

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

  // ==========================================
  // MODULE 2 - STUDENT OVERVIEW: PHASE 1
  // ==========================================

  /**
   * 4.1 - 4.5 List Students Enrolled in Selected Academic Year (Read-Only)
   */
  static async listStudents({
    schoolId,
    academicYearId,
    classId,
    sectionId,
    gender,
    enrollmentStatus,
    search = '',
    page = 1,
    limit = 10
  }) {
    if (!schoolId) {
      throw new Error('School identification is required.');
    }
    const sId = schoolId.toUpperCase();

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    // 1. Resolve Academic Year for the school
    const { selectedYear } = await this.resolveAcademicYear(sId, academicYearId);
    if (!selectedYear) {
      return {
        students: [],
        selectedAcademicYear: null,
        pagination: {
          currentPage: pageNum,
          totalPages: 1,
          totalRecords: 0,
          limit: limitNum
        }
      };
    }

    const yearRef = selectedYear._id;

    // 2. Build enrollment-level match (scoped strictly to school & selected academic year)
    const matchEnrollment = {
      schoolId: sId,
      academicYearRef: new mongoose.Types.ObjectId(yearRef)
    };

    if (classId && classId !== 'ALL') {
      if (mongoose.Types.ObjectId.isValid(classId)) {
        matchEnrollment.classRef = new mongoose.Types.ObjectId(classId);
      }
    }

    if (sectionId && sectionId !== 'ALL') {
      if (mongoose.Types.ObjectId.isValid(sectionId)) {
        matchEnrollment.sectionRef = new mongoose.Types.ObjectId(sectionId);
      }
    }

    if (enrollmentStatus && enrollmentStatus !== 'ALL') {
      matchEnrollment.status = enrollmentStatus.toUpperCase();
    }

    const pipeline = [
      { $match: matchEnrollment },
      {
        $lookup: {
          from: 'student_info',
          localField: 'studentRef',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: '$student' },
      {
        $lookup: {
          from: 'class_info',
          localField: 'classRef',
          foreignField: '_id',
          as: 'class'
        }
      },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'section_info',
          localField: 'sectionRef',
          foreignField: '_id',
          as: 'section'
        }
      },
      { $unwind: { path: '$section', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'academic_year_info',
          localField: 'academicYearRef',
          foreignField: '_id',
          as: 'academicYear'
        }
      },
      { $unwind: { path: '$academicYear', preserveNullAndEmptyArrays: true } }
    ];

    // 3. Student-level filtering (schoolId, gender, search)
    const studentMatch = {
      'student.schoolId': sId
    };

    if (gender && gender !== 'ALL') {
      studentMatch['student.gender'] = gender.toUpperCase();
    }

    if (search && search.trim()) {
      const term = search.trim();
      const regex = new RegExp(term, 'i');
      studentMatch.$or = [
        { 'student.firstName': regex },
        { 'student.lastName': regex },
        { 'student.middleName': regex },
        { 'student.admissionNumber': regex },
        { rollNumber: regex },
        {
          $expr: {
            $regexMatch: {
              input: { $concat: ['$student.firstName', ' ', { $ifNull: ['$student.lastName', ''] }] },
              regex: term,
              options: 'i'
            }
          }
        }
      ];
    }

    pipeline.push({ $match: studentMatch });

    // 4. Count total matching records
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await StudentEnrollmentInfo.aggregate(countPipeline);
    const totalRecords = countResult[0]?.total || 0;

    // 5. Sort & Paginate
    pipeline.push(
      {
        $sort: {
          'class.className': 1,
          'section.sectionName': 1,
          rollNumber: 1,
          'student.firstName': 1,
          'student.lastName': 1
        }
      },
      { $skip: skip },
      { $limit: limitNum }
    );

    const records = await StudentEnrollmentInfo.aggregate(pipeline);

    // 6. Format response data
    const formattedStudents = records.map(r => {
      const guardians = r.student.guardianDetails || [];
      const fatherGuardian = guardians.find(g => (g.relationship || '').toUpperCase() === 'FATHER');
      const motherGuardian = guardians.find(g => (g.relationship || '').toUpperCase() === 'MOTHER');
      const primaryGuardian = guardians.find(g => g.isPrimaryContact) || fatherGuardian || motherGuardian || guardians[0] || null;

      const fatherName = fatherGuardian?.fullName || '—';
      const parentContactNumber = primaryGuardian?.mobileNumber || fatherGuardian?.mobileNumber || motherGuardian?.mobileNumber || r.student.contact?.phone || '—';

      return {
        _id: r.student._id,
        studentId: r.student._id,
        enrollmentId: r._id,
        admissionNumber: r.student.admissionNumber,
        firstName: r.student.firstName,
        middleName: r.student.middleName || '',
        lastName: r.student.lastName || '',
        fullName: [r.student.firstName, r.student.middleName, r.student.lastName].filter(Boolean).join(' '),
        gender: r.student.gender || 'UNAVAILABLE',
        dateOfBirth: r.student.dateOfBirth,
        profilePhotoUrl: r.student.profilePhotoUrl || '',
        classId: r.classRef,
        className: r.class?.className || 'N/A',
        classCode: r.class?.classCode || '',
        sectionId: r.sectionRef,
        sectionName: r.section?.sectionName || 'N/A',
        sectionCode: r.section?.sectionCode || '',
        rollNumber: r.rollNumber || '',
        fatherName,
        parentContactNumber,
        guardianName: primaryGuardian?.fullName || '—',
        guardianRelationship: primaryGuardian?.relationship || '—',
        enrollmentStatus: r.status || 'ACTIVE',
        studentStatus: r.student.status || 'ACTIVE',
        academicYearId: r.academicYearRef,
        academicYearName: r.academicYear?.yearName || r.academicYear?.yearCode || 'N/A',
        enrollmentDate: r.enrollmentDate
      };
    });

    return {
      students: formattedStudents,
      selectedAcademicYear: selectedYear,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  // ==========================================
  // MODULE 2 - STUDENT OVERVIEW: PHASE 2
  // ==========================================

  /**
   * 5.1 - 5.6 Get Student Profile Overview (Read-Only)
   */
  static async getStudentProfile({ schoolId, studentId, academicYearId }) {
    if (!schoolId) {
      throw new Error('School identification is required.');
    }
    const sId = schoolId.toUpperCase();

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      const err = new Error('Valid student ID is required.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Fetch student master document strictly scoped to the school
    const student = await StudentInfo.findOne({ _id: studentId, schoolId: sId })
      .populate('admissionAcademicYearRef', 'yearName yearCode')
      .populate('admissionClassRef', 'className classCode')
      .lean();

    if (!student) {
      const err = new Error('Student record not found for this school.');
      err.statusCode = 404;
      throw err;
    }

    // 2. Resolve target Academic Year
    const { selectedYear, academicYears } = await this.resolveAcademicYear(sId, academicYearId);
    const targetAyId = selectedYear ? selectedYear._id : null;

    // 3. Find enrollment for the selected academic year
    let currentEnrollment = null;
    if (targetAyId) {
      currentEnrollment = await StudentEnrollmentInfo.findOne({
        schoolId: sId,
        studentRef: student._id,
        academicYearRef: targetAyId
      })
        .populate('academicYearRef', 'yearName yearCode isCurrent status')
        .populate('classRef', 'className classCode classTeacherRef')
        .populate('sectionRef', 'sectionName sectionCode sectionTeacherRef maxCapacity')
        .lean();
    }

    // If no enrollment in target year, fall back to the most recent enrollment for context
    if (!currentEnrollment) {
      currentEnrollment = await StudentEnrollmentInfo.findOne({
        schoolId: sId,
        studentRef: student._id
      })
        .sort({ enrollmentDate: -1, createdAt: -1 })
        .populate('academicYearRef', 'yearName yearCode isCurrent status')
        .populate('classRef', 'className classCode classTeacherRef')
        .populate('sectionRef', 'sectionName sectionCode sectionTeacherRef maxCapacity')
        .lean();
    }

    // 4. Resolve Class Teacher and Section Teacher info
    let classTeacher = null;
    let sectionTeacher = null;

    if (currentEnrollment?.classRef?.classTeacherRef) {
      classTeacher = await EmployeeInfo.findById(currentEnrollment.classRef.classTeacherRef)
        .select('fullName email mobileNumber designation')
        .lean();
    }
    if (currentEnrollment?.sectionRef?.sectionTeacherRef) {
      sectionTeacher = await EmployeeInfo.findById(currentEnrollment.sectionRef.sectionTeacherRef)
        .select('fullName email mobileNumber designation')
        .lean();
    }

    // 5. Parent / Guardian information extraction
    const guardians = student.guardianDetails || [];
    const fatherGuardian = guardians.find(g => (g.relationship || '').toUpperCase() === 'FATHER');
    const motherGuardian = guardians.find(g => (g.relationship || '').toUpperCase() === 'MOTHER');
    const otherGuardian = guardians.find(g => {
      const rel = (g.relationship || '').toUpperCase();
      return rel !== 'FATHER' && rel !== 'MOTHER';
    });
    const primaryGuardian = guardians.find(g => g.isPrimaryContact) || fatherGuardian || motherGuardian || otherGuardian || null;

    // 6. Complete enrollment history across academic years
    const allEnrollments = await StudentEnrollmentInfo.find({
      schoolId: sId,
      studentRef: student._id
    })
      .sort({ enrollmentDate: -1, createdAt: -1 })
      .populate('academicYearRef', 'yearName yearCode isCurrent status')
      .populate('classRef', 'className classCode')
      .populate('sectionRef', 'sectionName sectionCode')
      .lean();

    // 7. Recorded status / section change timeline from StudentEnrollmentHistoryInfo
    const enrollmentHistoryLogs = await StudentEnrollmentHistoryInfo.find({
      schoolId: sId,
      studentRef: student._id
    })
      .sort({ changedAt: -1, createdAt: -1 })
      .populate('academicYearRef', 'yearName yearCode')
      .populate('previousClassRef', 'className classCode')
      .populate('previousSectionRef', 'sectionName sectionCode')
      .populate('newClassRef', 'className classCode')
      .populate('newSectionRef', 'sectionName sectionCode')
      .lean();

    // Format clean enrollment history table rows
    const formattedEnrollmentHistory = allEnrollments.map(enr => ({
      _id: enr._id,
      academicYearName: enr.academicYearRef?.yearName || enr.academicYearRef?.yearCode || 'N/A',
      academicYearId: enr.academicYearRef?._id,
      isCurrentYear: !!enr.academicYearRef?.isCurrent,
      className: enr.classRef?.className || 'N/A',
      classCode: enr.classRef?.classCode || '',
      sectionName: enr.sectionRef?.sectionName || 'N/A',
      sectionCode: enr.sectionRef?.sectionCode || '',
      rollNumber: enr.rollNumber || '—',
      enrollmentDate: enr.enrollmentDate,
      enrollmentStatus: enr.status || 'ACTIVE',
      promotionOutcome: enr.promotionOutcome || null,
      remarks: enr.remarks || '—'
    }));

    return {
      student: {
        _id: student._id,
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        middleName: student.middleName || '',
        lastName: student.lastName || '',
        fullName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
        dateOfBirth: student.dateOfBirth,
        gender: student.gender || 'UNAVAILABLE',
        profilePhotoUrl: student.profilePhotoUrl || '',
        bloodGroup: student.bloodGroup || '—',
        religion: student.religion || '—',
        category: student.category || '—',
        nationality: student.nationality || 'Indian',
        studentMobile: student.contact?.phone || '—',
        email: student.contact?.email || '—',
        address: student.address || '—',
        admissionDate: student.admissionDate,
        admissionAcademicYear: student.admissionAcademicYearRef?.yearName || 'N/A',
        admissionClass: student.admissionClassRef?.className || 'N/A',
        masterStatus: student.status || 'ACTIVE'
      },
      academicPlacement: currentEnrollment ? {
        enrollmentId: currentEnrollment._id,
        academicYearId: currentEnrollment.academicYearRef?._id,
        academicYearName: currentEnrollment.academicYearRef?.yearName || 'N/A',
        isCurrentAcademicYear: !!currentEnrollment.academicYearRef?.isCurrent,
        className: currentEnrollment.classRef?.className || 'N/A',
        classCode: currentEnrollment.classRef?.classCode || '',
        sectionName: currentEnrollment.sectionRef?.sectionName || 'N/A',
        sectionCode: currentEnrollment.sectionRef?.sectionCode || '',
        rollNumber: currentEnrollment.rollNumber || '—',
        enrollmentDate: currentEnrollment.enrollmentDate,
        enrollmentStatus: currentEnrollment.status || 'ACTIVE',
        classTeacherName: classTeacher ? classTeacher.fullName : (currentEnrollment.classRef?.classTeacherName || 'Not Assigned'),
        classTeacherEmail: classTeacher?.email || '—',
        classTeacherMobile: classTeacher?.mobileNumber || '—',
        sectionTeacherName: sectionTeacher ? sectionTeacher.fullName : 'Not Assigned',
        sectionTeacherEmail: sectionTeacher?.email || '—',
        sectionTeacherMobile: sectionTeacher?.mobileNumber || '—',
        hasEnrollmentForSelectedYear: targetAyId ? (currentEnrollment.academicYearRef?._id?.toString() === targetAyId.toString()) : true
      } : null,
      parentGuardianInfo: {
        father: {
          fullName: fatherGuardian?.fullName || '—',
          mobileNumber: fatherGuardian?.mobileNumber || '—',
          email: fatherGuardian?.email || '—',
          occupation: fatherGuardian?.occupation || student.fatherOccupation || '—'
        },
        mother: {
          fullName: motherGuardian?.fullName || '—',
          mobileNumber: motherGuardian?.mobileNumber || '—',
          email: motherGuardian?.email || '—',
          occupation: motherGuardian?.occupation || student.motherOccupation || '—'
        },
        guardian: otherGuardian ? {
          fullName: otherGuardian.fullName,
          relationship: otherGuardian.relationship || 'Guardian',
          mobileNumber: otherGuardian.mobileNumber || '—',
          email: otherGuardian.email || '—',
          address: student.address || '—'
        } : (primaryGuardian && primaryGuardian !== fatherGuardian && primaryGuardian !== motherGuardian ? {
          fullName: primaryGuardian.fullName,
          relationship: primaryGuardian.relationship || 'Guardian',
          mobileNumber: primaryGuardian.mobileNumber || '—',
          email: primaryGuardian.email || '—',
          address: student.address || '—'
        } : null)
      },
      enrollmentHistory: formattedEnrollmentHistory,
      changeLogs: enrollmentHistoryLogs.map(log => ({
        _id: log._id,
        changeType: log.changeType,
        academicYearName: log.academicYearRef?.yearName || 'N/A',
        previousClass: log.previousClassRef?.className || null,
        previousSection: log.previousSectionRef?.sectionName || null,
        newClass: log.newClassRef?.className || 'N/A',
        newSection: log.newSectionRef?.sectionName || 'N/A',
        remarks: log.remarks || '—',
        changedAt: log.changedAt || log.createdAt
      })),
      selectedAcademicYear: selectedYear,
      allAcademicYears: academicYears
    };
  }

  // ==========================================
  // MODULE 2 - STUDENT OVERVIEW: PHASE 3
  // ==========================================

  /**
   * 6.1 - 6.8 Get Student Performance Overview (Read-Only)
   */
  static async getStudentPerformance({ schoolId, studentId, academicYearId }) {
    if (!schoolId) {
      throw new Error('School identification is required.');
    }
    const sId = schoolId.toUpperCase();

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      const err = new Error('Valid student ID is required.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Verify student exists in this school
    const student = await StudentInfo.findOne({ _id: studentId, schoolId: sId })
      .select('firstName middleName lastName admissionNumber dateOfBirth gender profilePhotoUrl status')
      .lean();

    if (!student) {
      const err = new Error('Student record not found for this school.');
      err.statusCode = 404;
      throw err;
    }

    // 2. Fetch all enrollments for academic year selection & comparison
    const allEnrollments = await StudentEnrollmentInfo.find({
      schoolId: sId,
      studentRef: student._id
    })
      .sort({ enrollmentDate: -1, createdAt: -1 })
      .populate('academicYearRef', 'yearName yearCode isCurrent')
      .populate('classRef', 'className classCode')
      .populate('sectionRef', 'sectionName sectionCode')
      .lean();

    // 3. Resolve target academic year
    const { selectedYear, academicYears } = await this.resolveAcademicYear(sId, academicYearId);
    const targetAyId = selectedYear ? selectedYear._id : null;

    // 4. Find enrollment for the selected academic year
    const targetEnrollment = allEnrollments.find(e =>
      e.academicYearRef && targetAyId && e.academicYearRef._id.toString() === targetAyId.toString()
    ) || allEnrollments[0] || null;

    // 5. Find configured examinations & real marks/results for the enrolled class and academic year
    let examinations = [];
    let finalResult = null;
    if (targetEnrollment && targetEnrollment.classRef) {
      const targetAyRef = targetEnrollment.academicYearRef._id;
      const [examClasses, examResults, studentMarksEntries, finalResDoc] = await Promise.all([
        ExaminationClassInfo.find({
          schoolId: sId,
          academicYearRef: targetAyRef,
          classRef: targetEnrollment.classRef._id,
          status: 'ACTIVE'
        })
          .populate('examinationRef')
          .lean(),
        ExaminationResultInfo.find({
          schoolId: sId,
          academicYearRef: targetAyRef,
          studentRef: student._id
        }).lean(),
        MarksEntryInfo.find({
          schoolId: sId,
          academicYearRef: targetAyRef,
          studentRef: student._id
        }).lean(),
        FinalAcademicResultInfo.findOne({
          schoolId: sId,
          academicYearRef: targetAyRef,
          studentRef: student._id
        }).lean()
      ]);

      finalResult = finalResDoc || null;
      const examResByExamId = new Map(examResults.map(er => [er.examinationRef.toString(), er]));
      const marksByExamSubj = new Map();
      for (const me of studentMarksEntries) {
        if (me.examinationRef) {
          marksByExamSubj.set(`${me.examinationRef.toString()}_${me.subjectRef.toString()}`, me);
        }
      }

      examinations = await Promise.all(examClasses.map(async (ec) => {
        const exam = ec.examinationRef;
        if (!exam) return null;

        const examRes = examResByExamId.get(exam._id.toString()) || null;

        // Fetch subjects configured for this examination and class
        const examSubjects = await ExaminationSubjectInfo.find({
          schoolId: sId,
          examinationRef: exam._id,
          classRef: targetEnrollment.classRef._id,
          status: 'ACTIVE'
        })
          .populate('subjectRef', 'subjectName subjectCode subjectType')
          .lean();

        const resAcadMap = new Map((examRes?.academicSubjects || []).map(s => [s.subjectRef.toString(), s]));
        const resCcMap = new Map((examRes?.coCurricularSubjects || []).map(s => [s.subjectRef.toString(), s]));

        // Fetch components & actual student marks for each subject
        const subjectsWithComponents = await Promise.all(examSubjects.map(async (es) => {
          const components = await ExaminationComponentInfo.find({
            examinationSubjectRef: es._id,
            schoolId: sId
          })
            .sort({ sequence: 1 })
            .lean();

          const subjIdStr = (es.subjectRef?._id || es.subjectRef || '').toString();
          const resAcad = resAcadMap.get(subjIdStr);
          const resCc = resCcMap.get(subjIdStr);
          const rawEntry = marksByExamSubj.get(`${exam._id.toString()}_${subjIdStr}`);

          const marksObtained = resAcad
            ? (resAcad.isAbsent ? 'AB' : resAcad.totalMarksObtained)
            : (rawEntry ? (rawEntry.isAbsent ? 'AB' : rawEntry.totalMarksObtained) : null);

          const grade = resAcad?.grade || resCc?.grade || rawEntry?.grade || '';
          const percentage = resAcad?.percentage ?? (
            typeof marksObtained === 'number' && es.totalMaximumMarks > 0
              ? Math.round((marksObtained / es.totalMaximumMarks) * 10000) / 100
              : null
          );

          return {
            _id: es._id,
            subjectId: es.subjectRef?._id,
            subjectName: es.subjectName || es.subjectRef?.subjectName,
            subjectCode: es.subjectCode || es.subjectRef?.subjectCode,
            subjectType: es.subjectType || es.subjectRef?.subjectType || 'ACADEMIC',
            totalMaximumMarks: resAcad?.totalMaximumMarks ?? es.totalMaximumMarks ?? 0,
            marksObtained,
            grade,
            percentage,
            isAbsent: Boolean(resAcad?.isAbsent ?? resCc?.isAbsent ?? rawEntry?.isAbsent),
            isPassing: resAcad ? resAcad.isPassing : null,
            entryStatus: examRes ? examRes.status : (rawEntry ? 'MARKS_ENTERED' : 'PENDING'),
            components: components.map(c => {
              const matchedComp =
                (resAcad?.components || []).find(rc => rc.componentName === c.componentName) ||
                (rawEntry?.componentMarks || []).find(mc => mc.componentName === c.componentName);
              return {
                _id: c._id,
                componentName: c.componentName,
                maximumMarks: c.maximumMarks,
                marksObtained: matchedComp ? matchedComp.marksObtained : null,
                sequence: c.sequence
              };
            })
          };
        }));

        return {
          _id: exam._id,
          examinationCode: exam.examinationCode,
          examinationName: exam.examinationName,
          status: exam.status,
          startDate: exam.startDate,
          endDate: exam.endDate,
          className: targetEnrollment.classRef?.className,
          sectionName: targetEnrollment.sectionRef?.sectionName,
          totalSubjectsConfigured: subjectsWithComponents.length,
          subjects: subjectsWithComponents,
          hasApprovedResults: Boolean(examRes && ['APPROVED', 'PUBLISHED'].includes(examRes.status)),
          approvedResultsStatus: examRes ? examRes.status : 'NOT_GENERATED',
          examResultSummary: examRes
            ? {
                resultId: examRes._id,
                totalMarksObtained: examRes.totalMarksObtained,
                totalMaximumMarks: examRes.totalMaximumMarks,
                percentage: examRes.percentage,
                overallGrade: examRes.overallGrade,
                resultStatus: examRes.resultStatus,
                status: examRes.status,
                termRemark: examRes.termRemark || ''
              }
            : null
        };
      }));

      examinations = examinations.filter(Boolean);
    }

    const publishedOrApprovedCount = examinations.filter(e => e.hasApprovedResults).length;

    return {
      student: {
        _id: student._id,
        admissionNumber: student.admissionNumber,
        firstName: student.firstName,
        middleName: student.middleName || '',
        lastName: student.lastName || '',
        fullName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
        profilePhotoUrl: student.profilePhotoUrl
      },
      academicPlacement: targetEnrollment ? {
        academicYearId: targetEnrollment.academicYearRef?._id,
        academicYearName: targetEnrollment.academicYearRef?.yearName || 'N/A',
        isCurrent: !!targetEnrollment.academicYearRef?.isCurrent,
        className: targetEnrollment.classRef?.className || 'N/A',
        classCode: targetEnrollment.classRef?.classCode || '',
        sectionName: targetEnrollment.sectionRef?.sectionName || 'N/A',
        sectionCode: targetEnrollment.sectionRef?.sectionCode || '',
        rollNumber: targetEnrollment.rollNumber || '—',
        enrollmentStatus: targetEnrollment.status
      } : null,
      availableAcademicYears: allEnrollments.map(e => ({
        academicYearId: e.academicYearRef?._id,
        academicYearName: e.academicYearRef?.yearName || 'N/A',
        isCurrent: !!e.academicYearRef?.isCurrent,
        className: e.classRef?.className || 'N/A',
        sectionName: e.sectionRef?.sectionName || 'N/A'
      })),
      selectedAcademicYear: selectedYear,
      totalExaminationsConfigured: examinations.length,
      totalApprovedResults: publishedOrApprovedCount,
      hasApprovedResults: publishedOrApprovedCount > 0 || Boolean(finalResult && ['APPROVED', 'PUBLISHED'].includes(finalResult.status)),
      examinations,
      finalResult: finalResult
        ? {
            _id: finalResult._id,
            overallTotalObtained: finalResult.overallTotalObtained,
            overallMaxMarks: finalResult.overallMaxMarks,
            finalPercentage: finalResult.finalPercentage,
            overallGrade: finalResult.overallGrade,
            resultStatus: finalResult.resultStatus,
            promotionStatus: finalResult.promotionStatus,
            status: finalResult.status,
            finalRemark: finalResult.finalRemark || '',
            academicSubjects: finalResult.academicSubjects || [],
            coCurricularSubjects: finalResult.coCurricularSubjects || []
          }
        : null,
      notice: null
    };
  }

  // ==========================================
  // MODULE 4 - EXAMINATION MANAGEMENT (HEAD TEACHER PANEL - READ ONLY)
  // ==========================================

  /**
   * Helper: Resolve Academic Year scope supporting 'ALL' or specific academicYearId
   */
  static async resolveExaminationYearScope(schoolId, academicYearId) {
    const sId = schoolId.toUpperCase();
    const academicYears = await AcademicYearInfo.find({ schoolId: sId })
      .sort({ isCurrent: -1, startDate: -1 })
      .lean();

    if (academicYearId === 'ALL') {
      return { selectedYear: null, academicYears, isAllYears: true, invalidYear: false };
    }

    if (academicYearId) {
      if (!mongoose.Types.ObjectId.isValid(academicYearId)) {
        return { selectedYear: null, academicYears, isAllYears: false, invalidYear: true };
      }
      const matched = academicYears.find(y => y._id.toString() === academicYearId.toString());
      if (!matched) {
        return { selectedYear: null, academicYears, isAllYears: false, invalidYear: true };
      }
      return { selectedYear: matched, academicYears, isAllYears: false, invalidYear: false };
    }

    const defaultYear = academicYears.find(y => y.isCurrent) || academicYears[0] || null;
    return { selectedYear: defaultYear, academicYears, isAllYears: false, invalidYear: false };
  }

  /**
   * 4.1 Examination Overview (Summary Cards + Examination List + Filters)
   */
  static async listExaminations({
    schoolId,
    academicYearId,
    examinationId = 'ALL',
    classId = 'ALL',
    status = 'ALL',
    search = '',
    page = 1,
    limit = 10
  }) {
    if (!schoolId) {
      throw new Error('School identification is required.');
    }
    const sId = schoolId.toUpperCase();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const { selectedYear, academicYears, isAllYears, invalidYear } =
      await this.resolveExaminationYearScope(sId, academicYearId);

    const activeClasses = await ClassInfo.find({ schoolId: sId, status: 'ACTIVE' })
      .sort({ className: 1 })
      .select('_id classCode className')
      .lean();

    if (invalidYear || (!isAllYears && !selectedYear)) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        summary: {
          totalExaminations: 0,
          upcomingExaminations: 0,
          ongoingExaminations: 0,
          completedExaminations: 0,
          cancelledExaminations: 0
        },
        examinations: [],
        filterOptions: { examinations: [], classes: activeClasses },
        pagination: { totalRecords: 0, currentPage: pageNum, totalPages: 1, limit: limitNum }
      };
    }

    const baseScopeQuery = { schoolId: sId };
    if (!isAllYears && selectedYear) {
      baseScopeQuery.academicYearRef = selectedYear._id;
    }

    // Fetch all examinations in the selected Academic Year scope for accurate summary cards & filter options
    const allScopeExams = await ExaminationInfo.find(baseScopeQuery)
      .populate('academicYearRef', 'yearName yearCode isCurrent')
      .sort({ startDate: -1, createdAt: -1 })
      .lean();

    const summary = {
      totalExaminations: allScopeExams.length,
      upcomingExaminations: allScopeExams.filter(e => e.status === 'UPCOMING').length,
      ongoingExaminations: allScopeExams.filter(e => e.status === 'ONGOING').length,
      completedExaminations: allScopeExams.filter(e => e.status === 'COMPLETED').length,
      cancelledExaminations: allScopeExams.filter(e => e.status === 'CANCELLED').length
    };

    const filterExamOptions = allScopeExams.map(e => ({
      _id: e._id,
      examinationCode: e.examinationCode,
      examinationName: e.examinationName,
      status: e.status
    }));

    if (allScopeExams.length === 0) {
      return {
        selectedAcademicYear: selectedYear,
        availableAcademicYears: academicYears,
        summary,
        examinations: [],
        filterOptions: { examinations: filterExamOptions, classes: activeClasses },
        pagination: { totalRecords: 0, currentPage: pageNum, totalPages: 1, limit: limitNum }
      };
    }

    const scopeExamIds = allScopeExams.map(e => e._id);

    // Fetch assigned classes, configured subject counts, and enrollment counts efficiently
    const [assignedClassDocs, subjectCountAgg, enrollmentAgg] = await Promise.all([
      ExaminationClassInfo.find({
        schoolId: sId,
        examinationRef: { $in: scopeExamIds },
        status: 'ACTIVE'
      })
        .sort({ className: 1 })
        .lean(),
      ExaminationSubjectInfo.aggregate([
        { $match: { schoolId: sId, examinationRef: { $in: scopeExamIds }, status: 'ACTIVE' } },
        { $group: { _id: '$examinationRef', count: { $sum: 1 } } }
      ]),
      StudentEnrollmentInfo.aggregate([
        {
          $match: {
            schoolId: sId,
            status: 'ACTIVE',
            ...(!isAllYears && selectedYear ? { academicYearRef: selectedYear._id } : {})
          }
        },
        {
          $group: {
            _id: { academicYearRef: '$academicYearRef', classRef: '$classRef' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const classMap = new Map();
    for (const ac of assignedClassDocs) {
      const key = ac.examinationRef.toString();
      if (!classMap.has(key)) classMap.set(key, []);
      classMap.get(key).push({
        _id: ac._id,
        classRef: ac.classRef,
        classCode: ac.classCode,
        className: ac.className
      });
    }

    const subjectCountMap = new Map();
    for (const item of subjectCountAgg) {
      subjectCountMap.set(item._id.toString(), item.count);
    }

    const enrollmentCountMap = new Map();
    for (const item of enrollmentAgg) {
      if (item._id?.academicYearRef && item._id?.classRef) {
        enrollmentCountMap.set(
          `${item._id.academicYearRef.toString()}_${item._id.classRef.toString()}`,
          item.count
        );
      }
    }

    let formatted = allScopeExams.map(exam => {
      const eIdStr = exam._id.toString();
      const ayIdStr = (exam.academicYearRef?._id || exam.academicYearRef)?.toString();
      const assignedClasses = classMap.get(eIdStr) || [];

      const enrolledStudentsCount = assignedClasses.reduce((sum, cls) => {
        const key = `${ayIdStr}_${cls.classRef.toString()}`;
        return sum + (enrollmentCountMap.get(key) || 0);
      }, 0);

      return {
        _id: exam._id,
        examinationCode: exam.examinationCode,
        examinationName: exam.examinationName,
        description: exam.description || '',
        academicYearRef: exam.academicYearRef?._id || exam.academicYearRef,
        academicYearName: exam.academicYearRef?.yearName || 'N/A',
        academicYearCode: exam.academicYearRef?.yearCode || '',
        startDate: exam.startDate,
        endDate: exam.endDate,
        hasIncompleteDates: !exam.startDate || !exam.endDate,
        status: exam.status,
        assignedClasses,
        assignedClassCount: assignedClasses.length,
        configuredSubjectsCount: subjectCountMap.get(eIdStr) || 0,
        enrolledStudentsCount,
        createdAt: exam.createdAt,
        updatedAt: exam.updatedAt
      };
    });

    // Apply filters
    if (examinationId && examinationId !== 'ALL') {
      formatted = formatted.filter(e => e._id.toString() === examinationId.toString());
    }
    if (status && status !== 'ALL') {
      const cleanStatus = status.toUpperCase();
      formatted = formatted.filter(e => e.status === cleanStatus);
    }
    if (classId && classId !== 'ALL') {
      formatted = formatted.filter(e =>
        e.assignedClasses.some(c => c.classRef.toString() === classId.toString())
      );
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      formatted = formatted.filter(e =>
        e.examinationName.toLowerCase().includes(q) ||
        e.examinationCode.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        e.assignedClasses.some(c =>
          c.className.toLowerCase().includes(q) || c.classCode.toLowerCase().includes(q)
        )
      );
    }

    const totalRecords = formatted.length;
    const paginated = formatted.slice(skip, skip + limitNum);

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      summary,
      examinations: paginated,
      filterOptions: {
        examinations: filterExamOptions,
        classes: activeClasses
      },
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * 4.2 Single Examination Details (Read-Only Modal/Drawer)
   */
  static async getExaminationDetails({ schoolId, examinationId }) {
    if (!schoolId) {
      throw new Error('School identification is required.');
    }
    const sId = schoolId.toUpperCase();

    if (!examinationId || !mongoose.Types.ObjectId.isValid(examinationId)) {
      const err = new Error('Valid examination ID is required.');
      err.statusCode = 400;
      throw err;
    }

    const exam = await ExaminationInfo.findOne({ _id: examinationId, schoolId: sId })
      .populate('academicYearRef', 'yearName yearCode isCurrent')
      .lean();

    if (!exam) {
      const err = new Error('Examination record not found for your school.');
      err.statusCode = 404;
      throw err;
    }

    const ayId = exam.academicYearRef?._id || exam.academicYearRef;

    const assignedClassDocs = await ExaminationClassInfo.find({
      schoolId: sId,
      examinationRef: exam._id,
      status: 'ACTIVE'
    })
      .sort({ className: 1 })
      .lean();

    const assignedClassIds = assignedClassDocs.map(c => c.classRef);

    const [
      examSubjects,
      allocatedSubjects,
      sections,
      teacherAssignments,
      enrollmentAgg
    ] = await Promise.all([
      ExaminationSubjectInfo.find({
        schoolId: sId,
        examinationRef: exam._id,
        status: 'ACTIVE'
      })
        .sort({ subjectCode: 1 })
        .lean(),
      ClassSubjectInfo.find({
        schoolId: sId,
        academicYearRef: ayId,
        classRef: { $in: assignedClassIds },
        status: 'ACTIVE'
      }).lean(),
      SectionInfo.find({
        schoolId: sId,
        classRef: { $in: assignedClassIds },
        status: 'ACTIVE'
      })
        .sort({ sectionName: 1 })
        .lean(),
      SubjectTeacherAssignmentInfo.find({
        schoolId: sId,
        academicYearRef: ayId,
        classRef: { $in: assignedClassIds },
        status: 'ACTIVE'
      }).lean(),
      StudentEnrollmentInfo.aggregate([
        {
          $match: {
            schoolId: sId,
            academicYearRef: ayId,
            classRef: { $in: assignedClassIds },
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
    ]);

    const examSubjectIds = examSubjects.map(es => es._id);
    const components = await ExaminationComponentInfo.find({
      schoolId: sId,
      examinationSubjectRef: { $in: examSubjectIds }
    })
      .sort({ sequence: 1 })
      .lean();

    const componentsByExamSubj = new Map();
    for (const comp of components) {
      const key = comp.examinationSubjectRef.toString();
      if (!componentsByExamSubj.has(key)) componentsByExamSubj.set(key, []);
      componentsByExamSubj.get(key).push({
        _id: comp._id,
        componentName: comp.componentName,
        maximumMarks: comp.maximumMarks,
        sequence: comp.sequence
      });
    }

    const classNameMap = new Map();
    for (const c of assignedClassDocs) {
      classNameMap.set(c.classRef.toString(), { classCode: c.classCode, className: c.className });
    }

    const configuredSubjects = examSubjects.map(es => {
      const cls = classNameMap.get(es.classRef.toString()) || {};
      return {
        _id: es._id,
        classId: es.classRef,
        classCode: cls.classCode || '',
        className: cls.className || 'N/A',
        subjectId: es.subjectRef,
        subjectCode: es.subjectCode,
        subjectName: es.subjectName,
        subjectType: es.subjectType,
        totalMaximumMarks: es.totalMaximumMarks,
        passingMarks: null,
        components: componentsByExamSubj.get(es._id.toString()) || [],
        status: es.status
      };
    });

    // Schedule derived from configured subjects & examination date window
    const schedule = configuredSubjects.map(sub => ({
      _id: sub._id,
      classId: sub.classId,
      classCode: sub.classCode,
      className: sub.className,
      subjectId: sub.subjectId,
      subjectCode: sub.subjectCode,
      subjectName: sub.subjectName,
      startDate: exam.startDate,
      endDate: exam.endDate,
      startTime: null,
      endTime: null,
      totalMaximumMarks: sub.totalMaximumMarks
    }));

    // Build Marks Entry Progress summary (per class-section-subject using live enrollment & teacher assignment records)
    const sectionByClassMap = new Map();
    for (const sec of sections) {
      const key = sec.classRef.toString();
      if (!sectionByClassMap.has(key)) sectionByClassMap.set(key, []);
      sectionByClassMap.get(key).push(sec);
    }

    const assignmentMap = new Map();
    for (const a of teacherAssignments) {
      assignmentMap.set(
        `${a.classRef.toString()}_${a.sectionRef.toString()}_${a.subjectRef.toString()}`,
        a
      );
    }

    const sectionCountMap = new Map();
    const classTotalCountMap = new Map();
    for (const row of enrollmentAgg) {
      const cKey = row._id.classRef.toString();
      const sKey = row._id.sectionRef ? row._id.sectionRef.toString() : '';
      classTotalCountMap.set(cKey, (classTotalCountMap.get(cKey) || 0) + row.count);
      if (sKey) {
        sectionCountMap.set(`${cKey}_${sKey}`, row.count);
      }
    }

    const marksProgressRows = [];
    for (const sub of configuredSubjects) {
      const cId = sub.classId.toString();
      const classSections = sectionByClassMap.get(cId) || [];
      if (classSections.length > 0) {
        for (const sec of classSections) {
          const totalStudents = sectionCountMap.get(`${cId}_${sec._id.toString()}`) || 0;
          const teacherAssign = assignmentMap.get(`${cId}_${sec._id.toString()}_${sub.subjectId.toString()}`);
          const marksEntered = 0; // Marks-entry workflow not yet implemented in DMMS
          const pending = totalStudents;
          const progressPercentage = totalStudents > 0 ? Math.round((marksEntered / totalStudents) * 100) : 0;

          marksProgressRows.push({
            classId: sub.classId,
            className: sub.className,
            sectionId: sec._id,
            sectionName: sec.sectionName,
            subjectId: sub.subjectId,
            subjectCode: sub.subjectCode,
            subjectName: sub.subjectName,
            assignedTeacherName: teacherAssign?.teacherName || null,
            totalStudents,
            marksEntered,
            pending,
            progressPercentage,
            submissionStatus: 'PENDING'
          });
        }
      } else {
        const totalStudents = classTotalCountMap.get(cId) || 0;
        marksProgressRows.push({
          classId: sub.classId,
          className: sub.className,
          sectionId: null,
          sectionName: null,
          subjectId: sub.subjectId,
          subjectCode: sub.subjectCode,
          subjectName: sub.subjectName,
          assignedTeacherName: null,
          totalStudents,
          marksEntered: 0,
          pending: totalStudents,
          progressPercentage: 0,
          submissionStatus: 'PENDING'
        });
      }
    }

    const totalEligibleStudents = marksProgressRows.reduce((s, r) => s + r.totalStudents, 0);
    const totalMarksEntered = marksProgressRows.reduce((s, r) => s + r.marksEntered, 0);
    const overallProgressPercentage =
      totalEligibleStudents > 0 ? Math.round((totalMarksEntered / totalEligibleStudents) * 100) : 0;

    return {
      examination: {
        _id: exam._id,
        examinationCode: exam.examinationCode,
        examinationName: exam.examinationName,
        description: exam.description || '',
        academicYearRef: ayId,
        academicYearName: exam.academicYearRef?.yearName || 'N/A',
        academicYearCode: exam.academicYearRef?.yearCode || '',
        startDate: exam.startDate,
        endDate: exam.endDate,
        hasIncompleteDates: !exam.startDate || !exam.endDate,
        status: exam.status,
        assignedClasses: assignedClassDocs.map(c => ({
          _id: c._id,
          classRef: c.classRef,
          classCode: c.classCode,
          className: c.className
        }))
      },
      configuredSubjects,
      classAllocationSummary: {
        totalAllocatedInClasses: allocatedSubjects.length,
        totalConfiguredInExam: configuredSubjects.length
      },
      schedule,
      marksEntryProgress: {
        isMarksModuleActive: false,
        totalEntries: marksProgressRows.length,
        totalEligibleStudents,
        totalMarksEntered,
        totalPending: totalEligibleStudents - totalMarksEntered,
        overallProgressPercentage,
        rows: marksProgressRows
      }
    };
  }

  /**
   * 4.3 Examination Schedule (Read-Only Timetable + Conflict & Same-Date Detection)
   */
  static async getExaminationSchedule({
    schoolId,
    academicYearId,
    examinationId = 'ALL',
    classId = 'ALL',
    subjectId = 'ALL',
    dateFrom = '',
    dateTo = '',
    search = '',
    page = 1,
    limit = 10
  }) {
    if (!schoolId) {
      throw new Error('School identification is required.');
    }
    const sId = schoolId.toUpperCase();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const { selectedYear, academicYears, isAllYears, invalidYear } =
      await this.resolveExaminationYearScope(sId, academicYearId);

    const [activeClasses, activeSubjects] = await Promise.all([
      ClassInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ className: 1 }).select('_id classCode className').lean(),
      SubjectInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ subjectName: 1 }).select('_id subjectCode subjectName subjectType').lean()
    ]);

    if (invalidYear || (!isAllYears && !selectedYear)) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        schedule: [],
        conflicts: [],
        sameDateExaminations: [],
        summary: { totalEntries: 0, uniqueExaminations: 0, missingDatesCount: 0, conflictCount: 0 },
        filterOptions: { examinations: [], classes: activeClasses, subjects: activeSubjects },
        scheduleSchemaInfo: {
          hasSubjectLevelTimetable: false,
          note: 'Subject-level paper dates and start/end times are not configured in the current Admin Examination schema; displaying examination window dates.'
        },
        pagination: { totalRecords: 0, currentPage: pageNum, totalPages: 1, limit: limitNum }
      };
    }

    const examQuery = { schoolId: sId };
    if (!isAllYears && selectedYear) {
      examQuery.academicYearRef = selectedYear._id;
    }

    const scopeExams = await ExaminationInfo.find(examQuery)
      .populate('academicYearRef', 'yearName yearCode')
      .sort({ startDate: 1, examinationName: 1 })
      .lean();

    const examMap = new Map();
    for (const ex of scopeExams) {
      examMap.set(ex._id.toString(), ex);
    }

    const scopeExamIds = scopeExams.map(e => e._id);
    const [examClassDocs, examSubjectDocs] = await Promise.all([
      ExaminationClassInfo.find({
        schoolId: sId,
        examinationRef: { $in: scopeExamIds },
        status: 'ACTIVE'
      }).lean(),
      ExaminationSubjectInfo.find({
        schoolId: sId,
        examinationRef: { $in: scopeExamIds },
        status: 'ACTIVE'
      })
        .sort({ subjectCode: 1 })
        .lean()
    ]);

    const classInfoMap = new Map();
    for (const c of activeClasses) {
      classInfoMap.set(c._id.toString(), c);
    }

    // Conflict Detection (Read-Only):
    // 1. Multiple non-cancelled examinations assigned to the same class with overlapping dates
    const conflicts = [];
    const examsByClass = new Map();
    for (const ec of examClassDocs) {
      const ex = examMap.get(ec.examinationRef.toString());
      if (!ex || ex.status === 'CANCELLED') continue;
      const cKey = ec.classRef.toString();
      if (!examsByClass.has(cKey)) examsByClass.set(cKey, []);
      examsByClass.get(cKey).push({ exam: ex, className: ec.className, classCode: ec.classCode });
    }

    for (const [cId, items] of examsByClass.entries()) {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const exA = items[i].exam;
          const exB = items[j].exam;
          if (!exA.startDate || !exB.startDate) continue;

          const startA = new Date(exA.startDate);
          const endA = exA.endDate ? new Date(exA.endDate) : new Date(exA.startDate);
          const startB = new Date(exB.startDate);
          const endB = exB.endDate ? new Date(exB.endDate) : new Date(exB.startDate);

          startA.setHours(0, 0, 0, 0);
          endA.setHours(23, 59, 59, 999);
          startB.setHours(0, 0, 0, 0);
          endB.setHours(23, 59, 59, 999);

          if (startA <= endB && startB <= endA) {
            conflicts.push({
              type: 'CLASS_DATE_OVERLAP',
              classId: cId,
              className: items[i].className,
              examinations: [
                { _id: exA._id, examinationCode: exA.examinationCode, examinationName: exA.examinationName, startDate: exA.startDate, endDate: exA.endDate },
                { _id: exB._id, examinationCode: exB.examinationCode, examinationName: exB.examinationName, startDate: exB.startDate, endDate: exB.endDate }
              ],
              message: `Overlapping examination dates detected for ${items[i].className}: "${exA.examinationName}" and "${exB.examinationName}".`
            });
          }
        }
      }
    }

    // 2. Duplicate schedule entries for same (examination, class, subject)
    const seenExamClassSubj = new Set();
    for (const es of examSubjectDocs) {
      const dupKey = `${es.examinationRef.toString()}_${es.classRef.toString()}_${es.subjectRef.toString()}`;
      if (seenExamClassSubj.has(dupKey)) {
        const ex = examMap.get(es.examinationRef.toString());
        const cls = classInfoMap.get(es.classRef.toString());
        conflicts.push({
          type: 'DUPLICATE_SUBJECT_ENTRY',
          classId: es.classRef.toString(),
          className: cls?.className || '',
          subjectName: es.subjectName,
          message: `Duplicate schedule entry for ${cls?.className || 'Class'} - ${es.subjectName} in "${ex?.examinationName || 'Examination'}".`
        });
      }
      seenExamClassSubj.add(dupKey);
    }

    // 3. Identify examinations scheduled on the same start date
    const examsByStartDate = new Map();
    for (const ex of scopeExams) {
      if (!ex.startDate || ex.status === 'CANCELLED') continue;
      const dKey = new Date(ex.startDate).toISOString().split('T')[0];
      if (!examsByStartDate.has(dKey)) examsByStartDate.set(dKey, []);
      examsByStartDate.get(dKey).push({
        _id: ex._id,
        examinationCode: ex.examinationCode,
        examinationName: ex.examinationName
      });
    }
    const sameDateExaminations = Array.from(examsByStartDate.entries())
      .filter(([, list]) => list.length > 1)
      .map(([date, list]) => ({ date, examinations: list }));

    // Build schedule entries from ExaminationSubjectInfo
    const examClassLookup = new Map();
    for (const ec of examClassDocs) {
      examClassLookup.set(`${ec.examinationRef.toString()}_${ec.classRef.toString()}`, ec);
    }

    let rows = examSubjectDocs
      .map(es => {
        const ex = examMap.get(es.examinationRef.toString());
        if (!ex) return null;
        const ec = examClassLookup.get(`${es.examinationRef.toString()}_${es.classRef.toString()}`);
        const cls = classInfoMap.get(es.classRef.toString());
        const className = ec?.className || cls?.className || 'N/A';
        const classCode = ec?.classCode || cls?.classCode || '';

        const startDateKey = ex.startDate ? new Date(ex.startDate).toISOString().split('T')[0] : null;
        const isSameDateShared = startDateKey ? (examsByStartDate.get(startDateKey)?.length || 0) > 1 : false;

        return {
          _id: es._id,
          examinationId: ex._id,
          examinationCode: ex.examinationCode,
          examinationName: ex.examinationName,
          examinationStatus: ex.status,
          academicYearRef: ex.academicYearRef?._id || ex.academicYearRef,
          academicYearName: ex.academicYearRef?.yearName || 'N/A',
          classId: es.classRef,
          classCode,
          className,
          subjectId: es.subjectRef,
          subjectCode: es.subjectCode,
          subjectName: es.subjectName,
          subjectType: es.subjectType,
          startDate: ex.startDate,
          endDate: ex.endDate,
          examinationDate: ex.startDate,
          startTime: null,
          endTime: null,
          totalMaximumMarks: es.totalMaximumMarks,
          hasIncompleteDates: !ex.startDate || !ex.endDate,
          isSameDateShared
        };
      })
      .filter(Boolean);

    // Apply filters
    if (examinationId && examinationId !== 'ALL') {
      rows = rows.filter(r => r.examinationId.toString() === examinationId.toString());
    }
    if (classId && classId !== 'ALL') {
      rows = rows.filter(r => r.classId.toString() === classId.toString());
    }
    if (subjectId && subjectId !== 'ALL') {
      rows = rows.filter(r => r.subjectId.toString() === subjectId.toString());
    }
    if (dateFrom || dateTo) {
      const fromDt = dateFrom ? new Date(dateFrom) : null;
      const toDt = dateTo ? new Date(dateTo) : null;
      if (fromDt && !isNaN(fromDt.getTime())) fromDt.setHours(0, 0, 0, 0);
      if (toDt && !isNaN(toDt.getTime())) toDt.setHours(23, 59, 59, 999);

      rows = rows.filter(r => {
        if (!r.startDate && !r.endDate) return false;
        const exStart = new Date(r.startDate || r.endDate);
        const exEnd = new Date(r.endDate || r.startDate);
        exStart.setHours(0, 0, 0, 0);
        exEnd.setHours(23, 59, 59, 999);
        if (fromDt && !isNaN(fromDt.getTime()) && exEnd < fromDt) return false;
        if (toDt && !isNaN(toDt.getTime()) && exStart > toDt) return false;
        return true;
      });
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r =>
        r.examinationName.toLowerCase().includes(q) ||
        r.examinationCode.toLowerCase().includes(q) ||
        r.className.toLowerCase().includes(q) ||
        r.subjectName.toLowerCase().includes(q) ||
        r.subjectCode.toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      const da = a.startDate ? new Date(a.startDate).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.startDate ? new Date(b.startDate).getTime() : Number.MAX_SAFE_INTEGER;
      if (da !== db) return da - db;
      const clsCmp = a.className.localeCompare(b.className);
      if (clsCmp !== 0) return clsCmp;
      return a.subjectName.localeCompare(b.subjectName);
    });

    const uniqueExamIds = new Set(rows.map(r => r.examinationId.toString()));
    const missingDatesCount = rows.filter(r => r.hasIncompleteDates).length;

    const totalRecords = rows.length;
    const paginated = rows.slice(skip, skip + limitNum);

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      schedule: paginated,
      conflicts,
      sameDateExaminations,
      summary: {
        totalEntries: totalRecords,
        uniqueExaminations: uniqueExamIds.size,
        missingDatesCount,
        conflictCount: conflicts.length
      },
      filterOptions: {
        examinations: scopeExams.map(e => ({
          _id: e._id,
          examinationCode: e.examinationCode,
          examinationName: e.examinationName,
          status: e.status
        })),
        classes: activeClasses,
        subjects: activeSubjects
      },
      scheduleSchemaInfo: {
        hasSubjectLevelTimetable: false,
        note: 'Subject-level paper dates and start/end times are not configured in the current Admin Examination schema; displaying examination window dates.'
      },
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * 4.4 Subject Configuration Overview (Read-Only)
   */
  static async getSubjectConfigurations({
    schoolId,
    academicYearId,
    examinationId = 'ALL',
    classId = 'ALL',
    subjectId = 'ALL',
    configStatus = 'ALL',
    search = '',
    page = 1,
    limit = 10
  }) {
    if (!schoolId) {
      throw new Error('School identification is required.');
    }
    const sId = schoolId.toUpperCase();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const { selectedYear, academicYears, isAllYears, invalidYear } =
      await this.resolveExaminationYearScope(sId, academicYearId);

    const [activeClasses, activeSubjects] = await Promise.all([
      ClassInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ className: 1 }).select('_id classCode className').lean(),
      SubjectInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ subjectName: 1 }).select('_id subjectCode subjectName subjectType').lean()
    ]);

    if (invalidYear || (!isAllYears && !selectedYear)) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        configurations: [],
        summary: { totalRecords: 0, configuredCount: 0, unconfiguredCount: 0, zeroMarksConfiguredCount: 0 },
        filterOptions: { examinations: [], classes: activeClasses, subjects: activeSubjects },
        pagination: { totalRecords: 0, currentPage: pageNum, totalPages: 1, limit: limitNum }
      };
    }

    const examQuery = { schoolId: sId };
    if (!isAllYears && selectedYear) {
      examQuery.academicYearRef = selectedYear._id;
    }

    const scopeExams = await ExaminationInfo.find(examQuery)
      .populate('academicYearRef', 'yearName yearCode')
      .sort({ createdAt: -1 })
      .lean();

    const scopeExamIds = scopeExams.map(e => e._id);
    if (scopeExamIds.length === 0) {
      return {
        selectedAcademicYear: selectedYear,
        availableAcademicYears: academicYears,
        configurations: [],
        summary: { totalRecords: 0, configuredCount: 0, unconfiguredCount: 0, zeroMarksConfiguredCount: 0 },
        filterOptions: { examinations: [], classes: activeClasses, subjects: activeSubjects },
        pagination: { totalRecords: 0, currentPage: pageNum, totalPages: 1, limit: limitNum }
      };
    }

    const [examClassDocs, examSubjectDocs, classSubjectDocs] = await Promise.all([
      ExaminationClassInfo.find({
        schoolId: sId,
        examinationRef: { $in: scopeExamIds },
        status: 'ACTIVE'
      })
        .sort({ className: 1 })
        .lean(),
      ExaminationSubjectInfo.find({
        schoolId: sId,
        examinationRef: { $in: scopeExamIds },
        status: 'ACTIVE'
      }).lean(),
      ClassSubjectInfo.find({
        schoolId: sId,
        ...(!isAllYears && selectedYear ? { academicYearRef: selectedYear._id } : {}),
        status: 'ACTIVE'
      })
        .sort({ subjectCode: 1 })
        .lean()
    ]);

    const examSubjectIds = examSubjectDocs.map(es => es._id);
    const componentDocs = await ExaminationComponentInfo.find({
      schoolId: sId,
      examinationSubjectRef: { $in: examSubjectIds }
    })
      .sort({ sequence: 1 })
      .lean();

    const compMap = new Map();
    for (const c of componentDocs) {
      const k = c.examinationSubjectRef.toString();
      if (!compMap.has(k)) compMap.set(k, []);
      compMap.get(k).push({
        _id: c._id,
        componentName: c.componentName,
        maximumMarks: c.maximumMarks,
        sequence: c.sequence
      });
    }

    const examMap = new Map();
    for (const ex of scopeExams) {
      examMap.set(ex._id.toString(), ex);
    }

    const examSubjectMap = new Map();
    for (const es of examSubjectDocs) {
      examSubjectMap.set(
        `${es.examinationRef.toString()}_${es.classRef.toString()}_${es.subjectRef.toString()}`,
        es
      );
    }

    const classSubjByYearClassMap = new Map();
    for (const cs of classSubjectDocs) {
      const key = `${cs.academicYearRef.toString()}_${cs.classRef.toString()}`;
      if (!classSubjByYearClassMap.has(key)) classSubjByYearClassMap.set(key, []);
      classSubjByYearClassMap.get(key).push(cs);
    }

    const classInfoMap = new Map();
    for (const c of activeClasses) {
      classInfoMap.set(c._id.toString(), c);
    }

    const mergedRows = [];
    const includedKeys = new Set();

    // Merge assigned classes with allocated ClassSubjectInfo + ExaminationSubjectInfo
    for (const ec of examClassDocs) {
      const ex = examMap.get(ec.examinationRef.toString());
      if (!ex) continue;
      const ayId = (ex.academicYearRef?._id || ex.academicYearRef).toString();
      const allocatedList = classSubjByYearClassMap.get(`${ayId}_${ec.classRef.toString()}`) || [];

      for (const alloc of allocatedList) {
        const key = `${ex._id.toString()}_${ec.classRef.toString()}_${alloc.subjectRef.toString()}`;
        includedKeys.add(key);
        const es = examSubjectMap.get(key);
        const components = es ? (compMap.get(es._id.toString()) || []) : [];

        mergedRows.push({
          _id: es ? es._id : `${ex._id}_${ec.classRef}_${alloc.subjectRef}`,
          examinationSubjectId: es ? es._id : null,
          examinationId: ex._id,
          examinationCode: ex.examinationCode,
          examinationName: ex.examinationName,
          examinationStatus: ex.status,
          academicYearRef: ayId,
          academicYearName: ex.academicYearRef?.yearName || 'N/A',
          classId: ec.classRef,
          classCode: ec.classCode,
          className: ec.className,
          subjectId: alloc.subjectRef,
          subjectCode: alloc.subjectCode,
          subjectName: alloc.subjectName,
          subjectType: alloc.subjectType,
          totalMaximumMarks: es ? es.totalMaximumMarks : 0,
          passingMarks: null, // Not present in current DMMS ExaminationSubjectInfo schema
          assessmentType: es
            ? (components.length > 0
                ? `${es.subjectType === 'CO_CURRICULAR' ? 'Co-Curricular' : 'Academic'} (${components.map(c => c.componentName).join(', ')})`
                : `${es.subjectType === 'CO_CURRICULAR' ? 'Co-Curricular' : 'Academic'} (No Components)`)
            : (alloc.subjectType === 'CO_CURRICULAR' ? 'Co-Curricular' : 'Academic'),
          components,
          hasAdditionalComponents: !!alloc.hasAdditionalComponents,
          additionalComponents: alloc.additionalComponents || [],
          totalAdditionalMarks: alloc.totalAdditionalMarks || 0,
          isConfigured: !!es,
          status: es ? 'CONFIGURED' : 'NOT_CONFIGURED'
        });
      }
    }

    // Include any active ExaminationSubjectInfo whose classSubject allocation might not be in active classSubjectDocs
    for (const es of examSubjectDocs) {
      const key = `${es.examinationRef.toString()}_${es.classRef.toString()}_${es.subjectRef.toString()}`;
      if (includedKeys.has(key)) continue;
      const ex = examMap.get(es.examinationRef.toString());
      if (!ex) continue;
      const cls = classInfoMap.get(es.classRef.toString());
      const components = compMap.get(es._id.toString()) || [];

      mergedRows.push({
        _id: es._id,
        examinationSubjectId: es._id,
        examinationId: ex._id,
        examinationCode: ex.examinationCode,
        examinationName: ex.examinationName,
        examinationStatus: ex.status,
        academicYearRef: (ex.academicYearRef?._id || ex.academicYearRef).toString(),
        academicYearName: ex.academicYearRef?.yearName || 'N/A',
        classId: es.classRef,
        classCode: cls?.classCode || '',
        className: cls?.className || 'N/A',
        subjectId: es.subjectRef,
        subjectCode: es.subjectCode,
        subjectName: es.subjectName,
        subjectType: es.subjectType,
        totalMaximumMarks: es.totalMaximumMarks,
        passingMarks: null,
        assessmentType:
          components.length > 0
            ? `${es.subjectType === 'CO_CURRICULAR' ? 'Co-Curricular' : 'Academic'} (${components.map(c => c.componentName).join(', ')})`
            : `${es.subjectType === 'CO_CURRICULAR' ? 'Co-Curricular' : 'Academic'} (No Components)`,
        components,
        hasAdditionalComponents: false,
        additionalComponents: [],
        totalAdditionalMarks: 0,
        isConfigured: true,
        status: 'CONFIGURED'
      });
    }

    // Filter by Examination, Class, Subject first for contextual summary, then ConfigStatus & Search
    let filtered = mergedRows;
    if (examinationId && examinationId !== 'ALL') {
      filtered = filtered.filter(r => r.examinationId.toString() === examinationId.toString());
    }
    if (classId && classId !== 'ALL') {
      filtered = filtered.filter(r => r.classId.toString() === classId.toString());
    }
    if (subjectId && subjectId !== 'ALL') {
      filtered = filtered.filter(r => r.subjectId.toString() === subjectId.toString());
    }

    const summary = {
      totalRecords: filtered.length,
      configuredCount: filtered.filter(r => r.isConfigured).length,
      unconfiguredCount: filtered.filter(r => !r.isConfigured).length,
      zeroMarksConfiguredCount: filtered.filter(r => r.isConfigured && r.totalMaximumMarks === 0).length
    };

    if (configStatus && configStatus !== 'ALL') {
      const cleanCfg = configStatus.toUpperCase();
      filtered = filtered.filter(r => r.status === cleanCfg);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(r =>
        r.examinationName.toLowerCase().includes(q) ||
        r.examinationCode.toLowerCase().includes(q) ||
        r.className.toLowerCase().includes(q) ||
        r.subjectName.toLowerCase().includes(q) ||
        r.subjectCode.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => {
      const exCmp = a.examinationName.localeCompare(b.examinationName);
      if (exCmp !== 0) return exCmp;
      const clsCmp = a.className.localeCompare(b.className);
      if (clsCmp !== 0) return clsCmp;
      return a.subjectName.localeCompare(b.subjectName);
    });

    const totalRecords = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      configurations: paginated,
      summary,
      filterOptions: {
        examinations: scopeExams.map(e => ({
          _id: e._id,
          examinationCode: e.examinationCode,
          examinationName: e.examinationName,
          status: e.status
        })),
        classes: activeClasses,
        subjects: activeSubjects
      },
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * 4.5 Marks Entry Monitoring (Read-Only)
   */
  static async getMarksEntryMonitoring({
    schoolId,
    academicYearId,
    examinationId = 'ALL',
    classId = 'ALL',
    subjectId = 'ALL',
    teacherId = 'ALL',
    submissionStatus = 'ALL',
    search = '',
    page = 1,
    limit = 10
  }) {
    if (!schoolId) {
      throw new Error('School identification is required.');
    }
    const sId = schoolId.toUpperCase();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const { selectedYear, academicYears, isAllYears, invalidYear } =
      await this.resolveExaminationYearScope(sId, academicYearId);

    const [activeClasses, activeSubjects, activeTeachers] = await Promise.all([
      ClassInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ className: 1 }).select('_id classCode className').lean(),
      SubjectInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ subjectName: 1 }).select('_id subjectCode subjectName').lean(),
      UserInfo.find({ schoolId: sId, roleCode: 'TEACHER', status: 'ACTIVE' }).select('_id userId fullName').sort({ fullName: 1 }).lean()
    ]);

    const marksModuleStatus = {
      isMarksCollectionAvailable: true,
      message: 'Live marks-entry tracking enabled from Teacher submissions.'
    };

    if (invalidYear || (!isAllYears && !selectedYear)) {
      return {
        selectedAcademicYear: null,
        availableAcademicYears: academicYears,
        entries: [],
        summary: {
          totalEntries: 0,
          pendingCount: 0,
          inProgressCount: 0,
          completedCount: 0,
          submittedCount: 0,
          totalStudentsSum: 0,
          totalMarksEnteredSum: 0,
          overallProgressPercentage: 0
        },
        marksModuleStatus,
        filterOptions: { examinations: [], classes: activeClasses, subjects: activeSubjects, teachers: activeTeachers },
        pagination: { totalRecords: 0, currentPage: pageNum, totalPages: 1, limit: limitNum }
      };
    }

    const examQuery = { schoolId: sId };
    if (!isAllYears && selectedYear) {
      examQuery.academicYearRef = selectedYear._id;
    }

    const scopeExams = await ExaminationInfo.find(examQuery)
      .populate('academicYearRef', 'yearName yearCode')
      .sort({ createdAt: -1 })
      .lean();

    const scopeExamIds = scopeExams.map(e => e._id);
    if (scopeExamIds.length === 0) {
      return {
        selectedAcademicYear: selectedYear,
        availableAcademicYears: academicYears,
        entries: [],
        summary: {
          totalEntries: 0,
          pendingCount: 0,
          inProgressCount: 0,
          completedCount: 0,
          submittedCount: 0,
          totalStudentsSum: 0,
          totalMarksEnteredSum: 0,
          overallProgressPercentage: 0
        },
        marksModuleStatus,
        filterOptions: { examinations: [], classes: activeClasses, subjects: activeSubjects, teachers: activeTeachers },
        pagination: { totalRecords: 0, currentPage: pageNum, totalPages: 1, limit: limitNum }
      };
    }

    const [
      examClassDocs,
      examSubjectDocs,
      sectionDocs,
      teacherAssignmentDocs,
      enrollmentAgg,
      submissionDocs
    ] = await Promise.all([
      ExaminationClassInfo.find({
        schoolId: sId,
        examinationRef: { $in: scopeExamIds },
        status: 'ACTIVE'
      }).lean(),
      ExaminationSubjectInfo.find({
        schoolId: sId,
        examinationRef: { $in: scopeExamIds },
        status: 'ACTIVE'
      }).lean(),
      SectionInfo.find({ schoolId: sId, status: 'ACTIVE' }).sort({ sectionName: 1 }).lean(),
      SubjectTeacherAssignmentInfo.find({
        schoolId: sId,
        ...(!isAllYears && selectedYear ? { academicYearRef: selectedYear._id } : {}),
        status: 'ACTIVE'
      }).lean(),
      StudentEnrollmentInfo.aggregate([
        {
          $match: {
            schoolId: sId,
            status: 'ACTIVE',
            ...(!isAllYears && selectedYear ? { academicYearRef: selectedYear._id } : {})
          }
        },
        {
          $group: {
            _id: {
              academicYearRef: '$academicYearRef',
              classRef: '$classRef',
              sectionRef: '$sectionRef'
            },
            count: { $sum: 1 }
          }
        }
      ]),
      MarksSubmissionInfo.find({
        schoolId: sId,
        examinationRef: { $in: scopeExamIds }
      }).lean()
    ]);

    const submissionByKey = new Map();
    for (const sub of submissionDocs) {
      if (!sub.examinationRef) continue;
      submissionByKey.set(
        `${sub.examinationRef.toString()}_${sub.classRef.toString()}_${sub.sectionRef.toString()}_${sub.subjectRef.toString()}`,
        sub
      );
    }

    const examMap = new Map();
    for (const ex of scopeExams) {
      examMap.set(ex._id.toString(), ex);
    }

    const examClassMap = new Map();
    for (const ec of examClassDocs) {
      examClassMap.set(`${ec.examinationRef.toString()}_${ec.classRef.toString()}`, ec);
    }

    const sectionsByClass = new Map();
    for (const sec of sectionDocs) {
      const cKey = sec.classRef.toString();
      if (!sectionsByClass.has(cKey)) sectionsByClass.set(cKey, []);
      sectionsByClass.get(cKey).push(sec);
    }

    const assignmentMap = new Map();
    for (const a of teacherAssignmentDocs) {
      assignmentMap.set(
        `${a.academicYearRef.toString()}_${a.classRef.toString()}_${a.sectionRef.toString()}_${a.subjectRef.toString()}`,
        a
      );
    }

    const sectionEnrollmentMap = new Map();
    const classEnrollmentMap = new Map();
    for (const item of enrollmentAgg) {
      const ay = item._id.academicYearRef?.toString();
      const cls = item._id.classRef?.toString();
      const sec = item._id.sectionRef?.toString();
      if (ay && cls) {
        classEnrollmentMap.set(`${ay}_${cls}`, (classEnrollmentMap.get(`${ay}_${cls}`) || 0) + item.count);
        if (sec) {
          sectionEnrollmentMap.set(`${ay}_${cls}_${sec}`, item.count);
        }
      }
    }

    const classInfoMap = new Map();
    for (const c of activeClasses) {
      classInfoMap.set(c._id.toString(), c);
    }

    const rows = [];
    for (const es of examSubjectDocs) {
      const ex = examMap.get(es.examinationRef.toString());
      if (!ex) continue;
      const ec = examClassMap.get(`${es.examinationRef.toString()}_${es.classRef.toString()}`);
      if (!ec) continue; // Skip if class was deactivated from examination

      const ayId = (ex.academicYearRef?._id || ex.academicYearRef).toString();
      const cId = es.classRef.toString();
      const clsMeta = classInfoMap.get(cId);
      const className = ec.className || clsMeta?.className || 'N/A';
      const classCode = ec.classCode || clsMeta?.classCode || '';

      const classSections = sectionsByClass.get(cId) || [];

      if (classSections.length > 0) {
        for (const sec of classSections) {
          const totalStudents = sectionEnrollmentMap.get(`${ayId}_${cId}_${sec._id.toString()}`) || 0;
          const assign = assignmentMap.get(`${ayId}_${cId}_${sec._id.toString()}_${es.subjectRef.toString()}`);
          const subDoc = submissionByKey.get(`${ex._id.toString()}_${cId}_${sec._id.toString()}_${es.subjectRef.toString()}`);

          const marksEntered = subDoc ? Math.min(totalStudents || subDoc.totalStudents || 0, subDoc.enteredCount || 0) : 0;
          const pending = Math.max(0, totalStudents - marksEntered);
          const progressPercentage = totalStudents > 0 ? Math.round((marksEntered / totalStudents) * 100) : 0;
          let rowStatus = 'PENDING';
          if (subDoc) {
            if (subDoc.status === 'DRAFT' && subDoc.enteredCount === 0 && !subDoc.lastEnteredBy) {
              rowStatus = 'PENDING';
            } else if (subDoc.status === 'DRAFT') {
              rowStatus = 'IN_PROGRESS';
            } else {
              rowStatus = subDoc.status;
            }
          }

          rows.push({
            _id: `${es._id}_${sec._id}`,
            examinationSubjectId: es._id,
            examinationId: ex._id,
            examinationCode: ex.examinationCode,
            examinationName: ex.examinationName,
            examinationStatus: ex.status,
            academicYearRef: ayId,
            academicYearName: ex.academicYearRef?.yearName || 'N/A',
            classId: es.classRef,
            classCode,
            className,
            sectionId: sec._id,
            sectionCode: sec.sectionCode,
            sectionName: sec.sectionName,
            subjectId: es.subjectRef,
            subjectCode: es.subjectCode,
            subjectName: es.subjectName,
            subjectType: es.subjectType,
            totalMaximumMarks: es.totalMaximumMarks,
            assignedTeacherRef: assign?.teacherUserRef || null,
            assignedTeacherName: assign?.teacherName || null,
            assignedTeacherUserId: assign?.teacherUserId || null,
            assignedTeacherEmail: assign?.teacherEmail || null,
            hasAssignedTeacher: !!assign,
            totalStudents,
            marksEntered,
            pending,
            progressPercentage,
            submissionStatus: rowStatus,
            isLocked: Boolean(subDoc?.isLocked)
          });
        }
      } else {
        const totalStudents = classEnrollmentMap.get(`${ayId}_${cId}`) || 0;
        const marksEntered = 0;
        const pending = totalStudents;
        const progressPercentage = totalStudents > 0 ? Math.round((marksEntered / totalStudents) * 100) : 0;

        rows.push({
          _id: `${es._id}_CLASS`,
          examinationSubjectId: es._id,
          examinationId: ex._id,
          examinationCode: ex.examinationCode,
          examinationName: ex.examinationName,
          examinationStatus: ex.status,
          academicYearRef: ayId,
          academicYearName: ex.academicYearRef?.yearName || 'N/A',
          classId: es.classRef,
          classCode,
          className,
          sectionId: null,
          sectionCode: '',
          sectionName: null,
          subjectId: es.subjectRef,
          subjectCode: es.subjectCode,
          subjectName: es.subjectName,
          subjectType: es.subjectType,
          totalMaximumMarks: es.totalMaximumMarks,
          assignedTeacherRef: null,
          assignedTeacherName: null,
          assignedTeacherUserId: null,
          assignedTeacherEmail: null,
          hasAssignedTeacher: false,
          totalStudents,
          marksEntered,
          pending,
          progressPercentage,
          submissionStatus: 'PENDING'
        });
      }
    }

    // Apply filters
    let filtered = rows;
    if (examinationId && examinationId !== 'ALL') {
      filtered = filtered.filter(r => r.examinationId.toString() === examinationId.toString());
    }
    if (classId && classId !== 'ALL') {
      filtered = filtered.filter(r => r.classId.toString() === classId.toString());
    }
    if (subjectId && subjectId !== 'ALL') {
      filtered = filtered.filter(r => r.subjectId.toString() === subjectId.toString());
    }
    if (teacherId && teacherId !== 'ALL') {
      if (teacherId === 'UNASSIGNED') {
        filtered = filtered.filter(r => !r.hasAssignedTeacher);
      } else {
        filtered = filtered.filter(r => r.assignedTeacherRef && r.assignedTeacherRef.toString() === teacherId.toString());
      }
    }

    const totalStudentsSum = filtered.reduce((s, r) => s + r.totalStudents, 0);
    const totalMarksEnteredSum = filtered.reduce((s, r) => s + r.marksEntered, 0);

    const summary = {
      totalEntries: filtered.length,
      pendingCount: filtered.filter(r => r.submissionStatus === 'PENDING').length,
      inProgressCount: filtered.filter(r => r.submissionStatus === 'IN_PROGRESS').length,
      completedCount: filtered.filter(r => r.submissionStatus === 'COMPLETED').length,
      submittedCount: filtered.filter(r => r.submissionStatus === 'SUBMITTED').length,
      totalStudentsSum,
      totalMarksEnteredSum,
      overallProgressPercentage:
        totalStudentsSum > 0 ? Math.round((totalMarksEnteredSum / totalStudentsSum) * 100) : 0
    };

    if (submissionStatus && submissionStatus !== 'ALL') {
      const cleanSub = submissionStatus.toUpperCase();
      filtered = filtered.filter(r => r.submissionStatus === cleanSub);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(r =>
        r.examinationName.toLowerCase().includes(q) ||
        r.className.toLowerCase().includes(q) ||
        (r.sectionName && r.sectionName.toLowerCase().includes(q)) ||
        r.subjectName.toLowerCase().includes(q) ||
        r.subjectCode.toLowerCase().includes(q) ||
        (r.assignedTeacherName && r.assignedTeacherName.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => {
      const exCmp = a.examinationName.localeCompare(b.examinationName);
      if (exCmp !== 0) return exCmp;
      const clsCmp = a.className.localeCompare(b.className);
      if (clsCmp !== 0) return clsCmp;
      const secCmp = (a.sectionName || '').localeCompare(b.sectionName || '');
      if (secCmp !== 0) return secCmp;
      return a.subjectName.localeCompare(b.subjectName);
    });

    const totalRecords = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    return {
      selectedAcademicYear: selectedYear,
      availableAcademicYears: academicYears,
      entries: paginated,
      summary,
      marksModuleStatus,
      filterOptions: {
        examinations: scopeExams.map(e => ({
          _id: e._id,
          examinationCode: e.examinationCode,
          examinationName: e.examinationName,
          status: e.status
        })),
        classes: activeClasses,
        subjects: activeSubjects,
        teachers: activeTeachers
      },
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * 4.6 Marks Entry Monitoring Details (Read-Only View Progress Modal)
   */
  static async getMarksEntryMonitoringDetails({
    schoolId,
    examinationId,
    classId,
    sectionId,
    subjectId
  }) {
    if (!schoolId) {
      throw new Error('School identification is required.');
    }
    const sId = schoolId.toUpperCase();

    if (
      !examinationId || !mongoose.Types.ObjectId.isValid(examinationId) ||
      !classId || !mongoose.Types.ObjectId.isValid(classId) ||
      !subjectId || !mongoose.Types.ObjectId.isValid(subjectId)
    ) {
      const err = new Error('Valid examinationId, classId, and subjectId are required.');
      err.statusCode = 400;
      throw err;
    }

    const exam = await ExaminationInfo.findOne({ _id: examinationId, schoolId: sId })
      .populate('academicYearRef', 'yearName yearCode')
      .lean();

    if (!exam) {
      const err = new Error('Examination record not found for your school.');
      err.statusCode = 404;
      throw err;
    }

    const ayId = exam.academicYearRef?._id || exam.academicYearRef;

    const [classDoc, examSubject, sectionDoc] = await Promise.all([
      ClassInfo.findOne({ _id: classId, schoolId: sId }).select('_id classCode className').lean(),
      ExaminationSubjectInfo.findOne({
        schoolId: sId,
        examinationRef: examinationId,
        classRef: classId,
        subjectRef: subjectId,
        status: 'ACTIVE'
      }).lean(),
      sectionId && mongoose.Types.ObjectId.isValid(sectionId)
        ? SectionInfo.findOne({ _id: sectionId, classRef: classId, schoolId: sId }).select('_id sectionCode sectionName').lean()
        : Promise.resolve(null)
    ]);

    if (!classDoc || !examSubject) {
      const err = new Error('Examination subject configuration not found for the selected class.');
      err.statusCode = 404;
      throw err;
    }

    const [components, assignment, enrollments, subDoc] = await Promise.all([
      ExaminationComponentInfo.find({
        schoolId: sId,
        examinationSubjectRef: examSubject._id
      })
        .sort({ sequence: 1 })
        .lean(),
      sectionDoc
        ? SubjectTeacherAssignmentInfo.findOne({
            schoolId: sId,
            academicYearRef: ayId,
            classRef: classId,
            sectionRef: sectionDoc._id,
            subjectRef: subjectId,
            status: 'ACTIVE'
          }).lean()
        : Promise.resolve(null),
      StudentEnrollmentInfo.find({
        schoolId: sId,
        academicYearRef: ayId,
        classRef: classId,
        ...(sectionDoc ? { sectionRef: sectionDoc._id } : {}),
        status: 'ACTIVE'
      })
        .populate('studentRef', 'admissionNumber firstName middleName lastName status')
        .populate('sectionRef', 'sectionName sectionCode')
        .sort({ rollNumber: 1 })
        .lean(),
      sectionDoc
        ? MarksSubmissionInfo.findOne({
            schoolId: sId,
            academicYearRef: ayId,
            examinationRef: examinationId,
            classRef: classId,
            sectionRef: sectionDoc._id,
            subjectRef: subjectId
          }).lean()
        : Promise.resolve(null)
    ]);

    const entries = subDoc
      ? await MarksEntryInfo.find({ submissionRef: subDoc._id }).lean()
      : [];
    const entryByStu = new Map(entries.map(ent => [ent.studentRef.toString(), ent]));

    const pendingStudents = enrollments
      .filter(e => e.studentRef)
      .map(e => {
        const ent = entryByStu.get(e.studentRef._id.toString());
        const hasMarks = Boolean(ent && (ent.isAbsent || ent.totalMarksObtained !== null || ent.grade));
        return {
          studentId: e.studentRef._id,
          admissionNumber: e.studentRef.admissionNumber,
          rollNumber: e.rollNumber || '—',
          fullName: [e.studentRef.firstName, e.studentRef.middleName, e.studentRef.lastName].filter(Boolean).join(' '),
          sectionName: e.sectionRef?.sectionName || sectionDoc?.sectionName || '—',
          marksObtained: ent ? (ent.isAbsent ? 'AB' : (ent.grade || ent.totalMarksObtained)) : null,
          status: hasMarks ? (subDoc?.status || 'ENTERED') : 'PENDING'
        };
      });

    const totalStudents = pendingStudents.length;
    const marksEntered = pendingStudents.filter(s => s.status !== 'PENDING').length;
    const pending = Math.max(0, totalStudents - marksEntered);
    const progressPercentage = totalStudents > 0 ? Math.round((marksEntered / totalStudents) * 100) : 0;

    return {
      examination: {
        _id: exam._id,
        examinationCode: exam.examinationCode,
        examinationName: exam.examinationName,
        startDate: exam.startDate,
        endDate: exam.endDate,
        status: exam.status,
        academicYearName: exam.academicYearRef?.yearName || 'N/A'
      },
      classInfo: classDoc,
      sectionInfo: sectionDoc,
      subjectInfo: {
        subjectId: examSubject.subjectRef,
        subjectCode: examSubject.subjectCode,
        subjectName: examSubject.subjectName,
        subjectType: examSubject.subjectType,
        totalMaximumMarks: examSubject.totalMaximumMarks,
        components: components.map(c => ({
          _id: c._id,
          componentName: c.componentName,
          maximumMarks: c.maximumMarks,
          sequence: c.sequence
        }))
      },
      assignedTeacher: assignment
        ? {
            isAssigned: true,
            teacherName: assignment.teacherName,
            teacherUserId: assignment.teacherUserId,
            teacherEmail: assignment.teacherEmail
          }
        : {
            isAssigned: false,
            teacherName: null,
            teacherUserId: null,
            teacherEmail: null
          },
      progress: {
        totalStudents,
        marksEntered,
        pending,
        progressPercentage,
        submissionStatus: subDoc ? subDoc.status : 'PENDING',
        isLocked: Boolean(subDoc?.isLocked)
      },
      pendingStudents,
      isMarksModuleActive: true
    };
  }
}

module.exports = HeadTeacherService;
