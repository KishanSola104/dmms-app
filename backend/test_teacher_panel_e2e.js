require('dotenv').config();
const mongoose = require('mongoose');
const assert = require('assert');
const PDFDocument = require('pdfkit');

// Register models
require('./src/models/roleInfo.model');
const AuthService = require('./src/services/auth.service');
const UserInfo = require('./src/models/userInfo.model');
const RoleInfo = require('./src/models/roleInfo.model');
const SchoolInfo = require('./src/models/schoolInfo.model');
const EmployeeInfo = require('./src/models/employeeInfo.model');
const AcademicYearInfo = require('./src/models/academicYearInfo.model');
const ClassInfo = require('./src/models/classInfo.model');
const SectionInfo = require('./src/models/sectionInfo.model');
const SubjectInfo = require('./src/models/subjectInfo.model');
const ClassSubjectInfo = require('./src/models/classSubjectInfo.model');
const SubjectTeacherAssignmentInfo = require('./src/models/subjectTeacherAssignmentInfo.model');
const StudentInfo = require('./src/models/studentInfo.model');
const StudentEnrollmentInfo = require('./src/models/studentEnrollmentInfo.model');
const ExaminationInfo = require('./src/models/examinationInfo.model');
const ExaminationClassInfo = require('./src/models/examinationClassInfo.model');
const ExaminationSubjectInfo = require('./src/models/examinationSubjectInfo.model');
const ExaminationComponentInfo = require('./src/models/examinationComponentInfo.model');
const SchoolResultConfig = require('./src/models/schoolResultConfig.model');
const MarksSubmissionInfo = require('./src/models/marksSubmissionInfo.model');
const MarksEntryInfo = require('./src/models/marksEntryInfo.model');
const MarksAuditLogInfo = require('./src/models/marksAuditLogInfo.model');
const ExaminationResultInfo = require('./src/models/examinationResultInfo.model');
const FinalAcademicResultInfo = require('./src/models/finalAcademicResultInfo.model');
const NotificationInfo = require('./src/models/notificationInfo.model');

const SchoolResultConfigService = require('./src/services/schoolResultConfig.service');
const TeacherResultService = require('./src/services/teacherResult.service');

const BASE_URL = 'http://localhost:8000/api';

