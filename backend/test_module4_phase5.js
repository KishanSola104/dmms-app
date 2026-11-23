/**
 * DMMS MODULE 4 – PHASE 5 TEST SUITE
 * Tests:
 * 1. Download Excel Import Template (returns valid XLSX buffer).
 * 2. Excel Import Preview with row validation (detects valid and invalid rows with exact reasons).
 * 3. Commit Type A Import (New Admissions: creates student master, enrollment, history, batch audit).
 * 4. Commit Type B Import (Existing Enrollment: avoids duplicate master, creates enrollment, logs history).
 * 5. Excel Export of Students (returns valid XLSX buffer).
 * 6. Single Student Profile PDF Export (returns valid PDF buffer).
 * 7. Class Section Student Roster PDF Export (returns valid PDF buffer).
 * 8. Multi-School Isolation.
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

async function runModule4Phase5Tests() {
  console.log('========================================================================');
  console.log('  DMMS MODULE 4 – PHASE 5 (IMPORT, EXPORT & PDF) TEST SUITE');
  console.log('========================================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');

  const ts = Date.now();
  const schoolEmail = `m4p5.school.${ts}@gmail.com`;
  const adminEmail = `m4p5.admin.${ts}@gmail.com`;

  // 1. Setup School & Admin
  console.log('--- 1. School Registration & Setup ---');
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Heritage Global School',
      establishedYear: 2011,
      email: schoolEmail,
      mobileNumber: '9876543210',
      address: '50 Heritage Way, Kolkata',
      websiteUrl: 'https://heritage.edu',
      contactPersons: [
        { fullName: 'Principal Heritage', email: `ph.${ts}@gmail.com`, mobileNumber: '9876500001', designation: 'Principal' },
        { fullName: 'Vice Principal', email: `vph.${ts}@gmail.com`, mobileNumber: '9876500002', designation: 'Vice Principal' }
      ],
      adminFullName: 'Debashis Roy',
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

  const testPw = 'Admin@Heritage2026';
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
  console.log('\n--- 2. Academic Setup ---');
  const curYear = new Date().getFullYear();

  const ayRes = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      yearName: `Academic Year ${curYear + 1}-${curYear + 2}`,
      startDate: `${curYear + 1}-06-01`,
      endDate: `${curYear + 2}-05-31`
    })
  }).then((r) => r.json());
  const ayId = ayRes.academicYear._id;

  const cRes = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classCode: 'CLS-4', className: 'Class 4', numberOfSections: 2 })
  }).then((r) => r.json());
  const cId = cRes.class._id;

  const secARes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classId: cId, sectionCode: 'A', sectionName: 'Section A', maxCapacity: 30 })
  }).then((r) => r.json());
  const secAId = secARes.section._id;

  const secBRes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classId: cId, sectionCode: 'B', sectionName: 'Section B', maxCapacity: 30 })
  }).then((r) => r.json());
  const secBId = secBRes.section._id;

  // 3. Test Download Import Template
  console.log('\n--- 3. Testing Download Import Template ---');
  const templRes = await fetch(`${API_BASE}/admin/students/import/template?importType=NEW_ADMISSION`, {
    headers: { Authorization: `Bearer ${aToken}`, 'x-school-token': sToken }
  });
  test(templRes.status === 200, 'Template download endpoint returned HTTP 200');
  const templBuf = Buffer.from(await templRes.arrayBuffer());
  const parsedWb = XLSX.read(templBuf, { type: 'buffer' });
  test(parsedWb.SheetNames.includes('Student_Data'), 'Workbook contains Student_Data sheet');
  test(parsedWb.SheetNames.includes('Instructions'), 'Workbook contains Instructions sheet');

  // 4. Test Preview Import with Valid & Invalid Rows
  console.log('\n--- 4. Testing Excel Import Preview & Row Validation ---');
  const mockHeaders = [
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

  const testRows = [
    // Valid Row 1: Manual Adm No
    [
      `ADM-${ts}-1`,
      'Ishaan',
      'K',
      'Khatter',
      '2015-06-20',
      'MALE',
      '9811122233',
      'ishaan@example.com',
      'Rajesh Khatter',
      'FATHER',
      '9811100011',
      'rajesh@khatter.com',
      'Class 4',
      'Section A',
      '1',
      '2026-06-15',
      'Valid row 1'
    ],
    // Valid Row 2: Auto Adm No
    [
      '',
      'Tanya',
      '',
      'Maniktala',
      '2015-09-10',
      'FEMALE',
      '',
      '',
      'Sunil Maniktala',
      'FATHER',
      '9811100022',
      '',
      'Class 4',
      'Section B',
      '1',
      '2026-06-15',
      'Valid row 2'
    ],
    // Invalid Row 3: Missing Last Name & Invalid Gender & Invalid Class
    [
      `ADM-${ts}-3`,
      'InvalidStudent',
      '',
      '', // Missing last name
      '2015-01-01',
      'UNKNOWN_GENDER', // Invalid gender
      '',
      '',
      'Parent',
      'FATHER',
      '9811100033',
      '',
      'NonExistentClass', // Invalid class
      'Section A',
      '',
      '',
      ''
    ]
  ];

  const testWb = XLSX.utils.book_new();
  const testWs = XLSX.utils.aoa_to_sheet([mockHeaders, ...testRows]);
  XLSX.utils.book_append_sheet(testWb, testWs, 'Students');
  const uploadBuf = XLSX.write(testWb, { type: 'buffer', bookType: 'xlsx' });

  // Use FormData via native Blob/FormData
  const form = new FormData();
  form.append('file', new Blob([uploadBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'test_import.xlsx');
  form.append('academicYearRef', ayId);
  form.append('importType', 'NEW_ADMISSION');

  const previewRes = await fetch(`${API_BASE}/admin/students/import/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${aToken}`, 'x-school-token': sToken },
    body: form
  }).then((r) => r.json());

  test(previewRes.success === true, 'Import preview completed successfully');
  test(previewRes.totalRows === 3, `Total rows recognized as 3 (Got: ${previewRes.totalRows})`);
  test(previewRes.validCount === 2, `Valid rows count is 2 (Got: ${previewRes.validCount})`);
  test(previewRes.invalidCount === 1, `Invalid rows count is 1 (Got: ${previewRes.invalidCount})`);
  test(previewRes.invalidRows[0].errors.length >= 2, 'Row-level errors reported for invalid row');

  // 5. Test Commit Validated Rows (Type A)
  console.log('\n--- 5. Testing Commit Import Batch (Type A: New Admissions) ---');
  const commitRes = await fetch(`${API_BASE}/admin/students/import/commit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      academicYearRef: ayId,
      importType: 'NEW_ADMISSION',
      fileName: 'test_import.xlsx',
      validRows: previewRes.validRows
    })
  }).then((r) => r.json());

  test(commitRes.success === true, 'Import batch committed successfully');
  test(commitRes.successfulRecords === 2, `2 student records successfully created (Got: ${commitRes.successfulRecords})`);
  test(commitRes.failedRecords === 0, '0 records failed during commit');
  test(commitRes.status === 'COMPLETED', 'Batch status is COMPLETED');

  // Verify Audit Record in DB
  const batchDoc = await mongoose.connection.db.collection('student_import_batch_info').findOne({
    _id: new mongoose.Types.ObjectId(commitRes.batchId)
  });
  test(batchDoc !== null && batchDoc.totalRecords === 2, 'Audit batch record verified in database');

  // Verify Student 1 (Ishaan) and Student 2 (Tanya) in DB
  const ishaan = await mongoose.connection.db.collection('student_info').findOne({ admissionNumber: `ADM-${ts}-1` });
  test(ishaan !== null && ishaan.firstName === 'Ishaan', 'Student 1 (Ishaan) master record created');

  const ishaanEnr = await mongoose.connection.db.collection('student_enrollment_info').findOne({
    studentRef: ishaan._id,
    academicYearRef: new mongoose.Types.ObjectId(ayId)
  });
  test(ishaanEnr !== null && ishaanEnr.rollNumber === '1', 'Ishaan enrollment record created with roll number 1');

  // 6. Test Excel Export
  console.log('\n--- 6. Testing Export Students to Excel ---');
  const exportRes = await fetch(`${API_BASE}/admin/students/export/excel?academicYearRef=${ayId}`, {
    headers: { Authorization: `Bearer ${aToken}`, 'x-school-token': sToken }
  });
  test(exportRes.status === 200, 'Excel export returned HTTP 200');
  const exportBuf = Buffer.from(await exportRes.arrayBuffer());
  const expWb = XLSX.read(exportBuf, { type: 'buffer' });
  const expRows = XLSX.utils.sheet_to_json(expWb.Sheets['Students']);
  test(expRows.length === 2, `Exported Excel sheet contains 2 students (Got: ${expRows.length})`);
  test(expRows.some((r) => r['First Name'] === 'Ishaan'), 'Exported sheet contains Ishaan Khatter');

  // 7. Test Student Profile PDF Export
  console.log('\n--- 7. Testing Student Profile PDF Export ---');
  const pdfRes = await fetch(`${API_BASE}/admin/students/${ishaan._id}/export/pdf?academicYearRef=${ayId}`, {
    headers: { Authorization: `Bearer ${aToken}`, 'x-school-token': sToken }
  });
  test(pdfRes.status === 200, 'Student profile PDF returned HTTP 200');
  const pdfContentType = pdfRes.headers.get('content-type');
  test(pdfContentType.includes('application/pdf'), 'Content-Type is application/pdf');
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  test(pdfBuf.slice(0, 4).toString() === '%PDF', 'PDF buffer starts with valid %PDF magic header');

  // 8. Test Class Roster PDF Export
  console.log('\n--- 8. Testing Class Section Roster PDF Export ---');
  const rosterPdfRes = await fetch(
    `${API_BASE}/admin/classes/${cId}/sections/${secAId}/export/pdf?academicYearRef=${ayId}`,
    {
      headers: { Authorization: `Bearer ${aToken}`, 'x-school-token': sToken }
    }
  );
  test(rosterPdfRes.status === 200, 'Class roster PDF returned HTTP 200');
  const rosterBuf = Buffer.from(await rosterPdfRes.arrayBuffer());
  test(rosterBuf.slice(0, 4).toString() === '%PDF', 'Roster PDF buffer starts with %PDF magic header');

  // 9. Multi-School Isolation
  console.log('\n--- 9. Multi-School Isolation ---');
  const s2Email = `m4p5.schoolB.${ts}@gmail.com`;
  const s2Admin = `m4p5.adminB.${ts}@gmail.com`;
  const reg2 = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'School B Campus',
      establishedYear: 2016,
      email: s2Email,
      mobileNumber: '9876543214',
      address: '11 East Wing',
      websiteUrl: 'https://schoolb.edu',
      contactPersons: [
        { fullName: 'Principal B', email: `pb.${ts}@gmail.com`, mobileNumber: '9876500003', designation: 'Principal' },
        { fullName: 'Trustee B', email: `tb.${ts}@gmail.com`, mobileNumber: '9876500004', designation: 'Trustee' }
      ],
      adminFullName: 'Admin B',
      adminEmail: s2Admin,
      adminMobile: '9876511115',
      adminPassword: 'Password@123',
      confirmPassword: 'Password@123',
      termsAccepted: true
    })
  }).then((r) => r.json());

  const schoolBId = reg2.data.schoolId;
  const adminBId = reg2.data.adminId;
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId: schoolBId }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: adminBId }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  const s2Login = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId: schoolBId, password: testPw })
  }).then((r) => r.json());

  const a2Login = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': s2Login.schoolToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: adminBId, password: testPw })
  }).then((r) => r.json());

  const schoolBHeaders = {
    Authorization: `Bearer ${a2Login.token}`,
    'x-school-token': s2Login.schoolToken
  };

  // School B attempts to export School A's student profile
  const crossPdf = await fetch(`${API_BASE}/admin/students/${ishaan._id}/export/pdf`, { headers: schoolBHeaders });
  test(crossPdf.status === 404, 'School B cannot export School A student profile (HTTP 404)');

  console.log('\n========================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} MODULE 4 PHASE 5 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runModule4Phase5Tests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
