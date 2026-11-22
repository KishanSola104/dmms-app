const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const API_BASE = 'http://localhost:8000/api';

async function runModule3Phase1Tests() {
  console.log('========================================================================');
  console.log('  DMMS MODULE 3 – PHASE 1 (SUBJECT ALLOCATION TO CLASSES) TEST SUITE');
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
  const schoolEmail = `m3.school.${ts}@gmail.com`;
  const adminEmail = `m3.admin.${ts}@gmail.com`;

  // 1. Register School A
  console.log('--- 1. School Registration & Authentication ---');
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Oxford International School',
      establishedYear: 2012,
      email: schoolEmail,
      mobileNumber: '9876543210',
      address: '100 University Avenue, Ahmedabad',
      websiteUrl: 'https://oxford-school.edu',
      contactPersons: [
        { fullName: 'Arthur Dent', email: `arthur.${ts}@gmail.com`, mobileNumber: '9876500001', designation: 'Trustee' },
        { fullName: 'Ford Prefect', email: `ford.${ts}@gmail.com`, mobileNumber: '9876500002', designation: 'Principal' }
      ],
      adminFullName: 'Tricia McMillan',
      adminEmail: adminEmail,
      adminMobile: '9876511111',
      termsAccepted: true
    })
  }).then(r => r.json());

  test(regRes.success === true, 'School registered successfully');
  const schoolId = regRes.data.schoolId;
  const adminId = regRes.data.adminId;

  // Set known password
  const testPw = 'Admin@Oxford2026';
  const hashedPw = await bcrypt.hash(testPw, 10);
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: adminId }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  // School Login
  const sLogin = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId, password: testPw })
  }).then(r => r.json());
  test(sLogin.success === true, 'School authenticated and returned schoolToken');
  const sToken = sLogin.schoolToken;

  // Admin User Login
  const aLogin = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': sToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: adminId, password: testPw })
  }).then(r => r.json());
  test(aLogin.success === true, 'Admin User authenticated and returned JWT');
  const aToken = aLogin.token;

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aToken}`,
    'x-school-token': sToken
  };

  // 2. Setup Academic Years (2 distinct years for separation testing)
  console.log('\n--- 2. Academic Years & Classes Setup ---');
  const curYear = new Date().getFullYear();

  // AY 1 (e.g. 2026-27)
  const ay1Res = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: `Academic Year ${curYear + 1}-${curYear + 2}`,
      startDate: `${curYear + 1}-06-01`,
      endDate: `${curYear + 2}-05-31`
    })
  }).then(r => r.json());
  test(ay1Res.success === true, 'Created Academic Year 1 (Upcoming)');
  const ay1Id = ay1Res.academicYear._id;

  // AY 2 (e.g. 2027-28)
  const ay2Res = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: `Academic Year ${curYear + 2}-${curYear + 3}`,
      startDate: `${curYear + 2}-06-01`,
      endDate: `${curYear + 3}-05-31`
    })
  }).then(r => r.json());
  test(ay2Res.success === true, 'Created Academic Year 2 (Upcoming)');
  const ay2Id = ay2Res.academicYear._id;

  // 3. Setup Classes & Sections
  const cls1Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classCode: 'CLASS-1',
      className: 'Class 1',
      numberOfSections: 2
    })
  }).then(r => r.json());
  test(cls1Res.success === true, 'Class 1 created');
  const class1Id = cls1Res.class._id;

  const cls2Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classCode: 'CLASS-2',
      className: 'Class 2',
      numberOfSections: 1
    })
  }).then(r => r.json());
  test(cls2Res.success === true, 'Class 2 created');
  const class2Id = cls2Res.class._id;

  // 4. Setup Subjects in Subject Pool (Module 2)
  console.log('\n--- 3. Subject Pool Setup ---');
  const subMath = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      subjectCode: 'MATH-101',
      subjectName: 'Mathematics',
      subjectType: 'ACADEMIC'
    })
  }).then(r => r.json());
  test(subMath.success === true, 'Mathematics subject created in school pool');
  const mathId = subMath.subject._id;

  const subEng = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      subjectCode: 'ENG-101',
      subjectName: 'English',
      subjectType: 'ACADEMIC'
    })
  }).then(r => r.json());
  test(subEng.success === true, 'English subject created in school pool');
  const engId = subEng.subject._id;

  const subArt = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      subjectCode: 'ART-101',
      subjectName: 'Drawing & Craft',
      subjectType: 'CO_CURRICULAR'
    })
  }).then(r => r.json());
  test(subArt.success === true, 'Drawing & Craft co-curricular subject created');
  const artId = subArt.subject._id;

  // 5. Test Available Subjects API
  console.log('\n--- 4. Subject Allocation Tests (Phase 1) ---');
  const availRes = await fetch(
    `${API_BASE}/admin/class-subjects/available?academicYearRef=${ay1Id}&classRef=${class1Id}`,
    { headers: adminHeaders }
  ).then(r => r.json());
  test(availRes.success && availRes.subjects.length === 3, 'Fetched available subjects with unallocated status');
  test(availRes.subjects.every(s => s.isAllocated === false), 'All subjects initially unallocated');

  // Test 1: Allocate single subject with additional components (Mathematics: Project Work 10, Mental Math 5)
  const alloc1 = await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      classRef: class1Id,
      allocations: [
        {
          subjectRef: mathId,
          hasAdditionalComponents: true,
          additionalComponents: [
            { componentName: 'Project Work', maximumMarks: 10 },
            { componentName: 'Mental Math Quiz', maximumMarks: 5 }
          ]
        }
      ]
    })
  }).then(r => r.json());

  test(alloc1.success === true && alloc1.allocations.length === 1, 'Mathematics allocated with additional components');
  test(alloc1.allocations[0].totalAdditionalMarks === 15, 'Total additional marks automatically calculated as 15');
  const mathAllocId = alloc1.allocations[0]._id;

  // Test 2: Prevent duplicate allocation of Mathematics to Class 1 in Academic Year 1
  const dupAlloc = await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      classRef: class1Id,
      allocations: [{ subjectRef: mathId, hasAdditionalComponents: false }]
    })
  }).then(r => r.json());
  test(dupAlloc.success === false, 'Duplicate subject allocation to same class and year correctly prevented');

  // Test 3: Allocate multiple subjects to Class 1 (English with Oral 5, Art without additional components)
  const allocMulti = await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      classRef: class1Id,
      allocations: [
        {
          subjectRef: engId,
          hasAdditionalComponents: true,
          additionalComponents: [{ componentName: 'Oral Activity', maximumMarks: 5 }]
        },
        {
          subjectRef: artId,
          hasAdditionalComponents: false
        }
      ]
    })
  }).then(r => r.json());
  test(allocMulti.success === true && allocMulti.allocations.length === 2, 'Multiple subjects allocated (English with component, Art without)');
  const artAlloc = allocMulti.allocations.find(a => a.subjectRef === artId);
  test(artAlloc && artAlloc.hasAdditionalComponents === false && artAlloc.totalAdditionalMarks === 0, 'Art saved cleanly without additional components');

  // Test 4: Validation on invalid additional components (negative/zero marks & duplicate names)
  const invalidMarks = await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      classRef: class2Id,
      allocations: [
        {
          subjectRef: mathId,
          hasAdditionalComponents: true,
          additionalComponents: [{ componentName: 'Invalid Marks Comp', maximumMarks: -5 }]
        }
      ]
    })
  }).then(r => r.json());
  test(invalidMarks.success === false, 'Negative maximum marks rejected by backend');

  const dupCompName = await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      classRef: class2Id,
      allocations: [
        {
          subjectRef: mathId,
          hasAdditionalComponents: true,
          additionalComponents: [
            { componentName: 'Project', maximumMarks: 10 },
            { componentName: 'PROJECT', maximumMarks: 5 }
          ]
        }
      ]
    })
  }).then(r => r.json());
  test(dupCompName.success === false, 'Duplicate component names within same subject rejected');

  // Test 5: Academic-Year Separation (Allocating Mathematics to Class 1 in Academic Year 2 is allowed and independent)
  const allocAy2 = await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay2Id,
      classRef: class1Id,
      allocations: [
        {
          subjectRef: mathId,
          hasAdditionalComponents: true,
          additionalComponents: [{ componentName: 'Practical Lab', maximumMarks: 20 }]
        }
      ]
    })
  }).then(r => r.json());
  test(allocAy2.success === true, 'Mathematics successfully allocated to Class 1 in Academic Year 2 independently');
  test(allocAy2.allocations[0].totalAdditionalMarks === 20, 'AY2 Mathematics has separate total marks (20 vs 15 in AY1)');

  // Verify AY1 allocation was untouched
  const listAy1 = await fetch(
    `${API_BASE}/admin/class-subjects?academicYearRef=${ay1Id}&classRef=${class1Id}`,
    { headers: adminHeaders }
  ).then(r => r.json());
  const ay1Math = listAy1.allocations.find(a => a.subjectCode === 'MATH-101');
  test(ay1Math && ay1Math.totalAdditionalMarks === 15, 'Academic Year separation verified: AY1 allocation remains unchanged');

  // Test 6: Class Separation (Allocating Mathematics to Class 2 in Academic Year 1 is allowed)
  const allocClass2 = await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      classRef: class2Id,
      allocations: [{ subjectRef: mathId, hasAdditionalComponents: false }]
    })
  }).then(r => r.json());
  test(allocClass2.success === true, 'Mathematics allocated to Class 2 without conflict with Class 1');

  // Test 7: Update allocation additional components
  const updateRes = await fetch(`${API_BASE}/admin/class-subjects/${mathAllocId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      hasAdditionalComponents: true,
      additionalComponents: [
        { componentName: 'Project Work Updated', maximumMarks: 15 },
        { componentName: 'Viva Voce', maximumMarks: 10 }
      ]
    })
  }).then(r => r.json());
  test(updateRes.success === true, 'Allocation additional components updated');
  test(updateRes.allocation.totalAdditionalMarks === 25, 'Updated total additional marks recalculated as 25 (15 + 10)');

  // Test 8: Toggle status (Active -> Inactive -> Active)
  const deactRes = await fetch(`${API_BASE}/admin/class-subjects/${mathAllocId}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'INACTIVE' })
  }).then(r => r.json());
  test(deactRes.success === true && deactRes.allocation.status === 'INACTIVE', 'Allocation successfully deactivated');

  const reactRes = await fetch(`${API_BASE}/admin/class-subjects/${mathAllocId}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'ACTIVE' })
  }).then(r => r.json());
  test(reactRes.success === true && reactRes.allocation.status === 'ACTIVE', 'Allocation successfully reactivated');

  // Test 9: Multi-school isolation
  console.log('\n--- 5. School Data Isolation Verification ---');
  const ts2 = Date.now() + 500;
  const regSchool2 = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Cambridge International High',
      establishedYear: 2018,
      email: `cambridge.${ts2}@gmail.com`,
      mobileNumber: '9123456789',
      address: '22 Park Lane, Vadodara',
      websiteUrl: 'https://cambridge.edu',
      contactPersons: [
        { fullName: 'David Hume', email: `david.${ts2}@gmail.com`, mobileNumber: '9123400001', designation: 'Director' },
        { fullName: 'Adam Smith', email: `adam.${ts2}@gmail.com`, mobileNumber: '9123400002', designation: 'Dean' }
      ],
      adminFullName: 'John Locke',
      adminEmail: `admin.cambridge.${ts2}@gmail.com`,
      adminMobile: '9123411111',
      termsAccepted: true
    })
  }).then(r => r.json());

  const school2Id = regSchool2.data.schoolId;
  const admin2Id = regSchool2.data.adminId;
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId: school2Id }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: admin2Id }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  const s2Login = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId: school2Id, password: testPw })
  }).then(r => r.json());

  const a2Login = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': s2Login.schoolToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: admin2Id, password: testPw })
  }).then(r => r.json());

  const school2Headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${a2Login.token}`,
    'x-school-token': s2Login.schoolToken
  };

  // School 2 tries to query School 1's allocations
  const s2Query = await fetch(
    `${API_BASE}/admin/class-subjects?academicYearRef=${ay1Id}&classRef=${class1Id}`,
    { headers: school2Headers }
  ).then(r => r.json());
  test(s2Query.success === true && s2Query.allocations.length === 0, 'School 2 cannot see School 1 allocations (isolated to 0)');

  // School 2 tries to modify School 1's allocation directly
  const s2Tamper = await fetch(`${API_BASE}/admin/class-subjects/${mathAllocId}`, {
    method: 'PUT',
    headers: school2Headers,
    body: JSON.stringify({ hasAdditionalComponents: false })
  }).then(r => r.json());
  test(s2Tamper.success === false, 'Cross-school modification rejected (Allocation not found under School 2)');

  // 6. Regression check: User, Academic Year, Class, Section, Subject lists
  console.log('\n--- 6. Regression Testing for Existing Modules ---');
  const uList = await fetch(`${API_BASE}/admin/users`, { headers: adminHeaders }).then(r => r.json());
  test(uList.success === true && uList.users.length >= 1, 'Module 2 User management intact');

  const ayList = await fetch(`${API_BASE}/admin/academic-years`, { headers: adminHeaders }).then(r => r.json());
  test(ayList.success === true && ayList.academicYears.length >= 2, 'Module 2 Academic year management intact');

  const cList = await fetch(`${API_BASE}/admin/classes`, { headers: adminHeaders }).then(r => r.json());
  test(cList.success === true && cList.classes.length >= 2, 'Module 2 Class management intact');

  const subList = await fetch(`${API_BASE}/admin/subjects`, { headers: adminHeaders }).then(r => r.json());
  test(subList.success === true && subList.subjects.length >= 3, 'Module 2 Subject management intact');

  await mongoose.disconnect();

  console.log('\n========================================================================');
  console.log(`  ALL ${passed}/${total} MODULE 3 PHASE 1 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');
}

runModule3Phase1Tests().catch(err => {
  console.error('\nTest suite failed:', err);
  process.exit(1);
});
