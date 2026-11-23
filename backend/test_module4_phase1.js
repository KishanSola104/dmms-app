/**
 * DMMS Module 4 – Phase 1 Test Suite
 * Student Master Models, Student Admission, Initial Enrollment,
 * Guardian Details, Capacity Checks, Auto & Manual Admission/Roll Numbers,
 * School Data Isolation, and Regression Testing.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const API_BASE = 'http://127.0.0.1:8000/api';

async function runModule4Phase1Tests() {
  console.log('========================================================================');
  console.log('  DMMS MODULE 4 – PHASE 1 (STUDENT ADMISSION & ENROLLMENT) TEST SUITE');
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

  // Connect directly to DB for fixture configuration & verification
  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');

  const ts = Date.now();
  const schoolEmail = `m4p1.school.${ts}@gmail.com`;
  const adminEmail = `m4p1.admin.${ts}@gmail.com`;

  // ---------------------------------------------------------
  // 1. School Registration & Authentication
  // ---------------------------------------------------------
  console.log('--- 1. School Registration & Authentication ---');
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'St. Xavier International School',
      establishedYear: 2010,
      email: schoolEmail,
      mobileNumber: '9876543210',
      address: '12 Mount Abu Road, Ahmedabad',
      websiteUrl: 'https://stxavier.edu',
      contactPersons: [
        { fullName: 'Francis Xavier', email: `francis.${ts}@gmail.com`, mobileNumber: '9876500001', designation: 'Director' },
        { fullName: 'Ignatius Loyola', email: `ignatius.${ts}@gmail.com`, mobileNumber: '9876500002', designation: 'Principal' }
      ],
      adminFullName: 'Anthony Edward',
      adminEmail: adminEmail,
      adminMobile: '9876511111',
      adminPassword: 'Password@123',
      confirmPassword: 'Password@123',
      termsAccepted: true
    })
  }).then((r) => r.json());

  test(regRes.success === true, 'School registered successfully');
  const schoolId = regRes.data.schoolId;
  const adminId = regRes.data.adminId;
  const schoolDoc = await mongoose.connection.db.collection('school_info').findOne({ schoolId });
  const schoolRef = schoolDoc._id;

  // Set known test password
  const testPw = 'Admin@Xavier2026';
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
  // 2. Setup Academic Year, Classes & Sections
  // ---------------------------------------------------------
  console.log('\n--- 2. Academic Setup (AY, Classes, Sections) ---');
  const curYear = new Date().getFullYear();

  // Active Academic Year
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
  const ayId = ayRes.academicYear._id;

  // Insert a Completed Academic Year directly in database (representing a legacy finished year)
  const compInsert = await mongoose.connection.db.collection('academic_year_info').insertOne({
    schoolRef: schoolRef,
    schoolId: schoolId,
    yearCode: `${curYear - 1}-${curYear}`,
    yearName: `Academic Year ${curYear - 1}-${curYear}`,
    startDate: new Date(`${curYear - 1}-06-01`),
    endDate: new Date(`${curYear}-05-31`),
    isCurrent: false,
    status: 'COMPLETED',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  const compAyId = compInsert.insertedId;

  // Class 1 (Class 10)
  const c1Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ classCode: 'CLS-10', className: 'Class 10', numberOfSections: 2 })
  }).then((r) => r.json());
  const c1Id = c1Res.class._id;

  // Class 2 (Class 9)
  const c2Res = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ classCode: 'CLS-9', className: 'Class 9', numberOfSections: 1 })
  }).then((r) => r.json());
  const c2Id = c2Res.class._id;

  // Create Section A for Class 10 with maxCapacity = 2
  const secACreate = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ classId: c1Id, sectionCode: 'A', sectionName: 'Section A', maxCapacity: 2 })
  }).then((r) => r.json());
  test(secACreate.success === true, 'Section 10-A created');
  const secAId = secACreate.section._id;

  // Create Section B for Class 10 with maxCapacity = 30
  const secBCreate = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ classId: c1Id, sectionCode: 'B', sectionName: 'Section B', maxCapacity: 30 })
  }).then((r) => r.json());
  test(secBCreate.success === true, 'Section 10-B created');
  const secBId = secBCreate.section._id;

  // Create Section A for Class 9 with maxCapacity = 30
  const c2SecCreate = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ classId: c2Id, sectionCode: 'A', sectionName: 'Section A', maxCapacity: 30 })
  }).then((r) => r.json());
  test(c2SecCreate.success === true, 'Section 9-A created');
  const c2SecId = c2SecCreate.section._id;

  // ---------------------------------------------------------
  // 3. Admission Number Auto-Generation Helper
  // ---------------------------------------------------------
  console.log('\n--- 3. Testing Next Admission Number Generator ---');
  const autoAdmRes = await fetch(`${API_BASE}/admin/students/next-admission-number`, {
    headers: adminHeaders
  }).then((r) => r.json());
  test(autoAdmRes.success === true, 'Successfully called next admission number endpoint');
  test(
    autoAdmRes.nextAdmissionNumber.startsWith(`ADM-${curYear}-`),
    `Generated number matches format ADM-${curYear}-NNNN (Got: ${autoAdmRes.nextAdmissionNumber})`
  );

  // ---------------------------------------------------------
  // 4. Student Admission with Manual Admission Number
  // ---------------------------------------------------------
  console.log('\n--- 4. Testing Manual Admission Number & Initial Enrollment ---');
  const manualAdmNo = `ADM-XAV-${curYear}-001`;

  const adm1Res = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      admissionNumberMethod: 'MANUAL',
      admissionNumber: manualAdmNo,
      firstName: 'Aarav',
      middleName: 'Rajesh',
      lastName: 'Sharma',
      dateOfBirth: '2010-04-15',
      gender: 'MALE',
      contact: { phone: '9876543210', email: 'aarav.sharma@example.com' },
      guardianDetails: [
        {
          fullName: 'Rajesh Sharma',
          relationship: 'FATHER',
          mobileNumber: '9876500111',
          email: 'rajesh.sharma@example.com',
          isPrimaryContact: true
        },
        {
          fullName: 'Sunita Sharma',
          relationship: 'MOTHER',
          mobileNumber: '9876500112',
          email: 'sunita.sharma@example.com',
          isPrimaryContact: false
        }
      ],
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: secAId,
      rollNumberMethod: 'MANUAL',
      rollNumber: '1',
      admissionDate: `${curYear}-06-15`,
      remarks: 'First student admitted with manual admission number'
    })
  }).then((r) => r.json());

  if (!adm1Res.success) {
    console.error('adm1Res Error:', adm1Res);
  }
  test(adm1Res.success === true, 'Student 1 admitted successfully with manual admission number');
  test(adm1Res.student.admissionNumber === manualAdmNo, 'Admission number correctly saved');
  test(adm1Res.student.status === 'ACTIVE', 'Student master status is ACTIVE');
  test(adm1Res.enrollment.status === 'ACTIVE', 'Student enrollment status is ACTIVE');
  test(adm1Res.enrollment.rollNumber === '1', 'Roll number 1 correctly recorded');
  const student1Id = adm1Res.student._id;

  // Verify in MongoDB: student_info, student_enrollment_info, student_enrollment_history_info
  const sDoc = await mongoose.connection.db.collection('student_info').findOne({ _id: new mongoose.Types.ObjectId(student1Id) });
  test(sDoc !== null && sDoc.schoolId === schoolId, 'student_info record verified in database');

  const eDoc = await mongoose.connection.db.collection('student_enrollment_info').findOne({ studentRef: new mongoose.Types.ObjectId(student1Id) });
  test(eDoc !== null && eDoc.classRef.toString() === c1Id.toString(), 'student_enrollment_info verified in database');

  const hDoc = await mongoose.connection.db.collection('student_enrollment_history_info').findOne({ studentRef: new mongoose.Types.ObjectId(student1Id) });
  test(hDoc !== null && hDoc.changeType === 'ADMISSION', 'student_enrollment_history_info created with ADMISSION type');

  // ---------------------------------------------------------
  // 5. Duplicate Admission Number Rejection
  // ---------------------------------------------------------
  console.log('\n--- 5. Duplicate Admission Number Prevention ---');
  const dupAdmRes = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      admissionNumberMethod: 'MANUAL',
      admissionNumber: manualAdmNo, // Same admission number!
      firstName: 'Vivaan',
      lastName: 'Patel',
      dateOfBirth: '2010-08-20',
      gender: 'MALE',
      guardianDetails: [{ fullName: 'Kirit Patel', relationship: 'FATHER', mobileNumber: '9876500222', isPrimaryContact: true }],
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: secAId
    })
  });
  test(dupAdmRes.status === 409 || dupAdmRes.status === 400, 'Duplicate admission number strictly rejected (HTTP 409/400)');

  // ---------------------------------------------------------
  // 6. Automatic Admission Number Generation During Admission
  // ---------------------------------------------------------
  console.log('\n--- 6. Testing Automatic Admission Number Generation on Admission ---');
  const adm2Res = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      admissionNumberMethod: 'AUTO',
      firstName: 'Diya',
      lastName: 'Mehta',
      dateOfBirth: '2010-11-05',
      gender: 'FEMALE',
      guardianDetails: [{ fullName: 'Sanjay Mehta', relationship: 'FATHER', mobileNumber: '9876500333', isPrimaryContact: true }],
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: secAId,
      rollNumberMethod: 'AUTO',
      admissionDate: `${curYear}-06-16`
    })
  }).then((r) => r.json());

  test(adm2Res.success === true, 'Student 2 admitted successfully with AUTO admission number');
  test(adm2Res.student.admissionNumber.startsWith(`ADM-${curYear}-`), 'Auto admission number correctly formatted');
  test(adm2Res.student.admissionNumber !== manualAdmNo, 'Auto admission number avoids collisions');
  test(adm2Res.enrollment.rollNumber === '2', 'Auto roll number assigned sequentially as 2');

  // ---------------------------------------------------------
  // 7. Validation: Required Fields, Dates, Genders & Guardians
  // ---------------------------------------------------------
  console.log('\n--- 7. Validations: Missing Fields, Invalid Dates & Guardians ---');

  // 7.1 Missing First Name
  const noNameRes = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      firstName: '   ',
      lastName: 'Shah',
      dateOfBirth: '2010-01-01',
      gender: 'MALE',
      guardianDetails: [{ fullName: 'G', relationship: 'FATHER', mobileNumber: '9876543210' }],
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: secBId
    })
  });
  test(noNameRes.status === 400, 'Rejected admission with empty first name');

  // 7.2 Future Date of Birth
  const futureDobRes = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      firstName: 'Rohan',
      lastName: 'Shah',
      dateOfBirth: '2030-01-01', // Future date!
      gender: 'MALE',
      guardianDetails: [{ fullName: 'G', relationship: 'FATHER', mobileNumber: '9876543210' }],
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: secBId
    })
  });
  test(futureDobRes.status === 400, 'Rejected admission with future date of birth');

  // 7.3 Invalid Gender
  const badGenderRes = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      firstName: 'Rohan',
      lastName: 'Shah',
      dateOfBirth: '2010-01-01',
      gender: 'ALIEN',
      guardianDetails: [{ fullName: 'G', relationship: 'FATHER', mobileNumber: '9876543210' }],
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: secBId
    })
  });
  test(badGenderRes.status === 400, 'Rejected admission with invalid gender value');

  // 7.4 Missing Guardian Details
  const noGuardianRes = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      firstName: 'Rohan',
      lastName: 'Shah',
      dateOfBirth: '2010-01-01',
      gender: 'MALE',
      guardianDetails: [], // Empty!
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: secBId
    })
  });
  test(noGuardianRes.status === 400, 'Rejected admission with empty guardian details');

  // ---------------------------------------------------------
  // 8. Academic Integrity: Class, Section & Academic Year
  // ---------------------------------------------------------
  console.log('\n--- 8. Academic Integrity Checks ---');

  // 8.1 Section from Class 9 passed with Class 10
  const mismatchRes = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      firstName: 'Isha',
      lastName: 'Joshi',
      dateOfBirth: '2010-03-25',
      gender: 'FEMALE',
      guardianDetails: [{ fullName: 'Manoj Joshi', relationship: 'FATHER', mobileNumber: '9876500444' }],
      academicYearRef: ayId,
      classRef: c1Id, // Class 10
      sectionRef: c2SecId // Section of Class 9!
    })
  });
  test(mismatchRes.status === 400, 'Rejected section belonging to a different class');

  // 8.2 Completed Academic Year
  const compYearRes = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      firstName: 'Isha',
      lastName: 'Joshi',
      dateOfBirth: '2010-03-25',
      gender: 'FEMALE',
      guardianDetails: [{ fullName: 'Manoj Joshi', relationship: 'FATHER', mobileNumber: '9876500444' }],
      academicYearRef: compAyId, // COMPLETED status!
      classRef: c1Id,
      sectionRef: secBId
    })
  });
  test(compYearRes.status === 400, 'Prevented admission into completed academic year');

  // ---------------------------------------------------------
  // 9. Section Capacity Enforcement
  // ---------------------------------------------------------
  console.log('\n--- 9. Section Maximum Capacity Enforcement ---');
  // Section A capacity is set to 2. Student 1 and Student 2 are already enrolled in Section A!
  const capOverRes = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      firstName: 'Ananya',
      lastName: 'Desai',
      dateOfBirth: '2010-05-18',
      gender: 'FEMALE',
      guardianDetails: [{ fullName: 'Kavita Desai', relationship: 'MOTHER', mobileNumber: '9876500555' }],
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: secAId // Section A is full (2/2)!
    })
  });
  test(capOverRes.status === 400, 'Prevented admission when section maximum capacity is reached');

  // Verify that Section B (which has capacity) succeeds:
  const secBOkRes = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      firstName: 'Ananya',
      lastName: 'Desai',
      dateOfBirth: '2010-05-18',
      gender: 'FEMALE',
      guardianDetails: [{ fullName: 'Kavita Desai', relationship: 'MOTHER', mobileNumber: '9876500555' }],
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: secBId, // Section B has capacity
      rollNumberMethod: 'AUTO'
    })
  }).then((r) => r.json());
  test(secBOkRes.success === true, 'Admitted student into Section B where capacity is available');

  // ---------------------------------------------------------
  // 10. Roll Number Conflict Prevention
  // ---------------------------------------------------------
  console.log('\n--- 10. Roll Number Uniqueness Enforcement ---');
  // In Section B, student Ananya has roll number 1. Attempt to admit another student into Section B with manual roll number 1!
  const dupRollRes = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      firstName: 'Karan',
      lastName: 'Kapoor',
      dateOfBirth: '2010-09-09',
      gender: 'MALE',
      guardianDetails: [{ fullName: 'Anil Kapoor', relationship: 'FATHER', mobileNumber: '9876500666' }],
      academicYearRef: ayId,
      classRef: c1Id,
      sectionRef: secBId,
      rollNumberMethod: 'MANUAL',
      rollNumber: '1' // Duplicate roll in Section B!
    })
  });
  test(dupRollRes.status === 409 || dupRollRes.status === 400, 'Duplicate roll number in same section rejected (HTTP 409/400)');

  // ---------------------------------------------------------
  // 11. Multi-School Data Isolation
  // ---------------------------------------------------------
  console.log('\n--- 11. Multi-School Data Isolation Verification ---');
  const ts2 = Date.now() + 200;
  const schoolBRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Delhi Public Academy',
      establishedYear: 2015,
      email: `m4p1.schoolb.${ts2}@gmail.com`,
      mobileNumber: '9123456789',
      address: '88 MG Road, Vadodara',
      websiteUrl: 'https://dpa.edu',
      contactPersons: [
        { fullName: 'Pramod Kumar', email: `pramod.${ts2}@gmail.com`, mobileNumber: '9123400001', designation: 'Trustee' },
        { fullName: 'Alka Kumar', email: `alka.${ts2}@gmail.com`, mobileNumber: '9123400002', designation: 'Secretary' }
      ],
      adminFullName: 'Vikram Seth',
      adminEmail: `vseth.${ts2}@gmail.com`,
      adminMobile: '9123411111',
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

  // School B attempts to admit student using School A's class & section
  const crossAdmRes = await fetch(`${API_BASE}/admin/students/admission`, {
    method: 'POST',
    headers: adminHeadersB,
    body: JSON.stringify({
      firstName: 'Cross',
      lastName: 'Hacker',
      dateOfBirth: '2010-01-01',
      gender: 'MALE',
      guardianDetails: [{ fullName: 'G', relationship: 'FATHER', mobileNumber: '9876543210' }],
      academicYearRef: ayId, // School A's AY
      classRef: c1Id,        // School A's Class
      sectionRef: secBId     // School A's Section
    })
  });
  test(crossAdmRes.status === 404 || crossAdmRes.status === 400, 'Cross-school student admission rejected');

  // School B auto-generation is independent and starts from 1 for School B
  const sBAdmNoRes = await fetch(`${API_BASE}/admin/students/next-admission-number`, {
    headers: adminHeadersB
  }).then((r) => r.json());
  test(sBAdmNoRes.success === true, 'School B can query its independent admission number');

  // ---------------------------------------------------------
  // 12. Regression Testing for Existing Modules 1, 2, 3
  // ---------------------------------------------------------
  console.log('\n--- 12. Regression Testing for Previous Modules ---');

  // Module 2 User management intact
  const uList = await fetch(`${API_BASE}/admin/users`, { headers: adminHeaders }).then((r) => r.json());
  test(uList.success === true && Array.isArray(uList.users), 'Module 2 User management intact');

  // Module 2 Academic years intact
  const ayList = await fetch(`${API_BASE}/admin/academic-years`, { headers: adminHeaders }).then((r) => r.json());
  test(ayList.success === true && Array.isArray(ayList.academicYears), 'Module 2 Academic year management intact');

  // Module 2 Classes intact
  const clsList = await fetch(`${API_BASE}/admin/classes`, { headers: adminHeaders }).then((r) => r.json());
  test(clsList.success === true && Array.isArray(clsList.classes), 'Module 2 Class management intact');

  // Module 3 Class Subjects intact
  const csList = await fetch(`${API_BASE}/admin/class-subjects?academicYearRef=${ayId}&classRef=${c1Id}`, { headers: adminHeaders }).then((r) => r.json());
  test(csList.success === true, 'Module 3 Class-Subject allocation intact');

  console.log('\n========================================================================');
  console.log(`  ALL ${passed}/${total} MODULE 4 PHASE 1 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runModule4Phase1Tests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
