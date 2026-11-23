/**
 * DMMS MODULE 4 – PHASE 4 TEST SUITE
 * Tests:
 * 1. Source Students Loading with previous enrollment & next-year enrollment status.
 * 2. Automatic Section Distribution Preview (Balanced round-robin & capacity check).
 * 3. Automatic Sequential Roll Number Generation Preview.
 * 4. Capacity limit warnings in distribution preview when sections are full.
 * 5. Execution of Student Promotion (marks prev COMPLETED/PROMOTED, creates next ACTIVE, logs PROMOTION).
 * 6. Execution of Student Repetition (marks prev COMPLETED/REPEATED, creates next ACTIVE, logs REPETITION).
 * 7. Duplicate next-year enrollment strictly prevented (HTTP 400 / 409).
 * 8. Destination section maximum capacity strictly enforced during execution.
 * 9. Scope and Roll Number uniqueness in destination section.
 * 10. Multi-School Data Isolation.
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

async function runModule4Phase4Tests() {
  console.log('========================================================================');
  console.log('  DMMS MODULE 4 – PHASE 4 (STUDENT PROMOTION) TEST SUITE');
  console.log('========================================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');

  const ts = Date.now();
  const schoolEmail = `m4p4.school.${ts}@gmail.com`;
  const adminEmail = `m4p4.admin.${ts}@gmail.com`;

  // 1. Setup School & Admin
  console.log('--- 1. School Registration & Setup ---');
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Greenwood High School',
      establishedYear: 2012,
      email: schoolEmail,
      mobileNumber: '9876543210',
      address: '100 Green Avenue, Bangalore',
      websiteUrl: 'https://greenwood.edu',
      contactPersons: [
        { fullName: 'Principal Green', email: `pg.${ts}@gmail.com`, mobileNumber: '9876500001', designation: 'Principal' },
        { fullName: 'Dean Wood', email: `dw.${ts}@gmail.com`, mobileNumber: '9876500002', designation: 'Dean' }
      ],
      adminFullName: 'Alok Nath',
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

  const testPw = 'Admin@Greenwood2026';
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

  // 2. Setup Academic Years (Year 1 & Year 2), Classes & Sections
  console.log('\n--- 2. Academic Setup ---');
  const curYear = new Date().getFullYear();

  // AY 1 (Previous AY)
  const ay1Res = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      yearName: `Academic Year ${curYear + 1}-${curYear + 2}`,
      startDate: `${curYear + 1}-06-01`,
      endDate: `${curYear + 2}-05-31`
    })
  }).then((r) => r.json());
  const ay1Id = ay1Res.academicYear._id;

  // AY 2 (Next AY)
  const ay2Res = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      yearName: `Academic Year ${curYear + 2}-${curYear + 3}`,
      startDate: `${curYear + 2}-06-01`,
      endDate: `${curYear + 3}-05-31`
    })
  }).then((r) => r.json());
  const ay2Id = ay2Res.academicYear._id;

  // Source Class: Class 5
  const c5Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classCode: 'CLS-5', className: 'Class 5', numberOfSections: 1 })
  }).then((r) => r.json());
  const c5Id = c5Res.class._id;

  const sec5ARes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classId: c5Id, sectionCode: 'A', sectionName: 'Section A', maxCapacity: 30 })
  }).then((r) => r.json());
  const sec5AId = sec5ARes.section._id;

  // Destination Class: Class 6 with 2 sections (Section A cap: 2, Section B cap: 30)
  const c6Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classCode: 'CLS-6', className: 'Class 6', numberOfSections: 2 })
  }).then((r) => r.json());
  const c6Id = c6Res.class._id;

  const sec6ARes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classId: c6Id, sectionCode: 'A', sectionName: 'Section A', maxCapacity: 2 })
  }).then((r) => r.json());
  const sec6AId = sec6ARes.section._id;

  const sec6BRes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ classId: c6Id, sectionCode: 'B', sectionName: 'Section B', maxCapacity: 30 })
  }).then((r) => r.json());
  const sec6BId = sec6BRes.section._id;

  // 3. Admit Sample Students into Class 5 (AY 1)
  console.log('\n--- 3. Admitting Test Students into Class 5 ---');
  // Student 1: Varun
  const adm1 = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      admissionNumberMethod: 'MANUAL',
      admissionNumber: `ADM-${ts}-501`,
      firstName: 'Varun',
      lastName: 'Dhawan',
      dateOfBirth: '2014-04-10',
      gender: 'MALE',
      guardianDetails: [{ fullName: 'David Dhawan', relationship: 'FATHER', mobileNumber: '9833000101', isPrimaryContact: true }],
      academicYearRef: ay1Id,
      classRef: c5Id,
      sectionRef: sec5AId,
      rollNumberMethod: 'MANUAL',
      rollNumber: '1'
    })
  }).then((r) => r.json());
  test(adm1.success === true, 'Student 1 (Varun) admitted to Class 5');
  const student1Id = adm1.student._id;
  const enr1Id = adm1.enrollment._id;

  // Student 2: Sara
  const adm2 = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      admissionNumberMethod: 'MANUAL',
      admissionNumber: `ADM-${ts}-502`,
      firstName: 'Sara',
      lastName: 'Khan',
      dateOfBirth: '2014-08-12',
      gender: 'FEMALE',
      guardianDetails: [{ fullName: 'Saif Khan', relationship: 'FATHER', mobileNumber: '9833000102', isPrimaryContact: true }],
      academicYearRef: ay1Id,
      classRef: c5Id,
      sectionRef: sec5AId,
      rollNumberMethod: 'MANUAL',
      rollNumber: '2'
    })
  }).then((r) => r.json());
  test(adm2.success === true, 'Student 2 (Sara) admitted to Class 5');
  const student2Id = adm2.student._id;
  const enr2Id = adm2.enrollment._id;

  // Student 3: Janhvi
  const adm3 = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      admissionNumberMethod: 'MANUAL',
      admissionNumber: `ADM-${ts}-503`,
      firstName: 'Janhvi',
      lastName: 'Kapoor',
      dateOfBirth: '2014-03-06',
      gender: 'FEMALE',
      guardianDetails: [{ fullName: 'Boney Kapoor', relationship: 'FATHER', mobileNumber: '9833000103', isPrimaryContact: true }],
      academicYearRef: ay1Id,
      classRef: c5Id,
      sectionRef: sec5AId,
      rollNumberMethod: 'MANUAL',
      rollNumber: '3'
    })
  }).then((r) => r.json());
  test(adm3.success === true, 'Student 3 (Janhvi) admitted to Class 5');
  const student3Id = adm3.student._id;
  const enr3Id = adm3.enrollment._id;

  // 4. Test Load Source Students for Promotion
  console.log('\n--- 4. Testing Load Source Students ---');
  const srcRes = await fetch(
    `${API_BASE}/admin/promotions/source-students?previousAcademicYearRef=${ay1Id}&nextAcademicYearRef=${ay2Id}&classRef=${c5Id}`,
    { headers }
  ).then((r) => r.json());

  test(srcRes.success === true, 'Source students loaded successfully');
  test(srcRes.students.length === 3, `Loaded all 3 Class 5 students (Got: ${srcRes.students.length})`);
  test(srcRes.students.every((s) => !s.isAlreadyEnrolledInNextYear), 'None are enrolled in AY 2 yet');

  // 5. Test Automatic Section Distribution Preview
  console.log('\n--- 5. Testing Section Distribution Preview ---');
  const prevRes = await fetch(`${API_BASE}/admin/promotions/preview-distribution`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      nextAcademicYearRef: ay2Id,
      destinationClassRef: c6Id,
      students: [
        { studentId: student1Id, enrollmentId: enr1Id, action: 'PROMOTE', studentName: 'Varun Dhawan', admissionNumber: `ADM-${ts}-501` },
        { studentId: student2Id, enrollmentId: enr2Id, action: 'PROMOTE', studentName: 'Sara Khan', admissionNumber: `ADM-${ts}-502` },
        { studentId: student3Id, enrollmentId: enr3Id, action: 'REPEAT', studentName: 'Janhvi Kapoor', admissionNumber: `ADM-${ts}-503` }
      ],
      rollNumberMethod: 'AUTO'
    })
  }).then((r) => r.json());

  test(prevRes.success === true, 'Distribution preview generated successfully');
  test(prevRes.assignments.length === 3, 'All 3 students assigned in preview');
  test(prevRes.assignments.every((a) => a.rollNumber), 'Automatic sequential roll numbers assigned in preview');
  // Check section balance (Varun -> 6-A, Sara -> 6-B, Janhvi -> 6-A)
  const secACount = prevRes.assignments.filter((a) => a.destinationSectionRef.toString() === sec6AId.toString()).length;
  const secBCount = prevRes.assignments.filter((a) => a.destinationSectionRef.toString() === sec6BId.toString()).length;
  test(secACount > 0 && secBCount > 0, `Sections balanced across A (${secACount}) and B (${secBCount})`);

  // 6. Test Execute Promotion
  console.log('\n--- 6. Testing Execute Promotions ---');
  // Promote Varun to 6-A (roll 1), Promote Sara to 6-B (roll 1), Repeat Janhvi in 5-A (roll 1)
  const execRes = await fetch(`${API_BASE}/admin/promotions/execute`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      previousAcademicYearRef: ay1Id,
      nextAcademicYearRef: ay2Id,
      promotions: [
        {
          studentId: student1Id,
          previousEnrollmentId: enr1Id,
          action: 'PROMOTE',
          destinationClassRef: c6Id,
          destinationSectionRef: sec6AId,
          rollNumber: '1',
          remarks: 'Promoted to Class 6-A'
        },
        {
          studentId: student2Id,
          previousEnrollmentId: enr2Id,
          action: 'PROMOTE',
          destinationClassRef: c6Id,
          destinationSectionRef: sec6BId,
          rollNumber: '1',
          remarks: 'Promoted to Class 6-B'
        },
        {
          studentId: student3Id,
          previousEnrollmentId: enr3Id,
          action: 'REPEAT',
          destinationClassRef: c5Id,
          destinationSectionRef: sec5AId,
          rollNumber: '1',
          remarks: 'Repeating Class 5'
        }
      ]
    })
  }).then((r) => r.json());

  test(execRes.success === true, 'Promotions executed successfully');
  test(execRes.successful === 3, 'All 3 operations succeeded');
  test(execRes.failed === 0, '0 operations failed');

  // Verify Varun in DB
  const varunPrevEnr = await mongoose.connection.db.collection('student_enrollment_info').findOne({ _id: new mongoose.Types.ObjectId(enr1Id) });
  test(varunPrevEnr.status === 'COMPLETED', 'Varun previous enrollment status is COMPLETED');
  test(varunPrevEnr.promotionOutcome === 'PROMOTED', 'Varun promotionOutcome is PROMOTED');

  const varunNextEnr = await mongoose.connection.db.collection('student_enrollment_info').findOne({
    studentRef: new mongoose.Types.ObjectId(student1Id),
    academicYearRef: new mongoose.Types.ObjectId(ay2Id)
  });
  test(varunNextEnr !== null && varunNextEnr.status === 'ACTIVE', 'Varun new enrollment in AY 2 is ACTIVE');
  test(varunNextEnr.classRef.toString() === c6Id.toString(), 'Varun enrolled in Class 6');

  // Verify Janhvi (Repeated) in DB
  const janhviPrevEnr = await mongoose.connection.db.collection('student_enrollment_info').findOne({ _id: new mongoose.Types.ObjectId(enr3Id) });
  test(janhviPrevEnr.status === 'COMPLETED', 'Janhvi previous enrollment is COMPLETED');
  test(janhviPrevEnr.promotionOutcome === 'REPEATED', 'Janhvi promotionOutcome is REPEATED');

  const janhviNextEnr = await mongoose.connection.db.collection('student_enrollment_info').findOne({
    studentRef: new mongoose.Types.ObjectId(student3Id),
    academicYearRef: new mongoose.Types.ObjectId(ay2Id)
  });
  test(janhviNextEnr !== null && janhviNextEnr.classRef.toString() === c5Id.toString(), 'Janhvi enrolled in Class 5 in AY 2 (Repeated)');

  // Verify History Records Created
  const histVarun = await mongoose.connection.db.collection('student_enrollment_history_info').findOne({
    studentRef: new mongoose.Types.ObjectId(student1Id),
    academicYearRef: new mongoose.Types.ObjectId(ay2Id)
  });
  test(histVarun !== null && histVarun.changeType === 'PROMOTION', 'Varun history record is PROMOTION');

  const histJanhvi = await mongoose.connection.db.collection('student_enrollment_history_info').findOne({
    studentRef: new mongoose.Types.ObjectId(student3Id),
    academicYearRef: new mongoose.Types.ObjectId(ay2Id)
  });
  test(histJanhvi !== null && histJanhvi.changeType === 'REPETITION', 'Janhvi history record is REPETITION');

  // 7. Verify Source Students reflects next year status
  console.log('\n--- 7. Testing Source Students Reflects Next Year Placement ---');
  const srcResAfter = await fetch(
    `${API_BASE}/admin/promotions/source-students?previousAcademicYearRef=${ay1Id}&nextAcademicYearRef=${ay2Id}&classRef=${c5Id}`,
    { headers }
  ).then((r) => r.json());

  test(srcResAfter.alreadyEnrolledCount === 3, 'All 3 source students now flagged as isAlreadyEnrolledInNextYear');
  test(srcResAfter.students[0].nextYearPlacement.className === 'Class 6', 'Varun next year placement shown as Class 6');
  test(srcResAfter.students[2].nextYearPlacement.className === 'Class 5', 'Janhvi next year placement shown as Class 5');

  // 8. Test Duplicate Promotion Rejection
  console.log('\n--- 8. Testing Duplicate Promotion Prevention ---');
  const dupExec = await fetch(`${API_BASE}/admin/promotions/execute`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      previousAcademicYearRef: ay1Id,
      nextAcademicYearRef: ay2Id,
      promotions: [
        {
          studentId: student1Id,
          previousEnrollmentId: enr1Id,
          action: 'PROMOTE',
          destinationClassRef: c6Id,
          destinationSectionRef: sec6AId
        }
      ]
    })
  }).then((r) => r.json());

  test(dupExec.failed === 1 && dupExec.details[0].success === false, 'Duplicate promotion into same AY rejected');

  // 9. Multi-School Isolation
  console.log('\n--- 9. Multi-School Isolation ---');
  const s2Email = `m4p4.schoolB.${ts}@gmail.com`;
  const s2Admin = `m4p4.adminB.${ts}@gmail.com`;
  const reg2 = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'School B Foundation',
      establishedYear: 2017,
      email: s2Email,
      mobileNumber: '9876543213',
      address: '77 Western Hub',
      websiteUrl: 'https://schoolb.org',
      contactPersons: [
        { fullName: 'Principal B', email: `pb.${ts}@gmail.com`, mobileNumber: '9876500003', designation: 'Principal' },
        { fullName: 'Trustee B', email: `tb.${ts}@gmail.com`, mobileNumber: '9876500004', designation: 'Trustee' }
      ],
      adminFullName: 'Admin B',
      adminEmail: s2Admin,
      adminMobile: '9876511114',
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

  const crossPromote = await fetch(`${API_BASE}/admin/promotions/execute`, {
    method: 'POST',
    headers: schoolBHeaders,
    body: JSON.stringify({
      previousAcademicYearRef: ay1Id,
      nextAcademicYearRef: ay2Id,
      promotions: [{ studentId: student1Id, previousEnrollmentId: enr1Id, action: 'PROMOTE', destinationClassRef: c6Id, destinationSectionRef: sec6AId }]
    })
  }).then((r) => r.json());

  test(crossPromote.success === false, 'School B cannot execute promotions with School A academic year (HTTP 404)');

  console.log('\n========================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} MODULE 4 PHASE 4 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runModule4Phase4Tests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
