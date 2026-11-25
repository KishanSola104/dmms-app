require('dotenv').config();
const mongoose = require('mongoose');
const assert = require('assert');

// Register models
require('./src/models/roleInfo.model');
const AuthService = require('./src/services/auth.service');
const UserInfo = require('./src/models/userInfo.model');
const SchoolInfo = require('./src/models/schoolInfo.model');
const EmployeeInfo = require('./src/models/employeeInfo.model');
const AcademicYearInfo = require('./src/models/academicYearInfo.model');
const ExaminationInfo = require('./src/models/examinationInfo.model');
const HeadTeacherService = require('./src/services/headTeacher.service');

const BASE_URL = 'http://localhost:8000/api';

async function runModule4Tests() {
  console.log('========================================================================');
  console.log('  DMMS HEAD TEACHER PANEL — MODULE 4 EXAMINATION MANAGEMENT TEST SUITE');
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
  assert(school, 'School KBPS_001 must exist');

  const htUser = await UserInfo.findOne({ schoolId: 'KBPS_001', roleCode: 'HEAD_TEACHER', status: 'ACTIVE' }).populate('roleRef');
  const teacherUser = await UserInfo.findOne({ schoolId: 'KBPS_001', roleCode: 'TEACHER', status: 'ACTIVE' }).populate('roleRef');
  assert(htUser, 'Active HEAD_TEACHER user must exist for KBPS_001');

  const htEmp = await EmployeeInfo.findById(htUser.employeeRef);
  const htToken = AuthService.generateUserToken(htUser, school, htEmp);

  let teacherToken = null;
  if (teacherUser) {
    const tEmp = await EmployeeInfo.findById(teacherUser.employeeRef);
    teacherToken = AuthService.generateUserToken(teacherUser, school, tEmp);
  }

  const academicYears = await AcademicYearInfo.find({ schoolId: 'KBPS_001' }).sort({ isCurrent: -1, startDate: -1 });
  const activeYear = academicYears.find(y => y.isCurrent) || academicYears[0];
  assert(activeYear, 'Active academic year must exist');

  // ------------------------------------------------------------------------
  // 1. SERVICE LAYER TESTS
  // ------------------------------------------------------------------------
  console.log('--- 1. SERVICE LAYER VERIFICATION ---');

  const overview = await HeadTeacherService.listExaminations({
    schoolId: 'KBPS_001',
    academicYearId: activeYear._id.toString()
  });
  test(overview.summary && typeof overview.summary.totalExaminations === 'number', 'Overview returns summary cards');
  test(
    overview.summary.totalExaminations >=
      overview.summary.upcomingExaminations +
        overview.summary.ongoingExaminations +
        overview.summary.completedExaminations,
    'Summary card counts reconcile with total examinations'
  );
  test(Array.isArray(overview.examinations) && overview.examinations.length > 0, 'Overview returns actual examinations');

  const firstExam = overview.examinations[0];
  const examDetails = await HeadTeacherService.getExaminationDetails({
    schoolId: 'KBPS_001',
    examinationId: firstExam._id.toString()
  });
  test(examDetails.examination.examinationCode === firstExam.examinationCode, 'Exam details returns matching examination');
  test(Array.isArray(examDetails.configuredSubjects), 'Exam details includes configuredSubjects');
  test(Array.isArray(examDetails.schedule), 'Exam details includes schedule');
  test(examDetails.marksEntryProgress && typeof examDetails.marksEntryProgress.overallProgressPercentage === 'number', 'Exam details includes marksEntryProgress');

  // Cross-school isolation check
  let crossSchoolRejected = false;
  try {
    await HeadTeacherService.getExaminationDetails({
      schoolId: 'OTHER_SCHOOL_999',
      examinationId: firstExam._id.toString()
    });
  } catch (err) {
    crossSchoolRejected = err.statusCode === 404;
  }
  test(crossSchoolRejected, 'Cross-school getExaminationDetails rejected with 404');

  // Schedule
  const scheduleRes = await HeadTeacherService.getExaminationSchedule({
    schoolId: 'KBPS_001',
    academicYearId: activeYear._id.toString()
  });
  test(Array.isArray(scheduleRes.schedule) && scheduleRes.schedule.length > 0, 'Schedule returns configured exam-subject entries');
  test(Array.isArray(scheduleRes.conflicts), 'Schedule returns conflicts array');
  test(Array.isArray(scheduleRes.sameDateExaminations), 'Schedule returns sameDateExaminations array');

  // Subject Configurations
  const subjConfigRes = await HeadTeacherService.getSubjectConfigurations({
    schoolId: 'KBPS_001',
    academicYearId: activeYear._id.toString()
  });
  test(Array.isArray(subjConfigRes.configurations) && subjConfigRes.configurations.length > 0, 'Subject configurations returns rows');
  test(typeof subjConfigRes.summary.configuredCount === 'number', 'Subject config summary includes configuredCount');
  test(typeof subjConfigRes.summary.unconfiguredCount === 'number', 'Subject config summary includes unconfiguredCount');

  // Marks Entry Monitoring
  const marksRes = await HeadTeacherService.getMarksEntryMonitoring({
    schoolId: 'KBPS_001',
    academicYearId: activeYear._id.toString()
  });
  test(Array.isArray(marksRes.entries) && marksRes.entries.length > 0, 'Marks monitoring returns class-section-subject rows');
  const m0 = marksRes.entries[0];
  test(
    typeof m0.totalStudents === 'number' &&
      typeof m0.marksEntered === 'number' &&
      typeof m0.pending === 'number' &&
      typeof m0.progressPercentage === 'number',
    'Marks monitoring row computes numeric progress safely'
  );
  test(m0.pending === Math.max(0, m0.totalStudents - m0.marksEntered), 'Pending count matches totalStudents - marksEntered');

  const marksDetailRes = await HeadTeacherService.getMarksEntryMonitoringDetails({
    schoolId: 'KBPS_001',
    examinationId: m0.examinationId.toString(),
    classId: m0.classId.toString(),
    sectionId: m0.sectionId ? m0.sectionId.toString() : undefined,
    subjectId: m0.subjectId.toString()
  });
  test(Array.isArray(marksDetailRes.pendingStudents), 'Marks monitoring details returns pendingStudents list');

  // ------------------------------------------------------------------------
  // 2. HTTP API TESTS (via running server on :8000)
  // ------------------------------------------------------------------------
  console.log('\n--- 2. HTTP ENDPOINT & AUTH VERIFICATION ---');

  const endpoints = [
    `/head-teacher/examinations?academicYearId=${activeYear._id}`,
    `/head-teacher/examinations/${firstExam._id}`,
    `/head-teacher/examination-schedule?academicYearId=${activeYear._id}`,
    `/head-teacher/subject-configurations?academicYearId=${activeYear._id}`,
    `/head-teacher/marks-entry-monitoring?academicYearId=${activeYear._id}`,
    `/head-teacher/marks-entry-monitoring/details?examinationId=${m0.examinationId}&classId=${m0.classId}&subjectId=${m0.subjectId}${m0.sectionId ? `&sectionId=${m0.sectionId}` : ''}`
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}${ep}`, {
      headers: { Authorization: `Bearer ${htToken}` }
    });
    const json = await res.json();
    test(res.status === 200 && json.success === true, `HTTP GET ${ep.split('?')[0]} returns 200 success`);
  }

  // Unauthorized check (no token)
  const unauthRes = await fetch(`${BASE_URL}/head-teacher/examinations`);
  test(unauthRes.status === 401, 'Unauthenticated request to /head-teacher/examinations returns 401');

  // Forbidden role check (TEACHER token)
  if (teacherToken) {
    const forbiddenRes = await fetch(`${BASE_URL}/head-teacher/examinations`, {
      headers: { Authorization: `Bearer ${teacherToken}` }
    });
    test(forbiddenRes.status === 403, 'TEACHER role request to /head-teacher/examinations returns 403');
  }

  // Write operation rejection (read-only guarantee)
  const postRes = await fetch(`${BASE_URL}/head-teacher/examinations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${htToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ examinationName: 'Forbidden' })
  });
  test(postRes.status === 404 || postRes.status === 405, 'POST /head-teacher/examinations rejected (read-only)');

  // ------------------------------------------------------------------------
  // 3. FILTER & EDGE-CASE VERIFICATION
  // ------------------------------------------------------------------------
  console.log('\n--- 3. FILTER & EDGE-CASE VERIFICATION ---');

  // Filter by status=COMPLETED (none in DB currently -> empty state)
  const completedRes = await HeadTeacherService.listExaminations({
    schoolId: 'KBPS_001',
    academicYearId: activeYear._id.toString(),
    status: 'COMPLETED'
  });
  test(Array.isArray(completedRes.examinations) && completedRes.examinations.length === 0, 'Status filter COMPLETED returns empty array cleanly');

  // Filter by academicYearId='ALL'
  const allYearsRes = await HeadTeacherService.listExaminations({
    schoolId: 'KBPS_001',
    academicYearId: 'ALL'
  });
  test(allYearsRes.examinations.length >= overview.examinations.length, 'AcademicYear=ALL returns examinations across sessions');

  // Invalid/cross-school academicYearId returns empty cleanly
  const badYearRes = await HeadTeacherService.listExaminations({
    schoolId: 'KBPS_001',
    academicYearId: new mongoose.Types.ObjectId().toString()
  });
  test(badYearRes.examinations.length === 0 && badYearRes.summary.totalExaminations === 0, 'Non-matching academicYearId returns empty safely');

  // Schedule date range filter (outside range returns empty, inside range returns entries)
  const outOfRangeSched = await HeadTeacherService.getExaminationSchedule({
    schoolId: 'KBPS_001',
    academicYearId: activeYear._id.toString(),
    dateFrom: '2099-01-01',
    dateTo: '2099-01-31'
  });
  test(outOfRangeSched.schedule.length === 0, 'Schedule date range outside exam window returns empty');

  const inRangeSched = await HeadTeacherService.getExaminationSchedule({
    schoolId: 'KBPS_001',
    academicYearId: activeYear._id.toString(),
    dateFrom: '2026-11-20',
    dateTo: '2026-12-10'
  });
  test(inRangeSched.schedule.length > 0, 'Schedule date range overlapping exam window returns entries');

  // Subject configurations filter by configStatus
  const cfgOnly = await HeadTeacherService.getSubjectConfigurations({
    schoolId: 'KBPS_001',
    academicYearId: activeYear._id.toString(),
    configStatus: 'CONFIGURED'
  });
  test(cfgOnly.configurations.every(c => c.isConfigured === true), 'Subject config filter CONFIGURED returns only configured subjects');

  // Marks monitoring filter by UNASSIGNED teacher & submissionStatus=PENDING
  const pendingMarks = await HeadTeacherService.getMarksEntryMonitoring({
    schoolId: 'KBPS_001',
    academicYearId: activeYear._id.toString(),
    submissionStatus: 'PENDING'
  });
  test(pendingMarks.entries.every(e => e.submissionStatus === 'PENDING'), 'Marks monitoring filter PENDING returns pending entries');

  console.log(`\n========================================================================`);
  console.log(`  ALL ${passed}/${total} MODULE 4 TESTS PASSED SUCCESSFULLY!`);
  console.log(`========================================================================`);
  await mongoose.disconnect();
}

runModule4Tests().catch(async (err) => {
  console.error('TEST SUITE ERROR:', err);
  await mongoose.disconnect();
  process.exit(1);
});
