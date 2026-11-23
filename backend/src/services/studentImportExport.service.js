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

/**
 * Helper: Parse Excel Date (handles JS Date, serial numbers, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY)
 */
function parseExcelDate(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const y = val.getUTCFullYear();
      const m = String(val.getUTCMonth() + 1).padStart(2, '0');
      const d = String(val.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return null;
  }
  if (typeof val === 'number') {
    // Excel serial date code
    const ms = Math.round((val - 25569) * 86400 * 1000);
    const date = new Date(ms);
    if (!isNaN(date.getTime())) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return null;
  }
  const str = String(val).trim();
  if (!str) return null;

  // Check YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Check DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Fallback to standard Date.parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Helper: Parse full name into firstName, middleName, lastName without losing any parts
 */
function parseStudentName(nameStr) {
  const trimmed = String(nameStr || '').trim();
  if (!trimmed) {
    return { firstName: '', middleName: '', lastName: '', fullName: '' };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      middleName: '',
      lastName: '',
      fullName: parts[0]
    };
  }
  if (parts.length === 2) {
    return {
      firstName: parts[0],
      middleName: '',
      lastName: parts[1],
      fullName: trimmed
    };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
    fullName: trimmed
  };
}

class StudentImportExportService {
  /**
   * 1. Generate downloadable Excel Template
   */
  static generateImportTemplate(importType = 'NEW_ADMISSION') {
    const isNew = importType === 'NEW_ADMISSION';

    // Official 15-column format for NEW_ADMISSION
    const sampleHeaders = isNew
      ? [
          'ROLL NO.',
          'NAME',
          'CLASS',
          'SEC',
          'ADDRESS',
          'DATE OF BIRTH',
          'BLOOD GROUP',
          "FATHER'S NAME",
          'OCCUPATION',
          'CONTACT NO. OF FATHER',
          "MOTHER'S NAME",
          'OCCUPATION',
          'CONTACT NO. OF MOTHER',
          'RELIGION',
          'School Admission No'
        ]
      : [
          'Admission Number',
          'Class Name',
          'Section Name',
          'Roll Number',
          'Enrollment Date (YYYY-MM-DD)',
          'Remarks'
        ];

    const sampleRows = isNew
      ? [
          [
            '1',
            'Aarav Sharma',
            'Class 5',
            'Section A',
            '123 Park Street, City',
            '2012-05-15',
            'O+',
            'Rajesh Sharma',
            'Business',
            '9876500111',
            'Sunita Sharma',
            'Teacher',
            '9876500222',
            'Hinduism',
            'ADM-2026-0001'
          ],
          [
            '2',
            'Ananya Verma',
            'Class 5',
            'Section B',
            '45 Lake Road, City',
            '2012-08-20',
            'B+',
            'Vikram Verma',
            'Engineer',
            '9876500333',
            'Pooja Verma',
            'Doctor',
            '9876500444',
            'Hinduism',
            ''
          ]
        ]
      : [
          [
            'ADM-2026-0001',
            'Class 6',
            'Section A',
            '1',
            '2026-06-15',
            'Re-enrolling existing student in new year'
          ]
        ];

    const ws = XLSX.utils.aoa_to_sheet([sampleHeaders, ...sampleRows]);

    // Instructions sheet
    const instructions = isNew
      ? [
          ['DMMS - Student Import Instructions (Official School Format)'],
          [''],
          ['Import Type:', importType],
          ['Rules:'],
          ['1. ROLL NO.: Student roll number for the section (optional, must be unique within section if provided).'],
          ['2. NAME: Full student name (e.g. "Aarav Sharma" or single name "Aarav").'],
          ['3. CLASS: Class name (e.g. "Class 5" or "5"). Must match an active class in the school.'],
          ['4. SEC: Section name (e.g. "Section A" or "A"). Must belong to the specified class.'],
          ['5. ADDRESS: Student address (optional).'],
          ['6. DATE OF BIRTH: Date of birth (e.g. YYYY-MM-DD or DD/MM/YYYY). Must be a valid past date.'],
          ['7. BLOOD GROUP: Student blood group (optional, e.g. "O+", "A+").'],
          ["8. FATHER'S NAME: Father full name (optional)."],
          ['9. OCCUPATION: Father\'s occupation (first OCCUPATION column, optional).'],
          ['10. CONTACT NO. OF FATHER: Father\'s mobile/contact number (optional).'],
          ["11. MOTHER'S NAME: Mother full name (optional)."],
          ['12. OCCUPATION: Mother\'s occupation (second OCCUPATION column, optional).'],
          ['13. CONTACT NO. OF MOTHER: Mother\'s mobile/contact number (optional).'],
          ['14. RELIGION: Student religion (optional).'],
          ['15. School Admission No: Unique admission number (optional; leave blank to auto-generate).']
        ]
      : [
          ['DMMS - Student Import Instructions (Existing Student Enrollment)'],
          [''],
          ['Import Type:', importType],
          ['Rules:'],
          ['1. Admission Number is strictly mandatory to match the student master record.'],
          ['2. Class Name and Section Name must match existing active classes/sections in your school.'],
          ['3. Roll Number is optional. If provided, it must be unique in that section.']
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
      const name = c.className.toLowerCase().trim();
      const code = c.classCode.toLowerCase().trim();
      classMap.set(name, c);
      classMap.set(code, c);
      const nameWithoutPrefix = name.replace(/^class\s*/i, '').trim();
      if (nameWithoutPrefix) {
        classMap.set(nameWithoutPrefix, c);
        classMap.set(`class ${nameWithoutPrefix}`, c);
      }
      const codeWithoutPrefix = code.replace(/^[a-z]+-?/i, '').trim();
      if (codeWithoutPrefix) {
        classMap.set(codeWithoutPrefix, c);
      }
    });

