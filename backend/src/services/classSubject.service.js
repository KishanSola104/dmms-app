const mongoose = require('mongoose');
const ClassSubjectInfo = require('../models/classSubjectInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SubjectInfo = require('../models/subjectInfo.model');
const AcademicYearInfo = require('../models/academicYearInfo.model');

class ClassSubjectService {
  /**
   * Helper to validate additional components structure
   */
  static validateAdditionalComponents(components = []) {
    if (!Array.isArray(components) || components.length === 0) {
      throw new Error('At least one additional component is required when additional components are enabled.');
    }

    const seenNames = new Set();
    const cleaned = [];
    let totalMarks = 0;

    for (const comp of components) {
      const name = (comp.componentName || '').trim();
      const marks = Number(comp.maximumMarks);

      if (!name) {
        throw new Error('Component name cannot be empty.');
      }

      const nameLower = name.toLowerCase();
      if (seenNames.has(nameLower)) {
        throw new Error(`Duplicate component name '${name}' found in the same subject allocation.`);
      }
      seenNames.add(nameLower);

      if (isNaN(marks) || marks <= 0) {
        throw new Error(`Maximum marks for '${name}' must be a valid positive number greater than 0.`);
      }

      totalMarks += marks;
      cleaned.push({
        componentName: name,
        maximumMarks: marks
      });
    }

    return { cleaned, totalMarks };
  }

  /**
   * List allocated subjects for a specific class and academic year
   */
  static async listAllocations({
    schoolId,
    academicYearRef,
    classRef,
    search = '',
    type = '',
    status = '',
    page = 1,
    limit = 10
  }) {
    if (!academicYearRef || !classRef) {
      return {
        allocations: [],
        pagination: {
          totalRecords: 0,
          currentPage: 1,
          totalPages: 1,
          limit: Number(limit) || 10
        }
      };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const query = {
      schoolId,
      academicYearRef: new mongoose.Types.ObjectId(academicYearRef),
      classRef: new mongoose.Types.ObjectId(classRef)
    };

    if (type && type !== 'ALL') {
      query.subjectType = type.toUpperCase();
    }
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    const records = await ClassSubjectInfo.find(query)
      .populate('subjectRef')
      .sort({ subjectName: 1 });

    const formatted = records.map(r => ({
      _id: r._id,
      schoolId: r.schoolId,
      academicYearRef: r.academicYearRef,
      classRef: r.classRef,
      subjectRef: r.subjectRef?._id || r.subjectRef,
      subjectCode: r.subjectCode,
      subjectName: r.subjectName,
      subjectType: r.subjectType,
      subjectTypeLabel: r.subjectType === 'ACADEMIC' ? 'Academic (Scholastic)' : 'Co-curricular (Co-Scholastic)',
      hasAdditionalComponents: r.hasAdditionalComponents,
      additionalComponents: r.additionalComponents || [],
      totalAdditionalMarks: r.totalAdditionalMarks || 0,
      status: r.status,
      createdAt: r.createdAt
    }));

    let filtered = formatted;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = formatted.filter(item =>
        item.subjectCode.toLowerCase().includes(q) || item.subjectName.toLowerCase().includes(q)
      );
    }

    const totalRecords = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    return {
      allocations: paginated,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * Get available subjects from school subject pool with allocation status for a class & year
   */
  static async getAvailableSubjectsForClass({ schoolId, academicYearRef, classRef }) {
    if (!academicYearRef || !classRef) {
      throw new Error('Academic Year and Class are required to fetch available subjects.');
    }

    // 1. Fetch all active subjects in school
    const allSubjects = await SubjectInfo.find({
      schoolId,
      status: 'ACTIVE'
    }).sort({ subjectName: 1 });

    // 2. Fetch existing allocations for this class in this academic year
    const existingAllocations = await ClassSubjectInfo.find({
      schoolId,
      academicYearRef: new mongoose.Types.ObjectId(academicYearRef),
      classRef: new mongoose.Types.ObjectId(classRef)
    });

    const allocationMap = new Map();
    existingAllocations.forEach(alloc => {
      allocationMap.set(alloc.subjectRef.toString(), alloc);
    });

    // 3. Map subjects with allocation status
    return allSubjects.map(sub => {
      const existing = allocationMap.get(sub._id.toString());
      return {
        _id: sub._id,
        subjectCode: sub.subjectCode,
        subjectName: sub.subjectName,
        subjectType: sub.subjectType,
        subjectTypeLabel: sub.subjectType === 'ACADEMIC' ? 'Academic (Scholastic)' : 'Co-curricular (Co-Scholastic)',
        isAllocated: Boolean(existing && existing.status === 'ACTIVE'),
        allocationId: existing ? existing._id : null,
        allocationStatus: existing ? existing.status : null,
        hasAdditionalComponents: existing ? existing.hasAdditionalComponents : false,
        additionalComponents: existing ? existing.additionalComponents : [],
        totalAdditionalMarks: existing ? existing.totalAdditionalMarks : 0
      };
    });
  }

  /**
   * Allocate subjects to a class for a specific academic year
   */
  static async allocateSubjects({
    schoolId,
    schoolRef,
    academicYearRef,
    classRef,
    allocations = []
  }) {
    if (!academicYearRef || !classRef) {
      throw new Error('Academic Year and Class are mandatory.');
    }

    if (!Array.isArray(allocations) || allocations.length === 0) {
      throw new Error('Please select at least one subject to allocate.');
    }

    // Validate Academic Year
    const academicYear = await AcademicYearInfo.findOne({
      _id: academicYearRef,
      schoolId
    });
    if (!academicYear) {
      throw new Error('Academic Year not found or does not belong to your school.');
    }

    // Validate Class
    const classDoc = await ClassInfo.findOne({
      _id: classRef,
      schoolId,
      status: 'ACTIVE'
    });
    if (!classDoc) {
      throw new Error('Selected class not found or is currently inactive.');
    }

    // Validate unique subjectRefs in request payload
    const requestedSubjectIds = new Set();
    for (const alloc of allocations) {
      if (!alloc.subjectRef) {
        throw new Error('Subject reference is required for each allocation.');
      }
      const sId = alloc.subjectRef.toString();
      if (requestedSubjectIds.has(sId)) {
        throw new Error('Duplicate subject found in allocation list.');
      }
      requestedSubjectIds.add(sId);
    }

    // Validate subjects existence in school and active status
    const subjectDocs = await SubjectInfo.find({
      _id: { $in: Array.from(requestedSubjectIds) },
      schoolId,
      status: 'ACTIVE'
    });

    if (subjectDocs.length !== requestedSubjectIds.size) {
      throw new Error('One or more selected subjects were not found or are currently inactive.');
    }

    const subjectMap = new Map();
    subjectDocs.forEach(s => subjectMap.set(s._id.toString(), s));

    // Check for existing allocations in this academic year and class
    const existingAllocations = await ClassSubjectInfo.find({
      schoolId,
      academicYearRef: new mongoose.Types.ObjectId(academicYearRef),
      classRef: new mongoose.Types.ObjectId(classRef),
      subjectRef: { $in: Array.from(requestedSubjectIds) }
    });

    const existingMap = new Map();
    existingAllocations.forEach(ea => existingMap.set(ea.subjectRef.toString(), ea));

    const savedAllocations = [];

    for (const alloc of allocations) {
      const subject = subjectMap.get(alloc.subjectRef.toString());
      const existing = existingMap.get(alloc.subjectRef.toString());

      if (existing && existing.status === 'ACTIVE') {
        throw new Error(`Subject '${subject.subjectName}' (${subject.subjectCode}) is already allocated to ${classDoc.className} in academic year ${academicYear.yearName}.`);
      }

      let hasAdditional = Boolean(alloc.hasAdditionalComponents);
      let cleanedComponents = [];
      let totalAdditionalMarks = 0;

      if (hasAdditional) {
        const validated = ClassSubjectService.validateAdditionalComponents(alloc.additionalComponents);
        cleanedComponents = validated.cleaned;
        totalAdditionalMarks = validated.totalMarks;
      }

      if (existing) {
        // Reactivate and update existing record
        existing.subjectCode = subject.subjectCode;
        existing.subjectName = subject.subjectName;
        existing.subjectType = subject.subjectType;
        existing.hasAdditionalComponents = hasAdditional;
        existing.additionalComponents = cleanedComponents;
        existing.totalAdditionalMarks = totalAdditionalMarks;
        existing.status = 'ACTIVE';
        await existing.save();
        savedAllocations.push(existing);
      } else {
        const newAlloc = new ClassSubjectInfo({
          schoolRef,
          schoolId,
          academicYearRef,
          classRef,
          subjectRef: subject._id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          subjectType: subject.subjectType,
          hasAdditionalComponents: hasAdditional,
          additionalComponents: cleanedComponents,
          totalAdditionalMarks,
          status: 'ACTIVE'
        });
        await newAlloc.save();
        savedAllocations.push(newAlloc);
      }
    }

    return savedAllocations;
  }

  /**
   * Update an existing allocation (e.g. modify additional/project components)
   */
  static async updateAllocation({
    schoolId,
    allocationId,
    hasAdditionalComponents,
    additionalComponents = []
  }) {
    const allocation = await ClassSubjectInfo.findOne({
      _id: allocationId,
      schoolId
    });

    if (!allocation) {
      throw new Error('Subject allocation record not found.');
    }

    const hasAdditional = Boolean(hasAdditionalComponents);
    let cleanedComponents = [];
    let totalAdditionalMarks = 0;

    if (hasAdditional) {
      const validated = ClassSubjectService.validateAdditionalComponents(additionalComponents);
      cleanedComponents = validated.cleaned;
      totalAdditionalMarks = validated.totalMarks;
    }

    allocation.hasAdditionalComponents = hasAdditional;
    allocation.additionalComponents = cleanedComponents;
    allocation.totalAdditionalMarks = totalAdditionalMarks;

    await allocation.save();

    return allocation;
  }

  /**
   * Toggle Allocation status (ACTIVE / INACTIVE)
   */
  static async toggleAllocationStatus({ schoolId, allocationId, status }) {
    const allocation = await ClassSubjectInfo.findOne({
      _id: allocationId,
      schoolId
    });

    if (!allocation) {
      throw new Error('Subject allocation record not found.');
    }

    const cleanStatus = status.toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(cleanStatus)) {
      throw new Error("Status must be either 'ACTIVE' or 'INACTIVE'.");
    }

    // Dependency check: If deactivating, ensure no active teacher assignment exists
    if (cleanStatus === 'INACTIVE') {
      const SubjectTeacherAssignmentInfo = mongoose.models.SubjectTeacherAssignmentInfo;
      if (SubjectTeacherAssignmentInfo) {
        const activeAssignment = await SubjectTeacherAssignmentInfo.findOne({
          classSubjectRef: allocation._id,
          status: 'ACTIVE'
        });
        if (activeAssignment) {
          throw new Error('Cannot deactivate subject allocation because an active teacher assignment is linked to it. Deactivate the teacher assignment first.');
        }
      }
    }

    allocation.status = cleanStatus;
    await allocation.save();

    return allocation;
  }
}

module.exports = ClassSubjectService;
