require('dotenv').config();
const mongoose = require('mongoose');
const assert = require('assert');

// Register models
require('./src/models/roleInfo.model');
const AuthService = require('./src/services/auth.service');
const UserInfo = require('./src/models/userInfo.model');
const SchoolInfo = require('./src/models/schoolInfo.model');
const EmployeeInfo = require('./src/models/employeeInfo.model');
const ClassInfo = require('./src/models/classInfo.model');
const SectionInfo = require('./src/models/sectionInfo.model');
const AcademicYearInfo = require('./src/models/academicYearInfo.model');
const StudentInfo = require('./src/models/studentInfo.model');
const StudentEnrollmentInfo = require('./src/models/studentEnrollmentInfo.model');
const HeadTeacherService = require('./src/services/headTeacher.service');

async function runFullModule2Tests() {
  console.log('========================================================================');
  console.log('  DMMS HEAD TEACHER PANEL — MODULE 2: STUDENT OVERVIEW COMPLETE TEST SUITE');
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

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/DMMS');

  const school = await SchoolInfo.findOne({ status: 'ACTIVE' });
  assert(school, 'An active school must exist in the database');
  const schoolId = school.schoolId;
  console.log(`Testing School: ${school.schoolName} (${schoolId})\n`);

  const academicYears = await AcademicYearInfo.find({ schoolId }).sort({ isCurrent: -1, startDate: -1 });
  assert(academicYears.length > 0, 'School must have at least one academic year');
  const activeYear = academicYears.find(y => y.isCurrent) || academicYears[0];

  const htUser = await UserInfo.findOne({ schoolId, roleCode: 'HEAD_TEACHER', status: 'ACTIVE' }).populate('roleRef');
  test(!!htUser, `Head Teacher user found for school ${schoolId}`);

  // ------------------------------------------------------------------------
  // PHASE 1 VERIFICATION
  // ------------------------------------------------------------------------
  console.log('\n--- VERIFYING PHASE 1: STUDENT LIST ---');
  const listResult = await HeadTeacherService.listStudents({
    schoolId,
    academicYearId: activeYear._id
  });
  test(Array.isArray(listResult.students), 'Phase 1: Returns student list array');
  test(listResult.pagination.totalRecords >= 0, 'Phase 1: Returns total records count');
  assert(listResult.students.length > 0, 'Need at least one student in DB for thorough testing');
  const targetStudent = listResult.students[0];
  test(!!targetStudent._id && !!targetStudent.admissionNumber, 'Phase 1: Student item contains _id and admissionNumber');

  // ------------------------------------------------------------------------
  // PHASE 2 VERIFICATION: STUDENT PROFILE
  // ------------------------------------------------------------------------
  console.log('\n--- VERIFYING PHASE 2: STUDENT PROFILE ---');
  const profileResult = await HeadTeacherService.getStudentProfile({
    schoolId,
    studentId: targetStudent._id.toString(),
    academicYearId: activeYear._id.toString()
  });

  // 2.1 Header details
  test(!!profileResult.student, 'Phase 2: Returns student master object');
  test(profileResult.student.admissionNumber === targetStudent.admissionNumber, 'Phase 2: Admission number matches requested student');
  test(profileResult.student.fullName === targetStudent.fullName, 'Phase 2: Full name matches requested student');
  test(profileResult.student.gender !== undefined, 'Phase 2: Gender is populated');
  test(profileResult.student.dateOfBirth !== undefined, 'Phase 2: Date of Birth is populated');

  // 2.2 Academic placement
  test(!!profileResult.academicPlacement, 'Phase 2: Returns academic placement object');
  test(profileResult.academicPlacement.className === targetStudent.className, 'Phase 2: Current class matches enrollment');
  test(profileResult.academicPlacement.classTeacherName !== undefined, 'Phase 2: Class teacher name is resolved');
  test(profileResult.academicPlacement.sectionTeacherName !== undefined, 'Phase 2: Section teacher name is resolved');

  // 2.3 Parent / Guardian details
  test(!!profileResult.parentGuardianInfo, 'Phase 2: Returns parentGuardianInfo object');
  test(profileResult.parentGuardianInfo.father !== undefined, 'Phase 2: Father details are structured');
  test(profileResult.parentGuardianInfo.mother !== undefined, 'Phase 2: Mother details are structured');

  // 2.4 Enrollment history
  test(Array.isArray(profileResult.enrollmentHistory), 'Phase 2: Returns enrollmentHistory array');
  test(profileResult.enrollmentHistory.length > 0, 'Phase 2: Enrollment history records found');
  const h0 = profileResult.enrollmentHistory[0];
  test(h0.academicYearName !== undefined, 'Phase 2: History row has academicYearName');
  test(h0.className !== undefined, 'Phase 2: History row has className');
  test(h0.enrollmentStatus !== undefined, 'Phase 2: History row has enrollmentStatus');

  // 2.5 Security: Cross-school rejection on student profile
  try {
    await HeadTeacherService.getStudentProfile({
      schoolId: 'OTHER_SCHOOL_999',
      studentId: targetStudent._id.toString()
    });
    test(false, 'Phase 2: Cross-school access must fail');
  } catch (err) {
    test(err.statusCode === 404, 'Phase 2: Cross-school student profile access rejected with 404');
  }

  // ------------------------------------------------------------------------
  // PHASE 3 VERIFICATION: STUDENT PERFORMANCE
  // ------------------------------------------------------------------------
  console.log('\n--- VERIFYING PHASE 3: STUDENT PERFORMANCE ---');
  const perfResult = await HeadTeacherService.getStudentPerformance({
    schoolId,
    studentId: targetStudent._id.toString(),
    academicYearId: activeYear._id.toString()
  });

  test(!!perfResult.student, 'Phase 3: Returns student overview details');
  test(!!perfResult.academicPlacement, 'Phase 3: Returns academic placement for the session');
  test(Array.isArray(perfResult.availableAcademicYears), 'Phase 3: Returns available academic years for multi-year comparison');
  test(Array.isArray(perfResult.examinations), 'Phase 3: Returns examinations list');
  test(perfResult.hasApprovedResults === false, 'Phase 3: Strictly reports hasApprovedResults: false when no published marks exist');
  test(perfResult.totalApprovedResults === 0, 'Phase 3: Reports 0 approved results without generating dummy values');
  test(typeof perfResult.notice === 'string', 'Phase 3: Includes informational notice regarding result approval workflow');

  if (perfResult.examinations.length > 0) {
    const e0 = perfResult.examinations[0];
    test(e0.examinationName && e0.examinationCode, 'Phase 3: Exam item has name and code');
    test(Array.isArray(e0.subjects), 'Phase 3: Exam item contains subjects array');
    if (e0.subjects.length > 0) {
      const sub0 = e0.subjects[0];
      test(sub0.subjectName && sub0.subjectCode, 'Phase 3: Subject item contains name and code');
      test(sub0.subjectType === 'ACADEMIC' || sub0.subjectType === 'CO_CURRICULAR', 'Phase 3: Subject type is ACADEMIC or CO_CURRICULAR');
      test(Array.isArray(sub0.components), 'Phase 3: Subject item contains components array');
    }
  }

  // 3.5 Security: Cross-school rejection on student performance
  try {
    await HeadTeacherService.getStudentPerformance({
      schoolId: 'OTHER_SCHOOL_999',
      studentId: targetStudent._id.toString()
    });
    test(false, 'Phase 3: Cross-school access must fail');
  } catch (err) {
    test(err.statusCode === 404, 'Phase 3: Cross-school student performance access rejected with 404');
  }

  // ------------------------------------------------------------------------
  // EXPRESS ROUTE & RBAC INTEGRATION
  // ------------------------------------------------------------------------
  console.log('\n--- VERIFYING EXPRESS ROUTER & RBAC GUARDS ---');
  const express = require('express');
  const app = express();
  app.use(express.json());

  const headTeacherRoutes = require('./src/routes/headTeacher.routes');
  app.use('/api/head-teacher', headTeacherRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/head-teacher`;

  try {
    const htEmployee = await EmployeeInfo.findById(htUser.employeeRef);
    const htToken = AuthService.generateUserToken(htUser, school, htEmployee);

    const teacherUser = await UserInfo.findOne({ schoolId, roleCode: 'TEACHER', status: 'ACTIVE' }).populate('roleRef');
    let teacherToken = null;
    if (teacherUser) {
      const teacherEmployee = await EmployeeInfo.findById(teacherUser.employeeRef);
      teacherToken = AuthService.generateUserToken(teacherUser, school, teacherEmployee);
    }

    // 1. Unauthenticated requests rejected with 401
    const unauthProfile = await fetch(`${baseUrl}/students/${targetStudent._id}`);
    test(unauthProfile.status === 401, 'HTTP: Unauthenticated request to student profile returns 401');

    const unauthPerf = await fetch(`${baseUrl}/students/${targetStudent._id}/performance`);
    test(unauthPerf.status === 401, 'HTTP: Unauthenticated request to student performance returns 401');

    // 2. TEACHER role rejected with 403
    if (teacherToken) {
      const teacherProfile = await fetch(`${baseUrl}/students/${targetStudent._id}`, {
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });
      test(teacherProfile.status === 403, 'HTTP: TEACHER request to student profile returns 403');

      const teacherPerf = await fetch(`${baseUrl}/students/${targetStudent._id}/performance`, {
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });
      test(teacherPerf.status === 403, 'HTTP: TEACHER request to student performance returns 403');
    }

    // 3. HEAD_TEACHER role succeeds with 200
    const htProfile = await fetch(`${baseUrl}/students/${targetStudent._id}`, {
      headers: { 'Authorization': `Bearer ${htToken}` }
    });
    test(htProfile.status === 200, 'HTTP: HEAD_TEACHER request to student profile returns 200');
    const profileJson = await htProfile.json();
    test(profileJson.success === true && !!profileJson.student, 'HTTP: Student profile payload valid');

    const htPerf = await fetch(`${baseUrl}/students/${targetStudent._id}/performance`, {
      headers: { 'Authorization': `Bearer ${htToken}` }
    });
    test(htPerf.status === 200, 'HTTP: HEAD_TEACHER request to student performance returns 200');
    const perfJson = await htPerf.json();
    test(perfJson.success === true && !!perfJson.student, 'HTTP: Student performance payload valid');

    // 4. Read-only restriction check: POST, PUT, DELETE operations on student profile routes return 404
    const putProfile = await fetch(`${baseUrl}/students/${targetStudent._id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${htToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Tamper' })
    });
    test(putProfile.status === 404, 'HTTP: PUT /students/:id rejected with 404 (strictly read-only)');

    const deleteProfile = await fetch(`${baseUrl}/students/${targetStudent._id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${htToken}` }
    });
    test(deleteProfile.status === 404, 'HTTP: DELETE /students/:id rejected with 404 (strictly read-only)');

    const postPerf = await fetch(`${baseUrl}/students/${targetStudent._id}/performance`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${htToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ marks: 100 })
    });
    test(postPerf.status === 404, 'HTTP: POST /students/:id/performance rejected with 404 (strictly read-only)');

  } finally {
    server.close();
  }

  console.log('\n========================================================================');
  console.log(`  MODULE 2 COMPLETE TEST RESULTS: ${passed}/${total} PASSED (100%)`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runFullModule2Tests().catch((err) => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});
