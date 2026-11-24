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

const BASE_URL = 'http://localhost:8000/api';

async function runTests() {
  console.log('========================================================================');
  console.log('  DMMS HEAD TEACHER PANEL — DASHBOARD VERIFICATION SUITE');
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

  // Fetch users for school KBPS_001
  const school = await SchoolInfo.findOne({ schoolId: 'KBPS_001' });
  assert(school, 'School KBPS_001 must exist in DB');

  const headTeacherUser = await UserInfo.findOne({ schoolId: 'KBPS_001', roleCode: 'HEAD_TEACHER' }).populate('roleRef');
  const teacherUser = await UserInfo.findOne({ schoolId: 'KBPS_001', roleCode: 'TEACHER' }).populate('roleRef');
  const adminUser = await UserInfo.findOne({ schoolId: 'KBPS_001', roleCode: 'ADMIN' }).populate('roleRef');
  const staffUser = await UserInfo.findOne({ schoolId: 'KBPS_001', roleCode: 'OFFICE_STAFF' }).populate('roleRef');

  const htEmployee = await EmployeeInfo.findById(headTeacherUser.employeeRef);
  const teacherEmployee = await EmployeeInfo.findById(teacherUser.employeeRef);
  const adminEmployee = await EmployeeInfo.findById(adminUser.employeeRef);
  const staffEmployee = await EmployeeInfo.findById(staffUser.employeeRef);

  const htToken = AuthService.generateUserToken(headTeacherUser, school, htEmployee);
  const teacherToken = AuthService.generateUserToken(teacherUser, school, teacherEmployee);
  const adminToken = AuthService.generateUserToken(adminUser, school, adminEmployee);
  const staffToken = AuthService.generateUserToken(staffUser, school, staffEmployee);

  console.log('--- TEST GROUP 1: SECURITY & ROLE AUTHORIZATION ---');
  // 1.1 Unauthenticated request must return 401
  const resNoAuth = await fetch(`${BASE_URL}/head-teacher/dashboard`);
  test(resNoAuth.status === 401, 'Unauthenticated request rejected with HTTP 401');

  // 1.2 Teacher token must be rejected with 403
  const resTeacher = await fetch(`${BASE_URL}/head-teacher/dashboard`, {
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  });
  test(resTeacher.status === 403, 'TEACHER role blocked from Head Teacher dashboard (HTTP 403)');

  // 1.3 Office Staff token must be rejected with 403
  const resStaff = await fetch(`${BASE_URL}/head-teacher/dashboard`, {
    headers: { 'Authorization': `Bearer ${staffToken}` }
  });
  test(resStaff.status === 403, 'OFFICE_STAFF role blocked from Head Teacher dashboard (HTTP 403)');

  // 1.4 Head Teacher token must be accepted with 200
  const resHT = await fetch(`${BASE_URL}/head-teacher/dashboard`, {
    headers: { 'Authorization': `Bearer ${htToken}` }
  });
  const dataHT = await resHT.json();
  test(resHT.status === 200 && dataHT.success === true, 'HEAD_TEACHER token authorized with HTTP 200');

  // 1.5 Admin token must be accepted with 200 (administrative oversight)
  const resAdmin = await fetch(`${BASE_URL}/head-teacher/dashboard`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  test(resAdmin.status === 200, 'ADMIN role allowed read-only oversight access (HTTP 200)');

  // 1.6 Verify read-only enforcement: POST /head-teacher/dashboard must fail (no write APIs)
  const resPost = await fetch(`${BASE_URL}/head-teacher/dashboard`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${htToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: 'invalid' })
  });
  test(resPost.status === 404 || resPost.status === 405, 'Read-only integrity: POST method not allowed on dashboard route');

  console.log('\n--- TEST GROUP 2: ACCURACY OF DATABASE STATISTICS (SECTION 3.1) ---');
  // Fetch ground truth directly from MongoDB
  const academicYears = await AcademicYearInfo.find({ schoolId: 'KBPS_001' }).sort({ isCurrent: -1, startDate: -1 });
  const currentYear = academicYears.find(y => y.isCurrent) || academicYears[0];
  const upcomingYear = academicYears.find(y => !y.isCurrent);

  const dbActiveStudents = await StudentEnrollmentInfo.countDocuments({
    schoolId: 'KBPS_001',
    academicYearRef: currentYear._id,
    status: 'ACTIVE'
  });

  const dbTeachers = await UserInfo.countDocuments({
    schoolId: 'KBPS_001',
    roleCode: 'TEACHER',
    status: 'ACTIVE'
  });

  const dbClasses = await ClassInfo.countDocuments({
    schoolId: 'KBPS_001',
    status: 'ACTIVE'
  });

  const dbSections = await SectionInfo.countDocuments({
    schoolId: 'KBPS_001',
    status: 'ACTIVE'
  });

  const dbSubjects = await SubjectInfo.countDocuments({
    schoolId: 'KBPS_001',
    status: 'ACTIVE'
  });

  const dbAssignments = await SubjectTeacherAssignmentInfo.countDocuments({
    schoolId: 'KBPS_001',
    academicYearRef: currentYear._id,
    status: 'ACTIVE'
  });

  test(dataHT.stats.totalStudents === dbActiveStudents, `Total Students accurately matches DB active enrollments (${dataHT.stats.totalStudents})`);
  test(dataHT.stats.totalTeachers === dbTeachers, `Total Teachers matches active TEACHER accounts excluding ADMIN / HEAD_TEACHER (${dataHT.stats.totalTeachers})`);
  test(dataHT.stats.totalClasses === dbClasses, `Total Classes matches active classes (${dataHT.stats.totalClasses})`);
  test(dataHT.stats.totalSections === dbSections, `Total Sections matches active sections (${dataHT.stats.totalSections})`);
  test(dataHT.stats.totalSubjects === dbSubjects, `Total Subjects matches active subjects (${dataHT.stats.totalSubjects})`);
  test(dataHT.stats.totalActiveTeacherAssignments === dbAssignments, `Total Active Teacher Assignments matches session assignments (${dataHT.stats.totalActiveTeacherAssignments})`);

  console.log('\n--- TEST GROUP 3: ACADEMIC OVERVIEW & GAP ANALYSIS (SECTION 3.2) ---');
  test(Array.isArray(dataHT.academicOverview.classStrength), 'Class-wise student strength list is provided');
  test(dataHT.academicOverview.classStrength.length === dbClasses, `Class strength list contains all ${dbClasses} active classes`);
  test(Array.isArray(dataHT.academicOverview.sectionStrength), 'Section-wise student strength list is provided');
  test(dataHT.academicOverview.sectionStrength.length === dbSections, `Section strength list contains all ${dbSections} active sections`);

  // Verify section capacity calculation
  const sampleSection = dataHT.academicOverview.sectionStrength[0];
  test(
    sampleSection && typeof sampleSection.availableCapacity === 'number' &&
    sampleSection.availableCapacity === Math.max(0, sampleSection.maxCapacity - sampleSection.studentCount),
    'Available capacity dynamically calculated as maxCapacity - studentCount'
  );

  // Subject distribution
  const subDist = dataHT.academicOverview.subjectDistribution;
  const dbAcademicSubs = await SubjectInfo.countDocuments({ schoolId: 'KBPS_001', subjectType: 'ACADEMIC', status: 'ACTIVE' });
  const dbCoCurrSubs = await SubjectInfo.countDocuments({ schoolId: 'KBPS_001', subjectType: 'CO_CURRICULAR', status: 'ACTIVE' });
  test(subDist.academic === dbAcademicSubs, `Academic subjects count matches DB (${subDist.academic})`);
  test(subDist.coCurricular === dbCoCurrSubs, `Co-curricular subjects count matches DB (${subDist.coCurricular})`);
  test(subDist.total === dbSubjects, `Total subjects distribution matches DB total (${subDist.total})`);

  // Assignment gaps
  const gaps = dataHT.academicOverview.assignmentGaps;
  test(typeof gaps.classesWithoutClassTeacherCount === 'number', 'Classes without class teachers calculated');
  test(typeof gaps.sectionsWithoutSectionTeacherCount === 'number', 'Sections without section teachers calculated');
  test(typeof gaps.subjectsWithoutAssignmentsCount === 'number', 'Subjects without assignments calculated');

  console.log('\n--- TEST GROUP 4: RECENT ACADEMIC ACTIVITY (SECTION 3.3) ---');
  const recent = dataHT.recentActivity;
  test(Array.isArray(recent.classes), 'Recent classes list provided');
  test(Array.isArray(recent.subjects), 'Recent subjects list provided');
  test(Array.isArray(recent.teacherAssignments), 'Recent teacher assignments list provided');
  test(Array.isArray(recent.recentAllocations), 'Recent class-subject allocations list provided');

  console.log('\n--- TEST GROUP 5: ACADEMIC YEAR FILTERING DYNAMICS (SECTION 3.4) ---');
  if (upcomingYear) {
    const resUpcoming = await fetch(`${BASE_URL}/head-teacher/dashboard?academicYearId=${upcomingYear._id}`, {
      headers: { 'Authorization': `Bearer ${htToken}` }
    });
    const dataUpcoming = await resUpcoming.json();

    const dbUpcomingStudents = await StudentEnrollmentInfo.countDocuments({
      schoolId: 'KBPS_001',
      academicYearRef: upcomingYear._id,
      status: 'ACTIVE'
    });

    test(dataUpcoming.success === true, 'API accepts academicYearId parameter');
    test(dataUpcoming.selectedAcademicYear._id === upcomingYear._id.toString(), `Correctly switches context to ${upcomingYear.yearCode}`);
    test(dataUpcoming.stats.totalStudents === dbUpcomingStudents, `Enrollments dynamically re-evaluated for ${upcomingYear.yearCode}: ${dataUpcoming.stats.totalStudents} students`);
    test(dataUpcoming.stats.totalActiveTeacherAssignments !== undefined, 'Teacher assignments re-evaluated for target session');
  } else {
    console.log('  [SKIP] Only one academic year found, skipping switch test.');
  }

  console.log('\n========================================================================');
  console.log(`  ALL ${passed}/${total} HEAD TEACHER DASHBOARD TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch(err => {
  console.error('\nTest Suite Failed:', err.message);
  process.exit(1);
});
