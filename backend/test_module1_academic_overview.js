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
const SubjectInfo = require('./src/models/subjectInfo.model');
const AcademicYearInfo = require('./src/models/academicYearInfo.model');
const StudentEnrollmentInfo = require('./src/models/studentEnrollmentInfo.model');
const SubjectTeacherAssignmentInfo = require('./src/models/subjectTeacherAssignmentInfo.model');
const ClassSubjectInfo = require('./src/models/classSubjectInfo.model');

const BASE_URL = 'http://localhost:8000/api';

async function runMasterTest() {
  console.log('========================================================================');
  console.log('  DMMS HEAD TEACHER PANEL — MODULE 1 ACADEMIC OVERVIEW MASTER TEST SUITE');
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

  const school = await SchoolInfo.findOne({ schoolId: 'KBPS_001' });
  assert(school, 'School KBPS_001 must exist in DB');

  const headTeacherUser = await UserInfo.findOne({ schoolId: 'KBPS_001', roleCode: 'HEAD_TEACHER' }).populate('roleRef');
  const teacherUser = await UserInfo.findOne({ schoolId: 'KBPS_001', roleCode: 'TEACHER' }).populate('roleRef');
  const adminUser = await UserInfo.findOne({ schoolId: 'KBPS_001', roleCode: 'ADMIN' }).populate('roleRef');

  const htEmployee = await EmployeeInfo.findById(headTeacherUser.employeeRef);
  const teacherEmployee = await EmployeeInfo.findById(teacherUser.employeeRef);
  const adminEmployee = await EmployeeInfo.findById(adminUser.employeeRef);

  const htToken = AuthService.generateUserToken(headTeacherUser, school, htEmployee);
  const teacherToken = AuthService.generateUserToken(teacherUser, school, teacherEmployee);
  const adminToken = AuthService.generateUserToken(adminUser, school, adminEmployee);

  const academicYears = await AcademicYearInfo.find({ schoolId: 'KBPS_001' }).sort({ isCurrent: -1, startDate: -1 });
  const activeYear = academicYears.find(y => y.isCurrent) || academicYears[0];
  const upcomingYear = academicYears.find(y => !y.isCurrent);

  // ==========================================
  // PHASE 1 TESTS: CLASSES & SECTIONS
  // ==========================================
  console.log('--- PHASE 1: CLASSES & SECTIONS (SECTION 5) ---');

  // 1.1 List classes
  const resClasses = await fetch(`${BASE_URL}/head-teacher/classes`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataClasses = await resClasses.json();
  test(resClasses.status === 200 && dataClasses.success === true, 'Phase 1: Classes listing returned successfully');
  test(Array.isArray(dataClasses.classes) && dataClasses.classes.length > 0, 'Phase 1: Classes array populated');

  const firstClass = dataClasses.classes[0];
  test(firstClass.classCode && firstClass.className, 'Phase 1: Class item contains classCode and className');
  test(typeof firstClass.totalStudentCount === 'number', 'Phase 1: Class item contains totalStudentCount');
  test(typeof firstClass.totalCapacity === 'number', 'Phase 1: Class item contains totalCapacity');
  test(typeof firstClass.numberOfSections === 'number', 'Phase 1: Class item contains numberOfSections');

  // 1.2 Search and filter classes
  const resClassSearch = await fetch(`${BASE_URL}/head-teacher/classes?search=${encodeURIComponent(firstClass.className)}`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataClassSearch = await resClassSearch.json();
  test(dataClassSearch.classes.some(c => c.classCode === firstClass.classCode), 'Phase 1: Search by class name works correctly');

  // 1.3 Class Details & Section Listing
  const resClassDetails = await fetch(`${BASE_URL}/head-teacher/classes/${firstClass._id}`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataClassDetails = await resClassDetails.json();
  test(resClassDetails.status === 200 && dataClassDetails.success === true, 'Phase 1: Class details fetched successfully');
  test(dataClassDetails.classDetails.classCode === firstClass.classCode, 'Phase 1: Class details match requested class');
  test(Array.isArray(dataClassDetails.sections) && dataClassDetails.sections.length > 0, 'Phase 1: Section listing for class returned');

  const firstSection = dataClassDetails.sections[0];
  test(firstSection.sectionCode && firstSection.sectionName, 'Phase 1: Section item contains code and name');
  test(typeof firstSection.availableCapacity === 'number', 'Phase 1: Section item contains availableCapacity');

  // 1.4 Section Details & Enrolled Students Roster
  const resSectionDetails = await fetch(`${BASE_URL}/head-teacher/classes/${firstClass._id}/sections/${firstSection._id}`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataSectionDetails = await resSectionDetails.json();
  test(resSectionDetails.status === 200 && dataSectionDetails.success === true, 'Phase 1: Section details fetched successfully');
  test(dataSectionDetails.sectionDetails.sectionCode === firstSection.sectionCode, 'Phase 1: Section details match requested section');
  test(Array.isArray(dataSectionDetails.students), 'Phase 1: Enrolled student roster array returned');

  // 1.5 Restrictions check: Write operations must be rejected
  const resClassPost = await fetch(`${BASE_URL}/head-teacher/classes`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${htToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ className: 'Forbidden' })
  });
  test(resClassPost.status === 404 || resClassPost.status === 405, 'Phase 1: POST operation rejected on classes route (Read-only restriction)');

  // ==========================================
  // PHASE 2 TESTS: SUBJECT OVERVIEW
  // ==========================================
  console.log('\n--- PHASE 2: SUBJECT OVERVIEW (SECTION 6) ---');

  // 2.1 List subjects
  const resSubjects = await fetch(`${BASE_URL}/head-teacher/subjects`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataSubjects = await resSubjects.json();
  test(resSubjects.status === 200 && dataSubjects.success === true, 'Phase 2: Subjects listing returned successfully');
  test(Array.isArray(dataSubjects.subjects) && dataSubjects.subjects.length > 0, 'Phase 2: Subjects array populated');

  const firstSub = dataSubjects.subjects[0];
  test(firstSub.subjectCode && firstSub.subjectName && firstSub.subjectType, 'Phase 2: Subject item contains code, name, and type');

  // 2.2 Filter subjects by type
  const resAcademicSubs = await fetch(`${BASE_URL}/head-teacher/subjects?type=ACADEMIC`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataAcademicSubs = await resAcademicSubs.json();
  test(dataAcademicSubs.subjects.every(s => s.subjectType === 'ACADEMIC'), 'Phase 2: Filter by subject type ACADEMIC works');

  // 2.3 Subject Details & Historical Allocations
  const resSubDetails = await fetch(`${BASE_URL}/head-teacher/subjects/${firstSub._id}`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataSubDetails = await resSubDetails.json();
  test(resSubDetails.status === 200 && dataSubDetails.success === true, 'Phase 2: Subject details fetched successfully');
  test(dataSubDetails.subject.subjectCode === firstSub.subjectCode, 'Phase 2: Subject details match requested subject');
  test(Array.isArray(dataSubDetails.allocations), 'Phase 2: Subject class allocations array returned');

  // 2.4 Class-wise Subject Allocations
  const resAllocations = await fetch(`${BASE_URL}/head-teacher/subject-allocations`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataAllocations = await resAllocations.json();
  test(resAllocations.status === 200 && dataAllocations.success === true, 'Phase 2: Class-wise subject allocations fetched successfully');
  test(Array.isArray(dataAllocations.allocations), 'Phase 2: Allocations array returned');

  // 2.5 Restrictions check
  const resSubPost = await fetch(`${BASE_URL}/head-teacher/subjects`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${htToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ subjectName: 'Forbidden' })
  });
  test(resSubPost.status === 404 || resSubPost.status === 405, 'Phase 2: POST operation rejected on subjects route (Read-only restriction)');

  // ==========================================
  // PHASE 3 TESTS: TEACHER OVERVIEW
  // ==========================================
  console.log('\n--- PHASE 3: TEACHER OVERVIEW (SECTION 7) ---');

  // 3.1 List teachers
  const resTeachers = await fetch(`${BASE_URL}/head-teacher/teachers`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataTeachers = await resTeachers.json();
  test(resTeachers.status === 200 && dataTeachers.success === true, 'Phase 3: Teacher listing returned successfully');
  test(Array.isArray(dataTeachers.teachers) && dataTeachers.teachers.length > 0, 'Phase 3: Teachers array populated');

  const firstTeacher = dataTeachers.teachers[0];
  test(firstTeacher.userId && firstTeacher.teacherName && firstTeacher.email, 'Phase 3: Teacher item contains userId, name, and email');
  test(!firstTeacher.passwordHash, 'Phase 3: passwordHash is NEVER exposed in listing');
  test(Array.isArray(firstTeacher.assignedClasses), 'Phase 3: Assigned classes array included');
  test(Array.isArray(firstTeacher.assignedSubjects), 'Phase 3: Assigned subjects array included');

  // 3.2 Teacher Profile Details
  const resTeacherProfile = await fetch(`${BASE_URL}/head-teacher/teachers/${firstTeacher.userId}`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataTeacherProfile = await resTeacherProfile.json();
  test(resTeacherProfile.status === 200 && dataTeacherProfile.success === true, 'Phase 3: Teacher profile fetched successfully');
  test(dataTeacherProfile.personalInfo.teacherName === firstTeacher.teacherName, 'Phase 3: Personal info matches teacher');
  test(dataTeacherProfile.accountInfo.userId === firstTeacher.userId, 'Phase 3: Account info matches teacher');
  test(!dataTeacherProfile.accountInfo.passwordHash, 'Phase 3: passwordHash is NEVER exposed in profile');
  test(dataTeacherProfile.academicResponsibilities !== undefined, 'Phase 3: Academic responsibilities included in profile');

  // 3.3 Restrictions check
  const resTeacherPost = await fetch(`${BASE_URL}/head-teacher/teachers`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${htToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ teacherName: 'Forbidden' })
  });
  test(resTeacherPost.status === 404 || resTeacherPost.status === 405, 'Phase 3: POST operation rejected on teachers route (Read-only restriction)');

  // ==========================================
  // PHASE 4 TESTS: TEACHER ASSIGNMENTS
  // ==========================================
  console.log('\n--- PHASE 4: TEACHER ASSIGNMENTS (SECTION 8) ---');

  // 4.1 List teacher assignments
  const resAssignments = await fetch(`${BASE_URL}/head-teacher/teacher-assignments`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataAssignments = await resAssignments.json();
  test(resAssignments.status === 200 && dataAssignments.success === true, 'Phase 4: Teacher assignments listing returned successfully');
  test(Array.isArray(dataAssignments.assignments), 'Phase 4: Assignments array returned');
  test(dataAssignments.summary !== undefined, 'Phase 4: Assignment summary metrics included');

  const summary = dataAssignments.summary;
  test(typeof summary.totalActiveAssignments === 'number', 'Phase 4: Summary contains totalActiveAssignments');
  test(typeof summary.totalAssignedTeachers === 'number', 'Phase 4: Summary contains totalAssignedTeachers');
  test(typeof summary.subjectsWithAssignedTeachers === 'number', 'Phase 4: Summary contains subjectsWithAssignedTeachers');
  test(typeof summary.subjectsWithoutAssignedTeachers === 'number', 'Phase 4: Summary contains subjectsWithoutAssignedTeachers');
  test(typeof summary.classesWithIncompleteAssignments === 'number', 'Phase 4: Summary contains classesWithIncompleteAssignments');
  test(typeof summary.sectionsWithoutSectionTeachers === 'number', 'Phase 4: Summary contains sectionsWithoutSectionTeachers');

  if (dataAssignments.assignments.length > 0) {
    const firstAssign = dataAssignments.assignments[0];
    test(firstAssign.teacherName && firstAssign.className && firstAssign.subjectName, 'Phase 4: Assignment item contains teacher, class, and subject');

    // 4.2 Assignment Details
    const resAssignDetails = await fetch(`${BASE_URL}/head-teacher/teacher-assignments/${firstAssign._id}`, {
      headers: { 'Authorization': `Bearer ${htToken}` }
    });
    const dataAssignDetails = await resAssignDetails.json();
    test(resAssignDetails.status === 200 && dataAssignDetails.success === true, 'Phase 4: Assignment details fetched successfully');
    test(dataAssignDetails.teacherName === firstAssign.teacherName, 'Phase 4: Details match teacher name');
    test(dataAssignDetails.className === firstAssign.className, 'Phase 4: Details match class name');
    test(dataAssignDetails.subjectName === firstAssign.subjectName, 'Phase 4: Details match subject name');
  }

  // 4.3 Restrictions check
  const resAssignPost = await fetch(`${BASE_URL}/head-teacher/teacher-assignments`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${htToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignment: 'Forbidden' })
  });
  test(resAssignPost.status === 404 || resAssignPost.status === 405, 'Phase 4: POST operation rejected on assignments route (Read-only restriction)');

  // ==========================================
  // CROSS-CUTTING SECURITY & AUTHORIZATION TESTS
  // ==========================================
  console.log('\n--- CROSS-CUTTING SECURITY & ROLE-BASED ACCESS CONTROL ---');

  const endpoints = [
    '/head-teacher/classes',
    '/head-teacher/subjects',
    '/head-teacher/teachers',
    '/head-teacher/teacher-assignments'
  ];

  for (const ep of endpoints) {
    // Unauthenticated
    const unauth = await fetch(`${BASE_URL}${ep}`);
    test(unauth.status === 401, `Access control: ${ep} rejects unauthenticated requests (HTTP 401)`);

    // Unauthorized role TEACHER
    const teacherDenied = await fetch(`${BASE_URL}${ep}`, {
      headers: { 'Authorization': `Bearer ${teacherToken}` }
    });
    test(teacherDenied.status === 403, `Access control: ${ep} rejects TEACHER role (HTTP 403)`);

    // Authorized role ADMIN
    const adminAllowed = await fetch(`${BASE_URL}${ep}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    test(adminAllowed.status === 200, `Access control: ${ep} permits ADMIN oversight role (HTTP 200)`);
  }

  console.log('\n========================================================================');
  console.log(`  ALL ${passed}/${total} MODULE 1 INTEGRATION TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runMasterTest().catch(err => {
  console.error('\nMaster Test Suite Failed:', err.message);
  process.exit(1);
});
