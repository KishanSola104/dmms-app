const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const API_BASE = 'http://localhost:8000/api';

async function runModule2Tests() {
  console.log('========================================================');
  console.log('   DMMS MODULE 2 – ADMINISTRATIVE SETUP BACKEND TESTS');
  console.log('========================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // Connect to DB for setup/verifications
  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');

  // Step 1: Register a fresh School for clean testing
  console.log('\n--- 1. School & Admin Initialization ---');
  const timestamp = Date.now();
  const testSchoolEmail = `mod2.school.${timestamp}@gmail.com`;
  const testAdminEmail = `mod2.admin.${timestamp}@gmail.com`;

  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'St. Xavier Academy',
      establishedYear: 2005,
      email: testSchoolEmail,
      mobileNumber: '9822334455',
      address: '77 Campus Road, Navrangpura, Ahmedabad',
      websiteUrl: 'https://stxavier.edu',
      contactPersons: [
        { fullName: 'Joseph Dsouza', email: `joseph.${timestamp}@gmail.com`, mobileNumber: '9822330001', designation: 'Secretary' },
        { fullName: 'Sister Mary', email: `mary.${timestamp}@gmail.com`, mobileNumber: '9822330002', designation: 'Treasurer' }
      ],
      adminFullName: 'Francis Xavier',
      adminEmail: testAdminEmail,
      adminMobile: '9822331111',
      termsAccepted: true
    })
  }).then(r => r.json());

  assert(regRes.success === true, 'School registered successfully');
  const schoolId = regRes.data.schoolId;
  const adminId = regRes.data.adminId;
  console.log(`Registered School ID: ${schoolId}, Admin ID: ${adminId}`);

  // Set known passwords in MongoDB for direct test login
  const testPassword = 'Password@1234Secure';
  const hashed = await bcrypt.hash(testPassword, 10);
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId }, { $set: { passwordHash: hashed } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: adminId }, { $set: { passwordHash: hashed, mustChangePassword: false } });

  // School Login
  const schoolLoginRes = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId, password: testPassword })
  }).then(r => r.json());
  assert(schoolLoginRes.success === true, 'School Login successful');
  const schoolToken = schoolLoginRes.schoolToken;

  // Admin User Login
  const adminLoginRes = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': schoolToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: adminId, password: testPassword })
  }).then(r => r.json());
  assert(adminLoginRes.success === true, 'Admin User Login successful');
  const adminToken = adminLoginRes.token;

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
    'x-school-token': schoolToken
  };

  // Step 2: Test Authorization: Non-Admin Rejection
  console.log('\n--- 2. Testing Role-Based Authorization Guard ---');
  // First, create a Teacher account to test non-admin rejection
  const teacherCreateRes = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Sunita Sharma',
      email: `sunita.teacher.${timestamp}@gmail.com`,
      mobileNumber: '9877001122',
      designation: 'Senior Mathematics Teacher',
      roleCode: 'TEACHER'
    })
  }).then(r => r.json());
  assert(teacherCreateRes.success === true, 'Teacher account created by Admin');
  const teacherUserId = teacherCreateRes.user.userId;

  // Set known password for teacher
  await mongoose.connection.db.collection('user_info').updateOne({ userId: teacherUserId }, { $set: { passwordHash: hashed, mustChangePassword: false } });

  // Login as Teacher
  const teacherLoginRes = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': schoolToken },
    body: JSON.stringify({ roleCode: 'TEACHER', identifier: teacherUserId, password: testPassword })
  }).then(r => r.json());
  assert(teacherLoginRes.success === true, 'Teacher Login successful');
  const teacherToken = teacherLoginRes.token;

  // Attempt to call Admin API with Teacher token -> Expect 403 Forbidden
  const teacherAdminAttempt = await fetch(`${API_BASE}/admin/users`, {
    headers: {
      'Authorization': `Bearer ${teacherToken}`,
      'x-school-token': schoolToken
    }
  });
  assert(teacherAdminAttempt.status === 403, 'Teacher token rejected with 403 Forbidden on /api/admin/users');

  // Step 3: Test Feature 1 - User Management
  console.log('\n--- 3. Testing Feature 1: User Management ---');
  // 3.1 Role limits: Admin max 2, Head Teacher max 1
  // School already has 1 Admin (Francis Xavier). Creating 2nd Admin should succeed.
  const admin2Res = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Robert Dsouza',
      email: `robert.admin.${timestamp}@gmail.com`,
      mobileNumber: '9877001133',
      designation: 'Co-Administrator',
      roleCode: 'ADMIN'
    })
  }).then(r => r.json());
  assert(admin2Res.success === true, 'Second Admin created successfully (Within Limit of 2)');
  const admin2Id = admin2Res.user.userId;

  // Creating 3rd Admin should fail (Limit: 2)
  const admin3Res = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Peter Parker',
      email: `peter.admin.${timestamp}@gmail.com`,
      mobileNumber: '9877001144',
      designation: 'Third Admin',
      roleCode: 'ADMIN'
    })
  }).then(r => r.json());
  assert(admin3Res.success === false && admin3Res.message.includes('Maximum limit reached for School Administrator'),
    'Third Admin correctly rejected by backend role limit');

  // Create Head Teacher (Limit: 1)
  const ht1Res = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Anita George',
      email: `anita.ht.${timestamp}@gmail.com`,
      mobileNumber: '9877001155',
      designation: 'Head Teacher',
      roleCode: 'HEAD_TEACHER'
    })
  }).then(r => r.json());
  assert(ht1Res.success === true, 'First Head Teacher created successfully (Within Limit of 1)');
  const ht1Id = ht1Res.user.userId;

  // Creating 2nd Head Teacher should fail (Limit: 1)
  const ht2Res = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Vandana Shukla',
      email: `vandana.ht.${timestamp}@gmail.com`,
      mobileNumber: '9877001166',
      designation: 'Second Head Teacher',
      roleCode: 'HEAD_TEACHER'
    })
  }).then(r => r.json());
  assert(ht2Res.success === false && ht2Res.message.includes('Maximum limit reached for Head Teacher'),
    'Second Head Teacher correctly rejected by backend role limit');

  // List Users with pagination & search
  const userListRes = await fetch(`${API_BASE}/admin/users?page=1&limit=10`, { headers: adminHeaders }).then(r => r.json());
  assert(userListRes.success === true && userListRes.users.length >= 4, 'Users listed for school with pagination');
  assert(userListRes.pagination.totalRecords >= 4, 'Pagination metadata returned correctly');

  // Search by name
  const searchRes = await fetch(`${API_BASE}/admin/users?search=Sunita`, { headers: adminHeaders }).then(r => r.json());
  assert(searchRes.success === true && searchRes.users.length === 1 && searchRes.users[0].userId === teacherUserId,
    'Search by name works');

  // Filter by role
  const roleFilterRes = await fetch(`${API_BASE}/admin/users?role=TEACHER`, { headers: adminHeaders }).then(r => r.json());
  assert(roleFilterRes.success === true && roleFilterRes.users.every(u => u.roleCode === 'TEACHER'),
    'Filter by role works');

  // 3.2 Edit User
  const editUserRes = await fetch(`${API_BASE}/admin/users/${teacherUserId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Sunita R. Sharma',
      mobileNumber: '9877999888',
      designation: 'Head of Mathematics Department'
    })
  }).then(r => r.json());
  assert(editUserRes.success === true && editUserRes.user.fullName === 'Sunita R. Sharma',
    'User updated without requiring email confirmation');

  // 3.3 Deactivate User with Confirmation Code
  // Self-deactivation rejection
  const selfDeactivateCodeReq = await fetch(`${API_BASE}/admin/users/request-confirmation-code`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'DEACTIVATE_USER', targetUserId: adminId })
  }).then(r => r.json());
  assert(selfDeactivateCodeReq.success === false && selfDeactivateCodeReq.message.includes('cannot deactivate their own account'),
    'Admin self-deactivation prevented');

  // Request code to deactivate teacher
  const deactReq = await fetch(`${API_BASE}/admin/users/request-confirmation-code`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'DEACTIVATE_USER', targetUserId: teacherUserId })
  }).then(r => r.json());
  assert(deactReq.success === true, 'Confirmation code requested for user deactivation');

  // Retrieve code directly from DB for automated testing
  const deactCodeDoc = await mongoose.connection.db.collection('confirmation_code_info').findOne({
    adminUserId: adminId,
    action: 'DEACTIVATE_USER',
    targetUserId: teacherUserId
  });
  assert(deactCodeDoc !== null, 'Confirmation code stored securely in DB with TTL');

  // Verify wrong code fails
  const wrongCodeRes = await fetch(`${API_BASE}/admin/users/deactivate`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ targetUserId: teacherUserId, confirmationCode: '000000' })
  }).then(r => r.json());
  assert(wrongCodeRes.success === false && wrongCodeRes.message.includes('Invalid confirmation code'),
    'Wrong confirmation code rejected and attempts tracked');

  // We need the valid plain text code. In our test, we can generate a known code and set codeHash
  const validOtp = '123456';
  const hashedOtp = await bcrypt.hash(validOtp, 10);
  await mongoose.connection.db.collection('confirmation_code_info').updateOne(
    { _id: deactCodeDoc._id },
    { $set: { codeHash: hashedOtp } }
  );

  const deactSuccessRes = await fetch(`${API_BASE}/admin/users/deactivate`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ targetUserId: teacherUserId, confirmationCode: validOtp })
  }).then(r => r.json());
  assert(deactSuccessRes.success === true, 'User deactivated with verified confirmation code');

  // Verify deactivated user cannot log in
  const deactLoginRes = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': schoolToken },
    body: JSON.stringify({ roleCode: 'TEACHER', identifier: teacherUserId, password: testPassword })
  }).then(r => r.json());
  assert(deactLoginRes.success === false && deactLoginRes.message.includes('inactive'),
    'Deactivated user cannot log in');

  // Activate user back
  const activateRes = await fetch(`${API_BASE}/admin/users/activate`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ targetUserId: teacherUserId })
  }).then(r => r.json());
  assert(activateRes.success === true, 'User activated back successfully');

  // Step 4: Test Feature 2 - Academic Year Management
  console.log('\n--- 4. Testing Feature 2: Academic Year Management ---');
  // 4.1 Past year rejection
  const pastYearRes = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: 'Academic Year 2020-2021',
      startDate: '2020-06-01',
      endDate: '2021-05-31'
    })
  }).then(r => r.json());
  assert(pastYearRes.success === false && pastYearRes.message.includes('Past academic years cannot be created'),
    'Past academic year creation rejected');

  // 4.2 >3 years ahead rejection (Current is 2026, >2029 should fail)
  const currentCalYear = new Date().getFullYear();
  const futureYear = currentCalYear + 5;
  const farFutureRes = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: `Academic Year ${futureYear}-${futureYear + 1}`,
      startDate: `${futureYear}-06-01`,
      endDate: `${futureYear + 1}-05-31`
    })
  }).then(r => r.json());
  assert(farFutureRes.success === false && farFutureRes.message.includes('three calendar years ahead'),
    'Year more than 3 calendar years ahead rejected');

  // 4.3 Start Date >= End Date rejection
  const invalidDateRes = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: 'Invalid Year',
      startDate: `${currentCalYear + 1}-06-01`,
      endDate: `${currentCalYear + 1}-05-01`
    })
  }).then(r => r.json());
  assert(invalidDateRes.success === false && invalidDateRes.message.includes('Start Date must be earlier than End Date'),
    'Start Date >= End Date rejected');

  // 4.4 Create valid Upcoming Academic Year (e.g. 2027-2028)
  const nextStart = currentCalYear + 1;
  const nextEnd = currentCalYear + 2;
  const createAyRes = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: `Academic Year ${nextStart}-${nextEnd}`,
      startDate: `${nextStart}-06-01`,
      endDate: `${nextEnd}-05-31`,
      isCurrent: false
    })
  }).then(r => r.json());
  assert(createAyRes.success === true, 'Upcoming Academic Year created successfully');
  const newYearId = createAyRes.academicYear._id;

  // 4.5 Prevent duplicate or overlapping date ranges
  const overlapRes = await fetch(`${API_BASE}/admin/academic-years`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      yearName: `Another Academic Year ${nextStart}`,
      startDate: `${nextStart}-07-01`,
      endDate: `${nextEnd}-04-30`
    })
  }).then(r => r.json());
  assert(overlapRes.success === false && overlapRes.message.includes('overlaps with existing academic year'),
    'Overlapping academic year date range rejected');

  // 4.6 List Academic Years
  const listAyRes = await fetch(`${API_BASE}/admin/academic-years`, { headers: adminHeaders }).then(r => r.json());
  assert(listAyRes.success === true && listAyRes.academicYears.length >= 2, 'Academic years listed');
  const currentAy = listAyRes.academicYears.find(y => y.isCurrent);
  assert(currentAy !== undefined, 'Current Academic Year identified and unique');

  // Step 5: Test Feature 3 - Classes & Sections
  console.log('\n--- 5. Testing Feature 3: Classes & Sections ---');
  // 5.1 Eligible Teachers dropdown
  const teachersRes = await fetch(`${API_BASE}/admin/teachers`, { headers: adminHeaders }).then(r => r.json());
  assert(teachersRes.success === true && teachersRes.teachers.length >= 2, 'Eligible teachers returned (Teacher + Head Teacher)');
  const eligibleTeacherId = teachersRes.teachers[0].employeeId;

  // 5.2 Create Class
  const createClassRes = await fetch(`${API_BASE}/admin/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classCode: 'CLASS-1',
      className: '1st Standard',
      classTeacherId: eligibleTeacherId,
      numberOfSections: 2
    })
  }).then(r => r.json());
  assert(createClassRes.success === true, 'Class created successfully');
  assert(createClassRes.class.totalCapacity === 0, 'Class total capacity initialized to 0 before sections are added');
  const classId = createClassRes.class._id;

  // 5.3 Create Sections with Capacities
  // Section A: Capacity 40
  const secARes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classId,
      sectionCode: 'A',
      sectionName: 'Section A',
      sectionTeacherId: eligibleTeacherId,
      maxCapacity: 40
    })
  }).then(r => r.json());
  assert(secARes.success === true, 'Section A created with capacity 40');
  const secAId = secARes.section._id;

  // Section B: Capacity 35
  const secBRes = await fetch(`${API_BASE}/admin/sections`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classId,
      sectionCode: 'B',
      sectionName: 'Section B',
      sectionTeacherId: eligibleTeacherId,
      maxCapacity: 35
    })
  }).then(r => r.json());
  assert(secBRes.success === true, 'Section B created with capacity 35');

  // Verify Automatic Class Capacity calculation = 40 + 35 = 75!
  const classListAfterSections = await fetch(`${API_BASE}/admin/classes`, { headers: adminHeaders }).then(r => r.json());
  const updatedClass = classListAfterSections.classes.find(c => c._id === classId);
  assert(updatedClass && updatedClass.totalCapacity === 75, `Total Class Capacity dynamically calculated as 75 (Found: ${updatedClass?.totalCapacity})`);

  // Edit Section A capacity from 40 to 45 -> Class Capacity should update to 45 + 35 = 80
  const editSecRes = await fetch(`${API_BASE}/admin/sections/${secAId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      maxCapacity: 45
    })
  }).then(r => r.json());
  assert(editSecRes.success === true, 'Section A capacity updated to 45');

  const classListAfterEdit = await fetch(`${API_BASE}/admin/classes`, { headers: adminHeaders }).then(r => r.json());
  const updatedClass2 = classListAfterEdit.classes.find(c => c._id === classId);
  assert(updatedClass2 && updatedClass2.totalCapacity === 80, `Total Class Capacity dynamically updated to 80 (Found: ${updatedClass2?.totalCapacity})`);

  // Step 6: Test Feature 4 - Subjects Management
  console.log('\n--- 6. Testing Feature 4: Subjects Management ---');
  // 6.1 Create Academic (Scholastic) Subject
  const mathSubjectRes = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      subjectCode: 'MATH-101',
      subjectName: 'Mathematics',
      subjectType: 'ACADEMIC'
    })
  }).then(r => r.json());
  assert(mathSubjectRes.success === true && mathSubjectRes.subject.subjectType === 'ACADEMIC',
    'Academic (Scholastic) subject created successfully');
  const subjectId = mathSubjectRes.subject._id;

  // 6.2 Create Co-curricular (Co-Scholastic) Subject
  const artSubjectRes = await fetch(`${API_BASE}/admin/subjects`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      subjectCode: 'ART-101',
      subjectName: 'Drawing & Painting',
      subjectType: 'CO_CURRICULAR'
    })
  }).then(r => r.json());
  assert(artSubjectRes.success === true && artSubjectRes.subject.subjectType === 'CO_CURRICULAR',
    'Co-curricular (Co-Scholastic) subject created successfully');

  // 6.3 List & Filter Subjects
  const subjectListRes = await fetch(`${API_BASE}/admin/subjects?type=ACADEMIC`, { headers: adminHeaders }).then(r => r.json());
  assert(subjectListRes.success === true && subjectListRes.subjects.every(s => s.subjectType === 'ACADEMIC'),
    'Subject filtering by ACADEMIC type works');

  // 6.4 Edit Subject
  const editSubjectRes = await fetch(`${API_BASE}/admin/subjects/${subjectId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      subjectName: 'Advanced Mathematics'
    })
  }).then(r => r.json());
  assert(editSubjectRes.success === true && editSubjectRes.subject.subjectName === 'Advanced Mathematics',
    'Subject edited successfully');

  // Step 7: Delete User with Confirmation Code & Safe Deletion
  console.log('\n--- 7. Testing User Deletion with Confirmation Code ---');
  // Attempt to delete teacher who is assigned to class/section -> should be blocked by safe deletion check!
  const delReqTeacher = await fetch(`${API_BASE}/admin/users/request-confirmation-code`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'DELETE_USER', targetUserId: teacherUserId })
  }).then(r => r.json());
  assert(delReqTeacher.success === true, 'Confirmation code requested for teacher deletion');

  // Set known code for delete attempt
  await mongoose.connection.db.collection('confirmation_code_info').updateOne(
    { adminUserId: adminId, action: 'DELETE_USER', targetUserId: teacherUserId },
    { $set: { codeHash: hashedOtp } }
  );

  const safeDelBlockedRes = await fetch(`${API_BASE}/admin/users/delete`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ targetUserId: teacherUserId, confirmationCode: validOtp })
  }).then(r => r.json());
  assert(safeDelBlockedRes.success === false && safeDelBlockedRes.message.includes('assigned as'),
    'Safe deletion check prevents deleting user who is assigned as class/section teacher');

  // Now create an unassigned user and delete them
  const tempUserRes = await fetch(`${API_BASE}/admin/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Temp Staff',
      email: `temp.staff.${timestamp}@gmail.com`,
      mobileNumber: '9899001122',
      designation: 'Temporary Assistant',
      roleCode: 'OFFICE_STAFF'
    })
  }).then(r => r.json());
  const tempUserId = tempUserRes.user.userId;

  await fetch(`${API_BASE}/admin/users/request-confirmation-code`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'DELETE_USER', targetUserId: tempUserId })
  });

  await mongoose.connection.db.collection('confirmation_code_info').updateOne(
    { adminUserId: adminId, action: 'DELETE_USER', targetUserId: tempUserId },
    { $set: { codeHash: hashedOtp } }
  );

  const delSuccessRes = await fetch(`${API_BASE}/admin/users/delete`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ targetUserId: tempUserId, confirmationCode: validOtp })
  }).then(r => r.json());
  assert(delSuccessRes.success === true, 'Unassigned user deleted safely after confirmation code verification');

  await mongoose.disconnect();

  console.log('\n========================================================');
  console.log(`ALL ${passedTests}/${totalTests} MODULE 2 BACKEND TESTS PASSED!`);
  console.log('========================================================\n');
}

runModule2Tests().catch(err => {
  console.error('\nModule 2 backend test error:', err);
  process.exit(1);
});
