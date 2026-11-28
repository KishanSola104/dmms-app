const mongoose = require('mongoose');
const StudentInfo = require('../models/studentInfo.model');
const StudentEnrollmentInfo = require('../models/studentEnrollmentInfo.model');
const StudentEnrollmentHistoryInfo = require('../models/studentEnrollmentHistoryInfo.model');
const AcademicYearInfo = require('../models/academicYearInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');

class StudentService {
  /**
   * Automatically generate a unique admission number for a school
   * Format: ADM-YYYY-NNNN with collision protection
   */
  static async generateAdmissionNumber(schoolId) {
    if (!schoolId) {
      throw new Error('School ID is required to generate admission number.');
    }

    const currentYear = new Date().getFullYear();
    const prefix = `ADM-${currentYear}-`;

    // Find the student with the highest sequence matching this prefix
    const latestStudent = await StudentInfo.findOne({
      schoolId: schoolId.toUpperCase(),
      admissionNumber: new RegExp(`^${prefix}\\d+$`, 'i')
    }).sort({ admissionNumber: -1 }).lean();

    let nextNum = 1;
    if (latestStudent && latestStudent.admissionNumber) {
      const match = latestStudent.admissionNumber.match(/(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }

    // Safety loop to ensure absolute uniqueness
    let candidate = `${prefix}${String(nextNum).padStart(4, '0')}`;
    while (await StudentInfo.exists({ schoolId: schoolId.toUpperCase(), admissionNumber: candidate })) {
      nextNum++;
      candidate = `${prefix}${String(nextNum).padStart(4, '0')}`;
    }

    return candidate;
  }

  /**
   * Get the next available sequential roll number in a section for an academic year
   */
  static async getNextRollNumber(schoolId, academicYearRef, classRef, sectionRef) {
    const activeEnrollments = await StudentEnrollmentInfo.find({
      schoolId: schoolId.toUpperCase(),
      academicYearRef,
      classRef,
      sectionRef,
      status: 'ACTIVE'
    }).select('rollNumber').lean();

    let maxRoll = 0;
    for (const e of activeEnrollments) {
      if (e.rollNumber) {
        const n = parseInt(e.rollNumber, 10);
        if (!isNaN(n) && n > maxRoll) {
          maxRoll = n;
        }
      }
    }

    return String(maxRoll + 1);
  }

  /**
   * Admit a new student:
   * 1. Validates all master details, guardians, class, section, capacities, and uniqueness.
   * 2. Atomically creates StudentInfo, StudentEnrollmentInfo, and initial StudentEnrollmentHistoryInfo.
   */
  static async admitStudent(schoolId, schoolRef, userId, data) {
    const sId = schoolId.toUpperCase();

    // 1. Validate Personal Information
    const {
      admissionNumberMethod = 'MANUAL', // 'MANUAL' or 'AUTO'
      admissionNumber,
      firstName,
      middleName = '',
      lastName,
      dateOfBirth,
      gender,
      profilePhotoUrl = '',
      contact = {},
      guardianDetails = [],
      academicYearRef,
      classRef,
      sectionRef,
      rollNumberMethod = 'MANUAL', // 'MANUAL' or 'AUTO'
      rollNumber = '',
      admissionDate = new Date(),
      remarks = ''
    } = data;

    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      const err = new Error('Student first name is required.');
      err.statusCode = 400;
      throw err;
    }
    if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
      const err = new Error('Student last name is required.');
      err.statusCode = 400;
      throw err;
    }
    if (!dateOfBirth) {
      const err = new Error('Date of birth is required.');
      err.statusCode = 400;
      throw err;
    }
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime()) || dob >= new Date()) {
      const err = new Error('Please provide a valid past date of birth.');
      err.statusCode = 400;
      throw err;
    }

    const upperGender = (gender || '').toUpperCase();
    if (!['MALE', 'FEMALE', 'OTHER'].includes(upperGender)) {
      const err = new Error('Gender must be MALE, FEMALE, or OTHER.');
      err.statusCode = 400;
      throw err;
    }

    // 2. Admission Number Resolution & Uniqueness
    let resolvedAdmissionNumber = '';
    if (admissionNumberMethod === 'AUTO' || !admissionNumber) {
      resolvedAdmissionNumber = await this.generateAdmissionNumber(sId);
    } else {
      resolvedAdmissionNumber = admissionNumber.trim().toUpperCase();
      if (!resolvedAdmissionNumber) {
        const err = new Error('Admission number is required.');
        err.statusCode = 400;
        throw err;
      }
      // Check collision
      const existing = await StudentInfo.findOne({ schoolId: sId, admissionNumber: resolvedAdmissionNumber });
      if (existing) {
        const err = new Error(`Admission number '${resolvedAdmissionNumber}' is already in use at this school.`);
        err.statusCode = 409;
        throw err;
      }
    }

    // 3. Validate Guardian Information
    if (!Array.isArray(guardianDetails) || guardianDetails.length === 0) {
      const err = new Error('At least one guardian details entry is required.');
      err.statusCode = 400;
      throw err;
    }

    let primaryFound = false;
    const sanitizedGuardians = guardianDetails.map((g, idx) => {
      if (!g.fullName || !g.fullName.trim()) {
        const err = new Error(`Guardian #${idx + 1} full name is required.`);
        err.statusCode = 400;
        throw err;
      }
      if (!g.relationship || !g.relationship.trim()) {
        const err = new Error(`Guardian #${idx + 1} relationship is required.`);
        err.statusCode = 400;
        throw err;
      }
      if (!g.mobileNumber || !g.mobileNumber.trim()) {
        const err = new Error(`Guardian #${idx + 1} mobile number is required.`);
        err.statusCode = 400;
        throw err;
      }

      const isPrimary = Boolean(g.isPrimaryContact);
      if (isPrimary && !primaryFound) {
        primaryFound = true;
      }

      return {
        fullName: g.fullName.trim(),
        relationship: g.relationship.trim().toUpperCase(),
        mobileNumber: g.mobileNumber.trim(),
        email: (g.email || '').trim().toLowerCase(),
        isPrimaryContact: isPrimary
      };
    });

    // If no guardian was marked primary, default the first one as primary
    if (!primaryFound && sanitizedGuardians.length > 0) {
      sanitizedGuardians[0].isPrimaryContact = true;
    }

    // 4. Validate Academic Year Reference
    if (!academicYearRef) {
      const err = new Error('Admission academic year is required.');
      err.statusCode = 400;
      throw err;
    }
    const academicYear = await AcademicYearInfo.findOne({ _id: academicYearRef, schoolId: sId });
    if (!academicYear) {
      const err = new Error('Academic year not found or does not belong to this school.');
      err.statusCode = 404;
      throw err;
    }
    if (academicYear.status === 'COMPLETED') {
      const err = new Error('Cannot admit a student into a completed academic year.');
      err.statusCode = 400;
      throw err;
    }

    // 5. Validate Class Reference
    if (!classRef) {
      const err = new Error('Admission class is required.');
      err.statusCode = 400;
      throw err;
    }
    const classDoc = await ClassInfo.findOne({ _id: classRef, schoolId: sId });
    if (!classDoc) {
      const err = new Error('Class not found or does not belong to this school.');
      err.statusCode = 404;
      throw err;
    }
    if (classDoc.status !== 'ACTIVE') {
      const err = new Error('Cannot admit a student into an inactive class.');
      err.statusCode = 400;
      throw err;
    }

    // 6. Validate Section Reference
    if (!sectionRef) {
      const err = new Error('Admission section is required.');
      err.statusCode = 400;
      throw err;
    }
    const sectionDoc = await SectionInfo.findOne({ _id: sectionRef, schoolId: sId });
    if (!sectionDoc) {
      const err = new Error('Section not found or does not belong to this school.');
      err.statusCode = 404;
      throw err;
    }
    if (sectionDoc.status !== 'ACTIVE') {
      const err = new Error('Cannot admit a student into an inactive section.');
      err.statusCode = 400;
      throw err;
    }
    if (sectionDoc.classRef.toString() !== classDoc._id.toString()) {
      const err = new Error(`Section '${sectionDoc.sectionName}' does not belong to class '${classDoc.className}'.`);
      err.statusCode = 400;
      throw err;
    }

    // 7. Validate Section Capacity
    const currentEnrolledCount = await StudentEnrollmentInfo.countDocuments({
      schoolId: sId,
      academicYearRef: academicYear._id,
      classRef: classDoc._id,
      sectionRef: sectionDoc._id,
      status: 'ACTIVE'
    });

    if (currentEnrolledCount >= sectionDoc.maxCapacity) {
      const err = new Error(
        `Section '${sectionDoc.sectionName}' has reached its maximum capacity of ${sectionDoc.maxCapacity} students (${currentEnrolledCount} currently active).`
      );
      err.statusCode = 400;
      throw err;
    }

    // 8. Roll Number Resolution & Uniqueness
    let resolvedRollNumber = '';
    if (rollNumberMethod === 'AUTO') {
      resolvedRollNumber = await this.getNextRollNumber(sId, academicYear._id, classDoc._id, sectionDoc._id);
    } else if (rollNumber && typeof rollNumber === 'string' && rollNumber.trim()) {
      resolvedRollNumber = rollNumber.trim();
      // Check uniqueness in section for this academic year
      const rollConflict = await StudentEnrollmentInfo.findOne({
        schoolId: sId,
        academicYearRef: academicYear._id,
        classRef: classDoc._id,
        sectionRef: sectionDoc._id,
        rollNumber: resolvedRollNumber,
        status: 'ACTIVE'
      });
      if (rollConflict) {
        const err = new Error(
          `Roll number '${resolvedRollNumber}' is already assigned in Section '${sectionDoc.sectionName}'.`
        );
        err.statusCode = 409;
        throw err;
      }
    }

    // 9. Atomic Creation: Student Master + Initial Enrollment + Enrollment History
    let supportsTransactions = false;
    try {
      const hello = await mongoose.connection.db.command({ hello: 1 });
      supportsTransactions = Boolean(hello.setName || hello.msg === 'isdbgrid');
    } catch {
      supportsTransactions = false;
    }

    let session = null;
    if (supportsTransactions) {
      session = await mongoose.startSession();
      session.startTransaction();
    }

    const sessionOpts = session ? { session } : {};
    let createdStudent = null;
    let createdEnrollment = null;

    try {
      // 9a. Create Student Master Record
      const newStudent = new StudentInfo({
        schoolRef,
        schoolId: sId,
        admissionNumber: resolvedAdmissionNumber,
        firstName: firstName.trim(),
        middleName: (middleName || '').trim(),
        lastName: lastName.trim(),
        dateOfBirth: dob,
        gender: upperGender,
        profilePhotoUrl: (profilePhotoUrl || '').trim(),
        contact: {
          phone: (contact.phone || '').trim(),
          email: (contact.email || '').trim().toLowerCase()
        },
        guardianDetails: sanitizedGuardians,
        admissionAcademicYearRef: academicYear._id,
        admissionClassRef: classDoc._id,
        admissionDate: new Date(admissionDate),
        status: 'ACTIVE'
      });

      await newStudent.save(sessionOpts);
      createdStudent = newStudent;

      // 9b. Create Student Enrollment Record
      const newEnrollment = new StudentEnrollmentInfo({
        schoolRef,
        schoolId: sId,
        studentRef: newStudent._id,
        academicYearRef: academicYear._id,
        classRef: classDoc._id,
        sectionRef: sectionDoc._id,
        rollNumber: resolvedRollNumber,
        enrollmentDate: new Date(admissionDate),
        status: 'ACTIVE',
        remarks: (remarks || '').trim()
      });

      await newEnrollment.save(sessionOpts);
      createdEnrollment = newEnrollment;

      // 9c. Create Initial Enrollment History Record
      const historyRecord = new StudentEnrollmentHistoryInfo({
        schoolRef,
        schoolId: sId,
        studentRef: newStudent._id,
        enrollmentRef: newEnrollment._id,
        academicYearRef: academicYear._id,
        previousClassRef: null,
        previousSectionRef: null,
        newClassRef: classDoc._id,
        newSectionRef: sectionDoc._id,
        changeType: 'ADMISSION',
        remarks: (remarks || '').trim() || 'Initial Admission',
        changedBy: userId || null,
        changedAt: new Date()
      });

      await historyRecord.save(sessionOpts);

      if (session) {
        await session.commitTransaction();
        session.endSession();
      }

      return {
        student: newStudent,
        enrollment: {
          ...newEnrollment.toObject(),
          academicYearName: academicYear.yearName,
          className: classDoc.className,
          sectionName: sectionDoc.sectionName
        }
      };
    } catch (opError) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      } else {
        if (createdEnrollment) {
          await StudentEnrollmentInfo.deleteOne({ _id: createdEnrollment._id });
        }
        if (createdStudent) {
          await StudentInfo.deleteOne({ _id: createdStudent._id });
        }
      }
      throw opError;
    }
  }

  /**
   * List students with academic year placement, search, filters & pagination
   */
  static async listStudents({
    schoolId,
    academicYearRef,
    classRef,
    sectionRef,
    status,
    enrollmentStatus,
    gender,
    search = '',
    page = 1,
    limit = 10
  }) {
    const sId = schoolId.toUpperCase();
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    // Resolve target academic year
    let targetAyId = academicYearRef;
    if (!targetAyId || targetAyId === 'CURRENT') {
      const currentAy = await AcademicYearInfo.findOne({ schoolId: sId, isCurrent: true }).lean();
      targetAyId = currentAy ? currentAy._id.toString() : null;
    }

    if (targetAyId && targetAyId !== 'ALL') {
      // 1. Query enrollments scoped to target academic year
      const matchEnrollment = {
        schoolId: sId,
        academicYearRef: new mongoose.Types.ObjectId(targetAyId)
      };

      if (classRef && classRef !== 'ALL') {
        matchEnrollment.classRef = new mongoose.Types.ObjectId(classRef);
      }
      if (sectionRef && sectionRef !== 'ALL') {
        matchEnrollment.sectionRef = new mongoose.Types.ObjectId(sectionRef);
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

      // Student master filter
      const studentMatch = {};
      if (status && status !== 'ALL') {
        studentMatch['student.status'] = status.toUpperCase();
      }
      if (gender && gender !== 'ALL') {
        studentMatch['student.gender'] = gender.toUpperCase();
      }
      if (search && search.trim()) {
        const q = search.trim();
        const regex = new RegExp(q, 'i');
        studentMatch.$or = [
          { 'student.firstName': regex },
          { 'student.lastName': regex },
          { 'student.middleName': regex },
          { 'student.admissionNumber': regex },
          { rollNumber: regex },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ['$student.firstName', ' ', '$student.lastName'] },
                regex: q,
                options: 'i'
              }
            }
          }
        ];
      }

      if (Object.keys(studentMatch).length > 0) {
        pipeline.push({ $match: studentMatch });
      }

      // Count total
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await StudentEnrollmentInfo.aggregate(countPipeline);
      const totalRecords = countResult[0]?.total || 0;

      // Sort & Paginate
      pipeline.push(
        { $sort: { 'class.className': 1, 'section.sectionName': 1, rollNumber: 1, 'student.firstName': 1 } },
        { $skip: skip },
        { $limit: limitNum }
      );

      const records = await StudentEnrollmentInfo.aggregate(pipeline);

      const formattedStudents = records.map(r => {
        const primaryGuardian = (r.student.guardianDetails || []).find(g => g.isPrimaryContact) ||
          (r.student.guardianDetails || [])[0] || null;

        return {
          _id: r.student._id,
          enrollmentId: r._id,
          admissionNumber: r.student.admissionNumber,
          firstName: r.student.firstName,
          middleName: r.student.middleName,
          lastName: r.student.lastName,
          fullName: [r.student.firstName, r.student.middleName, r.student.lastName].filter(Boolean).join(' '),
          dateOfBirth: r.student.dateOfBirth,
          gender: r.student.gender,
          profilePhotoUrl: r.student.profilePhotoUrl,
          studentPhone: r.student.contact?.phone || '',
          studentEmail: r.student.contact?.email || '',
          primaryGuardian: primaryGuardian ? {
            fullName: primaryGuardian.fullName,
            relationship: primaryGuardian.relationship,
            mobileNumber: primaryGuardian.mobileNumber,
            email: primaryGuardian.email
          } : null,
          academicYearId: r.academicYearRef,
          academicYearName: r.academicYear?.yearName || '',
          classId: r.classRef,
          className: r.class?.className || '',
          classCode: r.class?.classCode || '',
          sectionId: r.sectionRef,
          sectionName: r.section?.sectionName || '',
          sectionCode: r.section?.sectionCode || '',
          rollNumber: r.rollNumber || '',
          enrollmentStatus: r.status,
          status: r.student.status,
          admissionDate: r.student.admissionDate
        };
      });

      return {
        students: formattedStudents,
        pagination: {
          totalRecords,
          currentPage: pageNum,
          totalPages: Math.ceil(totalRecords / limitNum) || 1,
          limit: limitNum
        }
      };
    } else {
      // 2. Query StudentInfo directly if target AY is ALL or unassigned
      const studentMatch = { schoolId: sId };
      if (status && status !== 'ALL') {
        studentMatch.status = status.toUpperCase();
      }
      if (gender && gender !== 'ALL') {
        studentMatch.gender = gender.toUpperCase();
      }
      if (search && search.trim()) {
        const q = search.trim();
        const regex = new RegExp(q, 'i');
        studentMatch.$or = [
          { firstName: regex },
          { lastName: regex },
          { middleName: regex },
          { admissionNumber: regex },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ['$firstName', ' ', '$lastName'] },
                regex: q,
                options: 'i'
              }
            }
          }
        ];
      }

      const totalRecords = await StudentInfo.countDocuments(studentMatch);
      const studentDocs = await StudentInfo.find(studentMatch)
        .sort({ firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('admissionClassRef', 'className classCode')
        .populate('admissionAcademicYearRef', 'yearName')
        .lean();

      // For each student, fetch their latest enrollment
      const formattedStudents = await Promise.all(studentDocs.map(async s => {
        const enrollment = await StudentEnrollmentInfo.findOne({ schoolId: sId, studentRef: s._id })
          .sort({ createdAt: -1 })
          .populate('classRef', 'className classCode')
          .populate('sectionRef', 'sectionName sectionCode')
          .populate('academicYearRef', 'yearName')
          .lean();

        const primaryGuardian = (s.guardianDetails || []).find(g => g.isPrimaryContact) ||
          (s.guardianDetails || [])[0] || null;

        return {
          _id: s._id,
          enrollmentId: enrollment?._id || null,
          admissionNumber: s.admissionNumber,
          firstName: s.firstName,
          middleName: s.middleName,
          lastName: s.lastName,
          fullName: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '),
          dateOfBirth: s.dateOfBirth,
          gender: s.gender,
          profilePhotoUrl: s.profilePhotoUrl,
          studentPhone: s.contact?.phone || '',
          studentEmail: s.contact?.email || '',
          primaryGuardian: primaryGuardian ? {
            fullName: primaryGuardian.fullName,
            relationship: primaryGuardian.relationship,
            mobileNumber: primaryGuardian.mobileNumber,
            email: primaryGuardian.email
          } : null,
          academicYearId: enrollment?.academicYearRef?._id || s.admissionAcademicYearRef?._id,
          academicYearName: enrollment?.academicYearRef?.yearName || s.admissionAcademicYearRef?.yearName || '',
          classId: enrollment?.classRef?._id || s.admissionClassRef?._id,
          className: enrollment?.classRef?.className || s.admissionClassRef?.className || '',
          classCode: enrollment?.classRef?.classCode || s.admissionClassRef?.classCode || '',
          sectionId: enrollment?.sectionRef?._id || null,
          sectionName: enrollment?.sectionRef?.sectionName || '',
          sectionCode: enrollment?.sectionRef?.sectionCode || '',
          rollNumber: enrollment?.rollNumber || '',
          enrollmentStatus: enrollment?.status || 'NOT_ENROLLED',
          status: s.status,
          admissionDate: s.admissionDate
        };
      }));

      return {
        students: formattedStudents,
        pagination: {
          totalRecords,
          currentPage: pageNum,
          totalPages: Math.ceil(totalRecords / limitNum) || 1,
          limit: limitNum
        }
      };
    }
  }

  /**
   * Get single student complete profile with academic enrollment history
   */
  static async getStudentById(schoolId, studentId, academicYearRef) {
    const sId = schoolId.toUpperCase();
    const student = await StudentInfo.findOne({ _id: studentId, schoolId: sId })
      .populate('admissionAcademicYearRef', 'yearName yearCode')
      .populate('admissionClassRef', 'className classCode')
      .lean();

    if (!student) {
      const err = new Error('Student not found in this school.');
      err.statusCode = 404;
      throw err;
    }

    // Find enrollment for selected academic year or most recent enrollment
    const currentEnrollmentQuery = { schoolId: sId, studentRef: student._id };
    if (academicYearRef && academicYearRef !== 'CURRENT') {
      currentEnrollmentQuery.academicYearRef = academicYearRef;
    }

    const currentEnrollment = await StudentEnrollmentInfo.findOne(currentEnrollmentQuery)
      .sort({ createdAt: -1 })
      .populate('academicYearRef', 'yearName yearCode isCurrent status')
      .populate('classRef', 'className classCode')
      .populate('sectionRef', 'sectionName sectionCode maxCapacity')
      .lean();

    // All academic enrollments
    const allEnrollments = await StudentEnrollmentInfo.find({ schoolId: sId, studentRef: student._id })
      .sort({ createdAt: -1 })
      .populate('academicYearRef', 'yearName yearCode isCurrent status')
      .populate('classRef', 'className classCode')
      .populate('sectionRef', 'sectionName sectionCode')
      .lean();

    // Complete enrollment history timeline
    const enrollmentHistory = await StudentEnrollmentHistoryInfo.find({ schoolId: sId, studentRef: student._id })
      .sort({ changedAt: -1 })
      .populate('academicYearRef', 'yearName yearCode')
      .populate('previousClassRef', 'className classCode')
      .populate('previousSectionRef', 'sectionName sectionCode')
      .populate('newClassRef', 'className classCode')
      .populate('newSectionRef', 'sectionName sectionCode')
      .lean();

    return {
      student,
      currentEnrollment,
      allEnrollments,
      enrollmentHistory
    };
  }

  /**
   * Update student master details (personal, contact, guardians, photo)
   */
  static async updateStudent(schoolId, studentId, updateData) {
    const sId = schoolId.toUpperCase();
    const student = await StudentInfo.findOne({ _id: studentId, schoolId: sId });
    if (!student) {
      const err = new Error('Student not found in this school.');
      err.statusCode = 404;
      throw err;
    }

    const {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      profilePhotoUrl,
      contact,
      guardianDetails
    } = updateData;

    if (firstName !== undefined) {
      if (!firstName || !firstName.trim()) {
        const err = new Error('First name cannot be empty.');
        err.statusCode = 400;
        throw err;
      }
      student.firstName = firstName.trim();
    }

    if (middleName !== undefined) {
      student.middleName = (middleName || '').trim();
    }

    if (lastName !== undefined) {
      if (!lastName || !lastName.trim()) {
        const err = new Error('Last name cannot be empty.');
        err.statusCode = 400;
        throw err;
      }
      student.lastName = lastName.trim();
    }

    if (dateOfBirth !== undefined) {
      const dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime()) || dob >= new Date()) {
        const err = new Error('Please provide a valid past date of birth.');
        err.statusCode = 400;
        throw err;
      }
      student.dateOfBirth = dob;
    }

    if (gender !== undefined) {
      const upperGender = (gender || '').toUpperCase();
      if (!['MALE', 'FEMALE', 'OTHER'].includes(upperGender)) {
        const err = new Error('Gender must be MALE, FEMALE, or OTHER.');
        err.statusCode = 400;
        throw err;
      }
      student.gender = upperGender;
    }

    if (profilePhotoUrl !== undefined) {
      student.profilePhotoUrl = (profilePhotoUrl || '').trim();
    }

    if (contact !== undefined) {
      student.contact = {
        phone: (contact?.phone || '').trim(),
        email: (contact?.email || '').trim().toLowerCase()
      };
    }

    if (guardianDetails !== undefined) {
      if (!Array.isArray(guardianDetails) || guardianDetails.length === 0) {
        const err = new Error('At least one guardian details entry is required.');
        err.statusCode = 400;
        throw err;
      }

      let primaryFound = false;
      const sanitizedGuardians = guardianDetails.map((g, idx) => {
        if (!g.fullName || !g.fullName.trim()) {
          const err = new Error(`Guardian #${idx + 1} full name is required.`);
          err.statusCode = 400;
          throw err;
        }
        if (!g.relationship || !g.relationship.trim()) {
          const err = new Error(`Guardian #${idx + 1} relationship is required.`);
          err.statusCode = 400;
          throw err;
        }
        if (!g.mobileNumber || !g.mobileNumber.trim()) {
          const err = new Error(`Guardian #${idx + 1} mobile number is required.`);
          err.statusCode = 400;
          throw err;
        }

        const isPrimary = Boolean(g.isPrimaryContact);
        if (isPrimary && !primaryFound) {
          primaryFound = true;
        }

        return {
          fullName: g.fullName.trim(),
          relationship: g.relationship.trim().toUpperCase(),
          mobileNumber: g.mobileNumber.trim(),
          email: (g.email || '').trim().toLowerCase(),
          isPrimaryContact: isPrimary
        };
      });

      if (!primaryFound && sanitizedGuardians.length > 0) {
        sanitizedGuardians[0].isPrimaryContact = true;
      }

      student.guardianDetails = sanitizedGuardians;
    }

    await student.save();
    return student;
  }

  /**
   * Toggle student master status (ACTIVE, INACTIVE, etc.) without deleting records
   */
  static async toggleStudentStatus(schoolId, studentId, status) {
    const sId = schoolId.toUpperCase();
    const upperStatus = (status || '').toUpperCase();
    if (!['ACTIVE', 'INACTIVE', 'TRANSFERRED', 'ALUMNI'].includes(upperStatus)) {
      const err = new Error('Invalid status. Allowed values: ACTIVE, INACTIVE, TRANSFERRED, ALUMNI.');
      err.statusCode = 400;
      throw err;
    }

    const student = await StudentInfo.findOne({ _id: studentId, schoolId: sId });
    if (!student) {
      const err = new Error('Student not found in this school.');
      err.statusCode = 404;
      throw err;
    }

    student.status = upperStatus;
    await student.save();

    return {
      _id: student._id,
      admissionNumber: student.admissionNumber,
      fullName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
      status: student.status
    };
  }

  /**
   * Get section enrollment summary and enrolled student list
   */
  static async getSectionEnrollmentSummary({ schoolId, academicYearRef, classRef, sectionRef }) {
    const sId = schoolId.toUpperCase();
    if (!academicYearRef || !classRef || !sectionRef) {
      const err = new Error('academicYearRef, classRef, and sectionRef are required.');
      err.statusCode = 400;
      throw err;
    }

    const [sectionDoc, classDoc, academicYearDoc] = await Promise.all([
      SectionInfo.findOne({ _id: sectionRef, schoolId: sId }),
      ClassInfo.findOne({ _id: classRef, schoolId: sId }),
      AcademicYearInfo.findOne({ _id: academicYearRef, schoolId: sId })
    ]);

    if (!sectionDoc || !classDoc || !academicYearDoc) {
      const err = new Error('Section, Class, or Academic Year not found in this school.');
      err.statusCode = 404;
      throw err;
    }

    const enrollments = await StudentEnrollmentInfo.find({
      schoolId: sId,
      academicYearRef,
      classRef,
      sectionRef
    })
      .populate('studentRef')
      .sort({ rollNumber: 1, 'studentRef.firstName': 1 })
      .lean();

    const activeCount = enrollments.filter(e => e.status === 'ACTIVE').length;
    const maxCapacity = sectionDoc.maxCapacity || 30;
    const remainingCapacity = Math.max(0, maxCapacity - activeCount);

    const formattedEnrollments = enrollments.map(e => ({
      _id: e._id,
      studentId: e.studentRef?._id,
      admissionNumber: e.studentRef?.admissionNumber || '',
      firstName: e.studentRef?.firstName || '',
      lastName: e.studentRef?.lastName || '',
      fullName: [e.studentRef?.firstName, e.studentRef?.middleName, e.studentRef?.lastName].filter(Boolean).join(' '),
      gender: e.studentRef?.gender || '',
      profilePhotoUrl: e.studentRef?.profilePhotoUrl || '',
      rollNumber: e.rollNumber || '',
      enrollmentDate: e.enrollmentDate,
      status: e.status,
      remarks: e.remarks || ''
    }));

    return {
      academicYear: { _id: academicYearDoc._id, yearName: academicYearDoc.yearName, isCurrent: academicYearDoc.isCurrent },
      class: { _id: classDoc._id, className: classDoc.className, classCode: classDoc.classCode },
      section: { _id: sectionDoc._id, sectionName: sectionDoc.sectionName, sectionCode: sectionDoc.sectionCode },
      capacity: {
        maxCapacity,
        activeEnrolled: activeCount,
        totalEnrolled: enrollments.length,
        remainingCapacity,
        isFull: activeCount >= maxCapacity
      },
      enrollments: formattedEnrollments
    };
  }

  /**
   * Get students who are active in the school but not enrolled in a given academic year
   */
  static async getUnenrolledStudents({ schoolId, academicYearRef, search = '' }) {
    const sId = schoolId.toUpperCase();
    if (!academicYearRef) {
      const err = new Error('academicYearRef is required.');
      err.statusCode = 400;
      throw err;
    }

    // Find all studentRefs already enrolled in this academic year
    const enrolledStudentIds = await StudentEnrollmentInfo.find({
      schoolId: sId,
      academicYearRef
    }).distinct('studentRef');

    const query = {
      schoolId: sId,
      status: 'ACTIVE',
      _id: { $nin: enrolledStudentIds }
    };

    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, 'i');
      query.$or = [
        { firstName: regex },
        { lastName: regex },
        { admissionNumber: regex }
      ];
    }

    const students = await StudentInfo.find(query)
      .select('_id admissionNumber firstName middleName lastName gender dateOfBirth contact')
      .sort({ firstName: 1 })
      .limit(50)
      .lean();

    return students.map(s => ({
      _id: s._id,
      admissionNumber: s.admissionNumber,
      fullName: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' '),
      firstName: s.firstName,
      lastName: s.lastName,
      gender: s.gender,
      phone: s.contact?.phone || ''
    }));
  }

  /**
   * Enroll an existing student in an academic year
   */
  static async enrollStudent({
    schoolId,
    schoolRef,
    userId,
    studentId,
    academicYearRef,
    classRef,
    sectionRef,
    rollNumber = '',
    enrollmentDate = new Date(),
    remarks = ''
  }) {
    const sId = schoolId.toUpperCase();

    if (!studentId || !academicYearRef || !classRef || !sectionRef) {
      const err = new Error('studentId, academicYearRef, classRef, and sectionRef are mandatory.');
      err.statusCode = 400;
      throw err;
    }

    const student = await StudentInfo.findOne({ _id: studentId, schoolId: sId });
    if (!student) {
      const err = new Error('Student not found in this school.');
      err.statusCode = 404;
      throw err;
    }
    if (student.status !== 'ACTIVE') {
      const err = new Error(`Cannot enroll student with status '${student.status}'. Student must be ACTIVE.`);
      err.statusCode = 400;
      throw err;
    }

    const [academicYear, classDoc, sectionDoc] = await Promise.all([
      AcademicYearInfo.findOne({ _id: academicYearRef, schoolId: sId }),
      ClassInfo.findOne({ _id: classRef, schoolId: sId }),
      SectionInfo.findOne({ _id: sectionRef, schoolId: sId })
    ]);

    if (!academicYear) {
      const err = new Error('Academic year not found in this school.');
      err.statusCode = 404;
      throw err;
    }
    if (academicYear.status === 'COMPLETED') {
      const err = new Error('Cannot enroll a student into a completed academic year.');
      err.statusCode = 400;
      throw err;
    }

    if (!classDoc || classDoc.status !== 'ACTIVE') {
      const err = new Error('Class is invalid or inactive.');
      err.statusCode = 400;
      throw err;
    }

    if (!sectionDoc || sectionDoc.status !== 'ACTIVE') {
      const err = new Error('Section is invalid or inactive.');
      err.statusCode = 400;
      throw err;
    }

    if (sectionDoc.classRef.toString() !== classDoc._id.toString()) {
      const err = new Error(`Section '${sectionDoc.sectionName}' does not belong to class '${classDoc.className}'.`);
      err.statusCode = 400;
      throw err;
    }

    // Check duplicate enrollment for same academic year
    const existingEnrollment = await StudentEnrollmentInfo.findOne({
      schoolId: sId,
      academicYearRef: academicYear._id,
      studentRef: student._id
    });

    if (existingEnrollment) {
      const err = new Error(`Student '${student.admissionNumber}' is already enrolled in this academic year.`);
      err.statusCode = 409;
      throw err;
    }

    // Check section capacity
    const activeEnrolledCount = await StudentEnrollmentInfo.countDocuments({
      schoolId: sId,
      academicYearRef: academicYear._id,
      classRef: classDoc._id,
      sectionRef: sectionDoc._id,
      status: 'ACTIVE'
    });

    if (activeEnrolledCount >= sectionDoc.maxCapacity) {
      const err = new Error(
        `Section '${sectionDoc.sectionName}' has reached maximum capacity of ${sectionDoc.maxCapacity} students.`
      );
      err.statusCode = 400;
      throw err;
    }

    // Check unique roll number if provided
    let cleanRoll = (rollNumber || '').trim();
    if (cleanRoll) {
      const rollConflict = await StudentEnrollmentInfo.findOne({
        schoolId: sId,
        academicYearRef: academicYear._id,
        classRef: classDoc._id,
        sectionRef: sectionDoc._id,
        rollNumber: cleanRoll,
        status: 'ACTIVE'
      });
      if (rollConflict) {
        const err = new Error(`Roll number '${cleanRoll}' is already assigned in Section '${sectionDoc.sectionName}'.`);
        err.statusCode = 409;
        throw err;
      }
    }

    const enrollment = new StudentEnrollmentInfo({
      schoolRef: schoolRef || student.schoolRef,
      schoolId: sId,
      studentRef: student._id,
      academicYearRef: academicYear._id,
      classRef: classDoc._id,
      sectionRef: sectionDoc._id,
      rollNumber: cleanRoll,
      enrollmentDate: new Date(enrollmentDate),
      status: 'ACTIVE',
      remarks: (remarks || '').trim()
    });

    await enrollment.save();

    const history = new StudentEnrollmentHistoryInfo({
      schoolRef: schoolRef || student.schoolRef,
      schoolId: sId,
      studentRef: student._id,
      enrollmentRef: enrollment._id,
      academicYearRef: academicYear._id,
      previousClassRef: null,
      previousSectionRef: null,
      newClassRef: classDoc._id,
      newSectionRef: sectionDoc._id,
      changeType: 'ADMISSION',
      remarks: (remarks || '').trim() || 'Academic Year Enrollment',
      changedBy: userId || null,
      changedAt: new Date()
    });

    await history.save();

    return {
      enrollment: {
        ...enrollment.toObject(),
        studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
        admissionNumber: student.admissionNumber,
        className: classDoc.className,
        sectionName: sectionDoc.sectionName
      }
    };
  }

  /**
   * Update enrollment (roll number, status, remarks)
   */
  static async updateEnrollment({ schoolId, enrollmentId, rollNumber, remarks, status }) {
    const sId = schoolId.toUpperCase();
    const enrollment = await StudentEnrollmentInfo.findOne({ _id: enrollmentId, schoolId: sId });
    if (!enrollment) {
      const err = new Error('Enrollment not found in this school.');
      err.statusCode = 404;
      throw err;
    }

    if (rollNumber !== undefined) {
      const cleanRoll = (rollNumber || '').trim();
      if (cleanRoll && cleanRoll !== enrollment.rollNumber) {
        // Validate uniqueness in that section
        const conflict = await StudentEnrollmentInfo.findOne({
          schoolId: sId,
          academicYearRef: enrollment.academicYearRef,
          classRef: enrollment.classRef,
          sectionRef: enrollment.sectionRef,
          rollNumber: cleanRoll,
          _id: { $ne: enrollment._id },
          status: 'ACTIVE'
        });
        if (conflict) {
          const err = new Error(`Roll number '${cleanRoll}' is already assigned in this section.`);
          err.statusCode = 409;
          throw err;
        }
      }
      enrollment.rollNumber = cleanRoll;
    }

    if (remarks !== undefined) {
      enrollment.remarks = (remarks || '').trim();
    }

    if (status !== undefined) {
      const upperStatus = (status || '').toUpperCase();
      if (!['ACTIVE', 'COMPLETED', 'WITHDRAWN', 'TRANSFERRED'].includes(upperStatus)) {
        const err = new Error('Invalid enrollment status. Allowed values: ACTIVE, COMPLETED, WITHDRAWN, TRANSFERRED.');
        err.statusCode = 400;
        throw err;
      }
      enrollment.status = upperStatus;
    }

    await enrollment.save();
    return enrollment;
  }

  /**
   * Same-Year Section or Class Transfer
   */
  static async transferStudentSection({
    schoolId,
    userId,
    enrollmentId,
    newClassRef,
    newSectionRef,
    newRollNumber,
    remarks = ''
  }) {
    const sId = schoolId.toUpperCase();

    if (!enrollmentId || !newClassRef || !newSectionRef) {
      const err = new Error('enrollmentId, newClassRef, and newSectionRef are mandatory.');
      err.statusCode = 400;
      throw err;
    }

    const enrollment = await StudentEnrollmentInfo.findOne({ _id: enrollmentId, schoolId: sId })
      .populate('studentRef');

    if (!enrollment) {
      const err = new Error('Enrollment not found in this school.');
      err.statusCode = 404;
      throw err;
    }

    const previousClassRef = enrollment.classRef;
    const previousSectionRef = enrollment.sectionRef;

    const [destClass, destSection] = await Promise.all([
      ClassInfo.findOne({ _id: newClassRef, schoolId: sId }),
      SectionInfo.findOne({ _id: newSectionRef, schoolId: sId })
    ]);

    if (!destClass || destClass.status !== 'ACTIVE') {
      const err = new Error('Destination class not found or is inactive.');
      err.statusCode = 400;
      throw err;
    }

    if (!destSection || destSection.status !== 'ACTIVE') {
      const err = new Error('Destination section not found or is inactive.');
      err.statusCode = 400;
      throw err;
    }

    if (destSection.classRef.toString() !== destClass._id.toString()) {
      const err = new Error(`Section '${destSection.sectionName}' does not belong to class '${destClass.className}'.`);
      err.statusCode = 400;
      throw err;
    }

    // Check same section
    if (
      previousClassRef.toString() === destClass._id.toString() &&
      previousSectionRef.toString() === destSection._id.toString()
    ) {
      const err = new Error('Student is already in this class and section.');
      err.statusCode = 400;
      throw err;
    }

    // Check destination section capacity
    const activeInDest = await StudentEnrollmentInfo.countDocuments({
      schoolId: sId,
      academicYearRef: enrollment.academicYearRef,
      classRef: destClass._id,
      sectionRef: destSection._id,
      status: 'ACTIVE'
    });

    if (activeInDest >= destSection.maxCapacity) {
      const err = new Error(
        `Destination section '${destSection.sectionName}' has reached maximum capacity of ${destSection.maxCapacity} students.`
      );
      err.statusCode = 400;
      throw err;
    }

    // Determine and check roll number
    let targetRoll = newRollNumber !== undefined ? (newRollNumber || '').trim() : enrollment.rollNumber;
    if (targetRoll) {
      const rollConflict = await StudentEnrollmentInfo.findOne({
        schoolId: sId,
        academicYearRef: enrollment.academicYearRef,
        classRef: destClass._id,
        sectionRef: destSection._id,
        rollNumber: targetRoll,
        _id: { $ne: enrollment._id },
        status: 'ACTIVE'
      });
      if (rollConflict) {
        const err = new Error(`Roll number '${targetRoll}' is already in use in Section '${destSection.sectionName}'.`);
        err.statusCode = 409;
        throw err;
      }
    }

    // Determine changeType
    const isClassChange = previousClassRef.toString() !== destClass._id.toString();
    const changeType = isClassChange ? 'CLASS_TRANSFER' : 'SECTION_TRANSFER';

    // Update existing enrollment
    enrollment.classRef = destClass._id;
    enrollment.sectionRef = destSection._id;
    enrollment.rollNumber = targetRoll;
    if (remarks && remarks.trim()) {
      enrollment.remarks = remarks.trim();
    }
    await enrollment.save();

    // Create history record
    const history = new StudentEnrollmentHistoryInfo({
      schoolRef: enrollment.schoolRef,
      schoolId: sId,
      studentRef: enrollment.studentRef?._id || enrollment.studentRef,
      enrollmentRef: enrollment._id,
      academicYearRef: enrollment.academicYearRef,
      previousClassRef,
      previousSectionRef,
      newClassRef: destClass._id,
      newSectionRef: destSection._id,
      changeType,
      remarks: remarks.trim() || `Same-year transfer to ${destClass.className} - ${destSection.sectionName}`,
      changedBy: userId || null,
      changedAt: new Date()
    });

    await history.save();

    return {
      enrollment: {
        ...enrollment.toObject(),
        className: destClass.className,
        sectionName: destSection.sectionName
      },
      history
    };
  }

  /**
   * Load source students for promotion with previous enrollment details and next-year status
   */
  static async getSourceStudentsForPromotion({
    schoolId,
    previousAcademicYearRef,
    nextAcademicYearRef,
    classRef,
    sectionRef
  }) {
    const sId = schoolId.toUpperCase();
    if (!previousAcademicYearRef || !classRef) {
      const err = new Error('previousAcademicYearRef and classRef are mandatory.');
      err.statusCode = 400;
      throw err;
    }

    const query = {
      schoolId: sId,
      academicYearRef: previousAcademicYearRef,
      classRef
    };
    if (sectionRef && sectionRef !== 'ALL') {
      query.sectionRef = sectionRef;
    }

    const enrollments = await StudentEnrollmentInfo.find(query)
      .populate('studentRef')
      .populate('classRef', 'className classCode')
      .populate('sectionRef', 'sectionName sectionCode')
      .sort({ 'sectionRef.sectionName': 1, rollNumber: 1, 'studentRef.firstName': 1 })
      .lean();

    // Check if any student already has an enrollment in nextAcademicYearRef
    const nextYearEnrolledMap = new Map();
    if (nextAcademicYearRef) {
      const nextEnrollments = await StudentEnrollmentInfo.find({
        schoolId: sId,
        academicYearRef: nextAcademicYearRef,
        studentRef: { $in: enrollments.map((e) => e.studentRef?._id).filter(Boolean) }
      })
        .populate('classRef', 'className classCode')
        .populate('sectionRef', 'sectionName sectionCode')
        .lean();

      nextEnrollments.forEach((ne) => {
        if (ne.studentRef) {
          nextYearEnrolledMap.set(ne.studentRef.toString(), ne);
        }
      });
    }

    const formatted = enrollments.map((e) => {
      const s = e.studentRef;
      const nextYearPlacement = s ? nextYearEnrolledMap.get(s._id.toString()) : null;

      return {
        enrollmentId: e._id,
        studentId: s?._id,
        admissionNumber: s?.admissionNumber || '',
        firstName: s?.firstName || '',
        middleName: s?.middleName || '',
        lastName: s?.lastName || '',
        fullName: [s?.firstName, s?.middleName, s?.lastName].filter(Boolean).join(' '),
        gender: s?.gender || '',
        profilePhotoUrl: s?.profilePhotoUrl || '',
        classId: e.classRef?._id,
        className: e.classRef?.className || '',
        sectionId: e.sectionRef?._id,
        sectionName: e.sectionRef?.sectionName || '',
        rollNumber: e.rollNumber || '',
        status: e.status,
        promotionOutcome: e.promotionOutcome || null,
        isAlreadyEnrolledInNextYear: Boolean(nextYearPlacement),
        nextYearPlacement: nextYearPlacement
          ? {
              enrollmentId: nextYearPlacement._id,
              className: nextYearPlacement.classRef?.className,
              sectionName: nextYearPlacement.sectionRef?.sectionName,
              rollNumber: nextYearPlacement.rollNumber,
              status: nextYearPlacement.status
            }
          : null
      };
    });

    return {
      students: formatted,
      totalCount: formatted.length,
      alreadyEnrolledCount: formatted.filter((s) => s.isAlreadyEnrolledInNextYear).length
    };
  }

  /**
   * Preview automatic section distribution and roll number assignment
   */
  static async previewPromotionDistribution({
    schoolId,
    nextAcademicYearRef,
    destinationClassRef,
    targetSectionRefs = [],
    students = [],
    rollNumberMethod = 'AUTO'
  }) {
    const sId = schoolId.toUpperCase();
    if (!nextAcademicYearRef || !destinationClassRef) {
      const err = new Error('nextAcademicYearRef and destinationClassRef are required.');
      err.statusCode = 400;
      throw err;
    }

    // Get active sections of destination class
    const sectionQuery = {
      schoolId: sId,
      classRef: destinationClassRef,
      status: 'ACTIVE'
    };
    if (Array.isArray(targetSectionRefs) && targetSectionRefs.length > 0) {
      sectionQuery._id = { $in: targetSectionRefs };
    }

    const availableSections = await SectionInfo.find(sectionQuery)
      .sort({ sectionCode: 1 })
      .lean();

    if (availableSections.length === 0) {
      const err = new Error('No active sections found in the destination class.');
      err.statusCode = 400;
      throw err;
    }

    // Get existing enrollment counts and next roll numbers for each section in nextAcademicYearRef
    const sectionStats = [];
    for (const sec of availableSections) {
      const existingEnrollments = await StudentEnrollmentInfo.find({
        schoolId: sId,
        academicYearRef: nextAcademicYearRef,
        classRef: destinationClassRef,
        sectionRef: sec._id,
        status: 'ACTIVE'
      }).select('rollNumber').lean();

      let maxRoll = 0;
      for (const e of existingEnrollments) {
        if (e.rollNumber) {
          const num = parseInt(e.rollNumber, 10);
          if (!isNaN(num) && num > maxRoll) {
            maxRoll = num;
          }
        }
      }

      sectionStats.push({
        _id: sec._id,
        sectionName: sec.sectionName,
        sectionCode: sec.sectionCode,
        maxCapacity: sec.maxCapacity || 30,
        activeEnrolled: existingEnrollments.length,
        availableSlots: Math.max(0, (sec.maxCapacity || 30) - existingEnrollments.length),
        nextRoll: maxRoll + 1
      });
    }

    const assignments = [];
    const unassigned = [];
    let secIndex = 0;

    for (const st of students) {
      let assignedSection = null;
      let attempts = 0;

      while (attempts < sectionStats.length) {
        const candidate = sectionStats[secIndex];
        if (candidate.availableSlots > 0) {
          assignedSection = candidate;
          break;
        }
        secIndex = (secIndex + 1) % sectionStats.length;
        attempts++;
      }

      if (assignedSection) {
        let assignedRoll = '';
        if (rollNumberMethod === 'AUTO') {
          assignedRoll = String(assignedSection.nextRoll);
          assignedSection.nextRoll++;
        }

        assignedSection.availableSlots--;
        assignedSection.activeEnrolled++;

        assignments.push({
          studentId: st.studentId,
          previousEnrollmentId: st.enrollmentId,
          studentName: st.studentName || st.fullName || '',
          admissionNumber: st.admissionNumber || '',
          action: st.action || 'PROMOTE',
          destinationClassRef,
          destinationSectionRef: assignedSection._id,
          destinationSectionName: assignedSection.sectionName,
          rollNumber: assignedRoll
        });

        secIndex = (secIndex + 1) % sectionStats.length;
      } else {
        unassigned.push({
          studentId: st.studentId,
          previousEnrollmentId: st.enrollmentId,
          studentName: st.studentName || st.fullName || '',
          admissionNumber: st.admissionNumber || '',
          reason: 'All active destination sections have reached maximum capacity.'
        });
      }
    }

    return {
      sectionStats,
      assignments,
      unassigned,
      totalRequested: students.length,
      assignedCount: assignments.length,
      unassignedCount: unassigned.length
    };
  }

  /**
   * Execute student promotions and class retentions
   */
  static async executePromotions({
    schoolId,
    schoolRef,
    userId,
    previousAcademicYearRef,
    nextAcademicYearRef,
    promotions = []
  }) {
    const sId = schoolId.toUpperCase();
    if (!previousAcademicYearRef || !nextAcademicYearRef || !Array.isArray(promotions) || promotions.length === 0) {
      const err = new Error('previousAcademicYearRef, nextAcademicYearRef, and promotions array are required.');
      err.statusCode = 400;
      throw err;
    }

    const [prevAy, nextAy] = await Promise.all([
      AcademicYearInfo.findOne({ _id: previousAcademicYearRef, schoolId: sId }),
      AcademicYearInfo.findOne({ _id: nextAcademicYearRef, schoolId: sId })
    ]);

    if (!prevAy || !nextAy) {
      const err = new Error('Previous or Next Academic Year not found in this school.');
      err.statusCode = 404;
      throw err;
    }

    if (nextAy.status === 'COMPLETED') {
      const err = new Error('Cannot promote students into a completed academic year.');
      err.statusCode = 400;
      throw err;
    }

    const results = {
      total: promotions.length,
      successful: 0,
      failed: 0,
      details: []
    };

    for (const item of promotions) {
      const {
        studentId,
        previousEnrollmentId,
        action = 'PROMOTE',
        destinationClassRef,
        destinationSectionRef,
        rollNumber = '',
        remarks = ''
      } = item;

      try {
        const student = await StudentInfo.findOne({ _id: studentId, schoolId: sId });
        if (!student) {
          throw new Error(`Student #${studentId} not found.`);
        }

        const prevEnrollment = await StudentEnrollmentInfo.findOne({
          _id: previousEnrollmentId,
          schoolId: sId,
          studentRef: student._id
        });
        if (!prevEnrollment) {
          throw new Error(`Previous enrollment not found for student '${student.admissionNumber}'.`);
        }

        const alreadyEnrolled = await StudentEnrollmentInfo.findOne({
          schoolId: sId,
          academicYearRef: nextAy._id,
          studentRef: student._id
        });
        if (alreadyEnrolled) {
          throw new Error(`Student '${student.admissionNumber}' is already enrolled in ${nextAy.yearName}.`);
        }

        const [destClass, destSection] = await Promise.all([
          ClassInfo.findOne({ _id: destinationClassRef, schoolId: sId }),
          SectionInfo.findOne({ _id: destinationSectionRef, schoolId: sId })
        ]);

        if (!destClass || destClass.status !== 'ACTIVE') {
          throw new Error('Destination class is invalid or inactive.');
        }
        if (!destSection || destSection.status !== 'ACTIVE') {
          throw new Error('Destination section is invalid or inactive.');
        }
        if (destSection.classRef.toString() !== destClass._id.toString()) {
          throw new Error(`Section '${destSection.sectionName}' does not belong to '${destClass.className}'.`);
        }

        const currentCount = await StudentEnrollmentInfo.countDocuments({
          schoolId: sId,
          academicYearRef: nextAy._id,
          classRef: destClass._id,
          sectionRef: destSection._id,
          status: 'ACTIVE'
        });

        if (currentCount >= destSection.maxCapacity) {
          throw new Error(
            `Section '${destSection.sectionName}' has reached its maximum capacity of ${destSection.maxCapacity}.`
          );
        }

        let cleanRoll = (rollNumber || '').trim();
        if (cleanRoll) {
          const rollConflict = await StudentEnrollmentInfo.findOne({
            schoolId: sId,
            academicYearRef: nextAy._id,
            classRef: destClass._id,
            sectionRef: destSection._id,
            rollNumber: cleanRoll,
            status: 'ACTIVE'
          });
          if (rollConflict) {
            throw new Error(`Roll number '${cleanRoll}' is already in use in Section '${destSection.sectionName}'.`);
          }
        }

        // 1. Mark previous enrollment as completed
        prevEnrollment.status = 'COMPLETED';
        prevEnrollment.promotionOutcome = action === 'PROMOTE' ? 'PROMOTED' : 'REPEATED';
        await prevEnrollment.save();

        // 2. Create new enrollment
        const newEnrollment = new StudentEnrollmentInfo({
          schoolRef: schoolRef || student.schoolRef,
          schoolId: sId,
          studentRef: student._id,
          academicYearRef: nextAy._id,
          classRef: destClass._id,
          sectionRef: destSection._id,
          rollNumber: cleanRoll,
          enrollmentDate: new Date(),
          status: 'ACTIVE',
          remarks: (remarks || '').trim() || (action === 'PROMOTE' ? 'Promoted from previous year' : 'Retained in class')
        });
        await newEnrollment.save();

        // 3. Create history audit record
        const historyRecord = new StudentEnrollmentHistoryInfo({
          schoolRef: schoolRef || student.schoolRef,
          schoolId: sId,
          studentRef: student._id,
          enrollmentRef: newEnrollment._id,
          academicYearRef: nextAy._id,
          previousClassRef: prevEnrollment.classRef,
          previousSectionRef: prevEnrollment.sectionRef,
          newClassRef: destClass._id,
          newSectionRef: destSection._id,
          changeType: action === 'PROMOTE' ? 'PROMOTION' : 'REPETITION',
          remarks:
            (remarks || '').trim() ||
            (action === 'PROMOTE' ? `Promoted to ${destClass.className}` : `Repeating ${destClass.className}`),
          changedBy: userId || null,
          changedAt: new Date()
        });
        await historyRecord.save();

        results.successful++;
        results.details.push({
          studentId: student._id,
          admissionNumber: student.admissionNumber,
          studentName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
          success: true,
          action,
          destinationClass: destClass.className,
          destinationSection: destSection.sectionName,
          rollNumber: cleanRoll
        });
      } catch (err) {
        results.failed++;
        results.details.push({
          studentId,
          previousEnrollmentId,
          success: false,
          error: err.message
        });
      }
    }

    return results;
  }

  /**
   * List section/class transfer records scoped to school, academic year, and optional class/section
   */
  static async listSectionTransfers({ schoolId, academicYearRef, classRef, sectionRef }) {
    const sId = schoolId.toUpperCase();

    let targetAy = null;
    if (academicYearRef && academicYearRef !== 'CURRENT' && academicYearRef !== 'ALL') {
      targetAy = await AcademicYearInfo.findOne({ _id: academicYearRef, schoolId: sId }).lean();
    } else {
      targetAy = await AcademicYearInfo.findOne({ schoolId: sId, isCurrent: true }).lean();
    }

    const query = {
      schoolId: sId,
      changeType: { $in: ['SECTION_TRANSFER', 'CLASS_TRANSFER'] }
    };

    if (targetAy) {
      query.academicYearRef = targetAy._id;
    }

    const hasClassFilter = classRef && classRef !== 'ALL';
    const hasSectionFilter = sectionRef && sectionRef !== 'ALL';

    if (hasClassFilter && hasSectionFilter) {
      query.$or = [
        { previousClassRef: classRef, previousSectionRef: sectionRef },
        { newClassRef: classRef, newSectionRef: sectionRef }
      ];
    } else if (hasClassFilter) {
      query.$or = [{ previousClassRef: classRef }, { newClassRef: classRef }];
    }

    const [records, classDoc, sectionDoc] = await Promise.all([
      StudentEnrollmentHistoryInfo.find(query)
        .populate('studentRef', 'admissionNumber firstName middleName lastName gender')
        .populate('enrollmentRef', 'rollNumber status')
        .populate('academicYearRef', 'yearName yearCode')
        .populate('previousClassRef', 'className classCode')
        .populate('previousSectionRef', 'sectionName sectionCode')
        .populate('newClassRef', 'className classCode')
        .populate('newSectionRef', 'sectionName sectionCode')
        .sort({ changedAt: -1 })
        .lean(),
      hasClassFilter ? ClassInfo.findOne({ _id: classRef, schoolId: sId }).lean() : Promise.resolve(null),
      hasSectionFilter ? SectionInfo.findOne({ _id: sectionRef, schoolId: sId }).lean() : Promise.resolve(null)
    ]);

    const transfers = records
      .filter(r => r.studentRef)
      .map(r => {
        const stu = r.studentRef;
        const fullName = [stu.firstName, stu.middleName, stu.lastName].filter(Boolean).join(' ');
        const isIncoming =
          hasSectionFilter && r.newSectionRef?._id?.toString() === sectionRef.toString();
        const isOutgoing =
          hasSectionFilter && r.previousSectionRef?._id?.toString() === sectionRef.toString();

        return {
          _id: r._id,
          studentId: stu._id,
          admissionNumber: stu.admissionNumber || '',
          fullName,
          gender: stu.gender || '',
          rollNumber: r.enrollmentRef?.rollNumber || '',
          academicYearName: r.academicYearRef?.yearName || r.academicYearRef?.yearCode || '',
          fromClassName: r.previousClassRef?.className || '—',
          fromSectionName: r.previousSectionRef?.sectionName || '—',
          toClassName: r.newClassRef?.className || '—',
          toSectionName: r.newSectionRef?.sectionName || '—',
          direction: isIncoming ? 'INCOMING' : isOutgoing ? 'OUTGOING' : 'TRANSFER',
          changeType: r.changeType,
          remarks: r.remarks || '',
          changedAt: r.changedAt || r.createdAt
        };
      });

    return {
      academicYear: targetAy
        ? { _id: targetAy._id, yearName: targetAy.yearName, yearCode: targetAy.yearCode }
        : null,
      class: classDoc ? { _id: classDoc._id, className: classDoc.className, classCode: classDoc.classCode } : null,
      section: sectionDoc
        ? { _id: sectionDoc._id, sectionName: sectionDoc.sectionName, sectionCode: sectionDoc.sectionCode }
        : null,
      transfers
    };
  }
}

module.exports = StudentService;
