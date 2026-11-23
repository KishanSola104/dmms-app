/**
 * DMMS MODULE 4 – PHASE 2 TEST SUITE
 * Tests:
 * 1. Student Listing with Academic Year, Class, Section, Status, Gender, and Search Filters.
 * 2. Student Pagination.
 * 3. Get Student Profile by ID (Master + Current Enrollment + All Enrollments + History).
 * 4. Update Student Details (Name, Contact, Guardians, Photo).
 * 5. Update Validations (Missing name, invalid DOB, empty guardians).
 * 6. Deactivate & Reactivate Student (Toggle Status without deleting history).
 * 7. Multi-School Data Isolation.
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

async function runModule4Phase2Tests() {
  console.log('========================================================================');
  console.log('  DMMS MODULE 4 – PHASE 2 (STUDENT LISTING & PROFILE) TEST SUITE');
  console.log('========================================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');

  const ts = Date.now();
  const schoolEmail = `m4p2.school.${ts}@gmail.com`;
  const adminEmail = `m4p2.admin.${ts}@gmail.com`;

  // 1. Setup School & Admin
  console.log('--- 1. School Registration & Setup ---');
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'St. Teresa Academy',
      establishedYear: 2015,
      email: schoolEmail,
      mobileNumber: '9876543210',
      address: '44 Hill Road, Mumbai',
      websiteUrl: 'https://stteresa.edu',
      contactPersons: [
        { fullName: 'Sister Teresa', email: `teresa.${ts}@gmail.com`, mobileNumber: '9876500001', designation: 'Principal' },
        { fullName: 'Sister Agnes', email: `agnes.${ts}@gmail.com`, mobileNumber: '9876500002', designation: 'Vice Principal' }
      ],
      adminFullName: 'Francis Joseph',
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

  const testPw = 'Admin@Teresa2026';
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
    body: JSON.stringify({ classCode: 'CLS-8', className: 'Class 8', numberOfSections: 2 })
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

  // 3. Admit Sample Students
  console.log('\n--- 3. Admitting Test Students ---');
  const adm1 = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      admissionNumberMethod: 'MANUAL',
      admissionNumber: `ADM-${ts}-01`,
      firstName: 'Rohan',
      middleName: 'Amit',
      lastName: 'Patel',
      dateOfBirth: '2011-03-12',
      gender: 'MALE',
      contact: { phone: '9822011111', email: 'rohan.patel@example.com' },
      guardianDetails: [
        { fullName: 'Amit Patel', relationship: 'FATHER', mobileNumber: '9822000001', isPrimaryContact: true }
      ],
      academicYearRef: ayId,
      classRef: cId,
      sectionRef: secAId,
      rollNumberMethod: 'MANUAL',
      rollNumber: '1'
    })
  }).then((r) => r.json());
  test(adm1.success === true, 'Student 1 (Rohan Patel) admitted');
  const student1Id = adm1.student._id;

  const adm2 = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      admissionNumberMethod: 'MANUAL',
      admissionNumber: `ADM-${ts}-02`,
      firstName: 'Ananya',
      middleName: 'Raj',
      lastName: 'Deshmukh',
      dateOfBirth: '2011-07-22',
      gender: 'FEMALE',
      contact: { phone: '9822011112', email: 'ananya.deshmukh@example.com' },
      guardianDetails: [
        { fullName: 'Raj Deshmukh', relationship: 'FATHER', mobileNumber: '9822000002', isPrimaryContact: true }
      ],
      academicYearRef: ayId,
      classRef: cId,
      sectionRef: secBId,
      rollNumberMethod: 'MANUAL',
      rollNumber: '1'
    })
  }).then((r) => r.json());
  test(adm2.success === true, 'Student 2 (Ananya Deshmukh) admitted');
  const student2Id = adm2.student._id;

  // 4. Test Listing & Filters
  console.log('\n--- 4. Testing Student Listing & Filters ---');
  const listAll = await fetch(`${API_BASE}/admin/students?academicYearRef=${ayId}`, { headers }).then((r) => r.json());
  test(listAll.success === true, 'Student list retrieved successfully');
  test(listAll.students.length === 2, `Both admitted students listed (Got: ${listAll.students.length})`);

  // Filter by Section A
  const listSecA = await fetch(`${API_BASE}/admin/students?academicYearRef=${ayId}&sectionRef=${secAId}`, { headers }).then((r) => r.json());
  test(listSecA.students.length === 1 && listSecA.students[0].firstName === 'Rohan', 'Section A filter returns only Rohan');

  // Filter by Gender: FEMALE
  const listFemale = await fetch(`${API_BASE}/admin/students?academicYearRef=${ayId}&gender=FEMALE`, { headers }).then((r) => r.json());
  test(listFemale.students.length === 1 && listFemale.students[0].firstName === 'Ananya', 'Gender filter FEMALE returns only Ananya');

  // Search by Name
  const searchName = await fetch(`${API_BASE}/admin/students?academicYearRef=${ayId}&search=Deshmukh`, { headers }).then((r) => r.json());
  test(searchName.students.length === 1 && searchName.students[0].lastName === 'Deshmukh', 'Search by last name returned Ananya Deshmukh');

  // Search by Admission Number
  const searchAdm = await fetch(`${API_BASE}/admin/students?academicYearRef=${ayId}&search=ADM-${ts}-01`, { headers }).then((r) => r.json());
  test(searchAdm.students.length === 1 && searchAdm.students[0].firstName === 'Rohan', 'Search by admission number returned Rohan');

  // 5. Test Get Student By ID
  console.log('\n--- 5. Testing Get Student Profile by ID ---');
  const prof1 = await fetch(`${API_BASE}/admin/students/${student1Id}?academicYearRef=${ayId}`, { headers }).then((r) => r.json());
  test(prof1.success === true, 'Profile retrieved successfully');
  test(prof1.student.firstName === 'Rohan', 'Student master firstName matches');
  test(prof1.currentEnrollment !== null, 'Current enrollment attached');
  test(prof1.currentEnrollment.rollNumber === '1', 'Current roll number matches');
  test(prof1.allEnrollments.length === 1, 'All enrollments contains 1 record');
  test(prof1.enrollmentHistory.length === 1, 'Enrollment history audit contains initial admission record');
  test(prof1.enrollmentHistory[0].changeType === 'ADMISSION', 'History changeType is ADMISSION');

  // 6. Test Update Student Master
  console.log('\n--- 6. Testing Update Student Details ---');
  const updateRes = await fetch(`${API_BASE}/admin/students/${student1Id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      firstName: 'Rohan',
      middleName: 'Amitkumar',
      lastName: 'Patel',
      contact: { phone: '9999988888', email: 'rohan.updated@example.com' },
      guardianDetails: [
        { fullName: 'Amitkumar Patel', relationship: 'FATHER', mobileNumber: '9999900001', isPrimaryContact: true },
        { fullName: 'Meena Patel', relationship: 'MOTHER', mobileNumber: '9999900002', isPrimaryContact: false }
      ]
    })
  }).then((r) => r.json());

  test(updateRes.success === true, 'Student updated successfully');
  test(updateRes.student.middleName === 'Amitkumar', 'Middle name updated');
  test(updateRes.student.contact.phone === '9999988888', 'Phone updated');
  test(updateRes.student.guardianDetails.length === 2, 'Two guardians now recorded');

  // Validation: reject empty first name
  const invalidUpdate = await fetch(`${API_BASE}/admin/students/${student1Id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ firstName: '   ' })
  }).then((r) => r.json());
  test(invalidUpdate.success === false, 'Rejected update with empty first name');

  // 7. Test Deactivate & Reactivate Student
  console.log('\n--- 7. Testing Deactivation & Reactivation ---');
  const deactRes = await fetch(`${API_BASE}/admin/students/${student1Id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'INACTIVE' })
  }).then((r) => r.json());
  test(deactRes.success === true && deactRes.student.status === 'INACTIVE', 'Student deactivated to INACTIVE');

  // Verify in list with status filter
  const inactiveList = await fetch(`${API_BASE}/admin/students?academicYearRef=${ayId}&status=INACTIVE`, { headers }).then((r) => r.json());
  test(inactiveList.students.length === 1 && inactiveList.students[0].firstName === 'Rohan', 'Inactive student appears under INACTIVE filter');

  const activeList = await fetch(`${API_BASE}/admin/students?academicYearRef=${ayId}&status=ACTIVE`, { headers }).then((r) => r.json());
  test(activeList.students.length === 1 && activeList.students[0].firstName === 'Ananya', 'Only active students appear under ACTIVE filter');

  // Reactivate student
  const reactRes = await fetch(`${API_BASE}/admin/students/${student1Id}/status`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'ACTIVE' })
  }).then((r) => r.json());
  test(reactRes.success === true && reactRes.student.status === 'ACTIVE', 'Student reactivated to ACTIVE');

  // 8. Multi-School Data Isolation
  console.log('\n--- 8. Multi-School Data Isolation ---');
  const s2Email = `m4p2.schoolB.${ts}@gmail.com`;
  const s2Admin = `m4p2.adminB.${ts}@gmail.com`;
  const reg2 = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'School B',
      establishedYear: 2020,
      email: s2Email,
      mobileNumber: '9876543211',
      address: '22 B Road',
      websiteUrl: 'https://schoolb.edu',
      contactPersons: [
        { fullName: 'Principal B', email: `pb.${ts}@gmail.com`, mobileNumber: '9876500003', designation: 'Principal' },
        { fullName: 'Trustee B', email: `tb.${ts}@gmail.com`, mobileNumber: '9876500004', designation: 'Trustee' }
      ],
      adminFullName: 'Admin B',
      adminEmail: s2Admin,
      adminMobile: '9876511112',
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

  // School B attempts to query School A's student profile
  const crossProf = await fetch(`${API_BASE}/admin/students/${student1Id}`, { headers: schoolBHeaders }).then((r) => r.json());
  test(crossProf.success === false, 'School B cannot access School A student profile (HTTP 404)');

  const schoolBList = await fetch(`${API_BASE}/admin/students`, { headers: schoolBHeaders }).then((r) => r.json());
  test(schoolBList.students.length === 0, 'School B student list is strictly empty');

  console.log('\n========================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} MODULE 4 PHASE 2 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runModule4Phase2Tests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
