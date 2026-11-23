const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const mongoose = require('mongoose');
const StudentInfo = require('../models/studentInfo.model');
const StudentEnrollmentInfo = require('../models/studentEnrollmentInfo.model');
const StudentEnrollmentHistoryInfo = require('../models/studentEnrollmentHistoryInfo.model');
const StudentImportBatchInfo = require('../models/studentImportBatchInfo.model');
const AcademicYearInfo = require('../models/academicYearInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const SchoolInfo = require('../models/schoolInfo.model');
const StudentService = require('./student.service');

class StudentImportExportService {
  /**
   * 1. Generate downloadable Excel Template
   */
  static generateImportTemplate(importType = 'NEW_ADMISSION') {
    const isNew = importType === 'NEW_ADMISSION';

    const sampleHeaders = [
      'Admission Number',
      'First Name',
      'Middle Name',
      'Last Name',
      'Date of Birth (YYYY-MM-DD)',
      'Gender (MALE/FEMALE/OTHER)',
      'Student Phone',
      'Student Email',
      'Guardian Name',
      'Guardian Relationship (FATHER/MOTHER/GUARDIAN)',
      'Guardian Mobile',
      'Guardian Email',
      'Class Name',
      'Section Name',
      'Roll Number',
      'Enrollment Date (YYYY-MM-DD)',
      'Remarks'
    ];

    const sampleRows = isNew
      ? [
          [
            '', // Leave blank for auto-generation or enter manual
            'Aarav',
            'Rajesh',
            'Sharma',
            '2012-05-15',
            'MALE',
            '9876543210',
            'aarav@example.com',
            'Rajesh Sharma',
            'FATHER',
            '9876500111',
            'rajesh@example.com',
            'Class 5',
            'Section A',
            '1',
            '2026-06-15',
            'Admitted through Excel Import'
          ],
          [
            'ADM-2026-9999',
            'Ananya',
            '',
            'Verma',
            '2012-08-20',
            'FEMALE',
            '',
            '',
            'Sunita Verma',
            'MOTHER',
            '9876500222',
            '',
            'Class 5',
            'Section B',
            '2',
            '2026-06-15',
            'Manual admission number example'
          ]
        ]
      : [
          [
            'ADM-2026-0001',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            'Class 6',
            'Section A',
            '1',
            '2026-06-15',
            'Re-enrolling existing student in new year'
          ]
        ];

    const ws = XLSX.utils.aoa_to_sheet([sampleHeaders, ...sampleRows]);

    // Instructions sheet
    const instructions = [
      ['DMMS - Student Import Instructions'],
      [''],
      ['Import Type:', importType],
      ['Rules:'],
      [
        '1. For NEW_ADMISSION: Leave "Admission Number" blank to auto-generate, or provide a unique school admission number.'
      ],
      [
        '2. For EXISTING_ENROLLMENT: "Admission Number" is strictly mandatory to match the student master record.'
      ],
      ['3. Date format must be strictly YYYY-MM-DD (e.g. 2012-05-15).'],
      ['4. Gender must be MALE, FEMALE, or OTHER.'],
      ['5. Class Name and Section Name must match existing active classes/sections in your school.'],
      ['6. Guardian Mobile must be a valid 10-digit number.'],
      ['7. Roll Number is optional. If provided, it must be unique in that section.']
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Student_Data');
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * 2. Parse and Preview Uploaded Excel File
   */
  static async parseAndPreviewImport({ schoolId, academicYearRef, importType, fileBuffer, fileName }) {
    const sId = schoolId.toUpperCase();
    if (!academicYearRef) {
      throw new Error('Target academic year is required for import.');
    }

    const academicYear = await AcademicYearInfo.findOne({ _id: academicYearRef, schoolId: sId });
    if (!academicYear) {
      throw new Error('Academic year not found in this school.');
    }
    if (academicYear.status === 'COMPLETED') {
      throw new Error('Cannot import students into a completed academic year.');
    }

    // Load all classes and sections in school for fast memory lookup
    const [allClasses, allSections] = await Promise.all([
      ClassInfo.find({ schoolId: sId, status: 'ACTIVE' }).lean(),
      SectionInfo.find({ schoolId: sId, status: 'ACTIVE' }).lean()
    ]);

    const classMap = new Map();
    allClasses.forEach((c) => {
      classMap.set(c.className.toLowerCase().trim(), c);
      classMap.set(c.classCode.toLowerCase().trim(), c);
    });

    const sectionMap = new Map();
    allSections.forEach((s) => {
      // Key by classId + sectionName.toLowerCase()
      sectionMap.set(`${s.classRef.toString()}_${s.sectionName.toLowerCase().trim()}`, s);
      sectionMap.set(`${s.classRef.toString()}_${s.sectionCode.toLowerCase().trim()}`, s);
    });

    // Read Excel Workbook
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      throw new Error('The uploaded Excel file contains no data rows.');
    }

    const validRows = [];
    const invalidRows = [];
    const seenAdmNos = new Set();
    const seenRollMap = new Map(); // sectionId -> Set of rollNumbers

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNum = i + 2; // Excel row numbering (1 header + index 0 = row 2)
      const errors = [];

      const admNo = String(row['Admission Number'] || '').trim().toUpperCase();
      const firstName = String(row['First Name'] || '').trim();
      const middleName = String(row['Middle Name'] || '').trim();
      const lastName = String(row['Last Name'] || '').trim();
      const dobStr = String(row['Date of Birth (YYYY-MM-DD)'] || '').trim();
      const gender = String(row['Gender (MALE/FEMALE/OTHER)'] || '').trim().toUpperCase();
      const studentPhone = String(row['Student Phone'] || '').trim();
      const studentEmail = String(row['Student Email'] || '').trim();
      const guardianName = String(row['Guardian Name'] || '').trim();
      const guardianRel = String(row['Guardian Relationship (FATHER/MOTHER/GUARDIAN)'] || '').trim().toUpperCase();
      const guardianMobile = String(row['Guardian Mobile'] || '').trim();
      const guardianEmail = String(row['Guardian Email'] || '').trim();
      const classNameInput = String(row['Class Name'] || '').trim();
      const sectionNameInput = String(row['Section Name'] || '').trim();
      const rollNumber = String(row['Roll Number'] || '').trim();
      const enrollmentDateStr = String(row['Enrollment Date (YYYY-MM-DD)'] || '').trim();
      const remarks = String(row['Remarks'] || '').trim();

      // Validate Class & Section
      if (!classNameInput) {
        errors.push('Class Name is required.');
      }
      const matchedClass = classMap.get(classNameInput.toLowerCase());
      if (classNameInput && !matchedClass) {
        errors.push(`Class '${classNameInput}' not found or is inactive in this school.`);
      }

      if (!sectionNameInput) {
        errors.push('Section Name is required.');
      }
      let matchedSection = null;
      if (matchedClass && sectionNameInput) {
        matchedSection = sectionMap.get(`${matchedClass._id.toString()}_${sectionNameInput.toLowerCase()}`);
        if (!matchedSection) {
          errors.push(`Section '${sectionNameInput}' not found under '${matchedClass.className}'.`);
        }
      }

      // Roll Number Validation in Section
      if (matchedSection && rollNumber) {
        if (!seenRollMap.has(matchedSection._id.toString())) {
          seenRollMap.set(matchedSection._id.toString(), new Set());
        }
        const sectionRolls = seenRollMap.get(matchedSection._id.toString());
        if (sectionRolls.has(rollNumber)) {
          errors.push(`Duplicate roll number '${rollNumber}' in section '${matchedSection.sectionName}' within this Excel file.`);
        } else {
          sectionRolls.add(rollNumber);
        }
      }

      let studentDoc = null;

      if (importType === 'NEW_ADMISSION') {
        if (!firstName) errors.push('First Name is required.');
        if (!lastName) errors.push('Last Name is required.');

        if (!dobStr) {
          errors.push('Date of Birth is required.');
        } else {
          const dob = new Date(dobStr);
          if (isNaN(dob.getTime()) || dob >= new Date()) {
            errors.push('Date of Birth must be a valid past date (YYYY-MM-DD).');
          }
        }

        if (!['MALE', 'FEMALE', 'OTHER'].includes(gender)) {
          errors.push('Gender must be MALE, FEMALE, or OTHER.');
        }

        if (!guardianName) errors.push('Guardian Name is required.');
        if (!guardianRel) errors.push('Guardian Relationship is required.');
        if (!guardianMobile) errors.push('Guardian Mobile is required.');

        if (admNo) {
          if (seenAdmNos.has(admNo)) {
            errors.push(`Duplicate admission number '${admNo}' within this Excel file.`);
          } else {
            seenAdmNos.add(admNo);
            const exists = await StudentInfo.exists({ schoolId: sId, admissionNumber: admNo });
            if (exists) {
              errors.push(`Admission number '${admNo}' already exists in this school.`);
            }
          }
        }
      } else {
        // EXISTING_ENROLLMENT
        if (!admNo) {
          errors.push('Admission Number is required for existing student enrollment.');
        } else {
          studentDoc = await StudentInfo.findOne({ schoolId: sId, admissionNumber: admNo }).lean();
          if (!studentDoc) {
            errors.push(`No student found with admission number '${admNo}' in this school.`);
          } else if (studentDoc.status !== 'ACTIVE') {
            errors.push(`Student '${admNo}' has status '${studentDoc.status}'. Only ACTIVE students can be enrolled.`);
          } else {
            // Check if already enrolled in this academic year
            const alreadyEnrolled = await StudentEnrollmentInfo.exists({
              schoolId: sId,
              academicYearRef: academicYear._id,
              studentRef: studentDoc._id
            });
            if (alreadyEnrolled) {
              errors.push(`Student '${admNo}' is already enrolled in this academic year.`);
            }
          }
        }
      }

      const rowData = {
        rowNumber: rowNum,
        admissionNumber: admNo,
        firstName: firstName || studentDoc?.firstName || '',
        middleName: middleName || studentDoc?.middleName || '',
        lastName: lastName || studentDoc?.lastName || '',
        fullName: [firstName || studentDoc?.firstName, middleName || studentDoc?.middleName, lastName || studentDoc?.lastName].filter(Boolean).join(' '),
        dateOfBirth: dobStr || (studentDoc?.dateOfBirth ? new Date(studentDoc.dateOfBirth).toISOString().split('T')[0] : ''),
        gender: gender || studentDoc?.gender || '',
        studentPhone: studentPhone || studentDoc?.contact?.phone || '',
        studentEmail: studentEmail || studentDoc?.contact?.email || '',
        guardianDetails: [
          {
            fullName: guardianName,
            relationship: guardianRel || 'GUARDIAN',
            mobileNumber: guardianMobile,
            email: guardianEmail,
            isPrimaryContact: true
          }
        ],
        classId: matchedClass?._id,
        className: matchedClass?.className || classNameInput,
        sectionId: matchedSection?._id,
        sectionName: matchedSection?.sectionName || sectionNameInput,
        rollNumber,
        enrollmentDate: enrollmentDateStr || new Date().toISOString().split('T')[0],
        remarks,
        matchedStudentId: studentDoc?._id || null
      };

      if (errors.length > 0) {
        invalidRows.push({ ...rowData, errors });
      } else {
        validRows.push(rowData);
      }
    }

    return {
      fileName,
      importType,
      academicYearName: academicYear.yearName,
      totalRows: rawRows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      validRows,
      invalidRows
    };
  }

  /**
   * 3. Commit Validated Import Batch
   */
  static async commitImportBatch({
    schoolId,
    schoolRef,
    userId,
    academicYearRef,
    importType,
    fileName,
    validRows = []
  }) {
    const sId = schoolId.toUpperCase();
    if (!academicYearRef || !Array.isArray(validRows) || validRows.length === 0) {
      throw new Error('academicYearRef and validRows are required.');
    }

    const academicYear = await AcademicYearInfo.findOne({ _id: academicYearRef, schoolId: sId });
    if (!academicYear) {
      throw new Error('Academic year not found in this school.');
    }

    // Create Audit Batch Record
    const batch = new StudentImportBatchInfo({
      schoolRef,
      schoolId: sId,
      academicYearRef: academicYear._id,
      fileName: fileName || 'student_import.xlsx',
      importType,
      totalRecords: validRows.length,
      status: 'PROCESSING',
      importedBy: userId || null,
      importedAt: new Date()
    });
    await batch.save();

    let successfulRecords = 0;
    let failedRecords = 0;
    const batchErrors = [];

    for (const row of validRows) {
      try {
        let studentId = row.matchedStudentId;

        if (importType === 'NEW_ADMISSION') {
          // Resolve admission number
          let finalAdmNo = row.admissionNumber;
          if (!finalAdmNo) {
            finalAdmNo = await StudentService.generateAdmissionNumber(sId);
          }

          const newStudent = new StudentInfo({
            schoolRef,
            schoolId: sId,
            admissionNumber: finalAdmNo,
            firstName: row.firstName,
            middleName: row.middleName,
            lastName: row.lastName,
            dateOfBirth: new Date(row.dateOfBirth),
            gender: row.gender,
            contact: {
              phone: row.studentPhone,
              email: row.studentEmail
            },
            guardianDetails: row.guardianDetails,
            admissionAcademicYearRef: academicYear._id,
            admissionClassRef: row.classId,
            admissionDate: new Date(row.enrollmentDate),
            status: 'ACTIVE'
          });

          await newStudent.save();
          studentId = newStudent._id;
        }

        // Create Enrollment Record
        const newEnrollment = new StudentEnrollmentInfo({
          schoolRef,
          schoolId: sId,
          studentRef: studentId,
          academicYearRef: academicYear._id,
          classRef: row.classId,
          sectionRef: row.sectionId,
          rollNumber: row.rollNumber || '',
          enrollmentDate: new Date(row.enrollmentDate),
          status: 'ACTIVE',
          remarks: row.remarks || `Imported via ${importType}`
        });

        await newEnrollment.save();

        // Create History Audit
        const history = new StudentEnrollmentHistoryInfo({
          schoolRef,
          schoolId: sId,
          studentRef: studentId,
          enrollmentRef: newEnrollment._id,
          academicYearRef: academicYear._id,
          previousClassRef: null,
          previousSectionRef: null,
          newClassRef: row.classId,
          newSectionRef: row.sectionId,
          changeType: 'ADMISSION',
          remarks: `Excel Batch Import (${importType})`,
          changedBy: userId || null,
          changedAt: new Date()
        });

        await history.save();
        successfulRecords++;
      } catch (rowErr) {
        failedRecords++;
        batchErrors.push({
          row: row.rowNumber,
          admissionNumber: row.admissionNumber,
          studentName: row.fullName,
          reason: rowErr.message
        });
      }
    }

    // Finalize Batch Record
    batch.successfulRecords = successfulRecords;
    batch.failedRecords = failedRecords;
    batch.status = failedRecords === validRows.length ? 'FAILED' : 'COMPLETED';
    batch.errors = batchErrors;
    await batch.save();

    return {
      batchId: batch._id,
      totalRecords: validRows.length,
      successfulRecords,
      failedRecords,
      status: batch.status,
      errors: batchErrors
    };
  }

  /**
   * 4. Export Students to Excel
   */
  static async exportStudentsToExcel({ schoolId, academicYearRef, classRef, sectionRef, status, gender, search }) {
    const sId = schoolId.toUpperCase();
    const result = await StudentService.listStudents({
      schoolId: sId,
      academicYearRef,
      classRef,
      sectionRef,
      status,
      gender,
      search,
      page: 1,
      limit: 10000 // Export up to 10k rows
    });

    const students = result.students || [];

    const headers = [
      'Admission Number',
      'Full Name',
      'First Name',
      'Middle Name',
      'Last Name',
      'Gender',
      'Date of Birth',
      'Academic Year',
      'Class',
      'Section',
      'Roll Number',
      'Primary Guardian Name',
      'Guardian Relationship',
      'Guardian Mobile',
      'Guardian Email',
      'Student Phone',
      'Student Email',
      'Status',
      'Admission Date'
    ];

    const rows = students.map((s) => [
      s.admissionNumber,
      s.fullName,
      s.firstName,
      s.middleName,
      s.lastName,
      s.gender,
      s.dateOfBirth ? new Date(s.dateOfBirth).toISOString().split('T')[0] : '',
      s.academicYearName,
      s.className,
      s.sectionName,
      s.rollNumber || '',
      s.primaryGuardian?.fullName || '',
      s.primaryGuardian?.relationship || '',
      s.primaryGuardian?.mobileNumber || '',
      s.primaryGuardian?.email || '',
      s.studentPhone || '',
      s.studentEmail || '',
      s.status,
      s.admissionDate ? new Date(s.admissionDate).toISOString().split('T')[0] : ''
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * 5. Export Single Student Profile to PDF
   */
  static async exportStudentProfileToPDF({ schoolId, studentId, academicYearRef }) {
    const sId = schoolId.toUpperCase();
    const [profile, school] = await Promise.all([
      StudentService.getStudentById(sId, studentId, academicYearRef),
      SchoolInfo.findOne({ schoolId: sId }).lean()
    ]);

    const s = profile.student;
    const curr = profile.currentEnrollment;
    const fullName = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ');

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        doc.fontSize(18).font('Helvetica-Bold').text(school?.schoolName || 'DIGITAL MARKSHEET MANAGEMENT SYSTEM', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(school?.address || '', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e40af').text('STUDENT PROFILE REPORT', { align: 'center' });
        doc.moveDown(0.5);
        doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(1);

        // Student Info Box
        doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Personal Information');
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Full Name: ${fullName}`);
        doc.text(`Admission Number: ${s.admissionNumber}`);
        doc.text(`Date of Birth: ${s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('en-GB') : 'N/A'}`);
        doc.text(`Gender: ${s.gender}`);
        doc.text(`Student Mobile: ${s.contact?.phone || 'N/A'}`);
        doc.text(`Student Email: ${s.contact?.email || 'N/A'}`);
        doc.text(`Account Status: ${s.status}`);
        doc.moveDown(1);

        // Academic Placement Box
        doc.fontSize(12).font('Helvetica-Bold').text('Current Academic Placement');
        doc.moveDown(0.4);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Academic Year: ${curr?.academicYearRef?.yearName || 'N/A'}`);
        doc.text(`Class: ${curr?.classRef?.className || 'N/A'}`);
        doc.text(`Section: ${curr?.sectionRef?.sectionName || 'N/A'}`);
        doc.text(`Roll Number: ${curr?.rollNumber ? '#' + curr.rollNumber : 'Not Assigned'}`);
        doc.text(`Enrollment Date: ${curr?.enrollmentDate ? new Date(curr.enrollmentDate).toLocaleDateString('en-GB') : 'N/A'}`);
        doc.moveDown(1);

        // Guardians
        doc.fontSize(12).font('Helvetica-Bold').text('Guardian Details');
        doc.moveDown(0.4);
        (s.guardianDetails || []).forEach((g, idx) => {
          doc.fontSize(10).font('Helvetica');
          doc.text(`Guardian #${idx + 1}: ${g.fullName} (${g.relationship})${g.isPrimaryContact ? ' [Primary Contact]' : ''}`);
          doc.text(`  Mobile: ${g.mobileNumber} | Email: ${g.email || 'N/A'}`);
        });
        doc.moveDown(1);

        // Enrollment History
        doc.fontSize(12).font('Helvetica-Bold').text('Academic Enrollment History');
        doc.moveDown(0.4);
        (profile.allEnrollments || []).forEach((enr) => {
          doc.fontSize(10).font('Helvetica');
          doc.text(
            `• ${enr.academicYearRef?.yearName || 'N/A'}: ${enr.classRef?.className || 'N/A'} - ${enr.sectionRef?.sectionName || 'N/A'} (Roll #${enr.rollNumber || '—'}) - Status: ${enr.status}`
          );
        });

        // Footer
        doc.fontSize(8).fillColor('#64748b').text(`Generated on ${new Date().toLocaleString()} | Official DMMS Document`, 40, 780, { align: 'center', width: 515 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 6. Export Class/Section Student List to PDF
   */
  static async exportClassListToPDF({ schoolId, academicYearRef, classRef, sectionRef }) {
    const sId = schoolId.toUpperCase();
    const [summary, school] = await Promise.all([
      StudentService.getSectionEnrollmentSummary({ schoolId: sId, academicYearRef, classRef, sectionRef }),
      SchoolInfo.findOne({ schoolId: sId }).lean()
    ]);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text(school?.schoolName || 'DIGITAL MARKSHEET MANAGEMENT SYSTEM', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text(school?.address || '', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e40af').text(
          `STUDENT ROSTER: ${summary.class.className} - ${summary.section.sectionName} (${summary.academicYear.yearName})`,
          { align: 'center' }
        );
        doc.moveDown(0.5);
        doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(1);

        doc.fillColor('#0f172a').fontSize(9).font('Helvetica');
        doc.text(`Total Enrolled: ${summary.capacity.totalEnrolled} | Active: ${summary.capacity.activeEnrolled} | Capacity: ${summary.capacity.maxCapacity}`);
        doc.moveDown(0.8);

        // Table Header
        let y = doc.y;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e3a8a');
        doc.text('Roll', 40, y);
        doc.text('Adm No', 80, y);
        doc.text('Student Name', 160, y);
        doc.text('Gender', 340, y);
        doc.text('Enrollment Date', 410, y);
        doc.text('Status', 490, y);
        y += 15;
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, y).lineTo(555, y).stroke();
        y += 6;

        // Rows
        doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
        (summary.enrollments || []).forEach((enr) => {
          if (y > 750) {
            doc.addPage();
            y = 40;
          }
          doc.text(enr.rollNumber ? '#' + enr.rollNumber : '—', 40, y);
          doc.text(enr.admissionNumber, 80, y);
          doc.text(enr.fullName, 160, y);
          doc.text(enr.gender, 340, y);
          doc.text(enr.enrollmentDate ? new Date(enr.enrollmentDate).toLocaleDateString('en-GB') : '—', 410, y);
          doc.text(enr.status, 490, y);
          y += 16;
        });

        // Footer
        doc.fontSize(8).fillColor('#64748b').text(`Generated on ${new Date().toLocaleString()} | Official DMMS Document`, 40, 790, { align: 'center', width: 515 });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = StudentImportExportService;