    const sectionMap = new Map();
    allSections.forEach((s) => {
      const cIdStr = s.classRef.toString();
      const sName = s.sectionName.toLowerCase().trim();
      const sCode = s.sectionCode.toLowerCase().trim();
      sectionMap.set(`${cIdStr}_${sName}`, s);
      sectionMap.set(`${cIdStr}_${sCode}`, s);
      const nameWithoutSec = sName.replace(/^sec(tion)?\s*/i, '').trim();
      if (nameWithoutSec) {
        sectionMap.set(`${cIdStr}_${nameWithoutSec}`, s);
        sectionMap.set(`${cIdStr}_section ${nameWithoutSec}`, s);
        sectionMap.set(`${cIdStr}_sec ${nameWithoutSec}`, s);
      }
      const codeWithoutSec = sCode.replace(/^sec(tion)?-?/i, '').trim();
      if (codeWithoutSec) {
        sectionMap.set(`${cIdStr}_${codeWithoutSec}`, s);
      }
    });

    const findClass = (classNameInput) => {
      if (!classNameInput) return null;
      const trimmed = classNameInput.toLowerCase().trim();
      return (
        classMap.get(trimmed) ||
        classMap.get(`class ${trimmed}`) ||
        classMap.get(trimmed.replace(/^class\s*/i, '')) ||
        null
      );
    };

    const findSection = (matchedClass, sectionNameInput) => {
      if (!matchedClass || !sectionNameInput) return null;
      const cIdStr = matchedClass._id.toString();
      const trimmed = sectionNameInput.toLowerCase().trim();
      return (
        sectionMap.get(`${cIdStr}_${trimmed}`) ||
        sectionMap.get(`${cIdStr}_${trimmed.replace(/^sec(tion)?\s*/i, '')}`) ||
        sectionMap.get(`${cIdStr}_section ${trimmed}`) ||
        sectionMap.get(`${cIdStr}_sec ${trimmed}`) ||
        null
      );
    };

