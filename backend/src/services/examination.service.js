const mongoose = require('mongoose');
const ExaminationInfo = require('../models/examinationInfo.model');
const ExaminationClassInfo = require('../models/examinationClassInfo.model');
const AcademicYearInfo = require('../models/academicYearInfo.model');
const ClassInfo = require('../models/classInfo.model');

class ExaminationService {
  /**
   * Helper to format dates cleanly
   */
  static parseDates(startDate, endDate) {
    let parsedStart = null;
    let parsedEnd = null;

    if (startDate) {
      parsedStart = new Date(startDate);
      if (isNaN(parsedStart.getTime())) {
        throw new Error('Invalid examination start date format.');
      }
    }

    if (endDate) {
      parsedEnd = new Date(endDate);
      if (isNaN(parsedEnd.getTime())) {
        throw new Error('Invalid examination end date format.');
      }
    }

    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      throw new Error('Examination start date cannot be later than end date.');
    }

    return { parsedStart, parsedEnd };
  }

  /**
   * List examinations with search, status filter, and pagination
   */
  static async listExaminations({
    schoolId,
    academicYearRef,
    search = '',
    status = '',
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
    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    const exams = await ExaminationInfo.find(query)
      .populate('academicYearRef', 'yearName yearCode')
      .sort({ createdAt: -1 });

    // Fetch assigned classes for all returned exams
    const examIds = exams.map(e => e._id);
    const assignedClassDocs = await ExaminationClassInfo.find({
      schoolId,
      examinationRef: { $in: examIds },
      status: 'ACTIVE'
    });

    const classMap = new Map();
    for (const ac of assignedClassDocs) {
      const eId = ac.examinationRef.toString();
      if (!classMap.has(eId)) {
        classMap.set(eId, []);
      }
      classMap.get(eId).push({
        _id: ac._id,
        classRef: ac.classRef,
        classCode: ac.classCode,
        className: ac.className
      });
    }

    const formatted = exams.map(e => {
      const assignedClasses = classMap.get(e._id.toString()) || [];
      return {
        _id: e._id,
        schoolId: e.schoolId,
        academicYearRef: e.academicYearRef?._id || e.academicYearRef,
        academicYearName: e.academicYearRef?.yearName || '',
        academicYearCode: e.academicYearRef?.yearCode || '',
        examinationCode: e.examinationCode,
        examinationName: e.examinationName,
        description: e.description || '',
        startDate: e.startDate,
        endDate: e.endDate,
        status: e.status,
        assignedClasses,
        assignedClassCount: assignedClasses.length,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt
      };
    });

    let filtered = formatted;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = formatted.filter(e =>
        e.examinationCode.toLowerCase().includes(q) ||
        e.examinationName.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.assignedClasses.some(c =>
          c.className.toLowerCase().includes(q) || c.classCode.toLowerCase().includes(q)
        )
      );
    }

    const totalRecords = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    return {
      examinations: paginated,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * Get single examination with assigned classes
   */
  static async getExaminationById({ schoolId, examinationId }) {
    const exam = await ExaminationInfo.findOne({
      _id: examinationId,
      schoolId
    }).populate('academicYearRef', 'yearName yearCode');

    if (!exam) {
      throw new Error('Examination not found.');
    }

    const assignedClasses = await ExaminationClassInfo.find({
      schoolId,
      examinationRef: exam._id,
      status: 'ACTIVE'
    }).sort({ className: 1 });

    return {
      _id: exam._id,
      schoolId: exam.schoolId,
      academicYearRef: exam.academicYearRef?._id || exam.academicYearRef,
      academicYearName: exam.academicYearRef?.yearName || '',
      examinationCode: exam.examinationCode,
      examinationName: exam.examinationName,
      description: exam.description || '',
      startDate: exam.startDate,
      endDate: exam.endDate,
      status: exam.status,
      assignedClasses: assignedClasses.map(c => ({
        _id: c._id,
        classRef: c.classRef,
        classCode: c.classCode,
        className: c.className
      })),
      createdAt: exam.createdAt,
      updatedAt: exam.updatedAt
    };
  }

  /**
   * Create Examination and assign classes
   */
  static async createExamination({
    schoolId,
    schoolRef,
    academicYearRef,
    examinationCode,
    examinationName,
    description = '',
    startDate = null,
    endDate = null,
    status = 'UPCOMING',
    classIds = []
  }) {
    if (!academicYearRef || !examinationCode || !examinationName) {
      throw new Error('Academic Year, Examination Code, and Examination Name are mandatory.');
    }

    const cleanCode = examinationCode.trim().toUpperCase();
    const cleanName = examinationName.trim();
    const cleanDesc = (description || '').trim();
    const cleanStatus = (status || 'UPCOMING').toUpperCase();

    if (!['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'].includes(cleanStatus)) {
      throw new Error("Status must be one of: 'UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'.");
    }

    // Validate Academic Year
    const academicYear = await AcademicYearInfo.findOne({
      _id: academicYearRef,
      schoolId
    });
    if (!academicYear) {
      throw new Error('Academic Year not found or does not belong to your school.');
    }

    // Validate dates
    const { parsedStart, parsedEnd } = ExaminationService.parseDates(startDate, endDate);

    // Validate uniqueness of examinationCode within school & academic year
    const existingCode = await ExaminationInfo.findOne({
      schoolId,
      academicYearRef,
      examinationCode: cleanCode
    });
    if (existingCode) {
      throw new Error(`Examination Code '${cleanCode}' already exists for ${academicYear.yearName}.`);
    }

    // Validate classIds
    if (!Array.isArray(classIds) || classIds.length === 0) {
      throw new Error('Please select at least one class to assign to this examination.');
    }

    const uniqueClassIds = Array.from(new Set(classIds.map(id => id.toString())));
    const classDocs = await ClassInfo.find({
      _id: { $in: uniqueClassIds },
      schoolId,
      status: 'ACTIVE'
    });

    if (classDocs.length !== uniqueClassIds.length) {
      throw new Error('One or more selected classes were not found or are currently inactive.');
    }

    // Create Examination
    const examination = new ExaminationInfo({
      schoolRef,
      schoolId,
      academicYearRef,
      examinationCode: cleanCode,
      examinationName: cleanName,
      description: cleanDesc,
      startDate: parsedStart,
      endDate: parsedEnd,
      status: cleanStatus
    });

    await examination.save();

    // Create ExaminationClassInfo entries
    const classAssignments = classDocs.map(c => ({
      schoolRef,
      schoolId,
      examinationRef: examination._id,
      academicYearRef,
      classRef: c._id,
      classCode: c.classCode,
      className: c.className,
      status: 'ACTIVE'
    }));

    const savedClasses = await ExaminationClassInfo.insertMany(classAssignments);

    return {
      _id: examination._id,
      examinationCode: examination.examinationCode,
      examinationName: examination.examinationName,
      description: examination.description,
      startDate: examination.startDate,
      endDate: examination.endDate,
      status: examination.status,
      assignedClasses: savedClasses.map(c => ({
        _id: c._id,
        classRef: c.classRef,
        classCode: c.classCode,
        className: c.className
      }))
    };
  }

  /**
   * Edit Examination and synchronize assigned classes
   */
  static async editExamination({
    schoolId,
    schoolRef,
    examinationId,
    examinationCode,
    examinationName,
    description,
    startDate,
    endDate,
    status,
    classIds
  }) {
    const examination = await ExaminationInfo.findOne({
      _id: examinationId,
      schoolId
    });
    if (!examination) {
      throw new Error('Examination record not found.');
    }

    if (examinationCode) {
      const cleanCode = examinationCode.trim().toUpperCase();
      if (cleanCode !== examination.examinationCode) {
        const existing = await ExaminationInfo.findOne({
          schoolId,
          academicYearRef: examination.academicYearRef,
          examinationCode: cleanCode,
          _id: { $ne: examination._id }
        });
        if (existing) {
          throw new Error(`Examination Code '${cleanCode}' already exists in this academic year.`);
        }
        examination.examinationCode = cleanCode;
      }
    }

    if (examinationName) {
      examination.examinationName = examinationName.trim();
    }

    if (description !== undefined) {
      examination.description = (description || '').trim();
    }

    const { parsedStart, parsedEnd } = ExaminationService.parseDates(startDate, endDate);
    examination.startDate = parsedStart;
    examination.endDate = parsedEnd;

    if (status) {
      const cleanStatus = status.toUpperCase();
      if (!['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'].includes(cleanStatus)) {
        throw new Error("Status must be one of: 'UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'.");
      }
      examination.status = cleanStatus;
    }

    await examination.save();

    // Synchronize class assignments if classIds provided
    if (classIds && Array.isArray(classIds)) {
      if (classIds.length === 0) {
        throw new Error('At least one class must be assigned to the examination.');
      }

      const uniqueClassIds = Array.from(new Set(classIds.map(id => id.toString())));
      const validClasses = await ClassInfo.find({
        _id: { $in: uniqueClassIds },
        schoolId,
        status: 'ACTIVE'
      });

      if (validClasses.length !== uniqueClassIds.length) {
        throw new Error('One or more selected classes were not found or are currently inactive.');
      }

      const existingClassAssignments = await ExaminationClassInfo.find({
        schoolId,
        examinationRef: examination._id
      });

      const existingMap = new Map();
      existingClassAssignments.forEach(eca => existingMap.set(eca.classRef.toString(), eca));

      // 1. Deactivate classes no longer selected
      for (const eca of existingClassAssignments) {
        if (!uniqueClassIds.includes(eca.classRef.toString()) && eca.status === 'ACTIVE') {
          // Check if dependent marks exist (future phase dependency guard)
          const ExaminationSubjectInfo = mongoose.models.ExaminationSubjectInfo;
          if (ExaminationSubjectInfo) {
            const hasSubjects = await ExaminationSubjectInfo.findOne({
              examinationRef: examination._id,
              classRef: eca.classRef,
              status: 'ACTIVE'
            });
            if (hasSubjects) {
              throw new Error(
                `Cannot remove class '${eca.className}' because subject marks configuration already exists for this examination and class.`
              );
            }
          }
          eca.status = 'INACTIVE';
          await eca.save();
        }
      }

      // 2. Add new or reactivate existing classes
      for (const cls of validClasses) {
        const existing = existingMap.get(cls._id.toString());
        if (existing) {
          if (existing.status !== 'ACTIVE') {
            existing.status = 'ACTIVE';
            await existing.save();
          }
        } else {
          const newEca = new ExaminationClassInfo({
            schoolRef: examination.schoolRef,
            schoolId,
            examinationRef: examination._id,
            academicYearRef: examination.academicYearRef,
            classRef: cls._id,
            classCode: cls.classCode,
            className: cls.className,
            status: 'ACTIVE'
          });
          await newEca.save();
        }
      }
    }

    const updatedClasses = await ExaminationClassInfo.find({
      schoolId,
      examinationRef: examination._id,
      status: 'ACTIVE'
    });

    return {
      _id: examination._id,
      examinationCode: examination.examinationCode,
      examinationName: examination.examinationName,
      description: examination.description,
      startDate: examination.startDate,
      endDate: examination.endDate,
      status: examination.status,
      assignedClasses: updatedClasses.map(c => ({
        _id: c._id,
        classRef: c.classRef,
        classCode: c.classCode,
        className: c.className
      }))
    };
  }

  /**
   * Toggle examination status
   */
  static async toggleExaminationStatus({ schoolId, examinationId, status }) {
    const cleanStatus = status.toUpperCase();
    if (!['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'].includes(cleanStatus)) {
      throw new Error("Status must be one of: 'UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'.");
    }

    const examination = await ExaminationInfo.findOne({
      _id: examinationId,
      schoolId
    });
    if (!examination) {
      throw new Error('Examination record not found.');
    }

    examination.status = cleanStatus;
    await examination.save();

    return examination;
  }

  /**
   * Get assigned classes for an examination
   */
  static async getAssignedClassesForExamination({ schoolId, examinationId }) {
    const classes = await ExaminationClassInfo.find({
      schoolId,
      examinationRef: new mongoose.Types.ObjectId(examinationId),
      status: 'ACTIVE'
    }).sort({ className: 1 });

    return classes.map(c => ({
      _id: c._id,
      classRef: c.classRef,
      classCode: c.classCode,
      className: c.className
    }));
  }
}

module.exports = ExaminationService;
