const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const UserInfo = require('../models/userInfo.model');
const EmployeeInfo = require('../models/employeeInfo.model');

class ClassSectionService {
  /**
   * Helper to recalculate and sync Class Total Capacity & actual sections
   */
  static async recalculateClassCapacity(classId) {
    const sections = await SectionInfo.find({ classRef: classId, status: 'ACTIVE' });
    const totalCap = sections.reduce((sum, s) => sum + (s.maxCapacity || 0), 0);

    await ClassInfo.findByIdAndUpdate(classId, {
      totalCapacity: totalCap
    });

    return totalCap;
  }

  /**
   * Get eligible teachers for Class Teacher & Section Teacher dropdowns
   * Includes active Teachers and active Head Teacher
   */
  static async getEligibleTeachers(schoolId) {
    const users = await UserInfo.find({
      schoolId,
      roleCode: { $in: ['TEACHER', 'HEAD_TEACHER'] },
      status: 'ACTIVE'
    }).populate('employeeRef');

    return users.map(u => ({
      userId: u.userId,
      employeeId: u.employeeRef?._id,
      fullName: u.employeeRef?.fullName || u.userId,
      roleCode: u.roleCode,
      roleName: u.roleName,
      email: u.email
    }));
  }

  // ==========================================
  // CLASS MANAGEMENT
  // ==========================================

