const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const API_BASE = 'http://localhost:8000/api';

async function runTests() {
  console.log('====================================================');
  console.log('   DMMS SPRINT 1 END-TO-END AUTOMATED VERIFICATION');
  console.log('====================================================\n');

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

  // 1. Check Health & System
  console.log('\n--- 1. Testing System Health & Dynamic Roles ---');
  const healthRes = await fetch(`${API_BASE}/health`).then(r => r.json());
  assert(healthRes.status === 'online', 'Server health check returns online');

  const rolesRes = await fetch(`${API_BASE}/auth/roles`).then(r => r.json());
  assert(rolesRes.success && rolesRes.roles.length === 4, 'Dynamic roles retrieved from role_info table (4 roles)');
  const roleCodes = rolesRes.roles.map(r => r.roleCode);
  assert(roleCodes.includes('ADMIN') && roleCodes.includes('HEAD_TEACHER') && roleCodes.includes('TEACHER') && roleCodes.includes('OFFICE_STAFF'),
    'Contains ADMIN, HEAD_TEACHER, TEACHER, and OFFICE_STAFF');

  // 2. School Registration
  console.log('\n--- 2. Testing School Registration (4 Steps) ---');
  const timestamp = Date.now();
  const testSchoolEmail = `test.school.${timestamp}@gmail.com`;
  const testAdminEmail = `test.admin.${timestamp}@gmail.com`;

  const regPayload = {
    // Step 1: School Details
    schoolName: 'Kishore Bharti Primary School',
    establishedYear: 1998,
    email: testSchoolEmail,
    mobileNumber: '9876543210',
    address: '123 Education Lane, Knowledge Park, Ahmedabad, Gujarat',
    websiteUrl: 'https://www.kbps-school.edu',

    // Step 2: Contact Persons (2 to 3)
    contactPersons: [
      {
        fullName: 'Ramesh Patel',
        email: `ramesh.patel.${timestamp}@gmail.com`,
        mobileNumber: '9876500001',
        designation: 'Vice Principal'
      },
      {
        fullName: 'Meena Sharma',
        email: `meena.sharma.${timestamp}@gmail.com`,
        mobileNumber: '9876500002',
        designation: 'Managing Trustee'
      }
    ],

    // Step 3: Administrator Details
    adminFullName: 'Kishan Solanki',
    adminEmail: testAdminEmail,
    adminMobile: '9876511111',

    // Step 4: Terms
    termsAccepted: true
  };

  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload)
  }).then(r => r.json());

  assert(regRes.success === true, 'School registration completed successfully');
  assert(regRes.data && regRes.data.schoolId && regRes.data.schoolId.startsWith('KBPS_'), `School ID format is valid: ${regRes.data?.schoolId}`);
  assert(regRes.data && regRes.data.adminId && regRes.data.adminId.startsWith('KSKBPS_'), `Admin ID format is valid: ${regRes.data?.adminId}`);
  console.log(`Generated School ID: ${regRes.data.schoolId}`);
  console.log(`Generated Admin ID:  ${regRes.data.adminId}`);
  console.log(`Email Delivery Status: ${regRes.data.emailDeliveryStatus}`);

  // Fetch the created school and admin directly from MongoDB to inspect hashes
  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');
  const dbSchool = await mongoose.connection.db.collection('school_info').findOne({ schoolId: regRes.data.schoolId });
  const dbAdmin = await mongoose.connection.db.collection('user_info').findOne({ userId: regRes.data.adminId });

  assert(dbSchool.passwordHash && dbSchool.passwordHash.startsWith('$2'), 'School password securely hashed with bcrypt');
  assert(dbAdmin.passwordHash && dbAdmin.passwordHash.startsWith('$2'), 'Administrator password securely hashed with bcrypt');
  assert(dbSchool.passwordHash !== dbAdmin.passwordHash, 'School Password hash != Administrator Password hash');
  assert(dbAdmin.mustChangePassword === true, 'mustChangePassword flag is true on initial admin creation');

  // 3. School Login
  console.log('\n--- 3. Testing School Login ---');
  // We can test by setting a known password or reset temporary password
  // Let's test forgot password for school to generate a known temporary password or verify reset flow!
  const schoolForgotRes = await fetch(`${API_BASE}/school/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: regRes.data.schoolId })
  }).then(r => r.json());
  assert(schoolForgotRes.success === true, 'School Forgot Password generated temporary password');

  // Let's set a known password for testing login
  const knownSchoolPassword = 'School@1234Password';
  const hashedKnownSchool = await bcrypt.hash(knownSchoolPassword, 10);
  await mongoose.connection.db.collection('school_info').updateOne(
    { schoolId: regRes.data.schoolId },
    { $set: { passwordHash: hashedKnownSchool } }
  );

  const schoolLoginRes = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: regRes.data.schoolId,
      password: knownSchoolPassword
    })
  }).then(r => r.json());

  assert(schoolLoginRes.success === true, 'School Login authenticated successfully');
  assert(schoolLoginRes.schoolToken && typeof schoolLoginRes.schoolToken === 'string', 'Received school JWT session token');
  const schoolToken = schoolLoginRes.schoolToken;

  // 4. Role-Based User Login
  console.log('\n--- 4. Testing Role-Based User Login ---');
  const knownAdminPassword = 'TempAdmin@123Password';
  const hashedKnownAdmin = await bcrypt.hash(knownAdminPassword, 10);
  await mongoose.connection.db.collection('user_info').updateOne(
    { userId: regRes.data.adminId },
    { $set: { passwordHash: hashedKnownAdmin, mustChangePassword: true } }
  );

  const userLoginRes = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-school-token': schoolToken
    },
    body: JSON.stringify({
      roleCode: 'ADMIN',
      identifier: regRes.data.adminId,
      password: knownAdminPassword
    })
  }).then(r => r.json());

  assert(userLoginRes.success === true, 'Role-based user login successful');
  assert(userLoginRes.mustChangePassword === true, 'Mandatory first login password change enforced in login response');
  assert(userLoginRes.token && typeof userLoginRes.token === 'string', 'Received user JWT session token');
  let userToken = userLoginRes.token;

  // 5. Mandatory First Login Password Change
  console.log('\n--- 5. Testing Mandatory First Login Password Change ---');
  const permanentAdminPassword = 'PermAdmin@2026Secure';
  const firstChangeRes = await fetch(`${API_BASE}/auth/user/first-login-change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
      'x-school-token': schoolToken
    },
    body: JSON.stringify({
      currentPassword: knownAdminPassword,
      newPassword: permanentAdminPassword,
      confirmPassword: permanentAdminPassword
    })
  }).then(r => r.json());

  assert(firstChangeRes.success === true, 'First login password change succeeded');
  assert(firstChangeRes.user && firstChangeRes.user.mustChangePassword === false, 'mustChangePassword flag is now false');
  if (firstChangeRes.token) {
    userToken = firstChangeRes.token;
  }

  // 6. User Profile Management
  console.log('\n--- 6. Testing User Profile Management ---');
  const profileRes = await fetch(`${API_BASE}/profile/me`, {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'x-school-token': schoolToken
    }
  }).then(r => r.json());

  assert(profileRes.success === true, 'Profile fetched successfully');
  assert(profileRes.profile.userId === regRes.data.adminId, 'Profile User ID matches administrator');
  assert(profileRes.profile.roleCode === 'ADMIN', 'Profile role is ADMIN');
  assert(profileRes.profile.school.schoolId === regRes.data.schoolId, 'Profile school matches registered school');

  const updateProfileRes = await fetch(`${API_BASE}/profile/update`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
      'x-school-token': schoolToken
    },
    body: JSON.stringify({
      fullName: 'Kishan G. Solanki',
      mobileNumber: '9876599999',
      address: 'Staff Quarters, Campus A',
      qualification: 'M.Ed, Ph.D'
    })
  }).then(r => r.json());

  assert(updateProfileRes.success === true, 'Profile details updated successfully');
  assert(updateProfileRes.employee.fullName === 'Kishan G. Solanki', 'Updated full name persisted in employee_info');

  // 7. Academic Years & Switching
  console.log('\n--- 7. Testing Academic Year Management ---');
  const ayRes = await fetch(`${API_BASE}/common/academic-years`, {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'x-school-token': schoolToken
    }
  }).then(r => r.json());

  assert(ayRes.success === true && ayRes.academicYears.length > 0, 'Academic years retrieved for school');
  assert(ayRes.currentYear && ayRes.currentYear.isCurrent === true, 'Active academic year identified');

  // 8. Notifications
  console.log('\n--- 8. Testing Notification Management ---');
  const notifRes = await fetch(`${API_BASE}/common/notifications`, {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'x-school-token': schoolToken
    }
  }).then(r => r.json());

  assert(notifRes.success === true && notifRes.notifications.length > 0, 'Welcome notification retrieved');
  assert(notifRes.notifications[0].title === 'Welcome to DMMS!', 'Notification content matches');

  const markAllRes = await fetch(`${API_BASE}/common/notifications/mark-all-read`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'x-school-token': schoolToken
    }
  }).then(r => r.json());
  assert(markAllRes.success === true, 'All notifications marked as read');

  // 9. Dashboard Stats
  console.log('\n--- 9. Testing Dynamic Role-Specific Dashboard Stats ---');
  const statsRes = await fetch(`${API_BASE}/common/dashboard-stats`, {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'x-school-token': schoolToken
    }
  }).then(r => r.json());

  assert(statsRes.success === true, 'Dashboard stats retrieved for ADMIN role');
  assert(statsRes.roleTitle === 'School Administrator Portal', 'Role title is School Administrator Portal');
  assert(statsRes.stats.length === 4, '4 key metric cards returned');

  // 10. School Password Change by School Administrator
  console.log('\n--- 10. Testing School Password Change by Admin ---');
  const newSchoolPassword = 'NewSchool@999Password';
  const changeSchoolPwRes = await fetch(`${API_BASE}/school/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`,
      'x-school-token': schoolToken
    },
    body: JSON.stringify({
      currentPassword: knownSchoolPassword,
      newPassword: newSchoolPassword,
      confirmPassword: newSchoolPassword
    })
  }).then(r => r.json());

  assert(changeSchoolPwRes.success === true, 'School Administrator successfully changed School Password');

  // Verify that new School Password works for login
  const verifySchoolNewLogin = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: regRes.data.schoolId,
      password: newSchoolPassword
    })
  }).then(r => r.json());
  assert(verifySchoolNewLogin.success === true, 'School Login works with newly updated School Password');

  // Verify that old School Password fails
  const verifyOldFail = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolId: regRes.data.schoolId,
      password: knownSchoolPassword
    })
  }).then(r => r.json());
  assert(verifyOldFail.success === false, 'Old School Password rejected');

  await mongoose.disconnect();

  console.log('\n====================================================');
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('\nTest suite encountered an error:', err);
  process.exit(1);
});
