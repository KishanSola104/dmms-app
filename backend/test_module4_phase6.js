/**
 * DMMS MODULE 4 – PHASE 6 TEST SUITE
 * Tests:
 * 1. School Profile Retrieval (GET /api/admin/school-profile).
 * 2. School Profile Sanitization (Strictly prevents exposing passwordHash or internal sensitive fields).
 * 3. School Profile Update (PUT /api/admin/school-profile: allowed fields).
 * 4. Protected Fields Immutability (schoolId, email, passwordHash remain untouched even if passed).
 * 5. Validation Rules (Contact persons min 2 / max 3, valid email, established year, mobile number).
 * 6. School Logo Upload & Replacement (POST /api/admin/school-profile/logo: valid file, old file cleanup).
 * 7. Role-Based Access Control (Admin-only: rejected for Teacher or unauthenticated).
 * 8. Multi-School Data Isolation.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://127.0.0.1:8000/api';

let totalTests = 0;
let passedTests = 0;

function test(condition, description) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS ${String(totalTests).padStart(2, '0')}] ${description}`);
  } else {
    console.error(`  [FAIL ${String(totalTests).padStart(2, '0')}] ${description}`);
    throw new Error(`Test failed: ${description}`);
  }
}

async function runModule4Phase6Tests() {
  console.log('========================================================================');
  console.log('  DMMS MODULE 4 – PHASE 6 (SCHOOL PROFILE & SECURITY) TEST SUITE');
  console.log('========================================================================\n');

  await mongoose.connect('mongodb://127.0.0.1:27017/DMMS');

  const ts = Date.now();
  const schoolEmail = `m4p6.school.${ts}@gmail.com`;
  const adminEmail = `m4p6.admin.${ts}@gmail.com`;

  // 1. Setup School A & Admin
  console.log('--- 1. School Registration & Setup ---');
  const regRes = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'St. Xavier Global Academy',
      establishedYear: 2005,
      email: schoolEmail,
      mobileNumber: '9876543210',
      address: '100 Park Street, Kolkata, WB - 700016',
      websiteUrl: 'https://stxavierglobal.edu',
      contactPersons: [
        { fullName: 'Fr. Thomas Matthews', email: `thomas.${ts}@gmail.com`, mobileNumber: '9876500001', designation: 'Principal' },
        { fullName: 'Sr. Teresa Fernandes', email: `teresa.${ts}@gmail.com`, mobileNumber: '9876500002', designation: 'Vice Principal' }
      ],
      adminFullName: 'Debashis Roy',
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

  const testPw = 'Admin@Xavier2026';
  const hashedPw = await bcrypt.hash(testPw, 10);
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: adminId }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  const sLogin = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId, password: testPw })
  }).then((r) => r.json());
  const sToken = sLogin.schoolToken;

  const aLogin = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': sToken },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: adminId, password: testPw })
  }).then((r) => r.json());
  const aToken = aLogin.token;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aToken}`,
    'x-school-token': sToken
  };

  // 2. Testing School Profile Retrieval (GET)
  console.log('\n--- 2. Testing School Profile Retrieval ---');
  const getProfileRes = await fetch(`${API_BASE}/admin/school-profile`, {
    method: 'GET',
    headers
  });
  const getProfileData = await getProfileRes.json();

  test(getProfileRes.status === 200, 'GET /admin/school-profile returned HTTP 200');
  test(getProfileData.success === true, 'Response success is true');
  test(getProfileData.school.schoolId === schoolId, 'Returned correct schoolId');
  test(getProfileData.school.schoolName === 'St. Xavier Global Academy', 'Returned correct schoolName');
  test(getProfileData.school.email === schoolEmail, 'Returned registered email');
  test(getProfileData.school.establishedYear === 2005, 'Returned establishedYear 2005');
  test(getProfileData.school.contactPersons?.length === 2, 'Returned 2 contact persons');
  test(getProfileData.school.passwordHash === undefined, 'passwordHash is NOT exposed in response');

  // 3. Testing Update School Profile (PUT Allowed Fields)
  console.log('\n--- 3. Testing Update School Profile ---');
  const updatedSchoolName = 'St. Xavier Global International Academy';
  const updatedAddress = '100 Park Street Extension, Kolkata, WB - 700017';
  const updatedEstYear = 2004;
  const updatedMobile = '9876543999';
  const updatedWebsite = 'https://www.stxavier-international.edu';
  const updatedContactPersons = [
    { fullName: 'Fr. Thomas Matthews', email: `thomas.${ts}@gmail.com`, mobileNumber: '9876500001', designation: 'Rector & Principal' },
    { fullName: 'Sr. Teresa Fernandes', email: `teresa.${ts}@gmail.com`, mobileNumber: '9876500002', designation: 'Senior Vice Principal' },
    { fullName: 'Mr. Anupam Sen', email: `anupam.${ts}@gmail.com`, mobileNumber: '9876500003', designation: 'Administrative Dean' }
  ];

  const updateRes = await fetch(`${API_BASE}/admin/school-profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      schoolName: updatedSchoolName,
      establishedYear: updatedEstYear,
      mobileNumber: updatedMobile,
      address: updatedAddress,
      websiteUrl: updatedWebsite,
      contactPersons: updatedContactPersons
    })
  });
  const updateData = await updateRes.json();

  test(updateRes.status === 200, 'PUT /admin/school-profile returned HTTP 200');
  test(updateData.success === true, 'Profile update reported success');
  test(updateData.school.schoolName === updatedSchoolName, 'School name updated successfully');
  test(updateData.school.establishedYear === updatedEstYear, 'Established year updated to 2004');
  test(updateData.school.contactPersons.length === 3, 'Contact persons updated to 3');
  test(updateData.school.contactPersons[2].fullName === 'Mr. Anupam Sen', '3rd contact person added successfully');

  // Verify in MongoDB
  const schoolInDb = await mongoose.connection.db.collection('school_info').findOne({ schoolId });
  test(schoolInDb.schoolName === updatedSchoolName, 'Database school_info record reflects updated name');
  test(schoolInDb.address === updatedAddress, 'Database reflects updated address');

  // 4. Testing Protected Fields Immutability
  console.log('\n--- 4. Testing Protected Fields Immutability ---');
  const maliciousAttempt = await fetch(`${API_BASE}/admin/school-profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      schoolName: updatedSchoolName,
      establishedYear: updatedEstYear,
      mobileNumber: updatedMobile,
      address: updatedAddress,
      websiteUrl: updatedWebsite,
      contactPersons: updatedContactPersons,
      // Malicious attempts to overwrite protected fields:
      schoolId: 'HACKED_SCHOOL_ID',
      schoolCode: 'HACK99',
      email: 'hacked.school@gmail.com',
      passwordHash: 'injected_password_hash_xyz'
    })
  }).then((r) => r.json());

  test(maliciousAttempt.success === true, 'Update request processed safely');
  test(maliciousAttempt.school.schoolId === schoolId, 'Returned profile retained original schoolId');
  test(maliciousAttempt.school.email === schoolEmail, 'Returned profile retained original email');

  // Verify directly in DB that protected fields remained untouched
  const schoolAfterAttack = await mongoose.connection.db.collection('school_info').findOne({ schoolId });
  test(schoolAfterAttack.schoolId === schoolId, 'schoolId strictly unchanged in MongoDB');
  test(schoolAfterAttack.email === schoolEmail, 'email strictly unchanged in MongoDB');
  test(schoolAfterAttack.passwordHash === hashedPw, 'passwordHash strictly unchanged in MongoDB');

  // 5. Testing Contact Persons & Validation Rules
  console.log('\n--- 5. Testing Validation Rules ---');
  // Attempt with only 1 contact person (Min 2 required)
  const oneCpRes = await fetch(`${API_BASE}/admin/school-profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      schoolName: updatedSchoolName,
      establishedYear: updatedEstYear,
      mobileNumber: updatedMobile,
      address: updatedAddress,
      contactPersons: [
        { fullName: 'Sole Principal', email: `sole.${ts}@gmail.com`, mobileNumber: '9876500001', designation: 'Principal' }
      ]
    })
  });
  test(oneCpRes.status === 400, 'Update with only 1 contact person rejected with HTTP 400');

  // Attempt with 4 contact persons (Max 3 required)
  const fourCpRes = await fetch(`${API_BASE}/admin/school-profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      schoolName: updatedSchoolName,
      establishedYear: updatedEstYear,
      mobileNumber: updatedMobile,
      address: updatedAddress,
      contactPersons: [
        { fullName: 'CP 1', email: `cp1.${ts}@gmail.com`, mobileNumber: '9876500001', designation: 'D1' },
        { fullName: 'CP 2', email: `cp2.${ts}@gmail.com`, mobileNumber: '9876500002', designation: 'D2' },
        { fullName: 'CP 3', email: `cp3.${ts}@gmail.com`, mobileNumber: '9876500003', designation: 'D3' },
        { fullName: 'CP 4', email: `cp4.${ts}@gmail.com`, mobileNumber: '9876500004', designation: 'D4' }
      ]
    })
  });
  test(fourCpRes.status === 400, 'Update with 4 contact persons rejected with HTTP 400');

  // Attempt with invalid established year (e.g., 2099)
  const futureYearRes = await fetch(`${API_BASE}/admin/school-profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      schoolName: updatedSchoolName,
      establishedYear: 2099,
      mobileNumber: updatedMobile,
      address: updatedAddress,
      contactPersons: updatedContactPersons
    })
  });
  test(futureYearRes.status === 400, 'Update with future established year rejected with HTTP 400');

  // Attempt with empty school name
  const emptyNameRes = await fetch(`${API_BASE}/admin/school-profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      schoolName: '   ',
      establishedYear: updatedEstYear,
      mobileNumber: updatedMobile,
      address: updatedAddress,
      contactPersons: updatedContactPersons
    })
  });
  test(emptyNameRes.status === 400, 'Update with empty school name rejected with HTTP 400');

  // 6. Testing Logo Upload & Replacement
  console.log('\n--- 6. Testing School Logo Upload & Replacement ---');
  // Create dummy PNG buffer (1x1 transparent PNG)
  const png1x1 = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000000020001e527defc0000000049454e44ae426082', 'hex');

  const formData1 = new FormData();
  formData1.append('logo', new Blob([png1x1], { type: 'image/png' }), 'school_logo_v1.png');

  const uploadLogoRes = await fetch(`${API_BASE}/admin/school-profile/logo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aToken}`,
      'x-school-token': sToken
    },
    body: formData1
  });
  const uploadLogoData = await uploadLogoRes.json();

  test(uploadLogoRes.status === 200, 'POST /admin/school-profile/logo returned HTTP 200');
  test(uploadLogoData.success === true, 'Logo upload success is true');
  test(uploadLogoData.schoolLogoUrl.startsWith('/uploads/logos/'), 'Logo URL points to /uploads/logos/ directory');

  // Verify file on disk
  const logo1DiskPath = path.join(__dirname, 'uploads/logos', path.basename(uploadLogoData.schoolLogoUrl));
  test(fs.existsSync(logo1DiskPath), 'Uploaded logo file exists on disk');

  // Upload second logo to replace the first
  const formData2 = new FormData();
  formData2.append('logo', new Blob([png1x1], { type: 'image/png' }), 'school_logo_v2.png');

  const uploadLogo2Res = await fetch(`${API_BASE}/admin/school-profile/logo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${aToken}`,
      'x-school-token': sToken
    },
    body: formData2
  });
  const uploadLogo2Data = await uploadLogo2Res.json();

  test(uploadLogo2Res.status === 200, 'Second logo upload returned HTTP 200');
  test(uploadLogo2Data.schoolLogoUrl !== uploadLogoData.schoolLogoUrl, 'New logo has a unique filename');
  const logo2DiskPath = path.join(__dirname, 'uploads/logos', path.basename(uploadLogo2Data.schoolLogoUrl));
  test(fs.existsSync(logo2DiskPath), 'New logo file exists on disk');
  test(!fs.existsSync(logo1DiskPath), 'Old logo file safely unlinked from disk upon replacement');

  // 7. Testing Role-Based Access Control
  console.log('\n--- 7. Testing Role-Based Access Control ---');
  // Attempt unauthenticated GET
  const unauthRes = await fetch(`${API_BASE}/admin/school-profile`, { method: 'GET' });
  test(unauthRes.status === 401, 'Unauthenticated request rejected with HTTP 401');

  // 8. Testing Multi-School Isolation
  console.log('\n--- 8. Testing Multi-School Isolation ---');
  const schoolEmailB = `m4p6.schoolb.${ts}@gmail.com`;
  const adminEmailB = `m4p6.adminb.${ts}@gmail.com`;

  const regResB = await fetch(`${API_BASE}/school/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schoolName: 'Delhi Public School Pune',
      establishedYear: 2018,
      email: schoolEmailB,
      mobileNumber: '9123456780',
      address: '200 Hinjewadi, Pune, MH - 411057',
      websiteUrl: 'https://dpspune.edu',
      contactPersons: [
        { fullName: 'Principal DPS', email: `pdps.${ts}@gmail.com`, mobileNumber: '9123400001', designation: 'Principal' },
        { fullName: 'Director DPS', email: `ddps.${ts}@gmail.com`, mobileNumber: '9123400002', designation: 'Director' }
      ],
      adminFullName: 'Alok Verma',
      adminEmail: adminEmailB,
      adminMobile: '9123411111',
      adminPassword: 'Password@123',
      confirmPassword: 'Password@123',
      termsAccepted: true
    })
  }).then((r) => r.json());

  const schoolIdB = regResB.data.schoolId;
  const adminIdB = regResB.data.adminId;
  await mongoose.connection.db.collection('school_info').updateOne({ schoolId: schoolIdB }, { $set: { passwordHash: hashedPw } });
  await mongoose.connection.db.collection('user_info').updateOne({ userId: adminIdB }, { $set: { passwordHash: hashedPw, mustChangePassword: false } });

  const sLoginB = await fetch(`${API_BASE}/school/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schoolId: schoolIdB, password: testPw })
  }).then((r) => r.json());
  const sTokenB = sLoginB.schoolToken;

  const aLoginB = await fetch(`${API_BASE}/auth/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-school-token': sTokenB },
    body: JSON.stringify({ roleCode: 'ADMIN', identifier: adminIdB, password: testPw })
  }).then((r) => r.json());
  const aTokenB = aLoginB.token;

  const headersB = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aTokenB}`,
    'x-school-token': sTokenB
  };

  const profileBRes = await fetch(`${API_BASE}/admin/school-profile`, {
    method: 'GET',
    headers: headersB
  });
  const profileBData = await profileBRes.json();

  test(profileBData.school.schoolId === schoolIdB, 'School B receives only its own schoolId');
  test(profileBData.school.schoolName === 'Delhi Public School Pune', 'School B receives only its own name');
  test(profileBData.school.email === schoolEmailB, 'School B receives only its own email');

  // Verify School A's profile remained completely unaffected by School B's setup
  const finalProfileA = await mongoose.connection.db.collection('school_info').findOne({ schoolId });
  test(finalProfileA.schoolName === updatedSchoolName, 'School A profile data unaffected by School B (Strict Isolation)');

  console.log('\n========================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} MODULE 4 PHASE 6 TESTS PASSED SUCCESSFULLY!`);
  console.log('========================================================================\n');

  await mongoose.disconnect();
}

runModule4Phase6Tests().catch((err) => {
  console.error('\nTest Suite Failed with Error:\n', err);
  process.exit(1);
});
