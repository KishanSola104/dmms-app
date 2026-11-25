require('dotenv').config();
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

const BASE_URL = 'http://localhost:8000/api';

async function runRequiredCorrectionsTests() {
  console.log('========================================================================');
  console.log('  DMMS REQUIRED CORRECTIONS — MULTI-CLASS TEACHER, HT & OFFICE WORKFLOW');
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
  const TEST_SCHOOL_ID = 'TP_CORR_001';

  const cleanup = async () => {
    await Promise.all([
      SchoolInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      EmployeeInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      UserInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      AcademicYearInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      ClassInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      SectionInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      SubjectInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      ClassSubjectInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      SubjectTeacherAssignmentInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      StudentInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      StudentEnrollmentInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      ExaminationInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      ExaminationClassInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      ExaminationSubjectInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      ExaminationComponentInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      SchoolResultConfig.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      MarksSubmissionInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      MarksEntryInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      MarksAuditLogInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      ExaminationResultInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      FinalAcademicResultInfo.deleteMany({ schoolId: TEST_SCHOOL_ID }),
      NotificationInfo.deleteMany({ schoolId: TEST_SCHOOL_ID })
    ]);
  };

  await cleanup();

  try {
    const roles = await RoleInfo.find({ status: 'ACTIVE' }).lean();
    const roleByCode = new Map(roles.map(r => [r.roleCode, r]));
    const pwdHash = await PasswordService.hashPassword('TestPass@123');

    const school = await SchoolInfo.create({
      schoolId: TEST_SCHOOL_ID,
      schoolCode: 'TPCORR',
      schoolName: 'Corrections Model School',
      establishedYear: 2008,
      email: 'corr@school.edu',
      mobileNumber: '9876543210',
      address: '100 Workflow Lane',
      passwordHash: pwdHash,
      contactPersons: [
        { fullName: 'Principal', email: 'p@corr.edu', mobileNumber: '9990001111', designation: 'Principal' },
        { fullName: 'Trustee', email: 't@corr.edu', mobileNumber: '9990001112', designation: 'Trustee' }
      ],
      status: 'ACTIVE'
    });
    const schoolToken = AuthService.generateSchoolToken(school);

    const mkUser = async (code, name, roleCode) => {
      const emp = await EmployeeInfo.create({
        schoolRef: school._id,
        schoolId: TEST_SCHOOL_ID,
        fullName: name,
        email: `${code.toLowerCase()}@corr.edu`,
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
        passwordHash: pwdHash,
        isFirstLogin: false,
        mustChangePassword: false,
        status: 'ACTIVE'
      });
      const token = AuthService.generateUserToken(user, school, emp);
      return { emp, user, token };
    };

    const htDual = await mkUser('CRHT1', 'Head Teacher Dual', 'HEAD_TEACHER');
    const htNoTeach = await mkUser('CRHT2', 'Head Teacher No Duties', 'HEAD_TEACHER');
    const teacherA = await mkUser('CRTCHA', 'Teacher A', 'TEACHER');
    const teacherB = await mkUser('CRTCHB', 'Teacher B', 'TEACHER');
    const teacherC = await mkUser('CRTCHC', 'Teacher C', 'TEACHER');
    const subjOnly = await mkUser('CRSUBJ', 'Subject Only Teacher', 'TEACHER');
    const officeStaff = await mkUser('CROFF1', 'Office Staff One', 'OFFICE_STAFF');

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

    await SchoolResultConfig.create({
      schoolRef: school._id,
      schoolId: TEST_SCHOOL_ID,
      academicFinalRule: { expectedExamCount: 1, termSumDivisor: 1, formulaType: 'DIRECT_AVERAGE_PLUS_ADDITIONAL' }
    });

    // Classes & Sections:
    // - Class 1 Section A -> Teacher A
    // - Class 2 Section A -> Teacher B
    // - Class 3 (classTeacherRef: Teacher A) -> Section A (Teacher A) & Section B (explicit sectionTeacherRef: Teacher C)
    const cls1 = await ClassInfo.create({
      schoolRef: school._id, schoolId: TEST_SCHOOL_ID, classCode: 'C1', className: '1st Standard',
      classTeacherRef: teacherA.emp._id, classTeacherName: teacherA.emp.fullName, numberOfSections: 1, status: 'ACTIVE'
    });
    const sec1A = await SectionInfo.create({
      schoolRef: school._id, schoolId: TEST_SCHOOL_ID, classRef: cls1._id, classCode: 'C1', className: '1st Standard',
      sectionCode: 'A', sectionName: 'Section A', sectionTeacherRef: teacherA.emp._id, sectionTeacherName: teacherA.emp.fullName, maxCapacity: 40, status: 'ACTIVE'
    });

    const cls2 = await ClassInfo.create({
      schoolRef: school._id, schoolId: TEST_SCHOOL_ID, classCode: 'C2', className: '2nd Standard',
      classTeacherRef: teacherB.emp._id, classTeacherName: teacherB.emp.fullName, numberOfSections: 1, status: 'ACTIVE'
    });
    const sec2A = await SectionInfo.create({
      schoolRef: school._id, schoolId: TEST_SCHOOL_ID, classRef: cls2._id, classCode: 'C2', className: '2nd Standard',
      sectionCode: 'A', sectionName: 'Section A', sectionTeacherRef: teacherB.emp._id, sectionTeacherName: teacherB.emp.fullName, maxCapacity: 40, status: 'ACTIVE'
    });

    const cls3 = await ClassInfo.create({
      schoolRef: school._id, schoolId: TEST_SCHOOL_ID, classCode: 'C3', className: '3rd Standard',
      classTeacherRef: teacherA.emp._id, classTeacherName: teacherA.emp.fullName, numberOfSections: 2, status: 'ACTIVE'
    });
    const sec3A = await SectionInfo.create({
      schoolRef: school._id, schoolId: TEST_SCHOOL_ID, classRef: cls3._id, classCode: 'C3', className: '3rd Standard',
      sectionCode: 'A', sectionName: 'Section A', sectionTeacherRef: teacherA.emp._id, sectionTeacherName: teacherA.emp.fullName, maxCapacity: 40, status: 'ACTIVE'
    });
    const sec3B = await SectionInfo.create({
      schoolRef: school._id, schoolId: TEST_SCHOOL_ID, classRef: cls3._id, classCode: 'C3', className: '3rd Standard',
      sectionCode: 'B', sectionName: 'Section B', sectionTeacherRef: teacherC.emp._id, sectionTeacherName: teacherC.emp.fullName, maxCapacity: 40, status: 'ACTIVE'
    });

    const mathSub = await SubjectInfo.create({
      schoolRef: school._id, schoolId: TEST_SCHOOL_ID, subjectCode: 'MATH', subjectName: 'Mathematics', subjectType: 'ACADEMIC', status: 'ACTIVE'
    });

    const mkClassSubAndExamSetup = async (cls, sec, stuName, roll, teacherUserObj) => {
      const cs = await ClassSubjectInfo.create({
        schoolRef: school._id, schoolId: TEST_SCHOOL_ID, academicYearRef: ay._id, classRef: cls._id,
        subjectRef: mathSub._id, subjectCode: 'MATH', subjectName: 'Mathematics', subjectType: 'ACADEMIC', status: 'ACTIVE'
      });
      await SubjectTeacherAssignmentInfo.create({
        schoolRef: school._id, schoolId: TEST_SCHOOL_ID, academicYearRef: ay._id, classSubjectRef: cs._id,
        classRef: cls._id, sectionRef: sec._id, subjectRef: mathSub._id,
        teacherEmployeeRef: teacherUserObj.emp._id, teacherUserRef: teacherUserObj.user._id,
        classCode: cls.classCode, className: cls.className, sectionCode: sec.sectionCode, sectionName: sec.sectionName,
        subjectCode: 'MATH', subjectName: 'Mathematics', subjectType: 'ACADEMIC',
        teacherName: teacherUserObj.emp.fullName, teacherUserId: teacherUserObj.user.userId, teacherEmail: teacherUserObj.user.email, status: 'ACTIVE'
      });
      const stu = await StudentInfo.create({
        schoolRef: school._id, schoolId: TEST_SCHOOL_ID, admissionNumber: `ADM-${cls.classCode}-${sec.sectionCode}`,
        firstName: stuName, lastName: 'Student', gender: 'MALE', dateOfBirth: new Date('2017-01-01'),
        guardianDetails: [{ fullName: 'Parent', relationship: 'FATHER', mobileNumber: '9876543210', isPrimaryContact: true }],
        admissionAcademicYearRef: ay._id, admissionClassRef: cls._id, status: 'ACTIVE'
      });
      await StudentEnrollmentInfo.create({
        schoolRef: school._id, schoolId: TEST_SCHOOL_ID, studentRef: stu._id, academicYearRef: ay._id,
        classRef: cls._id, sectionRef: sec._id, rollNumber: roll, status: 'ACTIVE'
      });
      return { cs, stu };
    };

    const s1 = await mkClassSubAndExamSetup(cls1, sec1A, 'ClassOne', '1', htDual); // Head Teacher teaches 1st A Math (NOT Class Teacher!)
    const s2 = await mkClassSubAndExamSetup(cls2, sec2A, 'ClassTwo', '1', subjOnly);
    const s3 = await mkClassSubAndExamSetup(cls3, sec3B, 'ClassThreeB', '1', teacherC);

    const exam = await ExaminationInfo.create({
      schoolRef: school._id, schoolId: TEST_SCHOOL_ID, academicYearRef: ay._id,
      examinationCode: 'ANNUAL', examinationName: 'Annual Exam', startDate: new Date('2026-09-01'), endDate: new Date('2026-09-10'), status: 'COMPLETED'
    });

    for (const [cls, cs] of [[cls1, s1.cs], [cls2, s2.cs], [cls3, s3.cs]]) {
      const ec = await ExaminationClassInfo.create({
        schoolRef: school._id, schoolId: TEST_SCHOOL_ID, academicYearRef: ay._id,
        examinationRef: exam._id, classRef: cls._id, classCode: cls.classCode, className: cls.className, status: 'ACTIVE'
      });
      const es = await ExaminationSubjectInfo.create({
        schoolRef: school._id, schoolId: TEST_SCHOOL_ID, academicYearRef: ay._id,
        examinationRef: exam._id, examinationClassRef: ec._id, classRef: cls._id, classSubjectRef: cs._id,
        subjectRef: mathSub._id, subjectCode: 'MATH', subjectName: 'Mathematics', subjectType: 'ACADEMIC', totalMaximumMarks: 100, status: 'ACTIVE'
      });
      await ExaminationComponentInfo.create({
        schoolRef: school._id, schoolId: TEST_SCHOOL_ID, academicYearRef: ay._id,
        examinationSubjectRef: es._id, componentName: 'Theory', maximumMarks: 100, sequence: 1
      });
    }

    const apiCall = async (method, path, token, body = null, extraHeaders = {}) => {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...extraHeaders
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/pdf')) {
        return { status: res.status, pdfBuffer: Buffer.from(await res.arrayBuffer()) };
      }
      return { status: res.status, data: await res.json() };
    };

    // ------------------------------------------------------------------------
    // 1. SAME-CREDENTIAL DUAL PANEL LOGIN FOR HEAD TEACHER
    // ------------------------------------------------------------------------
    console.log('--- 1. HEAD TEACHER SAME-CREDENTIAL DUAL-PANEL LOGIN ---');
    const loginAsHT = await apiCall('POST', '/auth/user/login', null, {
      roleCode: 'HEAD_TEACHER', identifier: 'CRHT1', password: 'TestPass@123'
    }, { 'x-school-token': schoolToken });
    test(
      loginAsHT.status === 200 && loginAsHT.data.activePanel === 'HEAD_TEACHER' &&
        loginAsHT.data.user.roleCode === 'HEAD_TEACHER' && loginAsHT.data.user.teachingAccess.hasTeachingAccess === true,
      'HEAD_TEACHER with teaching duties logs into HEAD_TEACHER panel preserving role'
    );

    const loginAsTeacher = await apiCall('POST', '/auth/user/login', null, {
      roleCode: 'TEACHER', identifier: 'CRHT1', password: 'TestPass@123'
    }, { 'x-school-token': schoolToken });
    test(
      loginAsTeacher.status === 200 && loginAsTeacher.data.activePanel === 'TEACHER' &&
        loginAsTeacher.data.user.roleCode === 'HEAD_TEACHER',
      'Same HEAD_TEACHER credentials log into TEACHER panel without duplicate account or role downgrade'
    );

    const noDutiesBlocked = await apiCall('POST', '/auth/user/login', null, {
      roleCode: 'TEACHER', identifier: 'CRHT2', password: 'TestPass@123'
    }, { 'x-school-token': schoolToken });
    test(noDutiesBlocked.status === 403, 'HEAD_TEACHER without teaching duties blocked from selecting TEACHER panel (403)');

    // ------------------------------------------------------------------------
    // 2. MULTI-CLASS TEACHER FINAL RESULT GENERATION & STRICT SECTION ISOLATION
    // ------------------------------------------------------------------------
    console.log('--- 2. MULTIPLE CLASS TEACHERS FINAL RESULT ISOLATION ---');
    const submitAndVerify = async (subjTeacherObj, ctObj, cls, sec, stu, score) => {
      const subRes = await apiCall('POST', '/teacher/marks/save', subjTeacherObj.token, {
        academicYearId: ay._id, examinationId: exam._id, classId: cls._id, sectionId: sec._id,
        subjectId: mathSub._id, entryType: 'EXAM_ACADEMIC', action: 'SUBMIT',
        entries: [{ studentId: stu._id, componentMarks: [{ componentName: 'Theory', marksObtained: score }] }]
      });
      if (subRes.status !== 200) throw new Error(`Submit failed: ${JSON.stringify(subRes.data)}`);
      const verRes = await apiCall('POST', `/teacher/verification/${subRes.data.submission._id}/verify`, ctObj.token);
      if (verRes.status !== 200) throw new Error(`Verify failed: ${JSON.stringify(verRes.data)}`);
      const exRes = await apiCall('POST', '/teacher/examination-results/generate', ctObj.token, {
        academicYearId: ay._id, examinationId: exam._id, classId: cls._id, sectionId: sec._id
      });
      if (exRes.status !== 200) throw new Error(`Exam Gen failed: ${JSON.stringify(exRes.data)}`);
    };

    await submitAndVerify(htDual, teacherA, cls1, sec1A, s1.stu, 88);
    await submitAndVerify(subjOnly, teacherB, cls2, sec2A, s2.stu, 76);
    await submitAndVerify(teacherC, teacherC, cls3, sec3B, s3.stu, 92);

    // Subject teacher / non-class-teacher Head Teacher blocked from generating Class 1A Final Result
    const subjGenBlocked = await apiCall('POST', '/teacher/final-results/generate', subjOnly.token, {
      academicYearId: ay._id, classId: cls2._id, sectionId: sec2A._id
    });
    const htSubjOnlyBlocked = await apiCall('POST', '/teacher/final-results/generate', htDual.token, {
      academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id
    });
    test(subjGenBlocked.status === 403 && htSubjOnlyBlocked.status === 403, 'Subject-only teacher & non-Class-Teacher HT blocked from final result generation (403)');

    // Teacher A (Class Teacher of Class 3!) CANNOT generate Class 3 Section B because Section B has sectionTeacherRef = Teacher C!
    const crossSecBlocked = await apiCall('POST', '/teacher/final-results/generate', teacherA.token, {
      academicYearId: ay._id, classId: cls3._id, sectionId: sec3B._id
    });
    const crossClsBlocked = await apiCall('POST', '/teacher/final-results/generate', teacherA.token, {
      academicYearId: ay._id, classId: cls2._id, sectionId: sec2A._id
    });
    test(crossSecBlocked.status === 403 && crossClsBlocked.status === 403, 'Class Teacher A blocked from generating Class 2A or Class 3B (Teacher C section) final results (403)');

    // Each Class Teacher generates Final Result for their OWN class/section
    const gen1A = await apiCall('POST', '/teacher/final-results/generate', teacherA.token, {
      academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id
    });
    const gen2A = await apiCall('POST', '/teacher/final-results/generate', teacherB.token, {
      academicYearId: ay._id, classId: cls2._id, sectionId: sec2A._id
    });
    const gen3B = await apiCall('POST', '/teacher/final-results/generate', teacherC.token, {
      academicYearId: ay._id, classId: cls3._id, sectionId: sec3B._id
    });
    test(
      gen1A.status === 200 && gen2A.status === 200 && gen3B.status === 200,
      'Teacher A (1st-A), Teacher B (2nd-A), and Teacher C (3rd-B) each generate final results for their own assigned section'
    );
    const fin1AId = gen1A.data.results[0]._id;
    const fin2AId = gen2A.data.results[0]._id;
    const fin3BId = gen3B.data.results[0]._id;

    // ------------------------------------------------------------------------
    // 3. 6-STAGE APPROVAL & PUBLISHING LIFECYCLE + OFFICE STAFF STRICT ACCESS
    // ------------------------------------------------------------------------
    console.log('--- 3. HEAD TEACHER REVIEW, RETURN, APPROVE, PUBLISH & OFFICE STAFF ---');

    // Office Staff cannot see GENERATED results
    const offBefore = await apiCall('GET', `/office/published-results?academicYearId=${ay._id}`, officeStaff.token);
    const offPdfGen = await apiCall('GET', `/office/published-results/${fin1AId}/pdf`, officeStaff.token);
    test(
      offBefore.status === 200 && offBefore.data.results.length === 0 && offPdfGen.status === 403,
      'Office Staff sees 0 results and gets 403 for GENERATED final result'
    );

    // Teacher A & Teacher B submit to Head Teacher (Teacher C stays GENERATED)
    const sub1A = await apiCall('POST', '/teacher/final-results/submit', teacherA.token, {
      academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id
    });
    const sub2A = await apiCall('POST', '/teacher/final-results/submit', teacherB.token, {
      academicYearId: ay._id, classId: cls2._id, sectionId: sec2A._id
    });
    test(sub1A.status === 200 && sub2A.status === 200, 'Teacher A & B submit final results to Head Teacher');

    // Office Staff cannot see SUBMITTED_TO_HEAD_TEACHER results
    const offPdfSub = await apiCall('GET', `/office/published-results/${fin1AId}/pdf`, officeStaff.token);
    test(offPdfSub.status === 403, 'Office Staff gets 403 for SUBMITTED_TO_HEAD_TEACHER final result');

    // Head Teacher lists batches & marks 1st-A UNDER_REVIEW
    const htList = await apiCall('GET', `/head-teacher/results/batches?academicYearId=${ay._id}&type=FINAL`, htDual.token);
    const htReview = await apiCall('POST', '/head-teacher/results/review', htDual.token, {
      type: 'FINAL', academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id
    });
    test(
      htList.status === 200 && htList.data.batches.length >= 2 && htReview.status === 200,
      'Head Teacher views submitted classes and marks 1st-A as UNDER_REVIEW'
    );

    // Return requires mandatory reason (400 if blank)
    const badReturn = await apiCall('POST', '/head-teacher/results/return', htDual.token, {
      type: 'FINAL', academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id, reason: '   '
    });
    const validReturn = await apiCall('POST', '/head-teacher/results/return', htDual.token, {
      type: 'FINAL', academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id, reason: 'Update final remark'
    });
    test(
      badReturn.status === 400 && validReturn.status === 200,
      'Head Teacher return rejects blank reason (400) and returns 1st-A with reason'
    );

    // Office Staff cannot access RETURNED results
    const offPdfRet = await apiCall('GET', `/office/published-results/${fin1AId}/pdf`, officeStaff.token);
    test(offPdfRet.status === 403, 'Office Staff gets 403 for RETURNED final result');

    // Class Teacher updates remark & resubmits -> Head Teacher approves
    await apiCall('PUT', `/teacher/final-results/${fin1AId}/remark`, teacherA.token, {
      finalRemark: 'Excellent consistency throughout the year.', approve: true
    });
    const resub1A = await apiCall('POST', '/teacher/final-results/submit', teacherA.token, {
      academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id
    });
    test(resub1A.status === 200, 'Teacher A updates returned result and resubmits to Head Teacher');

    // Publish before approval blocked (400)
    const pubBeforeAppr = await apiCall('POST', '/head-teacher/results/publish', htDual.token, {
      type: 'FINAL', academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id
    });
    test(pubBeforeAppr.status === 400, 'Head Teacher cannot publish unapproved results (400)');

    // Approve 1st-A -> still NOT accessible to Office Staff until Published!
    const approve1A = await apiCall('POST', '/head-teacher/results/approve', htDual.token, {
      type: 'FINAL', academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id
    });
    const offPdfAppr = await apiCall('GET', `/office/published-results/${fin1AId}/pdf`, officeStaff.token);
    test(
      approve1A.status === 200 && offPdfAppr.status === 403,
      'Approved-but-unpublished 1st-A result remains blocked from Office Staff (403)'
    );

    // RBAC on Head Teacher publish (TEACHER and OFFICE_STAFF get 403)
    const pubByTeacher = await apiCall('POST', '/head-teacher/results/publish', teacherA.token, {
      type: 'FINAL', academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id
    });
    const pubByOffice = await apiCall('POST', '/head-teacher/results/publish', officeStaff.token, {
      type: 'FINAL', academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id
    });
    test(pubByTeacher.status === 403 && pubByOffice.status === 403, 'TEACHER and OFFICE_STAFF blocked from Head Teacher publish route (403)');

    // Head Teacher officially publishes 1st-A
    const publish1A = await apiCall('POST', '/head-teacher/results/publish', htDual.token, {
      type: 'FINAL', academicYearId: ay._id, classId: cls1._id, sectionId: sec1A._id
    });
    test(publish1A.status === 200 && publish1A.data.publishedCount === 1, 'Head Teacher officially publishes 1st-A Final Result');

    // Office Staff can now list ONLY 1st-A (NOT 2nd-A or 3rd-B) and download both student & class PDFs!
    const offAfter = await apiCall('GET', `/office/published-results?academicYearId=${ay._id}&type=FINAL`, officeStaff.token);
    const offPdfPub = await apiCall('GET', `/office/published-results/${fin1AId}/pdf?type=FINAL`, officeStaff.token);
    const offClassPdf = await apiCall(
      'GET',
      `/office/published-results/class-report/pdf?type=FINAL&academicYearId=${ay._id}&classId=${cls1._id}&sectionId=${sec1A._id}`,
      officeStaff.token
    );
    const offUnpub2APdf = await apiCall('GET', `/office/published-results/${fin2AId}/pdf?type=FINAL`, officeStaff.token);
    const offUnpub3BPdf = await apiCall('GET', `/office/published-results/${fin3BId}/pdf?type=FINAL`, officeStaff.token);

    test(
      offAfter.status === 200 &&
        offAfter.data.results.length === 1 &&
        String(offAfter.data.results[0]._id) === String(fin1AId),
      'Office Staff list contains ONLY officially PUBLISHED 1st-A result (2nd-A & 3rd-B hidden)'
    );
    test(
      offPdfPub.status === 200 && offPdfPub.pdfBuffer.slice(0, 4).toString() === '%PDF',
      'Office Staff downloads individual published student marksheet A4 PDF'
    );
    test(
      offClassPdf.status === 200 && offClassPdf.pdfBuffer.slice(0, 4).toString() === '%PDF',
      'Office Staff downloads class-wise published result register A4 PDF'
    );
    test(
      offUnpub2APdf.status === 403 && offUnpub3BPdf.status === 403,
      'Office Staff remains blocked (403) from downloading unpublished 2nd-A & 3rd-B PDFs'
    );

    const offNotifCount = await NotificationInfo.countDocuments({
      schoolId: TEST_SCHOOL_ID,
      targetUserRef: officeStaff.user._id,
      title: 'New Final Results Published'
    });
    test(offNotifCount >= 1, 'Office Staff receives publication notification');

    console.log(`\n========================================================================`);
    console.log(`  ALL ${passed}/${total} REQUIRED CORRECTIONS E2E TESTS PASSED!`);
    console.log(`========================================================================`);
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
}

runRequiredCorrectionsTests().catch((err) => {
  console.error('CORRECTIONS E2E ERROR:', err);
  process.exit(1);
});
