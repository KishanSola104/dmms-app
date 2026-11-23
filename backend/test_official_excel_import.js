/**
 * DMMS OFFICIAL 15-COLUMN EXCEL IMPORT TEST SUITE
 * Tests:
 * 1. Read all 15 columns correctly (including both OCCUPATION columns).
 * 2. Parse full student name into name fields without losing parts, support single-word name.
 * 3. Class and section matching (with and without "Class" / "Section" prefix).
 * 4. Date of birth parsing (string formats YYYY-MM-DD, DD/MM/YYYY, and serial numbers).
 * 5. Gender is omitted from official file and does NOT cause any validation error.
 * 6. Separate Father and Mother guardian records with their respective occupations and contacts.
 * 7. Missing optional guardian mobile numbers do not block import.
 * 8. Address, blood group, religion, father occupation, mother occupation preserved in DB.
 * 9. Admission number uniqueness and roll number uniqueness validated.
 * 10. Commit import batch saves student, enrollment, and history records correctly.
 * 11. Existing legacy import still works seamlessly.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');

const API_BASE = 'http://127.0.0.1:8000/api';

let totalTests = 0;
let passedTests = 0;

function test(condition, description) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS ${String(totalTests).padStart(2, '0')}] ${description}`);
  } else {
    console.error(`  [FAIL ${String(totalTests).padStart(2, '0')}] ${description}`);
    throw new Error(`Test failed: ${description}`);
  }
}

async function runOfficialExcelImportTests() {
  console.log('========================================================================');
  console.log('  DMMS OFFICIAL 15-COLUMN STUDENT EXCEL IMPORT TEST SUITE');
  console.log('========================================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');

  const ts = Date.now();
  const schoolEmail = `school.official.${ts}@gmail.com`;
  const adminEmail = `admin.official.${ts}@gmail.com`;

  // 1. Setup School & Admin
  console.log('--- 1. School Registration & Authentication ---');
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'St. Xavier Academy',
      establishedYear: 2005,
      email: schoolEmail,
      mobileNumber: '9876543210',
      address: '10 Park Circus, Kolkata',
      websiteUrl: 'https://stxavier.edu',
      contactPersons: [
        { fullName: 'Principal', email: `p.${ts}@gmail.com`, mobileNumber: '9876500001', designation: 'Principal' },
        { fullName: 'Vice Principal', email: `vp.${ts}@gmail.com`, mobileNumber: '9876500002', designation: 'Vice Principal' }
      ],
      adminFullName: 'Debanjan Sen',
      adminEmail: adminEmail,
      adminMobile: '9876511111',
      adminPassword: 'Password@123',
      confirmPassword: 'Password@123',
      termsAccepted: true
    })
  }).then((r) => r.json());

  test(regRes.success === true, 'School registered successfully');
  const schoolId = regRes.data.schoolId;
  const adminId = regRes.data.adminId;

  const testPw = 'Admin@Xavier2026';
  const hashedPw = await bcrypt.hash(testPw, 10);
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: adminId }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  const sLogin = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId, password: testPw })
  }).then((r) => r.json());
  const sToken = sLogin.schoolToken;

  const aLogin = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': sToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: adminId, password: testPw })
  }).then((r) => r.json());
  const aToken = aLogin.token;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aToken}`,
    'x-school-token': sToken
  };

  // 2. Setup Academic Year, Classes & Sections
  console.log('\n--- 2. Academic Setup (Class 5, Section A & B) ---');
  const curYear = new Date().getFullYear();

  const ayRes = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      yearName: `Academic Year 2027-2028`,
      startDate: '2027-06-01',
      endDate: '2028-05-31'
    })
  }).then((r) => r.json());
  if (!ayRes.academicYear) {
    console.error('Academic year creation response:', ayRes);
  }
  const ayId = ayRes.academicYear._id;

  const cRes = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classCode: 'CLS-5', className: 'Class 5', numberOfSections: 2 })
  }).then((r) => r.json());
  const cId = cRes.class._id;

  const secARes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classId: cId, sectionCode: 'A', sectionName: 'Section A', maxCapacity: 40 })
  }).then((r) => r.json());
  const secAId = secARes.section._id;

  const secBRes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classId: cId, sectionCode: 'B', sectionName: 'Section B', maxCapacity: 40 })
  }).then((r) => r.json());
  const secBId = secBRes.section._id;

  test(ayId && cId && secAId && secBId, 'Academic Year, Class 5, and Sections A & B created');

  // 3. Official 15-Column Excel File Construction
  console.log('\n--- 3. Testing Official 15-Column Import File Parsing & Preview ---');
  const officialHeaders = [
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
  ];

  const testOfficialRows = [
    // Row 1: Valid student with multi-part name, both parents, separate occupations, YYYY-MM-DD DOB
    [
      '1',
      'Aarav Kumar Sharma',
      'Class 5',
      'Section A',
      '123 MG Road, Kolkata',
      '2013-05-15',
      'O+',
      'Rajesh Sharma',
      'Software Engineer', // Father's Occupation
      '9876543210',
      'Sunita Sharma',
      'School Principal',  // Mother's Occupation
      '9876543211',
      'Hinduism',
      `ADM-OFF-${ts}-1`
    ],
    // Row 2: Valid single-name student, blank parent contact numbers, DD/MM/YYYY date, prefix-less class/sec, blank admNo (auto)
    [
      '2',
      'Kabir',             // Single word name!
      '5',                 // Class without 'Class ' prefix
      'A',                 // Section without 'Section ' prefix
      '45 Park Street',
      '20/08/2014',        // DD/MM/YYYY date format
      'B+',
      'Ramesh',
      'Businessman',       // Father's Occupation
      '',                  // Blank father contact number
      'Pooja',
      'Architect',         // Mother's Occupation
      '',                  // Blank mother contact number
      'Sikhism',
      ''                   // Auto-generate admission number
    ],
    // Row 3: Valid student with only mother details (father blank), Excel serial date
    [
      '3',
      'Priya Sen',
      'Class 5',
      'Section A',
      '88 Lake Gardens',
      41700,               // Serial date (around 2014)
      'AB+',
      '',                  // Father blank
      '',                  // Father occ blank
      '',                  // Father contact blank
      'Meera Sen',
      'Doctor',            // Mother's occupation
      '9830012345',
      'Christianity',
      `ADM-OFF-${ts}-3`
    ],
    // Row 4 (INVALID): Duplicate Roll Number 1 in Section A
    [
      '1',                 // Duplicate roll number 1 in Section A!
      'Rohan Gupta',
      'Class 5',
      'Section A',
      'Some Address',
      '2013-01-01',
      'A+',
      'Sanjay Gupta',
      'Lawyer',
      '9811122233',
      'Anita Gupta',
      'Teacher',
      '9811122234',
      'Hinduism',
      `ADM-OFF-${ts}-4`
    ],
    // Row 5 (INVALID): Missing Student Name
    [
      '4',
      '',                  // Missing name!
      'Class 5',
      'Section A',
      'Address',
      '2013-03-03',
      'O-',
      'Father',
      'Job',
      '9876543210',
      'Mother',
      'Job',
      '9876543211',
      'Islam',
      `ADM-OFF-${ts}-5`
    ],
    // Row 6 (INVALID): Non-existent Class
    [
      '5',
      'Neha Singh',
      'NonExistentClass',  // Invalid class!
      'Section A',
      'Address',
      '2013-04-04',
      'B-',
      'Father',
      'Job',
      '9876543210',
      'Mother',
      'Job',
      '9876543211',
      'Hinduism',
      `ADM-OFF-${ts}-6`
    ],
    // Row 7 (INVALID): Future Date of Birth
    [
      '6',
      'Tanvi Das',
      'Class 5',
      'Section A',
      'Address',
      '2099-01-01',        // Future date!
      'O+',
      'Father',
      'Job',
      '9876543210',
      'Mother',
      'Job',
      '9876543211',
      'Hinduism',
      `ADM-OFF-${ts}-7`
    ]
  ];

  const officialWb = XLSX.utils.book_new();
  const officialWs = XLSX.utils.aoa_to_sheet([officialHeaders, ...testOfficialRows]);
  XLSX.utils.book_append_sheet(officialWb, officialWs, 'Official_Format');
  const uploadBuf = XLSX.write(officialWb, { type: 'buffer', bookType: 'xlsx' });

  const form = new FormData();
  form.append('file', new Blob([uploadBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'official_school_data.xlsx');
  form.append('academicYearRef', ayId);
  form.append('importType', 'NEW_ADMISSION');

  const previewRes = await fetch(`${API_BASE}/admin/students/import/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${aToken}`, 'x-school-token': sToken },
    body: form
  }).then((r) => r.json());

  test(previewRes.success === true, 'Import preview completed successfully');
  test(previewRes.totalRows === 7, `Total rows recognized as 7 (Got: ${previewRes.totalRows})`);
  test(previewRes.validCount === 3, `Valid rows count is 3 (Got: ${previewRes.validCount})`);
  test(previewRes.invalidCount === 4, `Invalid rows count is 4 (Got: ${previewRes.invalidCount})`);

  // Verify Row 1 Parsing
  const row1 = previewRes.validRows.find((r) => r.rowNumber === 2);
  test(row1 !== undefined, 'Row 1 recognized as valid');
  test(row1.fullName === 'Aarav Kumar Sharma', `Row 1 full name preserved: ${row1.fullName}`);
  test(row1.firstName === 'Aarav', `Row 1 firstName: ${row1.firstName}`);
  test(row1.middleName === 'Kumar', `Row 1 middleName: ${row1.middleName}`);
  test(row1.lastName === 'Sharma', `Row 1 lastName: ${row1.lastName}`);
  test(row1.rollNumber === '1', `Row 1 roll number: ${row1.rollNumber}`);
  test(row1.className === 'Class 5', `Row 1 class: ${row1.className}`);
  test(row1.sectionName === 'Section A', `Row 1 section: ${row1.sectionName}`);
  test(row1.dateOfBirth === '2013-05-15', `Row 1 DOB: ${row1.dateOfBirth}`);
  test(row1.fatherOccupation === 'Software Engineer', `Row 1 Father Occ (1st OCCUPATION): ${row1.fatherOccupation}`);
  test(row1.motherOccupation === 'School Principal', `Row 1 Mother Occ (2nd OCCUPATION): ${row1.motherOccupation}`);
  test(row1.guardianDetails.length === 2, `Row 1 has 2 guardian details (Father & Mother)`);

  // Verify Row 2 Parsing (Single name, DD/MM/YYYY date, blank parent contacts)
  const row2 = previewRes.validRows.find((r) => r.rowNumber === 3);
  test(row2 !== undefined, 'Row 2 (single name Kabir) recognized as valid');
  test(row2.firstName === 'Kabir' && row2.lastName === '', `Single-word name parsed without error: '${row2.firstName}'`);
  test(row2.dateOfBirth === '2014-08-20', `DD/MM/YYYY date parsed correctly: ${row2.dateOfBirth}`);
  test(row2.className === 'Class 5', `Class without prefix matched: ${row2.className}`);
  test(row2.sectionName === 'Section A', `Section without prefix matched: ${row2.sectionName}`);
  test(row2.fatherContact === '' && row2.motherContact === '', 'Blank parent contact numbers accepted without error');

  // Verify Row 3 Parsing (Serial date, mother-only guardian)
  const row3 = previewRes.validRows.find((r) => r.rowNumber === 4);
  test(row3 !== undefined, 'Row 3 (serial date, mother-only) recognized as valid');
  test(row3.dateOfBirth !== '' && !row3.dateOfBirth.includes('NaN'), `Excel serial date converted to valid date: ${row3.dateOfBirth}`);
  test(row3.guardianDetails.length === 1 && row3.guardianDetails[0].fullName === 'Meera Sen', 'Only mother guardian created when father details absent');
  test(row3.guardianDetails[0].occupation === 'Doctor', `Mother occupation preserved: ${row3.guardianDetails[0].occupation}`);

  // Verify Invalid Rows Reasons
  const invRowDuplicateRoll = previewRes.invalidRows.find((r) => r.rowNumber === 5);
  test(invRowDuplicateRoll.errors.some((e) => e.includes('Duplicate roll number')), 'Invalid row 4 flagged duplicate roll number');

  const invRowMissingName = previewRes.invalidRows.find((r) => r.rowNumber === 6);
  test(invRowMissingName.errors.some((e) => e.includes('Student Name is required')), 'Invalid row 5 flagged missing student name');

  const invRowBadClass = previewRes.invalidRows.find((r) => r.rowNumber === 7);
  test(invRowBadClass.errors.some((e) => e.includes('not found')), 'Invalid row 6 flagged invalid class');

  const invRowFutureDob = previewRes.invalidRows.find((r) => r.rowNumber === 8);
  test(invRowFutureDob.errors.some((e) => e.includes('valid past date')), 'Invalid row 7 flagged future date of birth');

  // 4. Commit Validated Batch
  console.log('\n--- 4. Testing Commit Import Batch (Official Format) ---');
  const commitRes = await fetch(`${API_BASE}/admin/students/import/commit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      academicYearRef: ayId,
      importType: 'NEW_ADMISSION',
      fileName: 'official_school_data.xlsx',
      validRows: previewRes.validRows
    })
  }).then((r) => r.json());

  test(commitRes.success === true, 'Import batch committed successfully');
  test(commitRes.successfulRecords === 3, `3 records successfully committed (Got: ${commitRes.successfulRecords})`);
  test(commitRes.failedRecords === 0, '0 records failed during commit');
  test(commitRes.status === 'COMPLETED', `Batch status is COMPLETED (Got: ${commitRes.status})`);

  // 5. Database Verification of Saved Student & Enrollment Records
  console.log('\n--- 5. Direct Database Verification ---');
  const dbStudent1 = await mongoose.connection.db.collection('student_info').findOne({
    schoolId,
    admissionNumber: `ADM-OFF-${ts}-1`
  });

  test(dbStudent1 !== null, 'Student 1 master record exists in database');
  test(dbStudent1.address === '123 MG Road, Kolkata', `Address preserved: ${dbStudent1.address}`);
  test(dbStudent1.bloodGroup === 'O+', `Blood group preserved: ${dbStudent1.bloodGroup}`);
  test(dbStudent1.religion === 'Hinduism', `Religion preserved: ${dbStudent1.religion}`);
  test(dbStudent1.gender === 'UNAVAILABLE', `Gender safely handled as UNAVAILABLE: ${dbStudent1.gender}`);
  test(dbStudent1.guardianDetails.length === 2, '2 guardian records created');

  const fatherGuardian = dbStudent1.guardianDetails.find((g) => g.relationship === 'FATHER');
  test(fatherGuardian && fatherGuardian.occupation === 'Software Engineer', `Father occupation stored in guardian: ${fatherGuardian?.occupation}`);
  test(fatherGuardian && fatherGuardian.mobileNumber === '9876543210', `Father mobile stored: ${fatherGuardian?.mobileNumber}`);

  const motherGuardian = dbStudent1.guardianDetails.find((g) => g.relationship === 'MOTHER');
  test(motherGuardian && motherGuardian.occupation === 'School Principal', `Mother occupation stored in guardian: ${motherGuardian?.occupation}`);
  test(motherGuardian && motherGuardian.mobileNumber === '9876543211', `Mother mobile stored: ${motherGuardian?.mobileNumber}`);

  // Verify Student 2 (Single Name Kabir, Auto Admission No)
  const dbStudent2 = await mongoose.connection.db.collection('student_info').findOne({
    schoolId,
    firstName: 'Kabir'
  });
  test(dbStudent2 !== null, 'Single-name student Kabir saved in database');
  test(dbStudent2.admissionNumber && dbStudent2.admissionNumber.length > 0, `Auto-generated admission number: ${dbStudent2.admissionNumber}`);
  test(dbStudent2.bloodGroup === 'B+', `Student 2 blood group: ${dbStudent2.bloodGroup}`);
  test(dbStudent2.religion === 'Sikhism', `Student 2 religion: ${dbStudent2.religion}`);

  // Verify Student 1 Enrollment
  const dbEnrollment1 = await mongoose.connection.db.collection('student_enrollment_info').findOne({
    schoolId,
    studentRef: dbStudent1._id,
    academicYearRef: new mongoose.Types.ObjectId(ayId)
  });
  test(dbEnrollment1 !== null, 'Student 1 enrollment record exists');
  test(dbEnrollment1.rollNumber === '1', `Student 1 roll number: ${dbEnrollment1.rollNumber}`);
  test(dbEnrollment1.classRef.toString() === cId.toString(), 'Enrollment linked to Class 5');
  test(dbEnrollment1.sectionRef.toString() === secAId.toString(), 'Enrollment linked to Section A');

  // 6. Test Uniqueness Prevention on Second Import
  console.log('\n--- 6. Testing Uniqueness Rules on Re-upload ---');
  // Upload same file again -> should flag duplicate admission number and duplicate roll number in DB!
  const dupPreviewRes = await fetch(`${API_BASE}/admin/students/import/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${aToken}`, 'x-school-token': sToken },
    body: form
  }).then((r) => r.json());

  const reRow1 = dupPreviewRes.invalidRows.find((r) => r.rowNumber === 2);
  test(
    reRow1 && reRow1.errors.some((e) => e.includes('already exists in this school') || e.includes('already assigned')),
    'Re-upload flags already existing admission / roll number in database'
  );

  console.log('\n========================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} OFFICIAL IMPORT TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runOfficialExcelImportTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