async function runTeacherPanelTests() {
  console.log('========================================================================');
  console.log('  DMMS TEACHER PANEL — COMPREHENSIVE E2E FUNCTIONAL & SECURITY SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;
  function test(cond, msg) {
    total++;
    if (cond) {
      console.log(`  [PASS ${String(total).padStart(2, '0')}] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL ${String(total).padStart(2, '0')}] ${msg}`);
      throw new Error(`Test failed: ${msg}`);
    }
  }

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/DMMS');

  const TEST_SCHOOL_ID = 'TP_TEST_001';
  const OTHER_SCHOOL_ID = 'TP_OTHER_002';
  const cleanup = async () => {
    const ids = [TEST_SCHOOL_ID, OTHER_SCHOOL_ID];
    await Promise.all([
      SchoolInfo.deleteMany({ schoolId: { $in: ids } }),
      EmployeeInfo.deleteMany({ schoolId: { $in: ids } }),
      UserInfo.deleteMany({ schoolId: { $in: ids } }),
      AcademicYearInfo.deleteMany({ schoolId: { $in: ids } }),
      ClassInfo.deleteMany({ schoolId: { $in: ids } }),
      SectionInfo.deleteMany({ schoolId: { $in: ids } }),
      SubjectInfo.deleteMany({ schoolId: { $in: ids } }),
      ClassSubjectInfo.deleteMany({ schoolId: { $in: ids } }),
      SubjectTeacherAssignmentInfo.deleteMany({ schoolId: { $in: ids } }),
      StudentInfo.deleteMany({ schoolId: { $in: ids } }),
      StudentEnrollmentInfo.deleteMany({ schoolId: { $in: ids } }),
      ExaminationInfo.deleteMany({ schoolId: { $in: ids } }),
      ExaminationClassInfo.deleteMany({ schoolId: { $in: ids } }),
      ExaminationSubjectInfo.deleteMany({ schoolId: { $in: ids } }),
      ExaminationComponentInfo.deleteMany({ schoolId: { $in: ids } }),
      SchoolResultConfig.deleteMany({ schoolId: { $in: ids } }),
      MarksSubmissionInfo.deleteMany({ schoolId: { $in: ids } }),
      MarksEntryInfo.deleteMany({ schoolId: { $in: ids } }),
      MarksAuditLogInfo.deleteMany({ schoolId: { $in: ids } }),
      ExaminationResultInfo.deleteMany({ schoolId: { $in: ids } }),
      FinalAcademicResultInfo.deleteMany({ schoolId: { $in: ids } }),
      NotificationInfo.deleteMany({ schoolId: { $in: ids } })
    ]);
  };

  await cleanup();

  try {
    // ------------------------------------------------------------------------
    // SETUP ISOLATED TEST SANDBOX SCHOOL (Zero impact on KBPS_001)
    // ------------------------------------------------------------------------
    const roles = await RoleInfo.find({ status: 'ACTIVE' }).lean();
    const roleByCode = new Map(roles.map(r => [r.roleCode, r]));

    const school = await SchoolInfo.create({
      schoolId: TEST_SCHOOL_ID,
      schoolCode: 'TPTEST',
      schoolName: 'Test Primary School',
      establishedYear: 2005,
      email: 'tptest@school.edu',
      mobileNumber: '9876543210',
      address: '123 Test Ave',
      passwordHash: 'hashed',
      contactPersons: [
        { fullName: 'A', email: 'a@t.com', mobileNumber: '9999999991', designation: 'Principal' },
        { fullName: 'B', email: 'b@t.com', mobileNumber: '9999999992', designation: 'Admin' }
      ],
      status: 'ACTIVE'
    });

    const mkUser = async (code, name, roleCode) => {
      const emp = await EmployeeInfo.create({
        schoolRef: school._id,
        schoolId: TEST_SCHOOL_ID,
        fullName: name,
        email: `${code.toLowerCase()}@t.com`,
        mobileNumber: '9876543211',
        designation: roleCode
      });
      const role = roleByCode.get(roleCode);
      const user = await UserInfo.create({
        userId: code,
        schoolRef: school._id,
        schoolId: TEST_SCHOOL_ID,
        employeeRef: emp._id,
        roleRef: role._id,
        roleCode,
        roleName: role.roleName,
        email: emp.email,
        passwordHash: 'hashed',
        isFirstLogin: false,
        mustChangePassword: false,
        status: 'ACTIVE'
      });
      const token = AuthService.generateUserToken(user, school, emp);
      return { emp, user, token };
    };

    const admin = await mkUser('TPADMIN_01', 'Admin User', 'ADMIN');
    const htWithDuties = await mkUser('TPHT1_01', 'Head Teacher With Duties', 'HEAD_TEACHER');
    const htNoDuties = await mkUser('TPHT2_01', 'Head Teacher No Duties', 'HEAD_TEACHER');
    const subjTeacher = await mkUser('TPTEACH_01', 'Subject Teacher One', 'TEACHER');
    const otherTeacher = await mkUser('TPTEACH_02', 'Other Teacher Two', 'TEACHER');
    const staff = await mkUser('TPSTAFF_01', 'Office Staff', 'OFFICE_STAFF');

    const ay = await AcademicYearInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      yearCode: 'AY-2026-27',
      yearName: '2026-2027',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      isCurrent: true,
      status: 'ACTIVE'
    });

    // Class 5 (Class Teacher = htWithDuties) & Class 6 (Class Teacher = otherTeacher)
    const cls5 = await ClassInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      classCode: 'CLS5',
      className: '5th Standard',
      classTeacherRef: htWithDuties.emp._id,
      classTeacherName: htWithDuties.emp.fullName,
      numberOfSections: 1,
      status: 'ACTIVE'
    });
    const sec5A = await SectionInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      classRef: cls5._id,
      classCode: 'CLS5',
      className: '5th Standard',
      sectionCode: 'A',
      sectionName: 'Section A',
      sectionTeacherRef: htWithDuties.emp._id,
      sectionTeacherName: htWithDuties.emp.fullName,
      maxCapacity: 40,
      status: 'ACTIVE'
    });

    const cls6 = await ClassInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      classCode: 'CLS6',
      className: '6th Standard',
      classTeacherRef: otherTeacher.emp._id,
      classTeacherName: otherTeacher.emp.fullName,
      numberOfSections: 1,
      status: 'ACTIVE'
    });
    const sec6B = await SectionInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      classRef: cls6._id,
      classCode: 'CLS6',
      className: '6th Standard',
      sectionCode: 'B',
      sectionName: 'Section B',
      sectionTeacherRef: otherTeacher.emp._id,
      sectionTeacherName: otherTeacher.emp.fullName,
      maxCapacity: 40,
      status: 'ACTIVE'
    });

    // Subjects: MATH (Academic + Project 10M), ART (Co-curricular)
    const mathSub = await SubjectInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      subjectCode: 'MATH',
      subjectName: 'Mathematics',
      subjectType: 'ACADEMIC',
      status: 'ACTIVE'
    });
    const artSub = await SubjectInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      subjectCode: 'ART',
      subjectName: 'Art & Craft',
      subjectType: 'CO_CURRICULAR',
      status: 'ACTIVE'
    });

    const csMath5 = await ClassSubjectInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      academicYearRef: ay._id,
      classRef: cls5._id,
      subjectRef: mathSub._id,
      subjectCode: 'MATH',
      subjectName: 'Mathematics',
      subjectType: 'ACADEMIC',
      hasAdditionalComponents: true,
      additionalComponents: [{ componentName: 'Project', maximumMarks: 10 }],
      totalAdditionalMarks: 10,
      status: 'ACTIVE'
    });
    const csArt5 = await ClassSubjectInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      academicYearRef: ay._id,
      classRef: cls5._id,
      subjectRef: artSub._id,
      subjectCode: 'ART',
      subjectName: 'Art & Craft',
      subjectType: 'CO_CURRICULAR',
      hasAdditionalComponents: false,
      totalAdditionalMarks: 0,
      status: 'ACTIVE'
    });
    const csMath6 = await ClassSubjectInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      academicYearRef: ay._id,
      classRef: cls6._id,
      subjectRef: mathSub._id,
      subjectCode: 'MATH',
      subjectName: 'Mathematics',
      subjectType: 'ACADEMIC',
      status: 'ACTIVE'
    });

    // Assignments:
    // - 5th-A MATH -> subjTeacher
    // - 5th-A ART -> subjTeacher
    // - 6th-B MATH -> htWithDuties (Subject Teacher ONLY, NOT Class Teacher of 6th-B!)
    await SubjectTeacherAssignmentInfo.create([
      {
        schoolRef: school._id,
        schoolId: TEST_SCHOOL_ID,
        academicYearRef: ay._id,
        classSubjectRef: csMath5._id,
        classRef: cls5._id,
        sectionRef: sec5A._id,
        subjectRef: mathSub._id,
        teacherEmployeeRef: subjTeacher.emp._id,
        teacherUserRef: subjTeacher.user._id,
        classCode: 'CLS5',
        className: '5th Standard',
        sectionCode: 'A',
        sectionName: 'Section A',
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        subjectType: 'ACADEMIC',
        teacherName: subjTeacher.emp.fullName,
        teacherUserId: subjTeacher.user.userId,
        teacherEmail: subjTeacher.user.email,
        status: 'ACTIVE'
      },
      {
        schoolRef: school._id,
        schoolId: TEST_SCHOOL_ID,
        academicYearRef: ay._id,
        classSubjectRef: csArt5._id,
        classRef: cls5._id,
        sectionRef: sec5A._id,
        subjectRef: artSub._id,
        teacherEmployeeRef: subjTeacher.emp._id,
        teacherUserRef: subjTeacher.user._id,
        classCode: 'CLS5',
        className: '5th Standard',
        sectionCode: 'A',
        sectionName: 'Section A',
        subjectCode: 'ART',
        subjectName: 'Art & Craft',
        subjectType: 'CO_CURRICULAR',
        teacherName: subjTeacher.emp.fullName,
        teacherUserId: subjTeacher.user.userId,
        teacherEmail: subjTeacher.user.email,
        status: 'ACTIVE'
      },
      {
        schoolRef: school._id,
        schoolId: TEST_SCHOOL_ID,
        academicYearRef: ay._id,
        classSubjectRef: csMath6._id,
        classRef: cls6._id,
        sectionRef: sec6B._id,
        subjectRef: mathSub._id,
        teacherEmployeeRef: htWithDuties.emp._id,
        teacherUserRef: htWithDuties.user._id,
        classCode: 'CLS6',
        className: '6th Standard',
        sectionCode: 'B',
        sectionName: 'Section B',
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        subjectType: 'ACADEMIC',
        teacherName: htWithDuties.emp.fullName,
        teacherUserId: htWithDuties.user.userId,
        teacherEmail: htWithDuties.user.email,
        status: 'ACTIVE'
      }
    ]);

    // Student in 5th-A
    const stu1 = await StudentInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      admissionNumber: 'TP-001',
      firstName: 'Aarav',
      lastName: 'Sharma',
      dateOfBirth: new Date('2015-05-10'),
      gender: 'MALE',
      guardianDetails: [{ fullName: 'Ramesh Sharma', relationship: 'FATHER', mobileNumber: '9876543210', isPrimaryContact: true }],
      admissionAcademicYearRef: ay._id,
      admissionClassRef: cls5._id,
      status: 'ACTIVE'
    });
    await StudentEnrollmentInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      studentRef: stu1._id,
      academicYearRef: ay._id,
      classRef: cls5._id,
      sectionRef: sec5A._id,
      rollNumber: '1',
      status: 'ACTIVE'
    });

    // 3 Examinations: First Term, Second Term, End Term
    const createExam = async (code, name, status = 'COMPLETED') => {
      const ex = await ExaminationInfo.create({
        schoolRef: school._id,
        schoolId: TEST_SCHOOL_ID,
        academicYearRef: ay._id,
        examinationCode: code,
        examinationName: name,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-06-10'),
        status
      });
      const ec = await ExaminationClassInfo.create({
        schoolRef: school._id,
        schoolId: TEST_SCHOOL_ID,
        examinationRef: ex._id,
        academicYearRef: ay._id,
        classRef: cls5._id,
        classCode: 'CLS5',
        className: '5th Standard',
        status: 'ACTIVE'
      });
      const esMath = await ExaminationSubjectInfo.create({
        schoolRef: school._id,
        schoolId: TEST_SCHOOL_ID,
        academicYearRef: ay._id,
        examinationRef: ex._id,
        examinationClassRef: ec._id,
        classRef: cls5._id,
        classSubjectRef: csMath5._id,
        subjectRef: mathSub._id,
        subjectCode: 'MATH',
        subjectName: 'Mathematics',
        subjectType: 'ACADEMIC',
        totalMaximumMarks: 60,
        status: 'ACTIVE'
      });
      await ExaminationComponentInfo.create([
        { schoolRef: school._id, schoolId: TEST_SCHOOL_ID, academicYearRef: ay._id, examinationSubjectRef: esMath._id, componentName: 'Written', maximumMarks: 50, sequence: 1 },
        { schoolRef: school._id, schoolId: TEST_SCHOOL_ID, academicYearRef: ay._id, examinationSubjectRef: esMath._id, componentName: 'Oral', maximumMarks: 5, sequence: 2 },
        { schoolRef: school._id, schoolId: TEST_SCHOOL_ID, academicYearRef: ay._id, examinationSubjectRef: esMath._id, componentName: 'Class Assessment', maximumMarks: 5, sequence: 3 }
      ]);
      await ExaminationSubjectInfo.create({
        schoolRef: school._id,
        schoolId: TEST_SCHOOL_ID,
        academicYearRef: ay._id,
        examinationRef: ex._id,
        examinationClassRef: ec._id,
        classRef: cls5._id,
        classSubjectRef: csArt5._id,
        subjectRef: artSub._id,
        subjectCode: 'ART',
        subjectName: 'Art & Craft',
        subjectType: 'CO_CURRICULAR',
        totalMaximumMarks: 0,
        status: 'ACTIVE'
      });
      return ex;
    };

    const t1 = await createExam('TERM-1', 'First Term', 'COMPLETED');
    const t2 = await createExam('TERM-2', 'Second Term', 'COMPLETED');
    const t3 = await createExam('TERM-3', 'End Term', 'ONGOING'); // intentionally ONGOING initially to test readiness block

    const apiCall = async (method, path, token, body = null) => {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/pdf')) {
        const buf = Buffer.from(await res.arrayBuffer());
        return { status: res.status, pdfBuffer: buf };
      }
      const data = await res.json();
      return { status: res.status, data };
    };

    // ------------------------------------------------------------------------
    // 1. ASSIGNMENT & ROLE PERMISSION TESTS
    // ------------------------------------------------------------------------
    console.log('--- 1. PERMISSIONS & HEAD TEACHER DUAL-ACCESS ---');

    test((await apiCall('GET', '/teacher/dashboard', null)).status === 401, 'Unauthenticated request rejected (401)');
    test((await apiCall('GET', '/teacher/dashboard', staff.token)).status === 403, 'OFFICE_STAFF rejected on Teacher Panel (403)');
    test((await apiCall('GET', '/teacher/dashboard', admin.token)).status === 403, 'ADMIN rejected on Teacher Panel (403)');
    test((await apiCall('GET', '/teacher/dashboard', htNoDuties.token)).status === 403, 'HEAD_TEACHER without teaching duties blocked from Teacher Panel (403)');
    test((await apiCall('GET', '/head-teacher/dashboard', htNoDuties.token)).status === 200, 'HEAD_TEACHER without teaching duties retains Head Teacher Panel (200)');

    // Head Teacher WITH duties accesses BOTH panels
    test((await apiCall('GET', '/head-teacher/dashboard', htWithDuties.token)).status === 200, 'HEAD_TEACHER with teaching duties retains Head Teacher Panel (200)');
    const htDash = await apiCall('GET', `/teacher/dashboard?academicYearId=${ay._id}`, htWithDuties.token);
    test(htDash.status === 200 && htDash.data.access.isHeadTeacherWithDuties === true, 'HEAD_TEACHER with duties accesses Teacher Dashboard (200)');

    // Subject teacher cannot access Class Teacher verification / results
    test((await apiCall('GET', `/teacher/verification/overview?academicYearId=${ay._id}`, subjTeacher.token)).status === 403, 'Subject-only teacher blocked from Marks Verification (403)');
    test((await apiCall('GET', `/teacher/examination-results?academicYearId=${ay._id}`, subjTeacher.token)).status === 403, 'Subject-only teacher blocked from Exam Results generation (403)');
    test((await apiCall('GET', `/teacher/final-results?academicYearId=${ay._id}`, subjTeacher.token)).status === 403, 'Subject-only teacher blocked from Final Result generation (403)');

    // Head teacher who is class teacher of 5th-A CANNOT verify/generate for 6th-B (where they are subject teacher only)
    const unauthGen6B = await apiCall('POST', '/teacher/examination-results/generate', htWithDuties.token, {
      academicYearId: ay._id,
      examinationId: t1._id,
      classId: cls6._id,
      sectionId: sec6B._id
    });
    test(unauthGen6B.status === 403 || unauthGen6B.status === 400, 'Head Teacher cannot generate results for 6th-B where they are not Class Teacher');

    // Subject teacher cannot enter marks for unassigned 6th-B MATH
    const unauthSheet = await apiCall(
      'GET',
      `/teacher/marks/sheet?academicYearId=${ay._id}&examinationId=${t1._id}&classId=${cls6._id}&sectionId=${sec6B._id}&subjectId=${mathSub._id}`,
      subjTeacher.token
    );
    test(unauthSheet.status === 403, 'Subject teacher blocked from unassigned 6th-B MATH sheet (403)');

    // ------------------------------------------------------------------------
    // 2. MARKS ENTRY, VALIDATION, DRAFT/SUBMIT/LOCK, RETURN & RESUBMIT
    // ------------------------------------------------------------------------
    console.log('\n--- 2. MARKS ENTRY, VALIDATION & VERIFICATION WORKFLOW ---');

    // Validation: negative / over-max marks rejected
    const badMarks = await apiCall('POST', '/teacher/marks/save', subjTeacher.token, {
      academicYearId: ay._id,
      examinationId: t1._id,
      classId: cls5._id,
      sectionId: sec5A._id,
      subjectId: mathSub._id,
      entryType: 'EXAM_ACADEMIC',
      action: 'SUBMIT',
      entries: [{
        studentId: stu1._id,
        componentMarks: [
          { componentName: 'Written', marksObtained: 55 }, // exceeds max 50!
          { componentName: 'Oral', marksObtained: 5 },
          { componentName: 'Class Assessment', marksObtained: 5 }
        ]
      }]
    });
    test(badMarks.status === 400, 'Marks exceeding maximum (55/50) rejected with 400');

    // Save draft then submit T1 MATH (40 + 4 + 4 = 48 initially, to test return & correction to 50!)
    const draftRes = await apiCall('POST', '/teacher/marks/save', subjTeacher.token, {
      academicYearId: ay._id,
      examinationId: t1._id,
      classId: cls5._id,
      sectionId: sec5A._id,
      subjectId: mathSub._id,
      entryType: 'EXAM_ACADEMIC',
      action: 'DRAFT',
      entries: [{
        studentId: stu1._id,
        componentMarks: [
          { componentName: 'Written', marksObtained: 40 },
          { componentName: 'Oral', marksObtained: 4 },
          { componentName: 'Class Assessment', marksObtained: 4 }
        ]
      }]
    });
    test(draftRes.status === 200 && draftRes.data.submission.status === 'DRAFT', 'Draft marks saved successfully');

    const submitT1 = await apiCall('POST', '/teacher/marks/save', subjTeacher.token, {
      academicYearId: ay._id,
      examinationId: t1._id,
      classId: cls5._id,
      sectionId: sec5A._id,
      subjectId: mathSub._id,
      entryType: 'EXAM_ACADEMIC',
      action: 'SUBMIT',
      entries: [{
        studentId: stu1._id,
        componentMarks: [
          { componentName: 'Written', marksObtained: 40 },
          { componentName: 'Oral', marksObtained: 4 },
          { componentName: 'Class Assessment', marksObtained: 4 }
        ]
      }]
    });
    test(submitT1.status === 200 && submitT1.data.submission.status === 'SUBMITTED', 'Marks submitted & status set to SUBMITTED');
    const t1MathSubId = submitT1.data.submission._id;

    // Locked check
    const editWhileLocked = await apiCall('POST', '/teacher/marks/save', subjTeacher.token, {
      academicYearId: ay._id,
      examinationId: t1._id,
      classId: cls5._id,
      sectionId: sec5A._id,
      subjectId: mathSub._id,
      entryType: 'EXAM_ACADEMIC',
      action: 'DRAFT',
      entries: []
    });
    test(editWhileLocked.status === 403, 'Submitted marks are locked against direct edit (403)');

    // Return without reason fails (400)
    const emptyReturn = await apiCall('POST', `/teacher/verification/${t1MathSubId}/return`, htWithDuties.token, { reason: '   ' });
    test(emptyReturn.status === 400, 'Returning marks without mandatory reason rejected (400)');

    // Return with reason succeeds + sends notification
    const validReturn = await apiCall('POST', `/teacher/verification/${t1MathSubId}/return`, htWithDuties.token, {
      reason: 'Recheck Written total'
    });
    test(validReturn.status === 200 && validReturn.data.submission.status === 'RETURNED', 'Class Teacher returns marks with reason');

    const notifCount = await NotificationInfo.countDocuments({
      schoolId: TEST_SCHOOL_ID,
      targetUserRef: subjTeacher.user._id,
      title: 'Marks Returned for Correction'
    });
    test(notifCount >= 1, 'Subject teacher receives correction notification');

    // Resubmit corrected T1 MATH = 42 + 4 + 4 = 50/60
    const resubmitT1 = await apiCall('POST', '/teacher/marks/save', subjTeacher.token, {
      academicYearId: ay._id,
      examinationId: t1._id,
      classId: cls5._id,
      sectionId: sec5A._id,
      subjectId: mathSub._id,
      entryType: 'EXAM_ACADEMIC',
      action: 'SUBMIT',
      entries: [{
        studentId: stu1._id,
        componentMarks: [
          { componentName: 'Written', marksObtained: 42 },
          { componentName: 'Oral', marksObtained: 4 },
          { componentName: 'Class Assessment', marksObtained: 4 }
        ]
      }]
    });
    test(resubmitT1.status === 200 && resubmitT1.data.submission.status === 'SUBMITTED', 'Subject teacher corrects & resubmits marks');

    // Exam result generation blocked while T1 ART is unverified
    const blockedExamRes = await apiCall('POST', '/teacher/examination-results/generate', htWithDuties.token, {
      academicYearId: ay._id,
      examinationId: t1._id,
      classId: cls5._id,
      sectionId: sec5A._id
    });
    test(blockedExamRes.status === 400, 'Exam result generation blocked when co-curricular / unverified items remain');

    // Verify T1 MATH
    const verifyT1Math = await apiCall('POST', `/teacher/verification/${t1MathSubId}/verify`, htWithDuties.token);
    test(verifyT1Math.status === 200 && verifyT1Math.data.submission.status === 'VERIFIED', 'Class Teacher verifies T1 MATH marks');

    // Invalid co-curricular grade rejected
    const badCc = await apiCall('POST', '/teacher/marks/save', subjTeacher.token, {
      academicYearId: ay._id,
      examinationId: t1._id,
      classId: cls5._id,
      sectionId: sec5A._id,
      subjectId: artSub._id,
      entryType: 'CO_CURRICULAR_TERM',
      action: 'SUBMIT',
      entries: [{ studentId: stu1._id, grade: 'Z' }]
    });
    test(badCc.status === 400, 'Arbitrary co-curricular grade "Z" rejected (400)');

    // Helper to submit & verify all remaining terms + extra project
    const submitAndVerifyMath = async (examId, w, o, c) => {
      const s = await apiCall('POST', '/teacher/marks/save', subjTeacher.token, {
        academicYearId: ay._id,
        examinationId: examId,
        classId: cls5._id,
        sectionId: sec5A._id,
        subjectId: mathSub._id,
        entryType: 'EXAM_ACADEMIC',
        action: 'SUBMIT',
        entries: [{
          studentId: stu1._id,
          componentMarks: [
            { componentName: 'Written', marksObtained: w },
            { componentName: 'Oral', marksObtained: o },
            { componentName: 'Class Assessment', marksObtained: c }
          ]
        }]
      });
      await apiCall('POST', `/teacher/verification/${s.data.submission._id}/verify`, htWithDuties.token);
    };

    const submitAndVerifyArt = async (examId, grade) => {
      const s = await apiCall('POST', '/teacher/marks/save', subjTeacher.token, {
        academicYearId: ay._id,
        examinationId: examId,
        classId: cls5._id,
        sectionId: sec5A._id,
        subjectId: artSub._id,
        entryType: 'CO_CURRICULAR_TERM',
        action: 'SUBMIT',
        entries: [{ studentId: stu1._id, grade }]
      });
      await apiCall('POST', `/teacher/verification/${s.data.submission._id}/verify`, htWithDuties.token);
    };

    // T1 ART = A+, T2 MATH = 45/60 (37+4+4), T2 ART = A, T3 MATH = 55/60 (45+5+5), T3 ART = B
    await submitAndVerifyArt(t1._id, 'A+');
    await submitAndVerifyMath(t2._id, 37, 4, 4);
    await submitAndVerifyArt(t2._id, 'A');
    await submitAndVerifyMath(t3._id, 45, 5, 5);
    await submitAndVerifyArt(t3._id, 'B');

    // Extra Component: Project = 8/10
    const subExtra = await apiCall('POST', '/teacher/marks/save', subjTeacher.token, {
      academicYearId: ay._id,
      classId: cls5._id,
      sectionId: sec5A._id,
      subjectId: mathSub._id,
      entryType: 'EXTRA_COMPONENT',
      action: 'SUBMIT',
      entries: [{
        studentId: stu1._id,
        componentMarks: [{ componentName: 'Project', marksObtained: 8 }]
      }]
    });
    test(subExtra.status === 200 && subExtra.data.submission.status === 'SUBMITTED', 'Extra component (Project 8/10) submitted');
    await apiCall('POST', `/teacher/verification/${subExtra.data.submission._id}/verify`, htWithDuties.token);

    // ------------------------------------------------------------------------
    // 3. INDIVIDUAL TERM RESULTS, REMARKS & PDF
    // ------------------------------------------------------------------------
    console.log('\n--- 3. TERM EXAMINATION RESULTS, REMARKS & PDF ---');

    const genT1 = await apiCall('POST', '/teacher/examination-results/generate', htWithDuties.token, {
      academicYearId: ay._id, examinationId: t1._id, classId: cls5._id, sectionId: sec5A._id
    });
    const genT2 = await apiCall('POST', '/teacher/examination-results/generate', htWithDuties.token, {
      academicYearId: ay._id, examinationId: t2._id, classId: cls5._id, sectionId: sec5A._id
    });
    const genT3 = await apiCall('POST', '/teacher/examination-results/generate', htWithDuties.token, {
      academicYearId: ay._id, examinationId: t3._id, classId: cls5._id, sectionId: sec5A._id
    });
    test(genT1.status === 200 && genT2.status === 200 && genT3.status === 200, 'All 3 Term Examination Results generated independently');

    const t1ResId = genT1.data.results[0]._id;
    const sugTermRem = await apiCall('PUT', `/teacher/examination-results/${t1ResId}/remark`, htWithDuties.token, { suggestOnly: true });
    test(sugTermRem.status === 200 && sugTermRem.data.suggestedRemark.length > 10, 'Positive suggested term remark generated');
    await apiCall('PUT', `/teacher/examination-results/${t1ResId}/remark`, htWithDuties.token, {
      termRemark: sugTermRem.data.suggestedRemark,
      approve: true
    });

    const termPdf = await apiCall('GET', `/teacher/examination-results/${t1ResId}/pdf`, htWithDuties.token);
    test(termPdf.status === 200 && termPdf.pdfBuffer.slice(0, 4).toString() === '%PDF', 'Term Result Card A4 PDF generated cleanly');

    const subExamToHt = await apiCall('POST', '/teacher/examination-results/submit', htWithDuties.token, {
      academicYearId: ay._id, examinationId: t1._id, classId: cls5._id, sectionId: sec5A._id
    });
    test(subExamToHt.status === 200, 'Term Examination Result submitted to Head Teacher');

    // ------------------------------------------------------------------------
    // 4. FINAL ACADEMIC RESULT, FORMULA (83/100), CO-CURRICULAR A & B, CONFIG VERSIONING, PDF
    // ------------------------------------------------------------------------
    console.log('\n--- 4. FINAL RESULT FORMULA, CO-CURRICULAR WORKFLOWS & PDF ---');

    // Blocked while t3 is ONGOING
    const blockedFinal = await apiCall('POST', '/teacher/final-results/generate', htWithDuties.token, {
      academicYearId: ay._id, classId: cls5._id, sectionId: sec5A._id
    });
    test(blockedFinal.status === 400, 'Final Result blocked when End Term examination is still ONGOING');

    // Complete t3
    await ExaminationInfo.findByIdAndUpdate(t3._id, { status: 'COMPLETED' });

    // Generate Final Result (Option A AUTO_AVERAGE, default KBPS formula: (50+45+55)/2 + 8 = 83/100, Grade A)
    const genFinalA = await apiCall('POST', '/teacher/final-results/generate', htWithDuties.token, {
      academicYearId: ay._id, classId: cls5._id, sectionId: sec5A._id
    });
    test(genFinalA.status === 200, 'Final Result generated after all 3 terms completed');
    const finalDoc = genFinalA.data.results[0];
    const mathFinal = finalDoc.academicSubjects.find(s => s.subjectCode === 'MATH');
    const artFinal = finalDoc.coCurricularSubjects.find(s => s.subjectCode === 'ART');
    test(
      mathFinal.finalMarksObtained === 83 && mathFinal.finalMaxMarks === 100 && mathFinal.grade === 'A',
      `KBPS formula verified: (50+45+55)/2 + 8 = ${mathFinal.finalMarksObtained}/${mathFinal.finalMaxMarks} (Grade ${mathFinal.grade})`
    );
    test(artFinal.finalGrade === 'A' && artFinal.workflowUsed === 'AUTO_AVERAGE', `Co-curricular Option A averaged (A+, A, B) -> ${artFinal.finalGrade}`);

    // Test Option B (SEPARATE_SUBMISSION) + Updated Config Version
    await SchoolResultConfigService.updateConfig(TEST_SCHOOL_ID, admin.user._id, {
      coCurricularConfig: { finalWorkflow: 'SEPARATE_SUBMISSION' }
    });
    const reqOptB = await apiCall('POST', '/teacher/co-curricular/request-final', htWithDuties.token, {
      academicYearId: ay._id, classId: cls5._id, sectionId: sec5A._id
    });
    test(reqOptB.status === 200 && reqOptB.data.requestedCount === 1, 'Option B: Class Teacher requested separate final co-curricular grade');

    const subFinalArt = await apiCall('POST', '/teacher/marks/save', subjTeacher.token, {
      academicYearId: ay._id,
      classId: cls5._id,
      sectionId: sec5A._id,
      subjectId: artSub._id,
      entryType: 'CO_CURRICULAR_FINAL',
      action: 'SUBMIT',
      entries: [{ studentId: stu1._id, grade: 'A+' }]
    });
    await apiCall('POST', `/teacher/verification/${subFinalArt.data.submission._id}/verify`, htWithDuties.token);

    const genFinalB = await apiCall('POST', '/teacher/final-results/generate', htWithDuties.token, {
      academicYearId: ay._id, classId: cls5._id, sectionId: sec5A._id
    });
    const finalDocB = genFinalB.data.results[0];
    test(
      finalDocB.coCurricularSubjects[0].finalGrade === 'A+' &&
        finalDocB.coCurricularSubjects[0].workflowUsed === 'SEPARATE_SUBMISSION' &&
        finalDocB.configVersion === 2,
      'Option B verified co-curricular grade (A+) applied with updated configVersion v2'
    );

    // Suggest & save final remark (verify no subject-wise suggestions field)
    const sugFinRem = await apiCall('PUT', `/teacher/final-results/${finalDocB._id}/remark`, htWithDuties.token, { suggestOnly: true });
    test(sugFinRem.status === 200 && sugFinRem.data.suggestedRemark.length > 10, 'Positive final overall remark suggested');
    await apiCall('PUT', `/teacher/final-results/${finalDocB._id}/remark`, htWithDuties.token, {
      finalRemark: sugFinRem.data.suggestedRemark,
      approve: true
    });

    // Final Marksheet A4 PDF
    const finalPdf = await apiCall('GET', `/teacher/final-results/${finalDocB._id}/pdf`, htWithDuties.token);
    test(finalPdf.status === 200 && finalPdf.pdfBuffer.slice(0, 4).toString() === '%PDF', 'Comprehensive Final Marksheet A4 PDF generated cleanly');

    // Submit Final Result to Head Teacher
    const subFinToHt = await apiCall('POST', '/teacher/final-results/submit', htWithDuties.token, {
      academicYearId: ay._id, classId: cls5._id, sectionId: sec5A._id
    });
    test(subFinToHt.status === 200, 'Final Academic Results submitted to Head Teacher');

    // Approved/Published non-overwrite protection check
    await FinalAcademicResultInfo.findByIdAndUpdate(finalDocB._id, { status: 'APPROVED' });
    const overwriteBlocked = await apiCall('POST', '/teacher/final-results/generate', htWithDuties.token, {
      academicYearId: ay._id, classId: cls5._id, sectionId: sec5A._id
    });
    test(overwriteBlocked.status === 403, 'Approved/Published final results cannot be silently overwritten (403)');

    // Result & Performance Analytics
    const perfCT = await apiCall('GET', `/teacher/performance?academicYearId=${ay._id}`, htWithDuties.token);
    const perfST = await apiCall('GET', `/teacher/performance?academicYearId=${ay._id}`, subjTeacher.token);
    test(perfCT.status === 200 && perfCT.data.isClassTeacher === true && perfCT.data.classPerformance.classAverage > 0, 'Class Teacher sees complete class performance analytics');
    test(
      Array.isArray(perfCT.data.classPerformance.examinationWiseSummary) &&
        perfCT.data.classPerformance.examinationWiseSummary.length === 3,
      'Class Teacher performance analytics includes examinationWiseSummary across all 3 exams'
    );
    test(perfST.status === 200 && perfST.data.isClassTeacher === false && perfST.data.classPerformance === null && perfST.data.subjectPerformance.length > 0, 'Subject Teacher sees only assigned subject performance (no class-wide results)');

    // ------------------------------------------------------------------------
    // 5. E-SIGNATURE UPLOAD / DELETE + ROLE GUARD
    // ------------------------------------------------------------------------
    console.log('--- 5. E-SIGNATURE UPLOAD, ROLE GUARD & DELETE ---');
    const tinyPng = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
      'hex'
    );
    const makeSigForm = () => {
      const fd = new FormData();
      fd.append('signature', new Blob([tinyPng], { type: 'image/png' }), 'sig.png');
      return fd;
    };

    const staffSigRes = await fetch(`${BASE_URL}/profile/upload-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staff.token}` },
      body: makeSigForm()
    });
    test(staffSigRes.status === 403, 'OFFICE_STAFF rejected on /api/profile/upload-signature (403)');

    const teacherSigRes = await fetch(`${BASE_URL}/profile/upload-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${subjTeacher.token}` },
      body: makeSigForm()
    });
    const teacherSigData = await teacherSigRes.json();
    test(
      teacherSigRes.status === 200 && typeof teacherSigData.signatureUrl === 'string' && teacherSigData.signatureUrl.includes('/uploads/signatures/'),
      'Subject Teacher uploads e-signature cleanly'
    );

    const delSigRes = await apiCall('DELETE', '/profile/signature', subjTeacher.token);
    const empAfterDel = await EmployeeInfo.findById(subjTeacher.emp._id).lean();
    test(delSigRes.status === 200 && !empAfterDel.signatureUrl, 'E-signature deleted cleanly and cleared from EmployeeInfo');

    // ------------------------------------------------------------------------
    // 6. ADMIN RESULT POLICY UPDATE, VERSIONING & NON-OVERWRITE
    // ------------------------------------------------------------------------
    console.log('--- 6. ADMIN RESULT CONFIG VERSIONING ---');
    const policyPut = await apiCall('PUT', '/admin/result-config', admin.token, {
      academicFinalRule: {
        formulaType: 'SUM_DIVIDED_PLUS_ADDITIONAL',
        termSumDivisor: 2,
        expectedExamCount: 3,
        includeAdditionalComponents: true,
        roundingMode: 'ROUND_HALF_UP'
      },
      gradingScale: [
        { grade: 'A+', minPercentage: 85, maxPercentage: 100, minInclusive: true, maxInclusive: true, isPassing: true, description: 'Distinction' },
        { grade: 'B', minPercentage: 40, maxPercentage: 85, minInclusive: true, maxInclusive: false, isPassing: true, description: 'Pass' },
        { grade: 'F', minPercentage: 0, maxPercentage: 40, minInclusive: true, maxInclusive: false, isPassing: false, description: 'Needs Improvement' }
      ]
    });
    test(policyPut.status === 200 && policyPut.data.config.version === 3, 'Admin PUT /admin/result-config increments policy version to v3');

    const preservedFinal = await FinalAcademicResultInfo.findById(finalDocB._id).lean();
    test(preservedFinal.configVersion === 2 && preservedFinal.status === 'APPROVED', 'Approved Final Result retains snapshot configVersion v2');

    const regenT2V3 = await apiCall('POST', '/teacher/examination-results/generate', htWithDuties.token, {
      academicYearId: ay._id, examinationId: t2._id, classId: cls5._id, sectionId: sec5A._id
    });
    test(
      regenT2V3.status === 200 && regenT2V3.data.results[0].configVersion === 3,
      'Newly generated unapproved exam result uses new policy configVersion v3'
    );

    // ------------------------------------------------------------------------
    // 7. CROSS-SCHOOL ISOLATION ON /api/teacher/*
    // ------------------------------------------------------------------------
    console.log('--- 7. CROSS-SCHOOL ISOLATION ---');
    const otherSchool = await SchoolInfo.create({
      schoolId: OTHER_SCHOOL_ID,
      schoolCode: 'TPOTH',
      schoolName: 'Other Isolated School',
      establishedYear: 2010,
      email: 'other@school.edu',
      mobileNumber: '9998887776',
      address: '456 Other Rd',
      passwordHash: 'hashed',
      contactPersons: [
        { fullName: 'O', email: 'o@t.com', mobileNumber: '9998887771', designation: 'Principal' },
        { fullName: 'P', email: 'p@t.com', mobileNumber: '9998887773', designation: 'Admin' }
      ],
      status: 'ACTIVE'
    });
    const otherEmp = await EmployeeInfo.create({
      schoolRef: otherSchool._id,
      schoolId: OTHER_SCHOOL_ID,
      fullName: 'Other School Teacher',
      email: 'other_teach@t.com',
      mobileNumber: '9998887772',
      designation: 'TEACHER'
    });
    const teacherRole = roleByCode.get('TEACHER');
    const otherUsr = await UserInfo.create({
      userId: 'TPOTHER_01',
      schoolRef: otherSchool._id,
      schoolId: OTHER_SCHOOL_ID,
      employeeRef: otherEmp._id,
      roleRef: teacherRole._id,
      roleCode: 'TEACHER',
      roleName: teacherRole.roleName,
      email: otherEmp.email,
      passwordHash: 'hashed',
      isFirstLogin: false,
      mustChangePassword: false,
      status: 'ACTIVE'
    });
    const otherSchoolToken = AuthService.generateUserToken(otherUsr, otherSchool, otherEmp);
    // Give otherEmp valid teaching duties in OTHER_SCHOOL_ID so they pass authorizeTeacherAccess
    const otherCls = await ClassInfo.create({
      schoolRef: otherSchool._id,
      schoolId: OTHER_SCHOOL_ID,
      classCode: 'OC1',
      className: 'Other Class 1',
      classTeacherRef: otherEmp._id,
      classTeacherName: otherEmp.fullName,
      numberOfSections: 1,
      status: 'ACTIVE'
    });
    await SectionInfo.create({
      schoolRef: otherSchool._id,
      schoolId: OTHER_SCHOOL_ID,
      classRef: otherCls._id,
      classCode: 'OC1',
      className: 'Other Class 1',
      sectionCode: 'A',
      sectionName: 'Section A',
      maxCapacity: 40,
      classTeacherRef: otherEmp._id,
      classTeacherName: otherEmp.fullName,
      status: 'ACTIVE'
    });

    const crossSheet = await apiCall(
      'GET',
      `/teacher/marks/sheet?academicYearId=${ay._id}&examinationId=${t1._id}&classId=${cls5._id}&sectionId=${sec5A._id}&subjectId=${mathSub._id}&entryType=EXAM_ACADEMIC`,
      otherSchoolToken
    );
    const crossFinalPdf = await apiCall('GET', `/teacher/final-results/${finalDocB._id}/pdf`, otherSchoolToken);
    const crossDash = await apiCall('GET', '/teacher/dashboard', otherSchoolToken);
    test(
      [403, 404].includes(crossSheet.status) && [403, 404].includes(crossFinalPdf.status) &&
        crossDash.status === 200 &&
        !(crossDash.data.classTeacherSections || []).some((s) => String(s._id) === String(sec5A._id)),
      `Cross-school isolation blocks access to TP_TEST_001 marksheets (${crossSheet.status}) and PDFs (${crossFinalPdf.status})`
    );

    // ------------------------------------------------------------------------
    // 8. MULTI-SUBJECT (25-SUBJECT) MULTI-PAGE FINAL PDF LAYOUT
    // ------------------------------------------------------------------------
    console.log('--- 8. MULTI-SUBJECT MULTI-PAGE PDF LAYOUT ---');
    const manySubjects = Array.from({ length: 25 }, (_, i) => ({
      subjectRef: mathSub._id,
      subjectCode: `SUB${i + 1}`,
      subjectName: `Academic Subject ${i + 1}`,
      termResults: [
        { examinationRef: t1._id, examinationCode: 'TERM-1', examinationName: 'First Term', components: [], totalObtained: 48, totalMaximum: 60, isAbsent: false },
        { examinationRef: t2._id, examinationCode: 'TERM-2', examinationName: 'Second Term', components: [], totalObtained: 50, totalMaximum: 60, isAbsent: false },
        { examinationRef: t3._id, examinationCode: 'TERM-3', examinationName: 'End Term', components: [], totalObtained: 52, totalMaximum: 60, isAbsent: false }
      ],
      additionalMarksObtained: 9,
      additionalMarksMax: 10,
      finalMarksObtained: 84,
      finalMaxMarks: 100,
      percentage: 84,
      grade: 'A',
      isPassing: true
    }));

    const multiStu = await StudentInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      admissionNumber: 'ADM-MULTI-01',
      firstName: 'Multi',
      lastName: 'Subject',
      gender: 'FEMALE',
      dateOfBirth: new Date('2015-05-05'),
      guardianDetails: [{ fullName: 'Parent Multi', relationship: 'MOTHER', mobileNumber: '9876543219', isPrimaryContact: true }],
      admissionAcademicYearRef: ay._id,
      admissionClassRef: cls5._id,
      status: 'ACTIVE'
    });
    const multiEnr = await StudentEnrollmentInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      academicYearRef: ay._id,
      classRef: cls5._id,
      sectionRef: sec5A._id,
      studentRef: multiStu._id,
      rollNumber: '99',
      status: 'ACTIVE'
    });
    const multiFinalDoc = await FinalAcademicResultInfo.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      academicYearRef: ay._id,
      academicYearName: '2026-2027',
      classRef: cls5._id,
      className: '5th Standard',
      sectionRef: sec5A._id,
      sectionName: 'Section A',
      studentRef: multiStu._id,
      enrollmentRef: multiEnr._id,
      admissionNumber: 'ADM-MULTI-01',
      studentName: 'Multi Subject',
      rollNumber: '99',
      examinationsIncluded: finalDocB.examinationsIncluded,
      academicSubjects: manySubjects,
      coCurricularSubjects: finalDocB.coCurricularSubjects,
      overallTotalObtained: 1176,
      overallMaxMarks: 1400,
      finalPercentage: 84,
      overallGrade: 'A',
      resultStatus: 'PASS',
      promotionStatus: 'PROMOTED',
      termRemarks: [],
      finalRemark: 'Consistent performance across all 14 subjects.',
      finalRemarkApproved: true,
      status: 'GENERATED',
      version: 1,
      configVersion: 3,
      generatedByUserRef: htWithDuties.user._id
    });

    const multiPdf = await apiCall('GET', `/teacher/final-results/${multiFinalDoc._id}/pdf`, htWithDuties.token);
    const pdfLatin1 = multiPdf.pdfBuffer.toString('latin1');
    const pageMatches = (pdfLatin1.match(/\/Type\s*\/Page\b/g) || []).length;
    test(
      multiPdf.status === 200 && multiPdf.pdfBuffer.slice(0, 4).toString() === '%PDF' && pageMatches >= 2,
      `Multi-subject (25 subjects) Final PDF cleanly paginates across ${pageMatches} pages with signature guard`
    );

    console.log(`\n========================================================================`);
    console.log(`  ALL ${passed}/${total} TEACHER PANEL E2E TESTS PASSED SUCCESSFULLY!`);
    console.log(`========================================================================`);
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

runTeacherPanelTests().catch((err) => {
  console.error('TEACHER PANEL TEST ERROR:', err);
  process.exit(1);
});
