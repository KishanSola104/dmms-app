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

async function runPhase1Tests() {
  console.log('========================================================================');
  console.log('  DMMS HEAD TEACHER PANEL — MODULE 2: STUDENT OVERVIEW (PHASE 1) TESTS');
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

  // 1. Check schools and test data
  const school = await SchoolInfo.findOne({ status: 'ACTIVE' });
  assert(school, 'An active school must exist in the database');
  const schoolId = school.schoolId;
  console.log(`Testing with School: ${school.schoolName} (${schoolId})\n`);

  // Academic years
  const academicYears = await AcademicYearInfo.find({ schoolId }).sort({ isCurrent: -1, startDate: -1 });
  assert(academicYears.length > 0, 'School must have at least one academic year');
  const activeYear = academicYears.find(y => y.isCurrent) || academicYears[0];

  // 2. Head Teacher user
  let htUser = await UserInfo.findOne({ schoolId, roleCode: 'HEAD_TEACHER', status: 'ACTIVE' }).populate('roleRef');
  test(!!htUser, `Head Teacher user exists for school ${schoolId}`);

  // Test 1: Service listStudents without parameters defaults to current academic year
  const resultDefault = await HeadTeacherService.listStudents({
    schoolId,
    academicYearId: activeYear._id
  });
  test(Array.isArray(resultDefault.students), 'Returns array of enrolled students');
  test(resultDefault.pagination !== undefined, 'Returns pagination metadata');
  test(resultDefault.selectedAcademicYear !== undefined, 'Returns selected academic year');
  console.log(`  -> Found ${resultDefault.pagination.totalRecords} students enrolled in ${activeYear.yearName}`);

  if (resultDefault.students.length > 0) {
    const s0 = resultDefault.students[0];
    // Test 2: Field integrity according to Phase 1 specification (Section 4.1)
    test(s0.admissionNumber !== undefined, 'Student has admissionNumber');
    test(s0.fullName !== undefined && s0.fullName.length > 0, 'Student has fullName');
    test(s0.gender !== undefined, 'Student has gender');
    test(s0.className !== undefined, 'Student has className');
    test(s0.sectionName !== undefined, 'Student has sectionName');
    test(s0.fatherName !== undefined, 'Student has fatherName');
    test(s0.parentContactNumber !== undefined, 'Student has parentContactNumber');
    test(s0.enrollmentStatus !== undefined, 'Student has enrollmentStatus');

    // Test 3: Search by Student Name (Section 4.3)
    const searchName = s0.firstName;
    const nameSearchResult = await HeadTeacherService.listStudents({
      schoolId,
      academicYearId: activeYear._id,
      search: searchName
    });
    test(
      nameSearchResult.students.some(st => st._id.toString() === s0._id.toString()),
      `Search by first name "${searchName}" returns the student`
    );

    // Test 4: Search by Admission Number (Section 4.3)
    const admSearchResult = await HeadTeacherService.listStudents({
      schoolId,
      academicYearId: activeYear._id,
      search: s0.admissionNumber
    });
    test(
      admSearchResult.students.some(st => st.admissionNumber === s0.admissionNumber),
      `Search by admission number "${s0.admissionNumber}" returns the student`
    );

    // Test 5: Class filtering (Section 4.4)
    if (s0.classId) {
      const classFiltered = await HeadTeacherService.listStudents({
        schoolId,
        academicYearId: activeYear._id,
        classId: s0.classId.toString()
      });
      test(
        classFiltered.students.every(st => st.classId.toString() === s0.classId.toString()),
        `Class filter correctly filters all students to class ${s0.className}`
      );
    }

    // Test 6: Section filtering (Section 4.4)
    if (s0.sectionId) {
      const sectionFiltered = await HeadTeacherService.listStudents({
        schoolId,
        academicYearId: activeYear._id,
        classId: s0.classId ? s0.classId.toString() : 'ALL',
        sectionId: s0.sectionId.toString()
      });
      test(
        sectionFiltered.students.every(st => st.sectionId.toString() === s0.sectionId.toString()),
        `Section filter correctly filters all students to section ${s0.sectionName}`
      );
    }

    // Test 7: Gender filtering (Section 4.4)
    const genderFiltered = await HeadTeacherService.listStudents({
      schoolId,
      academicYearId: activeYear._id,
      gender: s0.gender
    });
    test(
      genderFiltered.students.every(st => st.gender === s0.gender),
      `Gender filter correctly returns only ${s0.gender} students`
    );

    // Test 8: Enrollment status filtering (Section 4.4)
    const statusFiltered = await HeadTeacherService.listStudents({
      schoolId,
      academicYearId: activeYear._id,
      enrollmentStatus: s0.enrollmentStatus
    });
    test(
      statusFiltered.students.every(st => st.enrollmentStatus === s0.enrollmentStatus),
      `Enrollment status filter correctly returns only ${s0.enrollmentStatus} students`
    );

    // Test 9: Pagination mechanics (Section 4.5)
    const page1 = await HeadTeacherService.listStudents({
      schoolId,
      academicYearId: activeYear._id,
      limit: 1,
      page: 1
    });
    test(page1.students.length <= 1, 'Limit parameter limits records per page to 1');
    test(page1.pagination.currentPage === 1, 'Current page is 1');
    test(page1.pagination.totalPages >= 1, 'Total pages calculated properly');
  } else {
    console.log('  [NOTICE] No student enrollment records found in DB to test individual row matching.');
  }

  // Test 10: Academic year isolation (Section 4.2)
  const dummyAyId = new mongoose.Types.ObjectId();
  const dummyAyResult = await HeadTeacherService.listStudents({
    schoolId,
    academicYearId: dummyAyId.toString()
  });
  test(Array.isArray(dummyAyResult.students), 'Invalid academic year handled safely and gracefully');

  // Test 11: Cross-school isolation (Section 9)
  const foreignResult = await HeadTeacherService.listStudents({
    schoolId: 'FOREIGN_SCHOOL_999',
    academicYearId: activeYear._id
  });
  test(foreignResult.students.length === 0, 'Foreign school query returns 0 students (strict isolation)');

  // Test 12: Express HTTP Route & RBAC integration test
  console.log('\nTesting Express Router & Auth Guard Integration...');
  const express = require('express');
  const app = express();
  app.use(express.json());

  // Mount head teacher routes
  const headTeacherRoutes = require('./src/routes/headTeacher.routes');
  app.use('/api/head-teacher', headTeacherRoutes);

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/head-teacher`;

  try {
    // 12a: Unauthenticated request should be rejected with 401
    const unauthRes = await fetch(`${baseUrl}/students`);
    test(unauthRes.status === 401, 'Unauthenticated request to /api/head-teacher/students is rejected (401)');

    // 12b: Teacher role should be rejected with 403 (Head Teacher supervision endpoint)
    const teacherUser = await UserInfo.findOne({ schoolId, roleCode: 'TEACHER', status: 'ACTIVE' }).populate('roleRef');
    if (teacherUser) {
      const teacherEmployee = await EmployeeInfo.findById(teacherUser.employeeRef);
      const teacherToken = AuthService.generateUserToken(teacherUser, school, teacherEmployee);

      const teacherRes = await fetch(`${baseUrl}/students`, {
        headers: { 'Authorization': `Bearer ${teacherToken}` }
      });
      test(teacherRes.status === 403, 'TEACHER role request to /api/head-teacher/students is rejected (403 Forbidden)');
    }

    // 12c: Head Teacher role should succeed with 200
    let htToken = null;
    if (htUser) {
      const htEmployee = await EmployeeInfo.findById(htUser.employeeRef);
      htToken = AuthService.generateUserToken(htUser, school, htEmployee);

      const htRes = await fetch(`${baseUrl}/students?academicYearId=${activeYear._id}`, {
        headers: { 'Authorization': `Bearer ${htToken}` }
      });
      test(htRes.status === 200, 'HEAD_TEACHER role request to /api/head-teacher/students succeeds (200 OK)');
      const htBody = await htRes.json();
      test(htBody.success === true, 'Response contains success: true');
      test(Array.isArray(htBody.students), 'Response contains students array');
      test(htBody.pagination !== undefined, 'Response contains pagination info');
    }

    // 12d: Verify that no mutation (POST, PUT, DELETE) routes exist for student modifications under Head Teacher (strictly read-only)
    const postRes = await fetch(`${baseUrl}/students`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${htToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ firstName: 'Test' })
    });
    test(postRes.status === 404, 'POST /api/head-teacher/students with HT token returns 404 (strictly read-only, no write mutations)');

    const deleteRes = await fetch(`${baseUrl}/students/123`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${htToken}` }
    });
    test(deleteRes.status === 404, 'DELETE /api/head-teacher/students with HT token returns 404 (strictly read-only)');
  } finally {
    server.close();
  }

  console.log('\n========================================================================');
  console.log(`  TEST RESULTS: ${passed}/${total} PASSED (100%)`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runPhase1Tests().catch((err) => {
  console.error('\n[FATAL TEST FAILURE]:', err);
  process.exit(1);
});
