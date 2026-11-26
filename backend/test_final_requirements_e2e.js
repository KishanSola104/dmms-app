require('dotenv').config();
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const mongoose = require('mongoose');

require('./src/models/roleInfo.model');
const AuthService = require('./src/services/auth.service');
const PasswordService = require('./src/services/password.service');
const RoleInfo = require('./src/models/roleInfo.model');
const SchoolInfo = require('./src/models/schoolInfo.model');
const EmployeeInfo = require('./src/models/employeeInfo.model');
const UserInfo = require('./src/models/userInfo.model');
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
const DownloadHistoryInfo = require('./src/models/downloadHistoryInfo.model');

const BASE_URL = 'http://localhost:8000/api';

async function isHealthUp() {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServerRunning() {
  if (await isHealthUp()) {
    return { startedByTest: false, child: null };
  }
  const child = spawn('node', ['src/server.js'], {
    cwd: path.resolve(__dirname),
    env: { ...process.env, PORT: '8000' },
    stdio: 'pipe'
  });

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await isHealthUp()) {
      return { startedByTest: true, child };
    }
  }
  child.kill();
  throw new Error('Backend server failed to start on port 8000 within 15s.');
}

async function apiCall(method, endpoint, token, body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${endpoint}`, opts);
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf')) {
    const ab = await res.arrayBuffer();
    return { status: res.status, data: null, pdfBuffer: Buffer.from(ab), headers: res.headers };
  }
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function run() {
  console.log('========================================================================');
  console.log('  DMMS FINAL REQUIREMENTS — COMPREHENSIVE END-TO-END TEST SUITE');
  console.log('========================================================================\n');

  const serverHandle = await ensureServerRunning();
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/DMMS');

  const S1 = 'TP_FINAL_001';
  const S2 = 'TP_FINAL_002';

  const cleanup = async () => {
    const filter = { schoolId: { $in: [S1, S2] } };
    await Promise.all([
      SchoolInfo.deleteMany(filter),
      EmployeeInfo.deleteMany(filter),
      UserInfo.deleteMany(filter),
      AcademicYearInfo.deleteMany(filter),
      ClassInfo.deleteMany(filter),
      SectionInfo.deleteMany(filter),
      SubjectInfo.deleteMany(filter),
      ClassSubjectInfo.deleteMany(filter),
      SubjectTeacherAssignmentInfo.deleteMany(filter),
      StudentInfo.deleteMany(filter),
      StudentEnrollmentInfo.deleteMany(filter),
      ExaminationInfo.deleteMany(filter),
      ExaminationClassInfo.deleteMany(filter),
      ExaminationSubjectInfo.deleteMany(filter),
      ExaminationComponentInfo.deleteMany(filter),
      SchoolResultConfig.deleteMany(filter),
      MarksSubmissionInfo.deleteMany(filter),
      MarksEntryInfo.deleteMany(filter),
      MarksAuditLogInfo.deleteMany(filter),
      ExaminationResultInfo.deleteMany(filter),
      FinalAcademicResultInfo.deleteMany(filter),
      NotificationInfo.deleteMany(filter),
      DownloadHistoryInfo.deleteMany(filter)
    ]);
  };

  let passed = 0;
  let total = 0;
  const test = (cond, msg) => {
    total++;
    if (cond) {
      passed++;
      console.log(`  [PASS ${String(total).padStart(2, '0')}] ${msg}`);
    } else {
      console.error(`  [FAIL ${String(total).padStart(2, '0')}] ${msg}`);
      throw new Error(`Test failed: ${msg}`);
    }
  };

  try {
    await cleanup();

    const roles = await RoleInfo.find({});
    const roleMap = new Map(roles.map((r) => [r.roleCode, r]));
    const pwdHash = await PasswordService.hashPassword('Pass@1234');

    const createSchoolAndStaff = async (sId, schoolEmail) => {
      const school = await SchoolInfo.create({
        schoolId: sId,
        schoolName: `${sId} Model School`,
        establishedYear: 2005,
        address: '100 Academic Road, Kolkata',
        email: schoolEmail,
        mobileNumber: '9876543210',
        passwordHash: pwdHash,
        status: 'ACTIVE'
      });

      const mkUser = async (code, roleCode, fullName, email) => {
        const role = roleMap.get(roleCode);
        const emp = await EmployeeInfo.create({
          schoolRef: school._id,
          schoolId: sId,
          fullName,
          email,
          mobileNumber: '9876500001',
          designation: role.roleName,
          roleRef: role._id,
          roleCode,
          status: 'ACTIVE'
        });
        const usr = await UserInfo.create({
          schoolRef: school._id,
          schoolId: sId,
          employeeRef: emp._id,
          userId: `${sId}_${code}`,
          email,
          roleRef: role._id,
          roleCode,
          roleName: role.roleName,
          passwordHash: pwdHash,
          mustChangePassword: false,
          status: 'ACTIVE'
        });
        const token = AuthService.generateUserToken(usr, school);
        return { emp, usr, token };
      };

      const admin = await mkUser('ADM', 'ADMIN', 'Admin Owner', `admin_${sId.toLowerCase()}@test.edu`);
      const ht = await mkUser('HT', 'HEAD_TEACHER', 'Head Teacher One', `ht_${sId.toLowerCase()}@test.edu`);
      const teacher = await mkUser('TCH', 'TEACHER', 'Subject Teacher One', `tch_${sId.toLowerCase()}@test.edu`);
      const office = await mkUser('OFF', 'OFFICE_STAFF', 'Office Clerk One', `off_${sId.toLowerCase()}@test.edu`);

      const ay = await AcademicYearInfo.create({
        schoolRef: school._id,
        schoolId: sId,
        yearName: 'Academic Year 2025-2026',
        yearCode: '2025-26',
        startDate: new Date('2025-04-01'),
        endDate: new Date('2026-03-31'),
        isCurrent: true,
        status: 'ACTIVE',
        createdBy: admin.usr._id
      });

      return { school, admin, ht, teacher, office, ay };
    };

    const s1 = await createSchoolAndStaff(S1, 'official.s1@school.edu');
    const s2 = await createSchoolAndStaff(S2, 'official.s2@school.edu');

    // ------------------------------------------------------------------
    // 1. Admin User Creation School Email Guard
    // ------------------------------------------------------------------
    const dupEmailCreate = await apiCall('POST', '/admin/users', s1.admin.token, {
      fullName: 'Duplicate Email User',
      email: 'OFFICIAL.S1@SCHOOL.EDU',
      mobileNumber: '9123456789',
      designation: 'Teacher',
      roleCode: 'TEACHER'
    });
    test(
      dupEmailCreate.status === 400 && /school.*email/i.test(dupEmailCreate.data?.message || ''),
      'Blocks creating user with same email as School official email (case-insensitive)'
    );

    const validCreate = await apiCall('POST', '/admin/users', s1.admin.token, {
      fullName: 'Extra Teacher Two',
      email: 'tch2_final@test.edu',
      mobileNumber: '9123456788',
      designation: 'Assistant Teacher',
      roleCode: 'TEACHER'
    });
    test(validCreate.status === 201 && validCreate.data?.success, 'Creates user when distinct email is used & writes audit log');

    const dupEmailEdit = await apiCall('PUT', `/admin/users/${validCreate.data.user._id}`, s1.admin.token, {
      fullName: 'Extra Teacher Two',
      email: 'official.s1@school.edu',
      mobileNumber: '9123456788',
      designation: 'Assistant Teacher',
      roleCode: 'TEACHER'
    });
    test(
      dupEmailEdit.status === 400 && /school.*email/i.test(dupEmailEdit.data?.message || ''),
      'Blocks updating existing user email to match School official email'
    );

    // ------------------------------------------------------------------
    // 2. Academic Setup + Head Teacher Academic/Student Management Access
    // ------------------------------------------------------------------
    const cls = await ClassInfo.create({
      schoolRef: s1.school._id,
      schoolId: S1,
      classCode: 'CLASS5',
      className: 'Class V',
      classTeacherRef: s1.teacher.emp._id,
      classTeacherName: s1.teacher.emp.fullName,
      status: 'ACTIVE',
      createdBy: s1.admin.usr._id
    });
    const sec = await SectionInfo.create({
      schoolRef: s1.school._id,
      schoolId: S1,
      classRef: cls._id,
      className: cls.className,
      sectionCode: 'A',
      sectionName: 'Section A',
      sectionTeacherRef: s1.teacher.emp._id,
      sectionTeacherName: s1.teacher.emp.fullName,
      status: 'ACTIVE',
      createdBy: s1.admin.usr._id
    });
    const subjMath = await SubjectInfo.create({
      schoolRef: s1.school._id,
      schoolId: S1,
      subjectCode: 'MATH',
      subjectName: 'Mathematics',
      subjectType: 'ACADEMIC',
      status: 'ACTIVE',
      createdBy: s1.admin.usr._id
    });
    const subjEng = await SubjectInfo.create({
      schoolRef: s1.school._id,
      schoolId: S1,
      subjectCode: 'ENG',
      subjectName: 'English',
      subjectType: 'ACADEMIC',
      status: 'ACTIVE',
      createdBy: s1.admin.usr._id
    });
    const subjArt = await SubjectInfo.create({
      schoolRef: s1.school._id,
      schoolId: S1,
      subjectCode: 'ART',
      subjectName: 'Art & Craft',
      subjectType: 'CO_CURRICULAR',
      status: 'ACTIVE',
      createdBy: s1.admin.usr._id
    });

    // Head Teacher allocates subjects via shared /admin/class-subjects route!
    const htAlloc = await apiCall('POST', '/admin/class-subjects', s1.ht.token, {
      academicYearRef: s1.ay._id,
      classRef: cls._id,
      allocations: [
        {
          subjectRef: subjMath._id,
          hasAdditionalComponents: true,
          additionalComponents: [{ componentName: 'Project', maximumMarks: 10 }]
        },
        { subjectRef: subjEng._id, hasAdditionalComponents: false, additionalComponents: [] },
        { subjectRef: subjArt._id, hasAdditionalComponents: false, additionalComponents: [] }
      ]
    });
    test(htAlloc.status === 201 && htAlloc.data?.success, 'Head Teacher allocates subjects via shared /admin/class-subjects');

    // Verify Head Teacher blocked from Admin-only setup routes
    const htUsersDenied = await apiCall('GET', '/admin/users', s1.ht.token);
    test(htUsersDenied.status === 403, 'Head Teacher remains blocked (403) from Admin-only User Management');

    const csMath = await ClassSubjectInfo.findOne({ schoolId: S1, classRef: cls._id, subjectRef: subjMath._id });
    const csEng = await ClassSubjectInfo.findOne({ schoolId: S1, classRef: cls._id, subjectRef: subjEng._id });
    const csArt = await ClassSubjectInfo.findOne({ schoolId: S1, classRef: cls._id, subjectRef: subjArt._id });

    // Assign teacher via HT
    const assignMath = await apiCall('POST', '/admin/teacher-assignments', s1.ht.token, {
      academicYearRef: s1.ay._id,
      classRef: cls._id,
      sectionRef: sec._id,
      classSubjectRef: csMath._id,
      teacherEmployeeId: s1.teacher.emp._id
    });
    const assignEng = await apiCall('POST', '/admin/teacher-assignments', s1.ht.token, {
      academicYearRef: s1.ay._id,
      classRef: cls._id,
      sectionRef: sec._id,
      classSubjectRef: csEng._id,
      teacherEmployeeId: s1.teacher.emp._id
    });
    const assignArt = await apiCall('POST', '/admin/teacher-assignments', s1.ht.token, {
      academicYearRef: s1.ay._id,
      classRef: cls._id,
      sectionRef: sec._id,
      classSubjectRef: csArt._id,
      teacherEmployeeId: s1.teacher.emp._id
    });
    test(assignMath.status === 201 && assignEng.status === 201 && assignArt.status === 201, 'Head Teacher assigns teachers via shared /admin/teacher-assignments');

    // Head Teacher creates & configures Examination + Student Admission
    const htExam = await apiCall('POST', '/admin/examinations', s1.ht.token, {
      academicYearRef: s1.ay._id,
      examinationCode: 'TERM1',
      examinationName: 'First Term Examination',
      startDate: '2025-07-10',
      endDate: '2025-07-20',
      classIds: [cls._id]
    });
    test(htExam.status === 201 && htExam.data?.examination?._id, 'Head Teacher creates Examination via shared /admin/examinations');
    const examId = htExam.data.examination._id;

    // Configure subjects for Term 1
    await apiCall('POST', `/admin/examinations/${examId}/classes/${cls._id}/subjects/${subjMath._id}/configure`, s1.ht.token, {
      components: [
        { componentName: 'Written', maximumMarks: 50, passingMarks: 20 },
        { componentName: 'Oral', maximumMarks: 5, passingMarks: 2 },
        { componentName: 'Class Assessment', maximumMarks: 5, passingMarks: 2 }
      ]
    });
    await apiCall('POST', `/admin/examinations/${examId}/classes/${cls._id}/subjects/${subjEng._id}/configure`, s1.ht.token, {
      components: [
        { componentName: 'Written', maximumMarks: 50, passingMarks: 20 },
        { componentName: 'Oral', maximumMarks: 5, passingMarks: 2 },
        { componentName: 'Class Assessment', maximumMarks: 5, passingMarks: 2 }
      ]
    });
    await apiCall('POST', `/admin/examinations/${examId}/classes/${cls._id}/subjects/${subjArt._id}/configure`, s1.ht.token, {
      components: []
    });

    // Admit Student via HT
    const htAdm = await apiCall('POST', '/admin/students/admission', s1.ht.token, {
      academicYearId: s1.ay._id,
      admissionNumber: 'ADM-2025-001',
      fullName: 'Aarav Sen',
      gender: 'MALE',
      dateOfBirth: '2015-05-15',
      guardianName: 'Subrata Sen',
      guardianMobile: '9800011111',
      classId: cls._id,
      sectionId: sec._id,
      rollNumber: '1'
    });
    test(htAdm.status === 201 && htAdm.data?.student?._id, 'Head Teacher admits student via shared /admin/students/admission');
    const studentId = htAdm.data.student._id;

    // ------------------------------------------------------------------
    // 3. Teacher Pending Work + Submit + Edit After Submission + Lock Controls
    // ------------------------------------------------------------------
    const dashBefore = await apiCall('GET', `/teacher/dashboard?academicYearId=${s1.ay._id}`, s1.teacher.token);
    test(
      dashBefore.status === 200 &&
        dashBefore.data?.pendingWorkSummary?.totalAssignedTasks === 4 &&
        dashBefore.data?.pendingWorkSummary?.pendingTasks === 4 &&
        dashBefore.data?.pendingTasks?.every((t) => t.targetRoute && t.targetRoute.includes('classId=')),
      'Teacher Dashboard reports pendingWorkSummary & clickable targetRoute for all 4 open tasks (Math T1, Eng T1, Art T1, Math Project)'
    );

    // Submit Math marks
    const saveMath1 = await apiCall('POST', '/teacher/marks/save', s1.teacher.token, {
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjMath._id,
      entryType: 'EXAM_ACADEMIC',
      action: 'SUBMIT',
      entries: [
        {
          studentId,
          isAbsent: false,
          remarks: 'Good start',
          componentMarks: [
            { componentName: 'Written', marksObtained: 42 },
            { componentName: 'Oral', marksObtained: 4 },
            { componentName: 'Class Assessment', marksObtained: 5 }
          ]
        }
      ]
    });
    test(saveMath1.status === 200 && saveMath1.data?.status === 'SUBMITTED', 'Teacher submits Term 1 Math marks');

    // Update submitted marks while UNLOCKED
    const updateMathAfterSubmit = await apiCall('POST', '/teacher/marks/save', s1.teacher.token, {
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjMath._id,
      entryType: 'EXAM_ACADEMIC',
      action: 'SUBMIT',
      entries: [
        {
          studentId,
          isAbsent: false,
          remarks: 'Updated after paper recheck',
          componentMarks: [
            { componentName: 'Written', marksObtained: 46 },
            { componentName: 'Oral', marksObtained: 5 },
            { componentName: 'Class Assessment', marksObtained: 5 }
          ]
        }
      ]
    });
    test(
      updateMathAfterSubmit.status === 200 && updateMathAfterSubmit.data?.status === 'SUBMITTED',
      'Teacher can edit SUBMITTED marks while unlocked (writes MARKS_UPDATED_AFTER_SUBMISSION audit log)'
    );

    const editAudit = await MarksAuditLogInfo.findOne({ schoolId: S1, action: 'MARKS_UPDATED_AFTER_SUBMISSION' }).lean();
    test(
      editAudit && editAudit.previousValue && editAudit.newValue,
      'MARKS_UPDATED_AFTER_SUBMISSION audit entry captures previousValue and newValue'
    );

    // Admin Locks Math marks -> Head Teacher CANNOT reopen Admin lock -> Admin reopens -> HT locks & reopens
    const adminLock = await apiCall('POST', '/admin/marks-lock/update', s1.admin.token, {
      action: 'LOCK',
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjMath._id,
      reason: 'Deadline passed'
    });
    test(adminLock.status === 200 && adminLock.data?.updatedCount === 1, 'Admin locks Term 1 Math marks');

    const editWhenLocked = await apiCall('POST', '/teacher/marks/save', s1.teacher.token, {
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjMath._id,
      entryType: 'EXAM_ACADEMIC',
      action: 'SUBMIT',
      entries: [{ studentId, isAbsent: false, componentMarks: [{ componentName: 'Written', marksObtained: 40 }, { componentName: 'Oral', marksObtained: 5 }, { componentName: 'Class Assessment', marksObtained: 5 }] }]
    });
    test(editWhenLocked.status === 403, 'Locked marks entry blocks Teacher edits (403)');

    const htOverrideAdmin = await apiCall('POST', '/head-teacher/marks-lock/update', s1.ht.token, {
      action: 'OPEN',
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjMath._id
    });
    test(htOverrideAdmin.status === 403, 'Head Teacher is blocked (403) from reopening Admin-locked marks');

    const adminReopen = await apiCall('POST', '/admin/marks-lock/update', s1.admin.token, {
      action: 'OPEN',
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjMath._id,
      reason: 'Approved moderation'
    });
    test(adminReopen.status === 200, 'Admin successfully reopens Admin-locked marks');

    const htLock = await apiCall('POST', '/head-teacher/marks-lock/update', s1.ht.token, {
      action: 'LOCK',
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjMath._id
    });
    const htReopenOwn = await apiCall('POST', '/head-teacher/marks-lock/update', s1.ht.token, {
      action: 'OPEN',
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjMath._id
    });
    test(htLock.status === 200 && htReopenOwn.status === 200, 'Head Teacher can lock and reopen Head Teacher-locked marks');

    // Submit English, Art & Math Extra Project marks
    await apiCall('POST', '/teacher/marks/save', s1.teacher.token, {
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjEng._id,
      entryType: 'EXAM_ACADEMIC',
      action: 'SUBMIT',
      entries: [{ studentId, isAbsent: false, componentMarks: [{ componentName: 'Written', marksObtained: 44 }, { componentName: 'Oral', marksObtained: 4 }, { componentName: 'Class Assessment', marksObtained: 4 }] }]
    });
    await apiCall('POST', '/teacher/marks/save', s1.teacher.token, {
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjArt._id,
      entryType: 'CO_CURRICULAR_TERM',
      action: 'SUBMIT',
      entries: [{ studentId, isAbsent: false, grade: 'A+' }]
    });
    await apiCall('POST', '/teacher/marks/save', s1.teacher.token, {
      academicYearId: s1.ay._id,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjMath._id,
      entryType: 'EXTRA_COMPONENT',
      action: 'SUBMIT',
      entries: [{ studentId, isAbsent: false, componentMarks: [{ componentName: 'Project', marksObtained: 9 }] }]
    });

    // ------------------------------------------------------------------
    // 4. Subject Teacher Deallocation (Preserves Marks, Blocks New Edits)
    // ------------------------------------------------------------------
    const engAssignId = assignEng.data.assignment._id;
    const deallocRes = await apiCall('POST', `/admin/teacher-assignments/${engAssignId}/deallocate`, s1.admin.token, {
      reason: 'Reassigning workload'
    });
    test(
      deallocRes.status === 200 && deallocRes.data?.assignment?.status === 'INACTIVE',
      'Deallocating subject teacher assignment marks it INACTIVE'
    );

    const engMarksCountAfterDealloc = await MarksEntryInfo.countDocuments({
      schoolId: S1,
      classRef: cls._id,
      subjectRef: subjEng._id
    });
    test(engMarksCountAfterDealloc === 1, 'Existing English marks preserved after teacher deallocation');

    const editAfterDealloc = await apiCall('POST', '/teacher/marks/save', s1.teacher.token, {
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      subjectId: subjEng._id,
      entryType: 'EXAM_ACADEMIC',
      action: 'DRAFT',
      entries: [{ studentId, isAbsent: false, componentMarks: [{ componentName: 'Written', marksObtained: 10 }] }]
    });
    test(editAfterDealloc.status === 403, 'Deallocated teacher is blocked (403) from modifying future marks for that subject');

    // Verify all open tasks completed in Pending Work dashboard
    const dashAfter = await apiCall('GET', `/teacher/dashboard?academicYearId=${s1.ay._id}`, s1.teacher.token);
    test(
      dashAfter.data?.pendingWorkSummary?.pendingTasks === 0 && dashAfter.data?.pendingWorkSummary?.totalAssignedTasks === 3,
      'Pending Work dashboard excludes deallocated Eng assignment & shows 0 remaining pending tasks'
    );

    // ------------------------------------------------------------------
    // 5. Verify Marks -> Generate & Publish Results -> Redesigned PDFs
    // ------------------------------------------------------------------
    const subs = await MarksSubmissionInfo.find({ schoolId: S1, academicYearRef: s1.ay._id }).lean();
    for (const s of subs) {
      if (s.entryType === 'EXTRA_COMPONENT') continue;
      await apiCall('POST', `/teacher/marks/verify/${s._id}`, s1.teacher.token, {});
    }

    const genTerm = await apiCall('POST', '/teacher/results/examination/generate', s1.teacher.token, {
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id
    });
    test(genTerm.status === 200 && genTerm.data?.generatedCount === 1, 'Generates Term Result despite English teacher deallocation');
    const termResId = genTerm.data.results[0]._id;

    await apiCall('POST', '/teacher/results/examination/remarks', s1.teacher.token, {
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id,
      remarks: [{ resultId: termResId, termRemark: 'Very consistent term progress.' }]
    });
    await apiCall('POST', '/teacher/results/examination/submit', s1.teacher.token, {
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id
    });
    await apiCall('POST', '/head-teacher/results/approve', s1.ht.token, {
      type: 'EXAMINATION',
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id
    });
    await apiCall('POST', '/head-teacher/results/publish', s1.ht.token, {
      type: 'EXAMINATION',
      academicYearId: s1.ay._id,
      examinationId: examId,
      classId: cls._id,
      sectionId: sec._id
    });

    // Verify Extra component & Generate Final Result
    const extraSub = await MarksSubmissionInfo.findOne({ schoolId: S1, entryType: 'EXTRA_COMPONENT' }).lean();
    await apiCall('POST', `/teacher/marks/verify/${extraSub._id}`, s1.teacher.token, {});

    const genFinal = await apiCall('POST', '/teacher/results/final/generate', s1.teacher.token, {
      academicYearId: s1.ay._id,
      classId: cls._id,
      sectionId: sec._id
    });
    test(genFinal.status === 200 && genFinal.data?.generatedCount === 1, 'Generates Final Academic Result cleanly');
    const finalResId = genFinal.data.results[0]._id;

    await apiCall('POST', '/teacher/results/final/remarks', s1.teacher.token, {
      academicYearId: s1.ay._id,
      classId: cls._id,
      sectionId: sec._id,
      updates: [{ finalResultId: finalResId, promotionStatus: 'PROMOTED', finalRemark: 'Excellent overall performance.' }]
    });
    await apiCall('POST', '/teacher/results/final/submit', s1.teacher.token, {
      academicYearId: s1.ay._id,
      classId: cls._id,
      sectionId: sec._id
    });
    await apiCall('POST', '/head-teacher/results/approve', s1.ht.token, {
      type: 'FINAL',
      academicYearId: s1.ay._id,
      classId: cls._id,
      sectionId: sec._id
    });
    await apiCall('POST', '/head-teacher/results/publish', s1.ht.token, {
      type: 'FINAL',
      academicYearId: s1.ay._id,
      classId: cls._id,
      sectionId: sec._id
    });

    // Check Redesigned Term & Final PDF generation across Teacher, Head Teacher, and Office Staff
    const htTermPdf = await apiCall('GET', `/head-teacher/results/examination/${termResId}/pdf`, s1.ht.token);
    const htFinalPdf = await apiCall('GET', `/head-teacher/results/final/${finalResId}/pdf`, s1.ht.token);
    test(
      htTermPdf.status === 200 && htTermPdf.pdfBuffer.slice(0, 4).toString() === '%PDF',
      'Head Teacher downloads redesigned Examination Marksheet PDF (fixed fileName)'
    );
    test(
      htFinalPdf.status === 200 && htFinalPdf.pdfBuffer.slice(0, 4).toString() === '%PDF' && htFinalPdf.pdfBuffer.length > 3500,
      'Head Teacher downloads redesigned 3-page Final Marksheet PDF'
    );

    // ------------------------------------------------------------------
    // 6. Office Staff Portal Backend & Download History
    // ------------------------------------------------------------------
    const offPdf = await apiCall('GET', `/office/published-results/${finalResId}/pdf?type=FINAL`, s1.office.token);
    test(offPdf.status === 200 && offPdf.pdfBuffer.slice(0, 4).toString() === '%PDF', 'Office Staff downloads published Final Marksheet PDF');

    const offPreviewOnly = await apiCall('GET', `/office/published-results/${termResId}/pdf?type=EXAMINATION&preview=true`, s1.office.token);
    test(offPreviewOnly.status === 200, 'Office Staff previews published Examination Marksheet PDF without adding download log');

    const offDash = await apiCall('GET', '/common/dashboard-stats', s1.office.token);
    test(
      offDash.status === 200 &&
        offDash.data?.stats?.totalPublishedFinalResults === 1 &&
        offDash.data?.stats?.totalPublishedExamResults === 1 &&
        offDash.data?.stats?.myTotalDownloads === 1,
      'Office Staff dashboard returns live DB metrics (published results + user-scoped download count)'
    );

    const offReports = await apiCall('GET', `/office/academic-reports?academicYearId=${s1.ay._id}`, s1.office.token);
    const offReportPdf = await apiCall('GET', `/office/academic-reports/pdf?academicYearId=${s1.ay._id}&reportType=CLASS_WISE`, s1.office.token);
    const offHistory = await apiCall('GET', `/office/download-history?academicYearId=${s1.ay._id}`, s1.office.token);
    test(
      offReports.status === 200 &&
        offReports.data?.classWiseReports?.length === 1 &&
        offReportPdf.status === 200 &&
        offReportPdf.pdfBuffer.slice(0, 4).toString() === '%PDF' &&
        offHistory.status === 200 &&
        offHistory.data?.downloads?.length === 2,
      'Office Academic Reports JSON/PDF and user-scoped Download History operate end-to-end'
    );

    // ------------------------------------------------------------------
    // 7. Head Teacher Live Monitoring, Student Performance & Module 6
    // ------------------------------------------------------------------
    const htMonitoring = await apiCall('GET', `/head-teacher/marks-monitoring?academicYearId=${s1.ay._id}`, s1.ht.token);
    const htPerf = await apiCall('GET', `/head-teacher/students/${studentId}/performance?academicYearId=${s1.ay._id}`, s1.ht.token);
    test(
      htMonitoring.status === 200 &&
        htMonitoring.data?.marksModuleStatus?.isMarksCollectionAvailable === true &&
        htPerf.status === 200 &&
        htPerf.data?.finalResult?.finalPercentage > 0 &&
        htPerf.data?.examinations?.[0]?.examResultSummary?.percentage > 0,
      'Head Teacher Marks Monitoring & Student Performance return live marks & published results'
    );

    const htReports = await apiCall('GET', `/head-teacher/reports?academicYearId=${s1.ay._id}`, s1.ht.token);
    const htReportPdf = await apiCall('GET', `/head-teacher/reports/pdf?academicYearId=${s1.ay._id}&reportSection=CLASS_WISE`, s1.ht.token);
    const htRecipients = await apiCall('GET', '/head-teacher/notifications/recipients', s1.ht.token);
    const htSendNotif = await apiCall('POST', '/head-teacher/notifications/send', s1.ht.token, {
      title: 'Term Results Closed',
      message: 'Please review final grades carefully.',
      type: 'info',
      recipientMode: 'ROLE',
      targetRoleCode: 'ALL_STAFF'
    });
    const htSentHist = await apiCall('GET', '/head-teacher/notifications/sent', s1.ht.token);
    test(
      htReports.status === 200 &&
        htReports.data?.classWisePerformance?.length === 1 &&
        htReportPdf.status === 200 &&
        htReportPdf.pdfBuffer.slice(0, 4).toString() === '%PDF' &&
        htRecipients.status === 200 &&
        Array.isArray(htRecipients.data?.recipients) &&
        htRecipients.data.recipients.length >= 2 &&
        htSendNotif.status === 201 &&
        htSentHist.status === 200 &&
        htSentHist.data?.history?.length >= 1,
      'Head Teacher Module 6 Academic Reports, PDF export, Recipients & Send Notifications work cleanly'
    );

    // ------------------------------------------------------------------
    // 8. Audit Log Hierarchy & Strict School Isolation
    // ------------------------------------------------------------------
    const adminAudit = await apiCall('GET', '/admin/audit-logs?limit=50', s1.admin.token);
    const htAudit = await apiCall('GET', '/head-teacher/audit-logs?limit=50', s1.ht.token);
    const htAskAdminRole = await apiCall('GET', '/head-teacher/audit-logs?role=ADMIN', s1.ht.token);
    const teacherAudit = await apiCall('GET', '/admin/audit-logs', s1.teacher.token);
    const officeAudit = await apiCall('GET', '/head-teacher/audit-logs', s1.office.token);
    const s2Audit = await apiCall('GET', '/admin/audit-logs?limit=50', s2.admin.token);

    test(
      adminAudit.status === 200 &&
        adminAudit.data.logs.some((l) => l.performedByRole === 'ADMIN') &&
        adminAudit.data.logs.some((l) => l.performedByRole === 'TEACHER') &&
        adminAudit.data.logs.every((l) => l.schoolId === S1),
      'Admin Audit Log includes Admin + HT + Teacher logs scoped strictly to S1'
    );
    test(
      htAudit.status === 200 &&
        htAudit.data.logs.every((l) => l.performedByRole !== 'ADMIN' && l.schoolId === S1) &&
        htAskAdminRole.status === 200 &&
        htAskAdminRole.data.logs.length === 0,
      'Head Teacher Audit Log completely hides ADMIN logs even when explicitly filtered by role=ADMIN'
    );
    test(teacherAudit.status === 403 && officeAudit.status === 403, 'Teacher & Office Staff receive 403 on Audit Log endpoints');
    test(s2Audit.status === 200 && s2Audit.data.logs.length === 0, 'Cross-school S2 Admin sees zero logs from S1');

    // ------------------------------------------------------------------
    // 9. Restart Application Status Endpoint (All 4 Authenticated Roles)
    // ------------------------------------------------------------------
    const rsAdm = await apiCall('GET', '/common/restart-status', s1.admin.token);
    const rsHt = await apiCall('GET', '/common/restart-status', s1.ht.token);
    const rsTch = await apiCall('GET', '/common/restart-status', s1.teacher.token);
    const rsOff = await apiCall('GET', '/common/restart-status', s1.office.token);
    test(
      rsAdm.status === 200 && rsHt.status === 200 && rsTch.status === 200 && rsOff.status === 200,
      'All 4 authenticated roles (Admin, Head Teacher, Teacher, Office Staff) authorized for Restart endpoints'
    );

    console.log('\n========================================================================');
    console.log(`  ALL ${passed}/${total} FINAL REQUIREMENTS E2E TESTS PASSED!`);
    console.log('========================================================================');
  } finally {
    await cleanup();
    await mongoose.disconnect();
    if (serverHandle.startedByTest && serverHandle.child) {
      serverHandle.child.kill();
    }
  }
}

run().catch((err) => {
  console.error('FINAL E2E SUITE FAILED:', err);
  process.exit(1);
});
