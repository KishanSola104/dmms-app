const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const API_BASE = 'http://localhost:8000/api';

async function runMasterVerification() {
  console.log('========================================================================');
  console.log('  DMMS COMPLETE VERIFICATION SUITE: MODULE 1 + MODULE 2 (ADMIN SETUP)');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function test(condition, description) {
    total++;
    if (condition) {
      console.log(`  [PASS ${String(total).padStart(2, '0')}] ${description}`);
      passed++;
    } else {
      console.error(`  [FAIL ${String(total).padStart(2, '0')}] ${description}`);
      throw new Error(`Test failed: ${description}`);
    }
  }

  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');

  // PART A: MODULE 1 SANITY
  console.log('--- PART A: VERIFYING MODULE 1 FOUNDATIONS ---');
  const health = await fetch(`${API_BASE}/health`).then(r => r.json());
  test(health.status === 'online', 'Health endpoint reports online');

  const roles = await fetch(`${API_BASE}/auth/roles`).then(r => r.json());
  test(roles.success && roles.roles.length === 4, 'Dynamic roles loaded from DB');

  // PART B: COMPLETE MODULE 2 ADMINISTRATIVE SETUP
  console.log('\n--- PART B: MODULE 2 ADMINISTRATIVE SETUP END-TO-END ---');
  const ts = Date.now();
  const schoolEmail = `master.school.${ts}@gmail.com`;
  const adminEmail = `master.admin.${ts}@gmail.com`;

  // 1. Register School
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Delhi Public Academy',
      establishedYear: 2010,
      email: schoolEmail,
      mobileNumber: '9988776655',
      address: 'Plot 42, Education City, Delhi',
      websiteUrl: 'https://dpa-delhi.edu',
      contactPersons: [
        { fullName: 'Anil Gupta', email: `anil.${ts}@gmail.com`, mobileNumber: '9988770001', designation: 'Trustee' },
        { fullName: 'Suman Verma', email: `suman.${ts}@gmail.com`, mobileNumber: '9988770002', designation: 'Principal' }
      ],
      adminFullName: 'Rajesh Mehra',
      adminEmail: adminEmail,
      adminMobile: '9988771122',
      termsAccepted: true
    })
  }).then(r => r.json());

  test(regRes.success === true, 'School registered');
  const schoolId = regRes.data.schoolId;
  const adminId = regRes.data.adminId;

  // Set known passwords
  const testPw = 'Admin@MasterPass2026';
  const hashedPw = await bcrypt.hash(testPw, 10);
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: adminId }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  // School Login
  const sLogin = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId, password: testPw })
  }).then(r => r.json());
  test(sLogin.success === true, 'School Login returned JWT session');
  const sToken = sLogin.schoolToken;

  // Admin Login
  const aLogin = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': sToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: adminId, password: testPw })
  }).then(r => r.json());
  test(aLogin.success === true, 'Admin User Login returned user JWT token');
  const aToken = aLogin.token;

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aToken}`,
    'x-school-token': sToken
  };

  // 2. Feature 1: User Management & Role Limits
  console.log('\n--- 1. Testing User Management & Role Limits ---');
  // Create 2nd Admin (Limit is 2)
  const a2 = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Vikram Batra',
      email: `vikram.admin.${ts}@gmail.com`,
      mobileNumber: '9988001122',
      designation: 'Vice Administrator',
      roleCode: 'ADMIN'
    })
  }).then(r => r.json());
  test(a2.success === true, '2nd Administrator created within limit');

  // Create 3rd Admin (Must fail: max 2)
  const a3 = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Pooja Batra',
      email: `pooja.admin.${ts}@gmail.com`,
      mobileNumber: '9988001133',
      designation: 'Third Administrator',
      roleCode: 'ADMIN'
    })
  }).then(r => r.json());
  test(a3.success === false, '3rd Administrator rejected (Role limit enforced)');

  // Create 1st Head Teacher (Limit is 1)
  const ht1 = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Dr. Alok Verma',
      email: `alok.ht.${ts}@gmail.com`,
      mobileNumber: '9988001144',
      designation: 'Head Teacher',
      roleCode: 'HEAD_TEACHER'
    })
  }).then(r => r.json());
  test(ht1.success === true, 'Head Teacher created within limit');

  // Create 2nd Head Teacher (Must fail: max 1)
  const ht2 = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Dr. Meena Verma',
      email: `meena.ht.${ts}@gmail.com`,
      mobileNumber: '9988001155',
      designation: 'Second Head Teacher',
      roleCode: 'HEAD_TEACHER'
    })
  }).then(r => r.json());
  test(ht2.success === false, '2nd Head Teacher rejected (Role limit enforced)');

  // Create Teachers (Unlimited)
  const t1 = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Deepak Joshi',
      email: `deepak.teacher.${ts}@gmail.com`,
      mobileNumber: '9988001166',
      designation: 'Physics Teacher',
      roleCode: 'TEACHER'
    })
  }).then(r => r.json());
  test(t1.success === true, 'Teacher 1 created successfully');
  const t1Id = t1.user.userId;

  // Edit User
  const editU = await fetch(`${API_BASE}/admin/users/${t1Id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Deepak K. Joshi',
      designation: 'Senior Physics Faculty'
    })
  }).then(r => r.json());
  test(editU.success === true && editU.user.fullName === 'Deepak K. Joshi', 'User edited without requiring email confirmation');

  // Deactivate User with confirmation code
  await fetch(`${API_BASE}/admin/users/request-confirmation-code`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'DEACTIVATE_USER', targetUserId: t1Id })
  });

  const otp = '654321';
  const hashedOtp = await bcrypt.hash(otp, 10);
  await mongoose.connection.db.collection('confirmation_code_info').updateOne(
    { adminUserId: adminId, action: 'DEACTIVATE_USER', targetUserId: t1Id },
    { $set: { codeHash: hashedOtp } }
  );

  const deactRes = await fetch(`${API_BASE}/admin/users/deactivate`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ targetUserId: t1Id, confirmationCode: otp })
  }).then(r => r.json());
  test(deactRes.success === true, 'User deactivated via verified confirmation code');

  // Activate User
  const actRes = await fetch(`${API_BASE}/admin/users/activate`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ targetUserId: t1Id })
  }).then(r => r.json());
  test(actRes.success === true, 'User activated back');

  // 3. Feature 2: Academic Year Management
  console.log('\n--- 2. Testing Academic Year Management ---');
  const curYear = new Date().getFullYear();
  // Valid Upcoming Year
  const ay1 = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: `Academic Year ${curYear + 1}-${curYear + 2}`,
      startDate: `${curYear + 1}-06-01`,
      endDate: `${curYear + 2}-05-31`
    })
  }).then(r => r.json());
  test(ay1.success === true, 'Upcoming Academic Year created');

  // Overlap prevention
  const ayOverlap = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: `Conflicting Year`,
      startDate: `${curYear + 1}-07-01`,
      endDate: `${curYear + 2}-04-01`
    })
  }).then(r => r.json());
  test(ayOverlap.success === false, 'Overlapping academic year date range prevented');

  // List Academic Years
  const ayList = await fetch(`${API_BASE}/admin/academic-years`, { headers: adminHeaders }).then(r => r.json());
  test(ayList.success === true && ayList.academicYears.length >= 2, 'Academic years listed');
  const currentAY = ayList.academicYears.find(y => y.isCurrent);
  test(currentAY && currentAY.status === 'CURRENT', 'Single Current Academic Year verified');

  // 4. Feature 3: Classes & Sections Management
  console.log('\n--- 3. Testing Classes & Sections Management ---');
  // Get eligible teachers
  const eligibleTeachers = await fetch(`${API_BASE}/admin/teachers`, { headers: adminHeaders }).then(r => r.json());
  test(eligibleTeachers.success && eligibleTeachers.teachers.length >= 2, 'Eligible teachers returned (Teacher + Head Teacher)');
  const teacherEmpId = eligibleTeachers.teachers[0].employeeId;

  // Create Class
  const classRes = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classCode: 'GRADE-5',
      className: 'Grade 5',
      classTeacherId: teacherEmpId,
      numberOfSections: 2
    })
  }).then(r => r.json());
  test(classRes.success === true && classRes.class.totalCapacity === 0, 'Class created with capacity = 0');
  const grade5Id = classRes.class._id;

  // Create Section A (Capacity 30)
  const secA = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classId: grade5Id,
      sectionCode: 'A',
      sectionName: 'Section A',
      sectionTeacherId: teacherEmpId,
      maxCapacity: 30
    })
  }).then(r => r.json());
  test(secA.success === true, 'Section A created (Capacity: 30)');

  // Create Section B (Capacity 25)
  const secB = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classId: grade5Id,
      sectionCode: 'B',
      sectionName: 'Section B',
      sectionTeacherId: teacherEmpId,
      maxCapacity: 25
    })
  }).then(r => r.json());
  test(secB.success === true, 'Section B created (Capacity: 25)');

  // Check Class Capacity: 30 + 25 = 55!
  const classesList = await fetch(`${API_BASE}/admin/classes`, { headers: adminHeaders }).then(r => r.json());
  const g5 = classesList.classes.find(c => c._id === grade5Id);
  test(g5 && g5.totalCapacity === 55, `Class Total Capacity automatically aggregated to 55 (Found: ${g5?.totalCapacity})`);

  // 5. Feature 4: Subjects Management
  console.log('\n--- 4. Testing Subjects Management ---');
  const subScholastic = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      subjectCode: 'SCI-05',
      subjectName: 'General Science',
      subjectType: 'ACADEMIC'
    })
  }).then(r => r.json());
  test(subScholastic.success === true && subScholastic.subject.subjectType === 'ACADEMIC', 'Academic (Scholastic) subject created');

  const subCoScholastic = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      subjectCode: 'MUSIC-01',
      subjectName: 'Vocal Music',
      subjectType: 'CO_CURRICULAR'
    })
  }).then(r => r.json());
  test(subCoScholastic.success === true && subCoScholastic.subject.subjectType === 'CO_CURRICULAR', 'Co-curricular (Co-Scholastic) subject created');

  const subjectsList = await fetch(`${API_BASE}/admin/subjects`, { headers: adminHeaders }).then(r => r.json());
  test(subjectsList.success === true && subjectsList.subjects.length >= 2, 'Subjects listed');

  await mongoose.disconnect();

  console.log('\n========================================================================');
  console.log(`  ALL ${passed}/${total} MASTER VERIFICATION TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');
}

runMasterVerification().catch(err => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
