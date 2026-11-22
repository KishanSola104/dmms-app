const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const API_BASE = 'http://localhost:8000/api';

async function runModule3Phase3Tests() {
  console.log('========================================================================');
  console.log('  DMMS MODULE 3 – PHASE 3 (EXAMINATION MANAGEMENT) TEST SUITE');
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

  // Connect to DB for direct setup/checks
  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');

  const ts = Date.now();
  const schoolEmail = `m3p3.school.${ts}@gmail.com`;
  const adminEmail = `m3p3.admin.${ts}@gmail.com`;

  // 1. Register School
  console.log('--- 1. School Registration & Authentication ---');
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Westminster Collegiate High',
      establishedYear: 2015,
      email: schoolEmail,
      mobileNumber: '9876545566',
      address: '45 Westminster Bridge, Rajkot',
      websiteUrl: 'https://westminster.edu',
      contactPersons: [
        { fullName: 'Winston Churchill', email: `winston.${ts}@gmail.com`, mobileNumber: '9876500031', designation: 'Trustee' },
        { fullName: 'Clement Attlee', email: `clement.${ts}@gmail.com`, mobileNumber: '9876500032', designation: 'Principal' }
      ],
      adminFullName: 'Harold Wilson',
      adminEmail: adminEmail,
      adminMobile: '9876511133',
      termsAccepted: true
    })
  }).then(r => r.json());

  test(regRes.success === true, 'School registered successfully');
  const schoolId = regRes.data.schoolId;
  const adminId = regRes.data.adminId;

  // Set known passwords
  const testPw = 'Admin@Westminster2026';
  const hashedPw = await bcrypt.hash(testPw, 10);
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: adminId }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  // School Login
  const sLogin = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId, password: testPw })
  }).then(r => r.json());
  test(sLogin.success === true, 'School authenticated');
  const sToken = sLogin.schoolToken;

  // Admin Login
  const aLogin = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': sToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: adminId, password: testPw })
  }).then(r => r.json());
  test(aLogin.success === true, 'Admin User authenticated');
  const aToken = aLogin.token;

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aToken}`,
    'x-school-token': sToken
  };

  // 2. Setup Academic Years (AY 1 and AY 2)
  console.log('\n--- 2. Academic Years & Classes Setup ---');
  const curYear = new Date().getFullYear();
  const ay1Res = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: `Academic Year ${curYear + 1}-${curYear + 2}`,
      startDate: `${curYear + 1}-06-01`,
      endDate: `${curYear + 2}-05-31`
    })
  }).then(r => r.json());
  test(ay1Res.success === true, 'Academic Year 1 created');
  const ay1Id = ay1Res.academicYear._id;

  const ay2Res = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: `Academic Year ${curYear + 2}-${curYear + 3}`,
      startDate: `${curYear + 2}-06-01`,
      endDate: `${curYear + 3}-05-31`
    })
  }).then(r => r.json());
  test(ay2Res.success === true, 'Academic Year 2 created');
  const ay2Id = ay2Res.academicYear._id;

  // 3. Create Classes (Class 1, Class 2, Class 3)
  const c1Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ classCode: 'CLS-1', className: 'Class 1', numberOfSections: 2 })
  }).then(r => r.json());
  const c1Id = c1Res.class._id;

  const c2Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ classCode: 'CLS-2', className: 'Class 2', numberOfSections: 2 })
  }).then(r => r.json());
  const c2Id = c2Res.class._id;

  const c3Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ classCode: 'CLS-3', className: 'Class 3', numberOfSections: 1 })
  }).then(r => r.json());
  const c3Id = c3Res.class._id;
  test(c1Id && c2Id && c3Id, '3 Classes created successfully');

  // 4. PHASE 3 TESTS: EXAMINATION CREATION & CLASS ASSIGNMENT
  console.log('\n--- 3. Testing Examination Management ---');

  // Test 1: Create an examination assigned to ONE class
  const exam1Res = await fetch(`${API_BASE}/admin/examinations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      examinationCode: 'UT-1',
      examinationName: 'Unit Test 1',
      description: 'First quarterly unit assessment',
      startDate: `${curYear + 1}-08-10`,
      endDate: `${curYear + 1}-08-20`,
      status: 'UPCOMING',
      classIds: [c1Id]
    })
  }).then(r => r.json());

  test(exam1Res.success === true, 'Examination UT-1 created');
  test(exam1Res.examination.assignedClasses.length === 1, 'Assigned to exactly 1 class (Class 1)');
  const exam1Id = exam1Res.examination._id;

  // Test 2: Prevent duplicate examination code within same academic year
  const dupCodeRes = await fetch(`${API_BASE}/admin/examinations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      examinationCode: 'UT-1',
      examinationName: 'Duplicate UT 1',
      classIds: [c2Id]
    })
  }).then(r => r.json());
  test(dupCodeRes.success === false, 'Duplicate examination code in same academic year rejected');

  // Test 3: Same examination code in a DIFFERENT academic year is allowed (Year Separation)
  const ay2ExamRes = await fetch(`${API_BASE}/admin/examinations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay2Id,
      examinationCode: 'UT-1',
      examinationName: 'Unit Test 1 (Next Year)',
      classIds: [c1Id]
    })
  }).then(r => r.json());
  test(ay2ExamRes.success === true, 'Same examination code allowed in separate academic year (AY2)');

  // Test 4: Create an examination assigned to MULTIPLE classes (SEM-1 to Class 1, Class 2, Class 3)
  const exam2Res = await fetch(`${API_BASE}/admin/examinations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      examinationCode: 'SEM-1',
      examinationName: 'First Semester Examination',
      description: 'Comprehensive mid-term evaluation',
      startDate: `${curYear + 1}-10-05`,
      endDate: `${curYear + 1}-10-25`,
      status: 'UPCOMING',
      classIds: [c1Id, c2Id, c3Id]
    })
  }).then(r => r.json());

  test(exam2Res.success === true, 'Semester 1 exam created');
  test(exam2Res.examination.assignedClasses.length === 3, 'Assigned to multiple classes (Class 1, 2, 3)');
  const exam2Id = exam2Res.examination._id;

  // Test 5: Duplicate class IDs in request payload are deduplicated
  const exam3Res = await fetch(`${API_BASE}/admin/examinations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      examinationCode: 'UT-2',
      examinationName: 'Unit Test 2',
      classIds: [c1Id, c1Id, c2Id] // duplicate c1Id
    })
  }).then(r => r.json());
  test(exam3Res.success === true, 'Duplicate class IDs in creation payload handled cleanly');
  test(exam3Res.examination.assignedClasses.length === 2, 'Assigned classes deduplicated to 2 distinct classes');

  // Test 6: Date validation (Start Date cannot be after End Date)
  const invalidDateRes = await fetch(`${API_BASE}/admin/examinations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      examinationCode: 'INVALID-DATES',
      examinationName: 'Invalid Dates Exam',
      startDate: `${curYear + 1}-11-20`,
      endDate: `${curYear + 1}-11-10`, // endDate earlier than startDate
      classIds: [c1Id]
    })
  }).then(r => r.json());
  test(invalidDateRes.success === false, 'Invalid dates rejected (Start date > End date)');

  // Test 7: List examinations with search, status, and assigned classes
  const listAll = await fetch(`${API_BASE}/admin/examinations?academicYearRef=${ay1Id}`, {
    headers: adminHeaders
  }).then(r => r.json());
  test(listAll.success === true && listAll.examinations.length === 3, 'All 3 examinations listed for Academic Year 1');

  const listSearch = await fetch(`${API_BASE}/admin/examinations?academicYearRef=${ay1Id}&search=Semester`, {
    headers: adminHeaders
  }).then(r => r.json());
  test(listSearch.success === true && listSearch.examinations.length === 1, 'Search by keyword "Semester" matched SEM-1');

  // Test 8: Get single examination details with assigned classes
  const getSingle = await fetch(`${API_BASE}/admin/examinations/${exam2Id}`, {
    headers: adminHeaders
  }).then(r => r.json());
  test(getSingle.success === true && getSingle.examination.examinationCode === 'SEM-1', 'Retrieved single examination');
  test(getSingle.examination.assignedClasses.length === 3, 'Single examination contains all 3 assigned classes');

  // Test 9: Get assigned classes endpoint (for Phase 4)
  const assignedClassesRes = await fetch(`${API_BASE}/admin/examinations/${exam2Id}/classes`, {
    headers: adminHeaders
  }).then(r => r.json());
  test(assignedClassesRes.success === true && assignedClassesRes.classes.length === 3, 'Retrieved assigned classes for examination');

  // Test 10: Edit examination (update name, description, and modify assigned classes)
  // Modify SEM-1 to remove Class 3, keeping Class 1 and Class 2
  const editRes = await fetch(`${API_BASE}/admin/examinations/${exam2Id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      examinationCode: 'SEM-1-REV',
      examinationName: 'First Semester Examination (Revised)',
      description: 'Revised schedule and classes',
      startDate: `${curYear + 1}-10-10`,
      endDate: `${curYear + 1}-10-28`,
      status: 'ONGOING',
      classIds: [c1Id, c2Id] // removed c3Id
    })
  }).then(r => r.json());
  test(editRes.success === true, 'Examination updated');
  test(editRes.examination.examinationCode === 'SEM-1-REV', 'Examination code updated');
  test(editRes.examination.status === 'ONGOING', 'Examination status updated to ONGOING');
  test(editRes.examination.assignedClasses.length === 2, 'Assigned classes synced to 2 classes (Class 3 deactivated)');

  // Test 11: Toggle examination status (ONGOING -> COMPLETED)
  const statusRes = await fetch(`${API_BASE}/admin/examinations/${exam2Id}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'COMPLETED' })
  }).then(r => r.json());
  test(statusRes.success === true && statusRes.examination.status === 'COMPLETED', 'Status updated to COMPLETED');

  // Test 12: Multi-school isolation
  console.log('\n--- 4. Multi-School Isolation Verification ---');
  const ts4 = Date.now() + 1200;
  const regSchool4 = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Oxfordshire High',
      establishedYear: 2017,
      email: `oxfordshire.${ts4}@gmail.com`,
      mobileNumber: '9222334455',
      address: '10 Oxford High Road, Jamnagar',
      contactPersons: [
        { fullName: 'C. S. Lewis', email: `cslewis.${ts4}@gmail.com`, mobileNumber: '9222300001', designation: 'Trustee' },
        { fullName: 'J. R. R. Tolkien', email: `tolkien.${ts4}@gmail.com`, mobileNumber: '9222300002', designation: 'Principal' }
      ],
      adminFullName: 'Philip Pullman',
      adminEmail: `admin.oxfordshire.${ts4}@gmail.com`,
      adminMobile: '9222311111',
      termsAccepted: true
    })
  }).then(r => r.json());

  const school4Id = regSchool4.data.schoolId;
  const admin4Id = regSchool4.data.adminId;
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId: school4Id }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: admin4Id }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  const s4Login = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId: school4Id, password: testPw })
  }).then(r => r.json());

  const a4Login = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': s4Login.schoolToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: admin4Id, password: testPw })
  }).then(r => r.json());

  const school4Headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${a4Login.token}`,
    'x-school-token': s4Login.schoolToken
  };

  const s4Query = await fetch(
    `${API_BASE}/admin/examinations?academicYearRef=${ay1Id}`,
    { headers: school4Headers }
  ).then(r => r.json());
  test(s4Query.success === true && s4Query.examinations.length === 0, 'School 4 cannot see School 1 examinations (isolated to 0)');

  const s4Tamper = await fetch(`${API_BASE}/admin/examinations/${exam1Id}`, {
    method: 'PUT',
    headers: school4Headers,
    body: JSON.stringify({ examinationName: 'Tampered Exam' })
  }).then(r => r.json());
  test(s4Tamper.success === false, 'Cross-school modification rejected (Examination not found under School 4)');

  await mongoose.disconnect();

  console.log('\n========================================================================');
  console.log(`  ALL ${passed}/${total} MODULE 3 PHASE 3 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');
}

runModule3Phase3Tests().catch(err => {
  console.error('\nTest suite failed:', err);
  process.exit(1);
});
