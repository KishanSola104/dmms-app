const SchoolInfo = require('../models/schoolInfo.model');
const EmployeeInfo = require('../models/employeeInfo.model');
const RoleInfo = require('../models/roleInfo.model');
const UserInfo = require('../models/userInfo.model');
const AcademicYearInfo = require('../models/academicYearInfo.model');
const NotificationInfo = require('../models/notificationInfo.model');
const SchoolIdService = require('../services/schoolId.service');
const UserIdService = require('../services/userId.service');
const PasswordService = require('../services/password.service');
const EmailService = require('../services/email.service');
const AuthService = require('../services/auth.service');

class SchoolController {
  /**
   * Check uniqueness of email / mobile
   */
  static async checkUniqueness(req, res, next) {
    try {
      const { email, type } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required for verification' });
      }

      if (type === 'school') {
        const existing = await SchoolInfo.findOne({ email: email.toLowerCase().trim() });
        return res.json({ success: true, isAvailable: !existing });
      } else if (type === 'admin') {
        const existing = await UserInfo.findOne({ email: email.toLowerCase().trim() });
        return res.json({ success: true, isAvailable: !existing });
      }

      return res.status(400).json({ success: false, message: 'Invalid verification type' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete 4-Step School Registration
   */
  static async registerSchool(req, res, next) {
    try {
      const {
        // Step 1: School Details
        schoolName,
        establishedYear,
        email: schoolEmail,
        mobileNumber: schoolMobile,
        address,
        websiteUrl,

        // Step 2: Contact Persons (2 to 3)
        contactPersons,

        // Step 3: Administrator Details
        adminFullName,
        adminEmail,
        adminMobile,

        // Step 4: Terms acceptance
        termsAccepted
      } = req.body;

      // 1. Mandatory Validations
      if (!schoolName || !establishedYear || !schoolEmail || !schoolMobile || !address) {
        return res.status(400).json({
          success: false,
          message: 'All mandatory school details must be completed.'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(schoolEmail)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid school email address.' });
      }

      const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
      if (!phoneRegex.test(schoolMobile)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid school mobile number.' });
      }

      const estYearNum = parseInt(establishedYear, 10);
      const currentYear = new Date().getFullYear();
      if (isNaN(estYearNum) || estYearNum < 1800 || estYearNum > currentYear) {
        return res.status(400).json({
          success: false,
          message: `Established year must be a valid year between 1800 and ${currentYear}.`
        });
      }

      // 2. Validate Contact Persons (Min 2, Max 3)
      if (!contactPersons || !Array.isArray(contactPersons) || contactPersons.length < 2 || contactPersons.length > 3) {
        return res.status(400).json({
          success: false,
          message: 'Please provide at least 2 and at most 3 contact persons.'
        });
      }

      for (let i = 0; i < contactPersons.length; i++) {
        const cp = contactPersons[i];
        if (!cp.fullName || !cp.email || !cp.mobileNumber || !cp.designation) {
          return res.status(400).json({
            success: false,
            message: `All fields for contact person #${i + 1} are required.`
          });
        }
        if (!emailRegex.test(cp.email)) {
          return res.status(400).json({
            success: false,
            message: `Contact person #${i + 1} email is invalid.`
          });
        }
        if (!phoneRegex.test(cp.mobileNumber)) {
          return res.status(400).json({
            success: false,
            message: `Contact person #${i + 1} mobile number is invalid.`
          });
        }
      }

      // 3. Validate Administrator
      if (!adminFullName || !adminEmail || !adminMobile) {
        return res.status(400).json({
          success: false,
          message: 'All administrator fields are required.'
        });
      }
      if (!emailRegex.test(adminEmail)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid administrator email address.' });
      }
      if (!phoneRegex.test(adminMobile)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid administrator mobile number.' });
      }

      // 4. Duplicate Prevention Checks (School vs Admin vs Contact Persons)
      const normEmail = (val) => (val || '').trim().toLowerCase();
      const normPhone = (val) => {
        if (!val) return '';
        let digits = String(val).replace(/\D/g, '');
        if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
        if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
        return digits;
      };
      const normName = (val) => (val || '').trim().toLowerCase().replace(/\s+/g, ' ');

      const nSchoolEmail = normEmail(schoolEmail);
      const nSchoolMobile = normPhone(schoolMobile);
      const nAdminEmail = normEmail(adminEmail);
      const nAdminMobile = normPhone(adminMobile);
      const nAdminName = normName(adminFullName);

      // Rule 1: School Official Email cannot be the same as Administrator Email
      if (nSchoolEmail === nAdminEmail) {
        return res.status(400).json({
          success: false,
          message: 'Official School Email and Administrator Email cannot be the same.'
        });
      }

      // Rule 2: School Official Mobile Number cannot be the same as Administrator Mobile Number
      if (nSchoolMobile === nAdminMobile) {
        return res.status(400).json({
          success: false,
          message: 'Official School Mobile Number and Administrator Mobile Number cannot be the same.'
        });
      }

      // Rule 4: Contact Persons must not have duplicate email addresses, mobile numbers, or full names among themselves
      for (let i = 0; i < contactPersons.length; i++) {
        const cpA = contactPersons[i];
        const nCpAEmail = normEmail(cpA.email);
        const nCpAMobile = normPhone(cpA.mobileNumber);
        const nCpAName = normName(cpA.fullName);

        for (let j = i + 1; j < contactPersons.length; j++) {
          const cpB = contactPersons[j];
          const nCpBEmail = normEmail(cpB.email);
          const nCpBMobile = normPhone(cpB.mobileNumber);
          const nCpBName = normName(cpB.fullName);

          if (nCpAEmail === nCpBEmail) {
            return res.status(400).json({
              success: false,
              message: `Contact Person #${i + 1} and Contact Person #${j + 1} cannot have the same email address (${cpA.email.trim()}).`
            });
          }
          if (nCpAMobile === nCpBMobile) {
            return res.status(400).json({
              success: false,
              message: `Contact Person #${i + 1} and Contact Person #${j + 1} cannot have the same mobile number (${cpA.mobileNumber.trim()}).`
            });
          }
          if (nCpAName === nCpBName) {
            return res.status(400).json({
              success: false,
              message: `Contact Person #${i + 1} and Contact Person #${j + 1} cannot have the same full name (${cpA.fullName.trim()}).`
            });
          }
        }
      }

      // Rule 1 & Rule 2: School Official Email & Mobile cannot match any Contact Person
      for (let i = 0; i < contactPersons.length; i++) {
        const cp = contactPersons[i];
        const nCpEmail = normEmail(cp.email);
        const nCpMobile = normPhone(cp.mobileNumber);

        if (nSchoolEmail === nCpEmail) {
          return res.status(400).json({
            success: false,
            message: `Official School Email cannot be the same as Contact Person #${i + 1} Email (${cp.email.trim()}).`
          });
        }
        if (nSchoolMobile === nCpMobile) {
          return res.status(400).json({
            success: false,
            message: `Official School Mobile Number cannot be the same as Contact Person #${i + 1} Mobile Number (${cp.mobileNumber.trim()}).`
          });
        }
      }

      // Rule 3 & Rule 5: Administrator Email, Mobile, and Full Name cannot match any Contact Person
      for (let i = 0; i < contactPersons.length; i++) {
        const cp = contactPersons[i];
        const nCpEmail = normEmail(cp.email);
        const nCpMobile = normPhone(cp.mobileNumber);
        const nCpName = normName(cp.fullName);

        if (nAdminEmail === nCpEmail) {
          return res.status(400).json({
            success: false,
            message: `Administrator Email cannot be the same as Contact Person #${i + 1} Email (${cp.email.trim()}).`
          });
        }
        if (nAdminMobile === nCpMobile) {
          return res.status(400).json({
            success: false,
            message: `Administrator Mobile Number cannot be the same as Contact Person #${i + 1} Mobile Number (${cp.mobileNumber.trim()}).`
          });
        }
        if (nAdminName === nCpName) {
          return res.status(400).json({
            success: false,
            message: `Administrator Full Name cannot be the same as Contact Person #${i + 1} Full Name (${cp.fullName.trim()}).`
          });
        }
      }

      // 5. Validate Terms
      if (!termsAccepted) {
        return res.status(400).json({
          success: false,
          message: 'You must accept the Terms and Conditions to complete registration.'
        });
      }

      // 5. Uniqueness Checks
      const existingSchool = await SchoolInfo.findOne({ email: schoolEmail.toLowerCase().trim() });
      if (existingSchool) {
        return res.status(400).json({
          success: false,
          message: 'A school with this email address is already registered.'
        });
      }

      const existingAdmin = await UserInfo.findOne({ email: adminEmail.toLowerCase().trim() });
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'An administrator account with this email address already exists.'
        });
      }

      // 6. Generate Credentials
      const { schoolCode, schoolId } = await SchoolIdService.generateUniqueSchoolId(schoolName);
      const rawSchoolPassword = PasswordService.generateSecurePassword(10);
      const schoolPasswordHash = await PasswordService.hashPassword(rawSchoolPassword);

      const adminId = await UserIdService.generateUniqueUserId(adminFullName, schoolCode);
      let rawAdminPassword = PasswordService.generateSecurePassword(10);
      // Ensure admin password is strictly different from school password
      while (rawAdminPassword === rawSchoolPassword) {
        rawAdminPassword = PasswordService.generateSecurePassword(10);
      }
      const adminPasswordHash = await PasswordService.hashPassword(rawAdminPassword);

      // 7. Save School
      const newSchool = new SchoolInfo({
        schoolId,
        schoolCode,
        schoolName: schoolName.trim(),
        establishedYear: estYearNum,
        email: schoolEmail.toLowerCase().trim(),
        mobileNumber: schoolMobile.trim(),
        address: address.trim(),
        websiteUrl: websiteUrl ? websiteUrl.trim() : '',
        passwordHash: schoolPasswordHash,
        contactPersons: contactPersons.map(cp => ({
          fullName: cp.fullName.trim(),
          email: cp.email.toLowerCase().trim(),
          mobileNumber: cp.mobileNumber.trim(),
          designation: cp.designation.trim()
        })),
        termsAccepted: true,
        termsAcceptedAt: new Date(),
        status: 'ACTIVE'
      });

      const savedSchool = await newSchool.save();

      // 8. Save Initial Administrator as Employee
      const adminEmployee = new EmployeeInfo({
        schoolRef: savedSchool._id,
        schoolId: savedSchool.schoolId,
        fullName: adminFullName.trim(),
        email: adminEmail.toLowerCase().trim(),
        mobileNumber: adminMobile.trim(),
        designation: 'School Administrator',
        joiningDate: new Date()
      });
      const savedAdminEmployee = await adminEmployee.save();

      // 9. Fetch Admin Role
      let adminRole = await RoleInfo.findOne({ roleCode: 'ADMIN' });
      if (!adminRole) {
        adminRole = await RoleInfo.create({
          roleCode: 'ADMIN',
          roleName: 'School Administrator',
          description: 'Primary administrator for school setup, users, and credentials'
        });
      }

      // 10. Save User Account for Administrator
      const adminUser = new UserInfo({
        userId: adminId,
        schoolRef: savedSchool._id,
        schoolId: savedSchool.schoolId,
        employeeRef: savedAdminEmployee._id,
        roleRef: adminRole._id,
        roleCode: 'ADMIN',
        roleName: 'School Administrator',
        email: adminEmail.toLowerCase().trim(),
        passwordHash: adminPasswordHash,
        isFirstLogin: true,
        mustChangePassword: true,
        status: 'ACTIVE'
      });
      await adminUser.save();

      // 11. Create Initial Academic Year (e.g. Current Academic Year 2025-2026 / 2026-2027)
      const yrStart = currentYear;
      const yrEnd = currentYear + 1;
      const defaultYearCode = `${yrStart}-${yrEnd}`;
      await AcademicYearInfo.create({
        schoolRef: savedSchool._id,
        schoolId: savedSchool.schoolId,
        yearCode: defaultYearCode,
        yearName: `Academic Year ${defaultYearCode}`,
        startDate: new Date(yrStart, 5, 1), // June 1st
        endDate: new Date(yrEnd, 4, 31), // May 31st
        isCurrent: true,
        status: 'ACTIVE'
      });

      // 12. Create Welcome Notification
      await NotificationInfo.create({
        schoolRef: savedSchool._id,
        schoolId: savedSchool.schoolId,
        targetRoleCode: 'ADMIN',
        title: 'Welcome to DMMS!',
        message: `Welcome to Digital Marksheet Management System for ${savedSchool.schoolName}. Please complete your profile and update your default credentials.`,
        type: 'success'
      });

      // 13. Send Credential Emails (sent sequentially for maximum SMTP delivery reliability)
      let emailSuccess = false;
      try {
        const schoolMailResult = await EmailService.sendSchoolCredentials({
          schoolEmail: savedSchool.email,
          schoolName: savedSchool.schoolName,
          schoolId: savedSchool.schoolId,
          schoolPassword: rawSchoolPassword
        });

        const adminMailResult = await EmailService.sendAdminCredentials({
          adminEmail: adminUser.email,
          adminName: adminEmployee.fullName,
          schoolName: savedSchool.schoolName,
          schoolId: savedSchool.schoolId,
          adminId: adminUser.userId,
          adminPassword: rawAdminPassword
        });

        emailSuccess = schoolMailResult.success && adminMailResult.success;
      } catch (mailErr) {
        console.error('[Registration] Email sending error:', mailErr.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Your school has been successfully registered on the DMMS platform.',
        data: {
          schoolId: savedSchool.schoolId,
          schoolName: savedSchool.schoolName,
          adminId: adminUser.userId,
          emailDeliveryStatus: emailSuccess ? 'DELIVERED' : 'PENDING_OR_FAILED'
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * School Authentication (School Login)
   */
  static async login(req, res, next) {
    try {
      const { schoolId, password } = req.body;

      if (!schoolId || !password) {
        return res.status(400).json({
          success: false,
          message: 'Both School ID and Password are required.'
        });
      }

      const school = await SchoolInfo.findOne({ schoolId: schoolId.toUpperCase().trim() });
      if (!school) {
        return res.status(401).json({
          success: false,
          message: 'The entered credentials are incorrect. Please try again.'
        });
      }

      if (school.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'This school account is currently inactive. Please contact support.'
        });
      }

      const isMatch = await PasswordService.comparePassword(password, school.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'The entered credentials are incorrect. Please try again.'
        });
      }

      const schoolToken = AuthService.generateSchoolToken(school);

      return res.json({
        success: true,
        message: 'School authentication successful.',
        schoolToken,
        school: {
          schoolId: school.schoolId,
          schoolName: school.schoolName,
          schoolCode: school.schoolCode,
          email: school.email,
          mustChangePassword: school.mustChangePassword
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * School Forgot Password
   */
  static async forgotPassword(req, res, next) {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return res.status(400).json({
          success: false,
          message: 'Please provide either School ID or registered school email.'
        });
      }

      const clean = identifier.trim();
      const school = await SchoolInfo.findOne({
        $or: [
          { schoolId: clean.toUpperCase() },
          { email: clean.toLowerCase() }
        ]
      });

      if (!school) {
        // Return standard friendly response for security
        return res.status(404).json({
          success: false,
          message: 'No school found matching the provided details.'
        });
      }

      const tempPassword = PasswordService.generateSecurePassword(10);
      const hash = await PasswordService.hashPassword(tempPassword);

      school.passwordHash = hash;
      school.mustChangePassword = true;
      await school.save();

      const mailResult = await EmailService.sendSchoolResetPassword({
        schoolEmail: school.email,
        schoolName: school.schoolName,
        schoolId: school.schoolId,
        tempPassword
      });

      return res.json({
        success: true,
        message: 'A temporary password has been sent to the school\'s registered email address.',
        emailDelivered: mailResult.success
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change School Password (Only School Administrator permitted)
   */
  static async changeSchoolPassword(req, res, next) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!req.user || req.user.roleCode !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Only the School Administrator is permitted to change the School Password.'
        });
      }

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password, new password, and confirmation password are all required.'
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'The new passwords do not match.'
        });
      }

      const complexity = PasswordService.validatePasswordComplexity(newPassword);
      if (!complexity.isValid) {
        return res.status(400).json({
          success: false,
          message: complexity.error
        });
      }

      const school = await SchoolInfo.findOne({ schoolId: req.user.schoolId });
      if (!school) {
        return res.status(404).json({
          success: false,
          message: 'School not found.'
        });
      }

      const isCurrentMatch = await PasswordService.comparePassword(currentPassword, school.passwordHash);
      if (!isCurrentMatch) {
        return res.status(400).json({
          success: false,
          message: 'The current school password entered is incorrect.'
        });
      }

      const isSameAsCurrent = await PasswordService.comparePassword(newPassword, school.passwordHash);
      if (isSameAsCurrent) {
        return res.status(400).json({
          success: false,
          message: 'New password cannot be the same as the current school password.'
        });
      }

      const newHash = await PasswordService.hashPassword(newPassword);
      school.passwordHash = newHash;
      school.mustChangePassword = false;
      await school.save();

      return res.json({
        success: true,
        message: 'School password changed successfully.'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SchoolController;
