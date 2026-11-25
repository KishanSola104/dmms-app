const SubjectTeacherAssignmentInfo = require('../models/subjectTeacherAssignmentInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');

class TeacherAccessService {
  /**
   * Compute actual teaching & class-teacher responsibilities for an authenticated user.
   * Supports both TEACHER role and HEAD_TEACHER role with teaching assignments.
   */
  static async getTeacherAccessContext(user) {
    if (!user) {
      return {
        hasTeachingAccess: false,
        isTeacherRole: false,
        isHeadTeacherWithDuties: false,
        hasSubjectAssignments: false,
        hasClassTeacherAssignments: false,
        classTeacherSectionIds: [],
        assignedSectionSubjectKeys: []
      };
    }

    const roleCode = (user.roleCode || '').toUpperCase();
    const schoolId = (user.schoolId || '').toUpperCase();
    const employeeRef = user.employeeRef?._id || user.employeeRef;
    const userRef = user._id;

    if (!['TEACHER', 'HEAD_TEACHER'].includes(roleCode)) {
      return {
        hasTeachingAccess: false,
        isTeacherRole: false,
        isHeadTeacherWithDuties: false,
        hasSubjectAssignments: false,
        hasClassTeacherAssignments: false,
        classTeacherSectionIds: [],
        assignedSectionSubjectKeys: []
      };
    }

    const [subjectAssignments, assignedClasses, assignedSections] = await Promise.all([
      SubjectTeacherAssignmentInfo.find({
        schoolId,
        status: 'ACTIVE',
        $or: [
          { teacherUserRef: userRef },
          ...(employeeRef ? [{ teacherEmployeeRef: employeeRef }] : [])
        ]
      })
        .select('academicYearRef classRef sectionRef subjectRef subjectType')
        .lean(),
      employeeRef
        ? ClassInfo.find({ schoolId, classTeacherRef: employeeRef, status: 'ACTIVE' })
            .select('_id classCode className')
            .lean()
        : Promise.resolve([]),
      employeeRef
        ? SectionInfo.find({ schoolId, sectionTeacherRef: employeeRef, status: 'ACTIVE' })
            .select('_id classRef sectionCode sectionName')
            .lean()
        : Promise.resolve([])
    ]);

    // Resolve sections belonging to classes where user is classTeacherRef,
    // ONLY if the section does not explicitly override sectionTeacherRef with another employee
    let sectionsFromAssignedClasses = [];
    if (assignedClasses.length > 0 && employeeRef) {
      const empStr = employeeRef.toString();
      const rawClassSections = await SectionInfo.find({
        schoolId,
        classRef: { $in: assignedClasses.map(c => c._id) },
        status: 'ACTIVE'
      })
        .select('_id classRef sectionCode sectionName sectionTeacherRef')
        .lean();
      sectionsFromAssignedClasses = rawClassSections.filter(
        sec => !sec.sectionTeacherRef || sec.sectionTeacherRef.toString() === empStr
      );
    }

    const classTeacherSectionMap = new Map();
    for (const sec of [...assignedSections, ...sectionsFromAssignedClasses]) {
      classTeacherSectionMap.set(sec._id.toString(), sec);
    }

    const hasSubjectAssignments = subjectAssignments.length > 0;
    const hasClassTeacherAssignments = classTeacherSectionMap.size > 0;
    const isTeacherRole = roleCode === 'TEACHER';
    const isHeadTeacherWithDuties = roleCode === 'HEAD_TEACHER' && (hasSubjectAssignments || hasClassTeacherAssignments);
    const hasTeachingAccess = isTeacherRole || isHeadTeacherWithDuties;

    return {
      hasTeachingAccess,
      isTeacherRole,
      isHeadTeacherWithDuties,
      hasSubjectAssignments,
      hasClassTeacherAssignments,
      classTeacherSectionIds: Array.from(classTeacherSectionMap.keys()),
      classTeacherSections: Array.from(classTeacherSectionMap.values()),
      assignedClassesCount: assignedClasses.length,
      subjectAssignmentsCount: subjectAssignments.length
    };
  }

  /**
   * Verify whether the user is an authorized Class Teacher for a specific (classId, sectionId).
   * If SectionInfo explicitly sets sectionTeacherRef, only that employee is authorized for that section;
   * otherwise falls back to ClassInfo.classTeacherRef.
   */
  static async isClassTeacherForSection({ schoolId, employeeRef, classId, sectionId }) {
    if (!employeeRef || !classId || !sectionId) return false;
    const sId = schoolId.toUpperCase();
    const empId = employeeRef.toString();

    const [cls, sec] = await Promise.all([
      ClassInfo.findOne({ _id: classId, schoolId: sId, status: 'ACTIVE' }).select('classTeacherRef').lean(),
      SectionInfo.findOne({ _id: sectionId, classRef: classId, schoolId: sId, status: 'ACTIVE' }).select('sectionTeacherRef').lean()
    ]);

    if (!cls || !sec) return false;
    if (sec.sectionTeacherRef) {
      return sec.sectionTeacherRef.toString() === empId;
    }
    if (cls.classTeacherRef) {
      return cls.classTeacherRef.toString() === empId;
    }
    return false;
  }

  /**
   * Verify whether the user is an authorized Subject Teacher for (academicYearId, classId, sectionId, subjectId)
   */
  static async isSubjectTeacherForAssignment({ schoolId, userRef, employeeRef, academicYearId, classId, sectionId, subjectId }) {
    const sId = schoolId.toUpperCase();
    const assign = await SubjectTeacherAssignmentInfo.findOne({
      schoolId: sId,
      academicYearRef: academicYearId,
      classRef: classId,
      sectionRef: sectionId,
      subjectRef: subjectId,
      status: 'ACTIVE',
      $or: [
        { teacherUserRef: userRef },
        ...(employeeRef ? [{ teacherEmployeeRef: employeeRef }] : [])
      ]
    }).lean();

    return assign || null;
  }
}

module.exports = TeacherAccessService;