  /**
   * List classes with search, status filter, and pagination
   */
  static async listClasses({ schoolId, search = '', status = '', page = 1, limit = 10 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const query = { schoolId };
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    const classes = await ClassInfo.find(query)
      .populate('classTeacherRef')
      .sort({ className: 1 });

    // Fetch actual section count and ensure up-to-date capacity for each class
    const enhanced = await Promise.all(
      classes.map(async (c) => {
        const actualSectionsCount = await SectionInfo.countDocuments({ classRef: c._id });
        const activeSections = await SectionInfo.find({ classRef: c._id, status: 'ACTIVE' });
        const calculatedCap = activeSections.reduce((sum, s) => sum + (s.maxCapacity || 0), 0);

        return {
          _id: c._id,
          classCode: c.classCode,
          className: c.className,
          classTeacherId: c.classTeacherRef?._id || null,
          classTeacherName: c.classTeacherRef?.fullName || c.classTeacherName || 'Not Assigned',
          plannedSections: c.numberOfSections,
          actualSectionsCount,
          totalCapacity: calculatedCap,
          status: c.status,
          createdAt: c.createdAt
        };
      })
    );

    let filtered = enhanced;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = enhanced.filter(c =>
        c.classCode.toLowerCase().includes(q) || c.className.toLowerCase().includes(q)
      );
    }

    const totalRecords = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    return {
      classes: paginated,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * Create Class
   */
  static async createClass({ schoolId, schoolRef, classCode, className, classTeacherId, numberOfSections }) {
    if (!classCode || !className) {
      throw new Error('Class Code and Class Name are mandatory.');
    }

    const cleanCode = classCode.trim().toUpperCase();
    const cleanName = className.trim();

    // Check unique classCode within school
    const existing = await ClassInfo.findOne({ schoolId, classCode: cleanCode });
    if (existing) {
      throw new Error(`Class Code '${cleanCode}' already exists in this school.`);
    }

    let teacherRef = null;
    let teacherName = '';

    if (classTeacherId) {
      const teacher = await EmployeeInfo.findOne({ _id: classTeacherId, schoolId });
      if (!teacher) {
        throw new Error('Selected Class Teacher is invalid or does not belong to this school.');
      }
      teacherRef = teacher._id;
      teacherName = teacher.fullName;
    }

    const numSections = parseInt(numberOfSections, 10);
    if (isNaN(numSections) || numSections < 1) {
      throw new Error('Number of sections must be a valid positive integer.');
    }

    const newClass = new ClassInfo({
      schoolRef,
      schoolId,
      classCode: cleanCode,
      className: cleanName,
      classTeacherRef: teacherRef,
      classTeacherName: teacherName,
      numberOfSections: numSections,
      totalCapacity: 0,
      status: 'ACTIVE'
    });

    await newClass.save();

    return {
      _id: newClass._id,
      classCode: newClass.classCode,
      className: newClass.className,
      classTeacherName: newClass.classTeacherName,
      numberOfSections: newClass.numberOfSections,
      totalCapacity: 0,
      status: newClass.status
    };
  }

  /**
   * Edit Class
   */
  static async editClass({ schoolId, classId, classCode, className, classTeacherId, numberOfSections }) {
    const classDoc = await ClassInfo.findOne({ _id: classId, schoolId });
    if (!classDoc) {
      throw new Error('Class not found.');
    }

    if (classCode) {
      const cleanCode = classCode.trim().toUpperCase();
      if (cleanCode !== classDoc.classCode) {
        const existing = await ClassInfo.findOne({ schoolId, classCode: cleanCode, _id: { $ne: classId } });
        if (existing) {
          throw new Error(`Class Code '${cleanCode}' already exists in this school.`);
        }
        classDoc.classCode = cleanCode;
      }
    }

    if (className) {
      classDoc.className = className.trim();
    }

    if (classTeacherId !== undefined) {
      if (classTeacherId) {
        const teacher = await EmployeeInfo.findOne({ _id: classTeacherId, schoolId });
        if (!teacher) {
          throw new Error('Selected Class Teacher is invalid or does not belong to this school.');
        }
        classDoc.classTeacherRef = teacher._id;
        classDoc.classTeacherName = teacher.fullName;
      } else {
        classDoc.classTeacherRef = null;
        classDoc.classTeacherName = '';
      }
    }

    if (numberOfSections !== undefined) {
      const numSections = parseInt(numberOfSections, 10);
      if (isNaN(numSections) || numSections < 1) {
        throw new Error('Number of sections must be a valid positive integer.');
      }
      classDoc.numberOfSections = numSections;
    }

    await classDoc.save();

    // Recalculate capacity
    const cap = await this.recalculateClassCapacity(classDoc._id);

    return {
      _id: classDoc._id,
      classCode: classDoc.classCode,
      className: classDoc.className,
      classTeacherName: classDoc.classTeacherName,
      numberOfSections: classDoc.numberOfSections,
      totalCapacity: cap,
      status: classDoc.status
    };
  }

  /**
   * Toggle Class Status
   */
  static async toggleClassStatus({ schoolId, classId, status }) {
    const classDoc = await ClassInfo.findOne({ _id: classId, schoolId });
    if (!classDoc) {
      throw new Error('Class not found.');
    }

    classDoc.status = status.toUpperCase();
    await classDoc.save();

    return {
      _id: classDoc._id,
      className: classDoc.className,
      status: classDoc.status
    };
  }

  // ==========================================
  // SECTION MANAGEMENT
  // ==========================================

  /**
   * List sections with search, class filter, status filter, and pagination
   */
  static async listSections({ schoolId, search = '', classId = '', status = '', page = 1, limit = 10 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const query = { schoolId };
    if (classId && classId !== 'ALL') {
      query.classRef = classId;
    }
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    const sections = await SectionInfo.find(query)
      .populate('classRef')
      .populate('sectionTeacherRef')
      .sort({ className: 1, sectionCode: 1 });

    const formatted = sections.map(s => ({
      _id: s._id,
      sectionCode: s.sectionCode,
      sectionName: s.sectionName,
      classId: s.classRef?._id || s.classRef,
      classCode: s.classCode,
      className: s.className,
      sectionTeacherId: s.sectionTeacherRef?._id || null,
      sectionTeacherName: s.sectionTeacherRef?.fullName || s.sectionTeacherName || 'Not Assigned',
      maxCapacity: s.maxCapacity,
      status: s.status,
      createdAt: s.createdAt
    }));

    let filtered = formatted;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = formatted.filter(s =>
        s.sectionCode.toLowerCase().includes(q) ||
        s.sectionName.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)
      );
    }

    const totalRecords = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    return {
      sections: paginated,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * Create Section
   */
  static async createSection({ schoolId, schoolRef, classId, sectionCode, sectionName, sectionTeacherId, maxCapacity }) {
    if (!classId || !sectionCode || !sectionName || !maxCapacity) {
      throw new Error('Class, Section Code, Section Name, and Maximum Capacity are mandatory.');
    }

    const classDoc = await ClassInfo.findOne({ _id: classId, schoolId });
    if (!classDoc) {
      throw new Error('Selected class not found in this school.');
    }

    const cleanCode = sectionCode.trim().toUpperCase();
    const cleanName = sectionName.trim();
    const capacityNum = parseInt(maxCapacity, 10);

    if (isNaN(capacityNum) || capacityNum < 1) {
      throw new Error('Maximum Capacity must be a positive integer.');
    }

    // Check unique sectionCode within this class in this school
    const existing = await SectionInfo.findOne({
      schoolId,
      classRef: classDoc._id,
      sectionCode: cleanCode
    });
    if (existing) {
      throw new Error(`Section Code '${cleanCode}' already exists for class '${classDoc.className}'.`);
    }

    let teacherRef = null;
    let teacherName = '';

    if (sectionTeacherId) {
      const teacher = await EmployeeInfo.findOne({ _id: sectionTeacherId, schoolId });
      if (!teacher) {
        throw new Error('Selected Section Teacher is invalid or does not belong to this school.');
      }
      teacherRef = teacher._id;
      teacherName = teacher.fullName;
    }

    const section = new SectionInfo({
      schoolRef,
      schoolId,
      classRef: classDoc._id,
      classCode: classDoc.classCode,
      className: classDoc.className,
      sectionCode: cleanCode,
      sectionName: cleanName,
      sectionTeacherRef: teacherRef,
      sectionTeacherName: teacherName,
      maxCapacity: capacityNum,
      status: 'ACTIVE'
    });

    await section.save();

    // Recalculate class capacity
    await this.recalculateClassCapacity(classDoc._id);

    return {
      _id: section._id,
      sectionCode: section.sectionCode,
      sectionName: section.sectionName,
      className: section.className,
      sectionTeacherName: section.sectionTeacherName,
      maxCapacity: section.maxCapacity,
      status: section.status
    };
  }

  /**
   * Edit Section
   */
  static async editSection({ schoolId, sectionId, classId, sectionCode, sectionName, sectionTeacherId, maxCapacity }) {
    const section = await SectionInfo.findOne({ _id: sectionId, schoolId });
    if (!section) {
      throw new Error('Section not found.');
    }

    const oldClassId = section.classRef;

    if (classId && classId.toString() !== section.classRef.toString()) {
      const targetClass = await ClassInfo.findOne({ _id: classId, schoolId });
      if (!targetClass) {
        throw new Error('Target class not found.');
      }
      section.classRef = targetClass._id;
      section.classCode = targetClass.classCode;
      section.className = targetClass.className;
    }

    if (sectionCode) {
      const cleanCode = sectionCode.trim().toUpperCase();
      if (cleanCode !== section.sectionCode) {
        const existing = await SectionInfo.findOne({
          schoolId,
          classRef: section.classRef,
          sectionCode: cleanCode,
          _id: { $ne: sectionId }
        });
        if (existing) {
          throw new Error(`Section Code '${cleanCode}' already exists for this class.`);
        }
        section.sectionCode = cleanCode;
      }
    }

    if (sectionName) {
      section.sectionName = sectionName.trim();
    }

    if (maxCapacity !== undefined) {
      const capacityNum = parseInt(maxCapacity, 10);
      if (isNaN(capacityNum) || capacityNum < 1) {
        throw new Error('Maximum Capacity must be a positive integer.');
      }
      section.maxCapacity = capacityNum;
    }

    if (sectionTeacherId !== undefined) {
      if (sectionTeacherId) {
        const teacher = await EmployeeInfo.findOne({ _id: sectionTeacherId, schoolId });
        if (!teacher) {
          throw new Error('Selected Section Teacher is invalid or does not belong to this school.');
        }
        section.sectionTeacherRef = teacher._id;
        section.sectionTeacherName = teacher.fullName;
      } else {
        section.sectionTeacherRef = null;
        section.sectionTeacherName = '';
      }
    }

    await section.save();

    // Recalculate capacity for both old and new class if class changed
    await this.recalculateClassCapacity(section.classRef);
    if (oldClassId.toString() !== section.classRef.toString()) {
      await this.recalculateClassCapacity(oldClassId);
    }

    return {
      _id: section._id,
      sectionCode: section.sectionCode,
      sectionName: section.sectionName,
      className: section.className,
      sectionTeacherName: section.sectionTeacherName,
      maxCapacity: section.maxCapacity,
      status: section.status
    };
  }

  /**
   * Toggle Section Status
   */
  static async toggleSectionStatus({ schoolId, sectionId, status }) {
    const section = await SectionInfo.findOne({ _id: sectionId, schoolId });
    if (!section) {
      throw new Error('Section not found.');
    }

    section.status = status.toUpperCase();
    await section.save();

    // Recalculate class capacity
    await this.recalculateClassCapacity(section.classRef);

    return {
      _id: section._id,
      sectionName: section.sectionName,
      status: section.status
    };
  }
}

module.exports = ClassSectionService;
