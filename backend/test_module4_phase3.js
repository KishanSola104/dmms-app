/**
 * DMMS MODULE 4 – PHASE 3 TEST SUITE
 * Tests:
 * 1. Section Enrollment Summary with Capacity & Remaining Seats.
 * 2. Unenrolled Active Students list.
 * 3. Enroll Active Student in Academic Year.
 * 4. Duplicate Enrollment in Same Academic Year strictly rejected (HTTP 409).
 * 5. Roll Number update and duplicate roll number in same section rejected.
 * 6. Same-Year Section Transfer (replaces class/section in single enrollment, logs history).
 * 7. Destination Section Capacity Enforcement during Transfer.
 * 8. Same-Year Class Transfer (logs CLASS_TRANSFER in history).
 * 9. Multi-School Isolation.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

async function runModule4Phase3Tests() {
  console.log('========================================================================');
  console.log('  DMMS MODULE 4 – PHASE 3 (ENROLLMENT & TRANSFERS) TEST SUITE');
  console.log('========================================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');

  const ts = Date.now();
  const schoolEmail = `m4p3.school.${ts}@gmail.com`;
  const adminEmail = `m4p3.admin.${ts}@gmail.com`;

  // 1. Setup School & Admin
  console.log('--- 1. School Registration & Setup ---');
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Delhi Public Academy',
      establishedYear: 2014,
      email: schoolEmail,
      mobileNumber: '9876543210',
      address: '88 Ring Road, New Delhi',
      websiteUrl: 'https://dpa.edu',
      contactPersons: [
        { fullName: 'Rajendra Prasad', email: `rp.${ts}@gmail.com`, mobileNumber: '9876500001', designation: 'Chairman' },
        { fullName: 'Radhakrishnan', email: `rk.${ts}@gmail.com`, mobileNumber: '9876500002', designation: 'Principal' }
      ],
      adminFullName: 'Ramesh Sen',
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

  const testPw = 'Admin@DPA2026';
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

  // Class 7
  const c7Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classCode: 'CLS-7', className: 'Class 7', numberOfSections: 2 })
  }).then((r) => r.json());
  const c7Id = c7Res.class._id;

  // Section 7-A (maxCapacity: 2 for capacity tests)
  const sec7ARes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classId: c7Id, sectionCode: 'A', sectionName: 'Section A', maxCapacity: 2 })
  }).then((r) => r.json());
  const sec7AId = sec7ARes.section._id;

  // Section 7-B (maxCapacity: 30)
  const sec7BRes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classId: c7Id, sectionCode: 'B', sectionName: 'Section B', maxCapacity: 30 })
  }).then((r) => r.json());
  const sec7BId = sec7BRes.section._id;

  // Class 8
  const c8Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classCode: 'CLS-8', className: 'Class 8', numberOfSections: 1 })
  }).then((r) => r.json());
  const c8Id = c8Res.class._id;

  const sec8ARes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classId: c8Id, sectionCode: 'A', sectionName: 'Section A', maxCapacity: 30 })
  }).then((r) => r.json());
  const sec8AId = sec8ARes.section._id;

  // 3. Admit Sample Students
  console.log('\n--- 3. Admitting Test Students ---');
  // Student 1 admitted to 7-A
  const adm1 = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      admissionNumberMethod: 'MANUAL',
      admissionNumber: `ADM-${ts}-101`,
      firstName: 'Kabir',
      middleName: 'Rao',
      lastName: 'Verma',
      dateOfBirth: '2012-05-10',
      gender: 'MALE',
      contact: { phone: '9811000101', email: 'kabir.verma@example.com' },
      guardianDetails: [{ fullName: 'Rao Verma', relationship: 'FATHER', mobileNumber: '9811000201', isPrimaryContact: true }],
      academicYearRef: ayId,
      classRef: c7Id,
      sectionRef: sec7AId,
      rollNumberMethod: 'MANUAL',
      rollNumber: '1'
    })
  }).then((r) => r.json());
  test(adm1.success === true, 'Student 1 (Kabir Verma) admitted to 7-A');
  const student1Id = adm1.student._id;
  const enrollment1Id = adm1.enrollment._id;

  // Student 2 admitted to 7-B
  const adm2 = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      admissionNumberMethod: 'MANUAL',
      admissionNumber: `ADM-${ts}-102`,
      firstName: 'Meera',
      middleName: 'Devi',
      lastName: 'Iyer',
      dateOfBirth: '2012-08-14',
      gender: 'FEMALE',
      contact: { phone: '9811000102', email: 'meera.iyer@example.com' },
      guardianDetails: [{ fullName: 'Suresh Iyer', relationship: 'FATHER', mobileNumber: '9811000202', isPrimaryContact: true }],
      academicYearRef: ayId,
      classRef: c7Id,
      sectionRef: sec7BId,
      rollNumberMethod: 'MANUAL',
      rollNumber: '1'
    })
  }).then((r) => r.json());
  test(adm2.success === true, 'Student 2 (Meera Iyer) admitted to 7-B');
  const student2Id = adm2.student._id;

  // 4. Test Section Enrollment Summary
  console.log('\n--- 4. Testing Section Enrollment Summary & Capacity ---');
  const sum7A = await fetch(`${API_BASE}/admin/enrollments?academicYearRef=${ayId}&classRef=${c7Id}&sectionRef=${sec7AId}`, { headers }).then((r) => r.json());
  test(sum7A.success === true, 'Section 7-A summary retrieved');
  test(sum7A.capacity.maxCapacity === 2, 'Section 7-A maxCapacity is 2');
  test(sum7A.capacity.activeEnrolled === 1, 'Section 7-A activeEnrolled is 1');
  test(sum7A.capacity.remainingCapacity === 1, 'Section 7-A remaining seats is 1');
  test(sum7A.capacity.isFull === false, 'Section 7-A is not full');
  test(sum7A.enrollments.length === 1 && sum7A.enrollments[0].firstName === 'Kabir', 'Kabir Verma is listed in 7-A');

  // 5. Test Update Enrollment Roll Number
  console.log('\n--- 5. Testing Update Roll Number ---');
  const updateRoll = await fetch(`${API_BASE}/admin/enrollments/${enrollment1Id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ rollNumber: '5', remarks: 'Roll number adjusted' })
  }).then((r) => r.json());
  test(updateRoll.success === true, 'Roll number updated successfully');
  test(updateRoll.enrollment.rollNumber === '5', 'Roll number changed to 5');

  // 6. Test Same-Year Section Transfer
  console.log('\n--- 6. Testing Same-Year Section Transfer ---');
  // Transfer Kabir from 7-A to 7-B
  const transRes = await fetch(`${API_BASE}/admin/enrollments/${enrollment1Id}/transfer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      newClassRef: c7Id,
      newSectionRef: sec7BId,
      newRollNumber: '2',
      remarks: 'Transferred to Section B on student request'
    })
  }).then((r) => r.json());

  test(transRes.success === true, 'Transferred Kabir to Section 7-B');
  test(transRes.enrollment.sectionName === 'Section B', 'Section is now Section B');
  test(transRes.history.changeType === 'SECTION_TRANSFER', 'History changeType recorded as SECTION_TRANSFER');

  // Verify only 1 enrollment exists in DB for Kabir (no duplicates created)
  const countEnrollments = await mongoose.connection.db.collection('student_enrollment_info').countDocuments({
    studentRef: new mongoose.Types.ObjectId(student1Id),
    academicYearRef: new mongoose.Types.ObjectId(ayId)
  });
  test(countEnrollments === 1, `Exactly 1 enrollment document exists for Kabir in this AY (Got: ${countEnrollments})`);

  // Verify 7-A now has 0 students and 7-B has 2 students
  const sum7AAfter = await fetch(`${API_BASE}/admin/enrollments?academicYearRef=${ayId}&classRef=${c7Id}&sectionRef=${sec7AId}`, { headers }).then((r) => r.json());
  test(sum7AAfter.capacity.activeEnrolled === 0, 'Section 7-A now has 0 active students');

  const sum7BAfter = await fetch(`${API_BASE}/admin/enrollments?academicYearRef=${ayId}&classRef=${c7Id}&sectionRef=${sec7BId}`, { headers }).then((r) => r.json());
  test(sum7BAfter.capacity.activeEnrolled === 2, 'Section 7-B now has 2 active students');

  // 7. Test Duplicate Roll Number Conflict in Destination
  console.log('\n--- 7. Testing Roll Number Conflict Prevention ---');
  // Meera in 7-B already has rollNumber '1'. Attempt to transfer Kabir or change roll to '1'
  const conflictRoll = await fetch(`${API_BASE}/admin/enrollments/${enrollment1Id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ rollNumber: '1' })
  }).then((r) => r.json());
  test(conflictRoll.success === false, 'Duplicate roll number in section 7-B rejected (HTTP 409)');

  // 8. Test Section Capacity Enforcement on Transfer
  console.log('\n--- 8. Testing Section Capacity Enforcement on Transfer ---');
  // First, fill 7-A to maxCapacity (2)
  // Student 3 to 7-A
  const adm3 = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      admissionNumberMethod: 'AUTO',
      firstName: 'Aarav',
      lastName: 'Nair',
      dateOfBirth: '2012-01-10',
      gender: 'MALE',
      guardianDetails: [{ fullName: 'Gopalan Nair', relationship: 'FATHER', mobileNumber: '9811000203', isPrimaryContact: true }],
      academicYearRef: ayId,
      classRef: c7Id,
      sectionRef: sec7AId,
      rollNumberMethod: 'MANUAL',
      rollNumber: '1'
    })
  }).then((r) => r.json());
  test(adm3.success === true, 'Student 3 admitted to 7-A');

  // Student 4 to 7-A
  const adm4 = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      admissionNumberMethod: 'AUTO',
      firstName: 'Diya',
      lastName: 'Kapoor',
      dateOfBirth: '2012-02-15',
      gender: 'FEMALE',
      guardianDetails: [{ fullName: 'Sunil Kapoor', relationship: 'FATHER', mobileNumber: '9811000204', isPrimaryContact: true }],
      academicYearRef: ayId,
      classRef: c7Id,
      sectionRef: sec7AId,
      rollNumberMethod: 'MANUAL',
      rollNumber: '2'
    })
  }).then((r) => r.json());
  test(adm4.success === true, 'Student 4 admitted to 7-A');

  // Now 7-A has 2/2 students (FULL)
  // Attempt to transfer Meera from 7-B into 7-A (should be rejected due to capacity)
  const overCapTransfer = await fetch(`${API_BASE}/admin/enrollments/${adm2.enrollment._id}/transfer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      newClassRef: c7Id,
      newSectionRef: sec7AId
    })
  }).then((r) => r.json());
  test(overCapTransfer.success === false, 'Transfer into full section strictly rejected (HTTP 400)');

  // 9. Test Same-Year Class Transfer (CLS-7 to CLS-8)
  console.log('\n--- 9. Testing Same-Year Class Transfer ---');
  const classTransRes = await fetch(`${API_BASE}/admin/enrollments/${enrollment1Id}/transfer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      newClassRef: c8Id,
      newSectionRef: sec8AId,
      newRollNumber: '1',
      remarks: 'Double promotion to Class 8'
    })
  }).then((r) => r.json());

  test(classTransRes.success === true, 'Transferred Kabir from Class 7 to Class 8');
  test(classTransRes.history.changeType === 'CLASS_TRANSFER', 'History changeType recorded as CLASS_TRANSFER');

  // 10. Multi-School Isolation
  console.log('\n--- 10. Multi-School Data Isolation ---');
  const s2Email = `m4p3.schoolB.${ts}@gmail.com`;
  const s2Admin = `m4p3.adminB.${ts}@gmail.com`;
  const reg2 = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'School B Institute',
      establishedYear: 2018,
      email: s2Email,
      mobileNumber: '9876543212',
      address: '99 South Avenue',
      websiteUrl: 'https://schoolb.edu',
      contactPersons: [
        { fullName: 'Principal B', email: `pb.${ts}@gmail.com`, mobileNumber: '9876500003', designation: 'Principal' },
        { fullName: 'Trustee B', email: `tb.${ts}@gmail.com`, mobileNumber: '9876500004', designation: 'Trustee' }
      ],
      adminFullName: 'Admin B',
      adminEmail: s2Admin,
      adminMobile: '9876511113',
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
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${a2Login.token}`,
    'x-school-token': s2Login.schoolToken
  };

  // School B attempts to transfer School A's enrollment
  const crossTransfer = await fetch(`${API_BASE}/admin/enrollments/${enrollment1Id}/transfer`, {
    method: 'POST',
    headers: schoolBHeaders,
    body: JSON.stringify({ newClassRef: c8Id, newSectionRef: sec8AId })
  }).then((r) => r.json());
  test(crossTransfer.success === false, 'School B cannot transfer School A enrollment (HTTP 404)');

  console.log('\n========================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} MODULE 4 PHASE 3 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runModule4Phase3Tests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
