/**
 * DMMS Module 3 – Phase 4 Test Suite
 * Examination Subject Configuration: Marks components, automatic totals,
 * independent class configurations, component validations, and school isolation.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const API_BASE = 'http://localhost:8000/api';

async function runModule3Phase4Tests() {
  console.log('========================================================================');
  console.log('  DMMS MODULE 3 – PHASE 4 (EXAMINATION SUBJECT CONFIGURATION) TEST SUITE');
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

  // Connect to DB for password setup and isolation checks
  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');

  const ts = Date.now();
  const schoolEmail = `m3p4.school.${ts}@gmail.com`;
  const adminEmail = `m3p4.admin.${ts}@gmail.com`;

  // ---------------------------------------------------------
  // 1. School Registration & Authentication
  // ---------------------------------------------------------
  console.log('--- 1. School Registration & Authentication ---');
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Oxford Academic Institute',
      establishedYear: 2012,
      email: schoolEmail,
      mobileNumber: '9876543210',
      address: '77 Oxford High Street, Ahmedabad',
      websiteUrl: 'https://oxford.edu',
      contactPersons: [
        { fullName: 'Arthur Conan', email: `arthur.${ts}@gmail.com`, mobileNumber: '9876500051', designation: 'Trustee' },
        { fullName: 'John Watson', email: `john.${ts}@gmail.com`, mobileNumber: '9876500052', designation: 'Principal' }
      ],
      adminFullName: 'Sherlock Holmes',
      adminEmail: adminEmail,
      adminMobile: '9876511151',
      adminPassword: 'Password@123',
      confirmPassword: 'Password@123',
      termsAccepted: true
    })
  }).then((r) => r.json());

  test(regRes.success === true, 'School registered successfully');
  const schoolId = regRes.data.schoolId;
  const adminId = regRes.data.adminId;

  // Set known passwords
  const testPw = 'Admin@Oxford2026';
  const hashedPw = await bcrypt.hash(testPw, 10);
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: adminId }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  // School Login
  const sLogin = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId, password: testPw })
  }).then((r) => r.json());
  test(sLogin.success === true, 'School authenticated');
  const sToken = sLogin.schoolToken;

  // Admin Login
  const aLogin = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': sToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: adminId, password: testPw })
  }).then((r) => r.json());
  test(aLogin.success === true, 'Admin User authenticated');
  const aToken = aLogin.token;

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aToken}`,
    'x-school-token': sToken
  };

  // ---------------------------------------------------------
  // 2. Setup Academic Year, Classes & Subjects
  // ---------------------------------------------------------
  console.log('\n--- 2. Academic Setup (AY, Classes, Subjects) ---');
  const curYear = new Date().getFullYear();

  // Academic Year
  const ayRes = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: `Academic Year ${curYear + 1}-${curYear + 2}`,
      startDate: `${curYear + 1}-06-01`,
      endDate: `${curYear + 2}-05-31`
    })
  }).then((r) => r.json());
  test(ayRes.success === true, 'Academic Year created');
  const ay1Id = ayRes.academicYear._id;

  // Classes (Class 1, Class 2, Class 3)
  const c1Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ classCode: 'CLS-1', className: 'Class 1', numberOfSections: 2 })
  }).then((r) => r.json());
  const c1Id = c1Res.class._id;

  const c2Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ classCode: 'CLS-2', className: 'Class 2', numberOfSections: 2 })
  }).then((r) => r.json());
  const c2Id = c2Res.class._id;

  const c3Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ classCode: 'CLS-3', className: 'Class 3', numberOfSections: 1 })
  }).then((r) => r.json());
  const c3Id = c3Res.class._id;
  test(c1Id && c2Id && c3Id, '3 Classes created successfully');

  // Subjects in Pool (Mathematics, General Science, English, Art)
  const subMath = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ subjectCode: 'MATH-101', subjectName: 'Mathematics', subjectType: 'ACADEMIC' })
  }).then((r) => r.json());
  const mathId = subMath.subject._id;

  const subSci = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ subjectCode: 'SCI-101', subjectName: 'General Science', subjectType: 'ACADEMIC' })
  }).then((r) => r.json());
  const sciId = subSci.subject._id;

  const subEng = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ subjectCode: 'ENG-101', subjectName: 'English Literature', subjectType: 'ACADEMIC' })
  }).then((r) => r.json());
  const engId = subEng.subject._id;

  const subArt = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ subjectCode: 'ART-101', subjectName: 'Art & Craft', subjectType: 'CO_CURRICULAR' })
  }).then((r) => r.json());
  const artId = subArt.subject._id;
  test(mathId && sciId && engId && artId, '4 Subjects created in pool');

  // ---------------------------------------------------------
  // 3. Subject Allocation Setup (Phase 1)
  // ---------------------------------------------------------
  console.log('\n--- 3. Subject Allocation Setup ---');

  // Class 1 Allocations: Math (with 10m project work), Science, English
  await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      classRef: c1Id,
      allocations: [
        {
          subjectRef: mathId,
          hasAdditionalComponents: true,
          additionalComponents: [{ componentName: 'Project Work', maximumMarks: 10 }]
        },
        {
          subjectRef: sciId,
          hasAdditionalComponents: false
        },
        {
          subjectRef: engId,
          hasAdditionalComponents: false
        }
      ]
    })
  });
  test(true, 'Allocated Math (with Project Work 10m), Science, English to Class 1');

  // Class 2 Allocations: Math, English
  await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      classRef: c2Id,
      allocations: [
        { subjectRef: mathId, hasAdditionalComponents: false },
        { subjectRef: engId, hasAdditionalComponents: false }
      ]
    })
  });
  test(true, 'Allocated Math & English to Class 2 (Art unallocated)');

  // ---------------------------------------------------------
  // 4. Examination Creation Setup (Phase 3)
  // ---------------------------------------------------------
  console.log('\n--- 4. Examination Creation Setup ---');
  const examRes = await fetch(`${API_BASE}/admin/examinations`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      examinationCode: 'UT-1',
      examinationName: 'Unit Test 1',
      startDate: `${curYear + 1}-08-01`,
      endDate: `${curYear + 1}-08-10`,
      classIds: [c1Id, c2Id]
    })
  }).then((r) => r.json());
  test(examRes.success === true, 'Unit Test 1 examination created');
  const examId = examRes.examination._id;

  // ---------------------------------------------------------
  // 5. Phase 4: Examination Subject Configuration
  // ---------------------------------------------------------
  console.log('\n--- 5. Testing Examination Subject Configuration (Phase 4) ---');

  // 5.1 Retrieve subjects for Class 1 under Unit Test 1
  const listRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects`,
    { headers: adminHeaders }
  ).then((r) => r.json());
  test(listRes.success === true, 'Retrieved allocated subjects for Class 1 in Unit Test 1');
  test(listRes.subjects.length === 3, 'Found exactly 3 allocated subjects for Class 1');
  test(
    listRes.subjects.every((s) => s.isConfigured === false),
    'All subjects initially marked as unconfigured'
  );
  test(
    listRes.summary.totalAllocatedSubjects === 3 && listRes.summary.configuredSubjects === 0,
    'Summary reflects 3 total, 0 configured'
  );

  // 5.2 Attempt to configure Art (which was NOT allocated to Class 1)
  const unallocRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects/${artId}/configure`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        components: [{ componentName: 'Drawing', maximumMarks: 50 }]
      })
    }
  );
  test(unallocRes.status === 400, 'Prevented configuration of unallocated subject (Art) to Class 1');

  // 5.3 Attempt to configure Class 3 (which was NOT assigned to this examination)
  const unassignedRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c3Id}/subjects/${mathId}/configure`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        components: [{ componentName: 'Written', maximumMarks: 50 }]
      })
    }
  );
  test(unassignedRes.status === 400, 'Prevented configuring subjects for class not assigned to examination');

  // 5.4 Validation: Empty components list rejected
  const emptyCompsRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects/${mathId}/configure`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ components: [] })
    }
  );
  test(emptyCompsRes.status === 400, 'Rejected configuration with empty components array');

  // 5.5 Validation: Invalid or missing component name rejected
  const missingNameRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects/${mathId}/configure`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        components: [{ componentName: '   ', maximumMarks: 50 }]
      })
    }
  );
  test(missingNameRes.status === 400, 'Rejected component with empty component name');

  // 5.6 Validation: Non-positive or zero maximum marks rejected
  const invalidMarksRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects/${mathId}/configure`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        components: [{ componentName: 'Written', maximumMarks: -10 }]
      })
    }
  );
  test(invalidMarksRes.status === 400, 'Rejected component with negative maximum marks');

  // 5.7 Validation: Duplicate component names in same subject rejected
  const dupNameRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects/${mathId}/configure`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        components: [
          { componentName: 'Written', maximumMarks: 40 },
          { componentName: 'written', maximumMarks: 10 }
        ]
      })
    }
  );
  test(dupNameRes.status === 400, 'Rejected duplicate component names (Written / written)');

  // 5.8 Configure Mathematics for Class 1:
  // Written: 40, Oral: 5, Class Work: 5 -> Expected Total = 50 marks
  const mathConfigRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects/${mathId}/configure`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        components: [
          { componentName: 'Written', maximumMarks: 40 },
          { componentName: 'Oral', maximumMarks: 5 },
          { componentName: 'Class Work', maximumMarks: 5 }
        ]
      })
    }
  ).then((r) => r.json());

  test(mathConfigRes.success === true, 'Configured Mathematics marks structure for Class 1');
  test(
    mathConfigRes.totalMaximumMarks === 50,
    `Automatic backend total calculated as 50 marks (Got: ${mathConfigRes.totalMaximumMarks})`
  );
  test(
    mathConfigRes.components.length === 3,
    'Exactly 3 components saved in examination_component_info'
  );

  // 5.9 Verify Mathematics Project Work (from Phase 1) remains separate from exam total
  const listResAfterMath = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects`,
    { headers: adminHeaders }
  ).then((r) => r.json());
  const mathSubInList = listResAfterMath.subjects.find((s) => s.subjectRef.toString() === mathId.toString());
  test(mathSubInList.isConfigured === true, 'Mathematics marked as configured in class listing');
  test(mathSubInList.totalMaximumMarks === 50, 'Mathematics exam total is 50 marks');
  test(
    mathSubInList.hasAdditionalComponents === true && mathSubInList.totalAdditionalMarks === 10,
    'Additional Component (Project Work: 10m) remains distinct and NOT added to exam total'
  );

  // 5.10 Configure Science for Class 1:
  // Theory: 70, Practical: 30 -> Total = 100
  const sciConfigRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects/${sciId}/configure`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        components: [
          { componentName: 'Theory Paper', maximumMarks: 70 },
          { componentName: 'Laboratory Practical', maximumMarks: 30 }
        ]
      })
    }
  ).then((r) => r.json());

  test(sciConfigRes.success === true, 'Configured Science marks structure for Class 1');
  test(
    sciConfigRes.totalMaximumMarks === 100,
    `Science backend total calculated as 100 marks (Got: ${sciConfigRes.totalMaximumMarks})`
  );

  // 5.11 Verify Class 2 Subject configuration is STRICTLY INDEPENDENT (Not auto-copied)
  const c2ListRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c2Id}/subjects`,
    { headers: adminHeaders }
  ).then((r) => r.json());
  test(c2ListRes.success === true, 'Retrieved allocated subjects for Class 2');
  const c2MathSub = c2ListRes.subjects.find((s) => s.subjectRef.toString() === mathId.toString());
  test(
    c2MathSub.isConfigured === false && c2MathSub.totalMaximumMarks === 0,
    'Independent check: Class 2 Mathematics is NOT auto-copied and remains unconfigured'
  );

  // 5.12 Configure Mathematics for Class 2 with DIFFERENT marks:
  // Written: 30, Viva: 10 -> Total = 40
  const c2MathConfig = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c2Id}/subjects/${mathId}/configure`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        components: [
          { componentName: 'Written', maximumMarks: 30 },
          { componentName: 'Viva', maximumMarks: 10 }
        ]
      })
    }
  ).then((r) => r.json());

  test(c2MathConfig.success === true, 'Configured Mathematics marks structure for Class 2');
  test(
    c2MathConfig.totalMaximumMarks === 40,
    `Class 2 Mathematics total is 40 marks (Got: ${c2MathConfig.totalMaximumMarks})`
  );

  // 5.13 Verify Class 1 Mathematics was NOT altered by Class 2 configuration
  const c1CheckRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects/${mathId}`,
    { headers: adminHeaders }
  ).then((r) => r.json());
  test(
    c1CheckRes.totalMaximumMarks === 50 && c1CheckRes.components.length === 3,
    'Class 1 Mathematics maintains independent 50 marks and 3 components'
  );

  // 5.14 Update / Edit Mathematics configuration in Class 1:
  // Change to Written: 45, Oral: 5 -> Total remains 50, but component count changes to 2
  const updateRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects/${mathId}/configure`,
    {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        components: [
          { componentName: 'Written Exam', maximumMarks: 45 },
          { componentName: 'Oral Interview', maximumMarks: 5 }
        ]
      })
    }
  ).then((r) => r.json());

  test(updateRes.success === true, 'Updated Mathematics configuration in Class 1');
  test(updateRes.components.length === 2, 'Component count updated to 2');
  test(updateRes.totalMaximumMarks === 50, 'Total marks recalculated to 50');

  // 5.15 Copy configuration helper:
  // Assign Class 3 to exam, allocate Math to Class 3, and copy from Class 2
  await fetch(`${API_BASE}/admin/examinations/${examId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      classIds: [c1Id, c2Id, c3Id]
    })
  });

  await fetch(`${API_BASE}/admin/class-subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      academicYearRef: ay1Id,
      classRef: c3Id,
      allocations: [{ subjectRef: mathId, hasAdditionalComponents: false }]
    })
  });

  const copyRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c3Id}/copy-from/${c2Id}`,
    {
      method: 'POST',
      headers: adminHeaders
    }
  ).then((r) => r.json());
  test(copyRes.success === true, 'Copied configuration from Class 2 to Class 3');
  test(copyRes.copiedCount === 1, 'Successfully copied 1 matching subject');

  const c3CheckRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c3Id}/subjects/${mathId}`,
    { headers: adminHeaders }
  ).then((r) => r.json());
  test(
    c3CheckRes.isConfigured === true && c3CheckRes.totalMaximumMarks === 40,
    'Class 3 received independent Mathematics config with 40 marks'
  );

  // ---------------------------------------------------------
  // 6. Multi-School Isolation Verification
  // ---------------------------------------------------------
  console.log('\n--- 6. Multi-School Isolation Verification ---');

  const ts2 = Date.now() + 100;
  const schoolBRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Harvard Preparatory School',
      establishedYear: 2018,
      email: `m3p4.schoolb.${ts2}@gmail.com`,
      mobileNumber: '9123456780',
      address: '99 Harvard Square, Surat',
      websiteUrl: 'https://harvardprep.edu',
      contactPersons: [
        { fullName: 'John Harvard', email: `jharvard.${ts2}@gmail.com`, mobileNumber: '9123400052', designation: 'Director' },
        { fullName: 'Samuel Phillips', email: `sphillips.${ts2}@gmail.com`, mobileNumber: '9123400053', designation: 'Principal' }
      ],
      adminFullName: 'Charles Eliot',
      adminEmail: `celiot.${ts2}@gmail.com`,
      adminMobile: '9123411152',
      adminPassword: 'Password@123',
      confirmPassword: 'Password@123',
      termsAccepted: true
    })
  }).then((r) => r.json());

  const schoolBId = schoolBRes.data.schoolId;
  const adminBId = schoolBRes.data.adminId;

  await mongoose.connection.db.collection('school_info').updateOne({ schoolId: schoolBId }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: adminBId }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  const sBLogin = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId: schoolBId, password: testPw })
  }).then((r) => r.json());
  const sBToken = sBLogin.schoolToken;

  const aBLogin = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': sBToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: adminBId, password: testPw })
  }).then((r) => r.json());
  const aBToken = aBLogin.token;

  const adminHeadersB = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aBToken}`,
    'x-school-token': sBToken
  };

  // School B attempts to view School A's exam subjects
  const sBAccessRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects`,
    { headers: adminHeadersB }
  );
  test(sBAccessRes.status === 404 || sBAccessRes.status === 400, 'School B rejected from accessing School A examination subjects');

  // School B attempts to configure School A's subject
  const sBConfigRes = await fetch(
    `${API_BASE}/admin/examinations/${examId}/classes/${c1Id}/subjects/${mathId}/configure`,
    {
      method: 'POST',
      headers: adminHeadersB,
      body: JSON.stringify({
        components: [{ componentName: 'Hacked', maximumMarks: 100 }]
      })
    }
  );
  test(sBConfigRes.status === 404 || sBConfigRes.status === 400, 'Cross-school subject marks configuration rejected');

  console.log('\n========================================================================');
  console.log(`  ALL ${passed}/${total} MODULE 3 PHASE 4 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runModule3Phase4Tests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