    // Read Excel Workbook
    const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false });

    if (!aoa || aoa.length === 0) {
      throw new Error('The uploaded Excel file contains no data rows.');
    }

    const headerRow = aoa[0] || [];
    const normalizedHeaders = headerRow.map((h) => String(h || '').trim().toUpperCase());

    // Determine format: official 15-column format vs legacy template
    const hasFirstName = normalizedHeaders.some((h) => h.includes('FIRST NAME'));
    const isOfficial =
      !hasFirstName &&
      (normalizedHeaders.includes('CLASS') ||
        normalizedHeaders.includes('SEC') ||
        normalizedHeaders.includes('ROLL NO.') ||
        normalizedHeaders.includes('ROLL NO'));

    const validRows = [];
    const invalidRows = [];
    const seenAdmNos = new Set();
    const seenRollMap = new Map(); // sectionId -> Set of rollNumbers

    const getCellStr = (val) => (val === undefined || val === null ? '' : String(val).trim());

    if (isOfficial) {
      // ---------------------------------------------------------
      // OFFICIAL 15-COLUMN FORMAT PARSER
      // ---------------------------------------------------------
      let rollNoCol = -1;
      let nameCol = -1;
      let classCol = -1;
      let secCol = -1;
      let addressCol = -1;
      let dobCol = -1;
      let bloodGroupCol = -1;
      let fatherNameCol = -1;
      let fatherOccCol = -1;
      let fatherContactCol = -1;
      let motherNameCol = -1;
      let motherOccCol = -1;
      let motherContactCol = -1;
      let religionCol = -1;
      let admNoCol = -1;

      for (let c = 0; c < headerRow.length; c++) {
        const h = String(headerRow[c] || '').trim().toUpperCase();
        if (h.includes('ROLL')) {
          rollNoCol = c;
        } else if (h === 'NAME' || h === 'STUDENT NAME') {
          nameCol = c;
        } else if (h === 'CLASS' || h === 'CLASS NAME') {
          classCol = c;
        } else if (h === 'SEC' || h === 'SECTION' || h === 'SECTION NAME') {
          secCol = c;
        } else if (h.includes('ADDRESS')) {
          addressCol = c;
        } else if (h.includes('BIRTH') || h === 'DOB') {
          dobCol = c;
        } else if (h.includes('BLOOD')) {
          bloodGroupCol = c;
        } else if (h.includes('FATHER') && h.includes('NAME')) {
          fatherNameCol = c;
        } else if (h.includes('OCCUPATION')) {
          // Distinguish Father's Occupation (1st) from Mother's Occupation (2nd)
          if (fatherOccCol === -1) {
            fatherOccCol = c;
          } else {
            motherOccCol = c;
          }
        } else if (
          h.includes('FATHER') &&
          (h.includes('CONTACT') || h.includes('PHONE') || h.includes('MOBILE') || h.includes('NO'))
        ) {
          fatherContactCol = c;
        } else if (h.includes('MOTHER') && h.includes('NAME')) {
          motherNameCol = c;
        } else if (
          h.includes('MOTHER') &&
          (h.includes('CONTACT') || h.includes('PHONE') || h.includes('MOBILE') || h.includes('NO'))
        ) {
          motherContactCol = c;
        } else if (h.includes('RELIGION')) {
          religionCol = c;
        } else if (h.includes('ADMISSION')) {
          admNoCol = c;
        }
      }

      // Positional fallbacks for official 15 columns if headers weren't named identically
      if (rollNoCol === -1) rollNoCol = 0;
      if (nameCol === -1) nameCol = 1;
      if (classCol === -1) classCol = 2;
      if (secCol === -1) secCol = 3;
      if (addressCol === -1) addressCol = 4;
      if (dobCol === -1) dobCol = 5;
      if (bloodGroupCol === -1) bloodGroupCol = 6;
      if (fatherNameCol === -1) fatherNameCol = 7;
      if (fatherOccCol === -1) fatherOccCol = 8;
      if (fatherContactCol === -1) fatherContactCol = 9;
      if (motherNameCol === -1) motherNameCol = 10;
      if (motherOccCol === -1) motherOccCol = 11;
      if (motherContactCol === -1) motherContactCol = 12;
      if (religionCol === -1) religionCol = 13;
      if (admNoCol === -1) admNoCol = 14;

      for (let i = 1; i < aoa.length; i++) {
        const r = aoa[i] || [];
        const isBlank = r.every((c) => c === undefined || c === null || String(c).trim() === '');
        if (isBlank) continue;

        const rowNum = i + 1; // 1-indexed (row 1 is header)
        const errors = [];

        const rollNumber = getCellStr(r[rollNoCol]);
        const rawName = getCellStr(r[nameCol]);
        const classNameInput = getCellStr(r[classCol]);
        const sectionNameInput = getCellStr(r[secCol]);
        const address = getCellStr(r[addressCol]);
        const rawDob = r[dobCol];
        const bloodGroup = getCellStr(r[bloodGroupCol]);
        const fatherName = getCellStr(r[fatherNameCol]);
        const fatherOccupation = getCellStr(r[fatherOccCol]);
        const fatherContact = getCellStr(r[fatherContactCol]);
        const motherName = getCellStr(r[motherNameCol]);
        const motherOccupation = getCellStr(r[motherOccCol]);
        const motherContact = getCellStr(r[motherContactCol]);
        const religion = getCellStr(r[religionCol]);
        const admNo = getCellStr(r[admNoCol]).toUpperCase();

        // 1. Validate Student Name
        if (!rawName) {
          errors.push('Student Name is required.');
        }
        const { firstName, middleName, lastName, fullName } = parseStudentName(rawName);

        // 2. Validate Class & Section
        if (!classNameInput) {
          errors.push('Class Name is required.');
        }
        const matchedClass = findClass(classNameInput);
        if (classNameInput && !matchedClass) {
          errors.push(`Class '${classNameInput}' not found or is inactive in this school.`);
        }

        if (!sectionNameInput) {
          errors.push('Section Name is required.');
        }
        let matchedSection = null;
        if (matchedClass && sectionNameInput) {
          matchedSection = findSection(matchedClass, sectionNameInput);
          if (!matchedSection) {
            errors.push(`Section '${sectionNameInput}' not found under '${matchedClass.className}'.`);
          }
        }

        // 3. Validate Roll Number (Unique within Section & AY)
        if (matchedSection && rollNumber) {
          const secKey = matchedSection._id.toString();
          if (!seenRollMap.has(secKey)) {
            seenRollMap.set(secKey, new Set());
          }
          const sectionRolls = seenRollMap.get(secKey);
          if (sectionRolls.has(rollNumber)) {
            errors.push(
              `Duplicate roll number '${rollNumber}' in section '${matchedSection.sectionName}' within this Excel file.`
            );
          } else {
            sectionRolls.add(rollNumber);
          }

          // Check DB for existing roll number in this section & academic year
          const rollExistsInDb = await StudentEnrollmentInfo.exists({
            schoolId: sId,
            academicYearRef: academicYear._id,
            classRef: matchedClass._id,
            sectionRef: matchedSection._id,
            rollNumber,
            status: 'ACTIVE'
          });
          if (rollExistsInDb) {
            errors.push(
              `Roll number '${rollNumber}' is already assigned in section '${matchedSection.sectionName}' for this academic year.`
            );
          }
        }

        // 4. Validate Date of Birth
        let dobFormatted = '';
        if (!rawDob && rawDob !== 0) {
          errors.push('Date of Birth is required.');
        } else {
          dobFormatted = parseExcelDate(rawDob);
          if (!dobFormatted) {
            errors.push('Date of Birth must be a valid date (e.g. YYYY-MM-DD or DD/MM/YYYY).');
          } else {
            const dobObj = new Date(dobFormatted);
            if (isNaN(dobObj.getTime()) || dobObj >= new Date()) {
              errors.push('Date of Birth must be a valid past date.');
            }
          }
        }

        // 5. Build Guardian Records
        const guardianDetails = [];
        if (fatherName) {
          guardianDetails.push({
            fullName: fatherName,
            relationship: 'Father',
            occupation: fatherOccupation,
            mobileNumber: fatherContact,
            email: '',
            isPrimaryContact: true
          });
        }
        if (motherName) {
          guardianDetails.push({
            fullName: motherName,
            relationship: 'Mother',
            occupation: motherOccupation,
            mobileNumber: motherContact,
            email: '',
            isPrimaryContact: guardianDetails.length === 0
          });
        }

        let studentDoc = null;

        if (importType === 'NEW_ADMISSION') {
          // Admission number uniqueness validation (if provided)
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
          rollNumber,
          admissionNumber: admNo,
          firstName: firstName || studentDoc?.firstName || '',
          middleName: middleName || studentDoc?.middleName || '',
          lastName: lastName || studentDoc?.lastName || '',
          fullName: rawName || fullName || studentDoc?.fullName || '',
          dateOfBirth: dobFormatted || (studentDoc?.dateOfBirth ? new Date(studentDoc.dateOfBirth).toISOString().split('T')[0] : ''),
          gender: 'UNAVAILABLE',
          address,
          bloodGroup,
          religion,
          fatherName,
          fatherOccupation,
          fatherContact,
          motherName,
          motherOccupation,
          motherContact,
          studentPhone: '',
          studentEmail: '',
          guardianDetails: guardianDetails.length > 0 ? guardianDetails : (studentDoc?.guardianDetails || []),
          classId: matchedClass?._id,
          className: matchedClass?.className || classNameInput,
          sectionId: matchedSection?._id,
          sectionName: matchedSection?.sectionName || sectionNameInput,
          enrollmentDate: new Date().toISOString().split('T')[0],
          remarks: `Imported via ${importType}`,
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
        totalRows: validRows.length + invalidRows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows,
        invalidRows
      };
    } else {
      // ---------------------------------------------------------
      // LEGACY TEMPLATE PARSER (Preserved for backward compatibility)
      // ---------------------------------------------------------
      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];
        const rowNum = i + 2;
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
        const matchedClass = findClass(classNameInput);
        if (classNameInput && !matchedClass) {
          errors.push(`Class '${classNameInput}' not found or is inactive in this school.`);
        }

        if (!sectionNameInput) {
          errors.push('Section Name is required.');
        }
        let matchedSection = null;
        if (matchedClass && sectionNameInput) {
          matchedSection = findSection(matchedClass, sectionNameInput);
          if (!matchedSection) {
            errors.push(`Section '${sectionNameInput}' not found under '${matchedClass.className}'.`);
          }
        }

        // Roll Number Validation in Section
        if (matchedSection && rollNumber) {
          const secKey = matchedSection._id.toString();
          if (!seenRollMap.has(secKey)) {
            seenRollMap.set(secKey, new Set());
          }
          const sectionRolls = seenRollMap.get(secKey);
          if (sectionRolls.has(rollNumber)) {
            errors.push(
              `Duplicate roll number '${rollNumber}' in section '${matchedSection.sectionName}' within this Excel file.`
            );
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
          fullName: [firstName || studentDoc?.firstName, middleName || studentDoc?.middleName, lastName || studentDoc?.lastName]
            .filter(Boolean)
            .join(' '),
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
            middleName: row.middleName || '',
            lastName: row.lastName || '',
            dateOfBirth: new Date(row.dateOfBirth),
            gender: row.gender || 'UNAVAILABLE',
            address: row.address || '',
            bloodGroup: row.bloodGroup || '',
            religion: row.religion || '',
            fatherOccupation: row.fatherOccupation || '',
            motherOccupation: row.motherOccupation || '',
            contact: {
              phone: row.studentPhone || '',
              email: row.studentEmail || ''
            },
            guardianDetails: row.guardianDetails || [],
            admissionAcademicYearRef: academicYear._id,
            admissionClassRef: row.classId,
            admissionDate: new Date(row.enrollmentDate || Date.now()),
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
          enrollmentDate: new Date(row.enrollmentDate || Date.now()),
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
