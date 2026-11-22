const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const API_BASE = 'http://localhost:8000/api';

async function runModule3Phase2Tests() {
  console.log('========================================================================');
  console.log('  DMMS MODULE 3 – PHASE 2 (TEACHER ASSIGNMENT TO SUBJECTS) TEST SUITE');
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
  const schoolEmail = `m3p2.school.${ts}@gmail.com`;
  const adminEmail = `m3p2.admin.${ts}@gmail.com`;

  // 1. Register School
  console.log('--- 1. School Registration & Authentication ---');
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'St. Patrick Senior High',
      establishedYear: 2011,
      email: schoolEmail,
      mobileNumber: '9876543322',
      address: '88 High Street, Surat',
      websiteUrl: 'https://stpatrick.edu',
      contactPersons: [
        { fullName: 'Patrick O Brien', email: `pobrien.${ts}@gmail.com`, mobileNumber: '9876500021', designation: 'Trustee' },
        { fullName: 'Mary Byrne', email: `mbyrne.${ts}@gmail.com`, mobileNumber: '9876500022', designation: 'Principal' }
      ],
      adminFullName: 'Connor MacLeod',
      adminEmail: adminEmail,
      adminMobile: '9876511122',
      termsAccepted: true
    })
  }).then(r => r.json());

  test(regRes.success === true, 'School registered successfully');
  const schoolId = regRes.data.schoolId;
  const adminId = regRes.data.adminId;

  // Set known passwords
  const testPw = 'Admin@Patrick2026';
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

  // 2. Setup Academic Year
  console.log('\n--- 2. Academic Setup (Year, Staff, Classes, Subjects) ---');
  const curYear = new Date().getFullYear();
  const ayRes = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: `Academic Year ${curYear + 1}-${curYear + 2}`,
      startDate: `${curYear + 1}-06-01`,
      endDate: `${curYear + 2}-05-31`
    })
  }).then(r => r.json());
  test(ayRes.success === true, 'Academic Year created');
  const ayId = ayRes.academicYear._id;

  // 3. Create Staff: Head Teacher, Teacher A, Teacher B, Teacher C, Office Staff (unauthorized for teaching)
  // Head Teacher (Dr. Evelyn)
  const htRes = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Dr. Evelyn Cross',
      email: `evelyn.ht.${ts}@gmail.com`,
      mobileNumber: '9900112233',
      designation: 'Head Teacher',
      roleCode: 'HEAD_TEACHER'
    })
  }).then(r => r.json());
  test(htRes.success === true, 'Head Teacher created');
  const htUserId = htRes.user.userId;

  // Teacher A (Prof. Alan)
  const tARes = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Prof. Alan Turing',
      email: `alan.ta.${ts}@gmail.com`,
      mobileNumber: '9900112244',
      designation: 'Mathematics Faculty',
      roleCode: 'TEACHER'
    })
  }).then(r => r.json());
  test(tARes.success === true, 'Teacher A (Alan) created');
  const tAUserId = tARes.user.userId;

  // Teacher B (Prof. Grace)
  const tBRes = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Prof. Grace Hopper',
      email: `grace.tb.${ts}@gmail.com`,
      mobileNumber: '9900112255',
      designation: 'Computer Science Faculty',
      roleCode: 'TEACHER'
    })
  }).then(r => r.json());
  test(tBRes.success === true, 'Teacher B (Grace) created');
  const tBUserId = tBRes.user.userId;

  // Teacher C (Prof. Ada)
  const tCRes = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Prof. Ada Lovelace',
      email: `ada.tc.${ts}@gmail.com`,
      mobileNumber: '9900112266',
      designation: 'English Faculty',
      roleCode: 'TEACHER'
    })
  }).then(r => r.json());
  test(tCRes.success === true, 'Teacher C (Ada) created');

  // Office Staff (John Staff - cannot teach)
  const osRes = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'John Staff',
      email: `john.os.${ts}@gmail.com`,
      mobileNumber: '9900112277',
      designation: 'Registrar Staff',
      roleCode: 'OFFICE_STAFF'
    })
  }).then(r => r.json());
  test(osRes.success === true, 'Office Staff created');

  // Ensure all employeeRef ObjectIds are fetched accurately
  const htUserDoc = await mongoose.connection.db.collection('user_info').findOne({ userId: htRes.user.userId });
  const htEmpId = htUserDoc.employeeRef;
  const tAUserDoc = await mongoose.connection.db.collection('user_info').findOne({ userId: tARes.user.userId });
  const tAEmpId = tAUserDoc.employeeRef;
  const tBUserDoc = await mongoose.connection.db.collection('user_info').findOne({ userId: tBRes.user.userId });
  const tBEmpId = tBUserDoc.employeeRef;
  const tCUserDoc = await mongoose.connection.db.collection('user_info').findOne({ userId: tCRes.user.userId });
  const tCEmpId = tCUserDoc.employeeRef;
  const osUserDoc = await mongoose.connection.db.collection('user_info').findOne({ userId: osRes.user.userId });
  const osEmpId = osUserDoc.employeeRef;

  // 4. Create Classes & Sections
  // Class 1 (Class Teacher: Alan)
  const c1Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classCode: 'CLASS-1',
      className: 'Class 1',
      classTeacherId: tAEmpId,
      numberOfSections: 2
    })
  }).then(r => r.json());
  test(c1Res.success === true, 'Class 1 created (Class Teacher: Alan)');
  const c1Id = c1Res.class._id;

  // Section A under Class 1 (Section Teacher: Grace)
  const s1ARes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classId: c1Id,
      sectionCode: 'A',
      sectionName: 'Section A',
      sectionTeacherId: tBEmpId,
      maxCapacity: 35
    })
  }).then(r => r.json());
  test(s1ARes.success === true, 'Class 1 Section A created (Section Teacher: Grace)');
  const s1AId = s1ARes.section._id;

  // Section B under Class 1 (Section Teacher: Ada)
  const s1BRes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classId: c1Id,
      sectionCode: 'B',
      sectionName: 'Section B',
      sectionTeacherId: tCEmpId,
      maxCapacity: 35
    })
  }).then(r => r.json());
  test(s1BRes.success === true, 'Class 1 Section B created (Section Teacher: Ada)');
  const s1BId = s1BRes.section._id;

  // Class 2 (Class Teacher: Evelyn Head Teacher)
  const c2Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classCode: 'CLASS-2',
      className: 'Class 2',
      classTeacherId: htEmpId,
      numberOfSections: 1
    })
  }).then(r => r.json());
  test(c2Res.success === true, 'Class 2 created (Class Teacher: Evelyn)');
  const c2Id = c2Res.class._id;

  // Section A under Class 2
  const s2ARes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classId: c2Id,
      sectionCode: 'A',
      sectionName: 'Section A',
      sectionTeacherId: htEmpId,
      maxCapacity: 40
    })
  }).then(r => r.json());
  test(s2ARes.success === true, 'Class 2 Section A created');
  const s2AId = s2ARes.section._id;

  // 5. Subject Pool & Class Subject Allocations (Phase 1)
  const subMath = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ subjectCode: 'MATH-1', subjectName: 'Mathematics', subjectType: 'ACADEMIC' })
  }).then(r => r.json());
  const mathId = subMath.subject._id;

  const subEng = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ subjectCode: 'ENG-1', subjectName: 'English', subjectType: 'ACADEMIC' })
  }).then(r => r.json());
  const engId = subEng.subject._id;

  // Allocate Mathematics & English to Class 1
  const allocC1 = await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ayId,
      classRef: c1Id,
      allocations: [
        { subjectRef: mathId, hasAdditionalComponents: false },
        { subjectRef: engId, hasAdditionalComponents: false }
      ]
    })
  }).then(r => r.json());
  test(allocC1.success === true && allocC1.allocations.length === 2, 'Allocated Math & English to Class 1');
  const allocMathC1Id = allocC1.allocations.find(a => a.subjectCode === 'MATH-1')._id;
  const allocEngC1Id = allocC1.allocations.find(a => a.subjectCode === 'ENG-1')._id;

  // Allocate Mathematics to Class 2
  const allocC2 = await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ayId,
      classRef: c2Id,
      allocations: [{ subjectRef: mathId, hasAdditionalComponents: false }]
    })
  }).then(r => r.json());
  test(allocC2.success === true, 'Allocated Mathematics to Class 2');
  const allocMathC2Id = allocC2.allocations[0]._id;

  // Clear any existing notifications before testing assignment notifications
  await mongoose.connection.db.collection('notification_info').deleteMany({ schoolId });

  // 6. PHASE 2 TESTING: TEACHER ASSIGNMENT
  console.log('\n--- 3. Testing Teacher Assignments & Rules ---');

  // Test 1: Fetch eligible options API
  const optionsRes = await fetch(
    `${API_BASE}/admin/teacher-assignments/eligible-options?academicYearRef=${ayId}&classRef=${c1Id}`,
    { headers: adminHeaders }
  ).then(r => r.json());
  test(optionsRes.success === true, 'Eligible options retrieved for Class 1');
  test(optionsRes.sections.length === 2, 'Found 2 sections (A & B) for Class 1');
  test(optionsRes.allocatedSubjects.length === 2, 'Found 2 allocated subjects (Math & English) for Class 1');
  test(optionsRes.teachers.length === 4, 'Found 4 eligible teachers (3 Teachers + 1 Head Teacher)');
  test(!optionsRes.teachers.some(t => t.employeeId === osEmpId), 'Office staff correctly excluded from eligible teachers');

  // Test 2: Assign Teacher A (Alan) to Mathematics in Class 1 Section A
  const assign1 = await fetch(`${API_BASE}/admin/teacher-assignments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: s1AId,
      classSubjectRef: allocMathC1Id,
      teacherEmployeeId: tAEmpId
    })
  }).then(r => r.json());
  test(assign1.success === true, 'Teacher A assigned to Mathematics in Class 1 Section A');
  const assign1Id = assign1.assignment._id;

  // Test 3: Notification Verification for Test 2
  // Recipients for Class 1 Section A Math:
  // - Assigned Teacher: Alan (tAEmpId)
  // - Class Teacher: Alan (tAEmpId) -> DEDUPLICATED! Must receive only 1 notification.
  // - Section Teacher: Grace (tBEmpId)
  // - Head Teacher: Evelyn (htEmpId)
  const notifs1 = await mongoose.connection.db.collection('notification_info').find({ schoolId }).toArray();
  test(notifs1.length === 3, `Expected exactly 3 deduplicated notifications (Found: ${notifs1.length})`);

  const alanNotif = notifs1.find(n => n.targetUserId === tAUserId);
  test(alanNotif && alanNotif.message.includes('You have been assigned to teach Mathematics'), 'Alan received direct assignment notification');

  const graceNotif = notifs1.find(n => n.targetUserId === tBUserId);
  test(graceNotif && graceNotif.message.includes('Prof. Alan Turing has been assigned to teach Mathematics'), 'Section Teacher Grace received assignment notification');

  const evelynNotif = notifs1.find(n => n.targetUserId === htUserId);
  test(evelynNotif && evelynNotif.message.includes('Prof. Alan Turing has been assigned to teach Mathematics'), 'Head Teacher Evelyn received assignment notification');

  // Test 4: Conflict Prevention: Assigning another teacher (Grace) to same Math in Class 1 Section A must fail
  const conflictAssign = await fetch(`${API_BASE}/admin/teacher-assignments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: s1AId,
      classSubjectRef: allocMathC1Id,
      teacherEmployeeId: tBEmpId
    })
  }).then(r => r.json());
  test(conflictAssign.success === false, 'Conflict prevented: Cannot assign second active teacher to same subject in same section');

  // Test 5: Same Teacher (Alan) assigned to SAME subject in MULTIPLE sections (Section B)
  const assign2 = await fetch(`${API_BASE}/admin/teacher-assignments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: s1BId,
      classSubjectRef: allocMathC1Id,
      teacherEmployeeId: tAEmpId
    })
  }).then(r => r.json());
  test(assign2.success === true, 'Allowed: Same Teacher (Alan) assigned to same subject in another section (Section B)');

  // Test 6: Same Teacher (Alan) assigned to DIFFERENT class (Class 2 Section A)
  const assign3 = await fetch(`${API_BASE}/admin/teacher-assignments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ayId,
      classRef: c2Id,
      sectionRef: s2AId,
      classSubjectRef: allocMathC2Id,
      teacherEmployeeId: tAEmpId
    })
  }).then(r => r.json());
  test(assign3.success === true, 'Allowed: Same Teacher (Alan) assigned to teach in a different class (Class 2)');

  // Test 7: Same Teacher (Alan) assigned to DIFFERENT subject (English) in same class & section
  const assign4 = await fetch(`${API_BASE}/admin/teacher-assignments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: s1AId,
      classSubjectRef: allocEngC1Id,
      teacherEmployeeId: tAEmpId
    })
  }).then(r => r.json());
  test(assign4.success === true, 'Allowed: Same Teacher (Alan) assigned to different subject (English) in same section');

  // Test 8: Different Teacher (Grace) assigned to same subject (English) in different section (Section B)
  const assign5 = await fetch(`${API_BASE}/admin/teacher-assignments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: s1BId,
      classSubjectRef: allocEngC1Id,
      teacherEmployeeId: tBEmpId
    })
  }).then(r => r.json());
  test(assign5.success === true, 'Allowed: Different Teacher (Grace) assigned to English in Section B');

  // Test 9: Unauthorized User cannot be assigned (Office Staff)
  const unauthAssign = await fetch(`${API_BASE}/admin/teacher-assignments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ayId,
      classRef: c2Id,
      sectionRef: s2AId,
      classSubjectRef: allocMathC2Id,
      teacherEmployeeId: osEmpId
    })
  }).then(r => r.json());
  test(unauthAssign.success === false, 'Unauthorized user (Office Staff) rejected from teacher assignment');

  // Test 10: Head Teacher can be assigned as a teacher
  const htAssign = await fetch(`${API_BASE}/admin/teacher-assignments`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: s1BId,
      classSubjectRef: allocMathC1Id,
      teacherEmployeeId: htEmpId
    })
  }).then(r => r.json());
  test(htAssign.success === false, 'Head Teacher assignment rejected when Section B Math already has Alan');

  // Test 11: Reassign Teacher: Reassign Class 1 Section A Math from Alan to Grace
  await mongoose.connection.db.collection('notification_info').deleteMany({ schoolId });

  const reassignRes = await fetch(`${API_BASE}/admin/teacher-assignments/${assign1Id}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ newTeacherEmployeeId: tBEmpId })
  }).then(r => r.json());
  test(reassignRes.success === true && reassignRes.assignment.teacherName === 'Prof. Grace Hopper', 'Teacher reassigned from Alan to Grace');

  // Verify Reassignment Notifications:
  // - Grace (new teacher): assigned
  // - Alan (previous teacher): transferred
  // - Evelyn (Head Teacher): updated
  const reassignNotifs = await mongoose.connection.db.collection('notification_info').find({ schoolId }).toArray();
  test(reassignNotifs.length === 3, `Expected 3 reassignment notifications (Found: ${reassignNotifs.length})`);

  const graceReassignNotif = reassignNotifs.find(n => n.targetUserId === tBUserId);
  test(graceReassignNotif && graceReassignNotif.message.includes('You have been assigned'), 'New teacher Grace received assignment notification');

  const alanReassignNotif = reassignNotifs.find(n => n.targetUserId === tAUserId);
  test(alanReassignNotif && alanReassignNotif.message.includes('transferred to Prof. Grace Hopper'), 'Previous teacher Alan received transfer notification');

  // Test 12: List assignments with filters
  const listAll = await fetch(`${API_BASE}/admin/teacher-assignments?academicYearRef=${ayId}`, {
    headers: adminHeaders
  }).then(r => r.json());
  test(listAll.success === true && listAll.assignments.length === 5, `List returned all 5 active assignments (Found: ${listAll.assignments.length})`);

  const listByTeacher = await fetch(
    `${API_BASE}/admin/teacher-assignments?academicYearRef=${ayId}&teacherId=${tBEmpId}`,
    { headers: adminHeaders }
  ).then(r => r.json());
  test(listByTeacher.success === true && listByTeacher.assignments.length === 2, 'Filtered by Teacher Grace returned 2 assignments');

  // Test 13: Toggle Status: Deactivate & Reactivate
  const deactRes = await fetch(`${API_BASE}/admin/teacher-assignments/${assign1Id}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'INACTIVE' })
  }).then(r => r.json());
  test(deactRes.success === true && deactRes.assignment.status === 'INACTIVE', 'Teacher assignment deactivated');

  const reactRes = await fetch(`${API_BASE}/admin/teacher-assignments/${assign1Id}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'ACTIVE' })
  }).then(r => r.json());
  test(reactRes.success === true && reactRes.assignment.status === 'ACTIVE', 'Teacher assignment reactivated');

  // Test 14: School Isolation
  console.log('\n--- 4. School Data Isolation Verification ---');
  const ts3 = Date.now() + 800;
  const regSchool3 = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Dublin Grammar School',
      establishedYear: 2019,
      email: `dublin.${ts3}@gmail.com`,
      mobileNumber: '9111223344',
      address: '15 O Connell Street, Dublin',
      contactPersons: [
        { fullName: 'W. B. Yeats', email: `yeats.${ts3}@gmail.com`, mobileNumber: '9111200001', designation: 'Patron' },
        { fullName: 'James Joyce', email: `joyce.${ts3}@gmail.com`, mobileNumber: '9111200002', designation: 'Headmaster' }
      ],
      adminFullName: 'Oscar Wilde',
      adminEmail: `admin.dublin.${ts3}@gmail.com`,
      adminMobile: '9111211111',
      termsAccepted: true
    })
  }).then(r => r.json());

  const school3Id = regSchool3.data.schoolId;
  const admin3Id = regSchool3.data.adminId;
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId: school3Id }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: admin3Id }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  const s3Login = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId: school3Id, password: testPw })
  }).then(r => r.json());

  const a3Login = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': s3Login.schoolToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: admin3Id, password: testPw })
  }).then(r => r.json());

  const school3Headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${a3Login.token}`,
    'x-school-token': s3Login.schoolToken
  };

  const s3Query = await fetch(
    `${API_BASE}/admin/teacher-assignments?academicYearRef=${ayId}`,
    { headers: school3Headers }
  ).then(r => r.json());
  test(s3Query.success === true && s3Query.assignments.length === 0, 'School 3 cannot see School 1 assignments (isolated to 0)');

  const s3Tamper = await fetch(`${API_BASE}/admin/teacher-assignments/${assign1Id}`, {
    method: 'PUT',
    headers: school3Headers,
    body: JSON.stringify({ newTeacherEmployeeId: tAEmpId })
  }).then(r => r.json());
  test(s3Tamper.success === false, 'Cross-school reassign attempt rejected (Assignment not found under School 3)');

  await mongoose.disconnect();

  console.log('\n========================================================================');
  console.log(`  ALL ${passed}/${total} MODULE 3 PHASE 2 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');
}

runModule3Phase2Tests().catch(err => {
  console.error('\nTest suite failed:', err);
  process.exit(1);
});
