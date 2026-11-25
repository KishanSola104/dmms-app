const UserInfo = require('../models/userInfo.model');
const RoleInfo = require('../models/roleInfo.model');
const EmployeeInfo = require('../models/employeeInfo.model');
const SchoolInfo = require('../models/schoolInfo.model');
const PasswordService = require('../services/password.service');
const EmailService = require('../services/email.service');
const AuthService = require('../services/auth.service');
const TeacherAccessService = require('../services/teacherAccess.service');

class AuthController {
  /**
   * Get dynamic list of available roles from role_info table
   */
  static async getAvailableRoles(req, res, next) {
    try {
      const roles = await RoleInfo.find({ status: 'ACTIVE' })
        .select('roleCode roleName description')
        .sort({ roleCode: 1 });
      return res.json({ success: true, roles });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get currently authenticated school details
   */
  static async getCurrentSchool(req, res, next) {
    try {
      if (!req.school) {
        return res.status(401).json({ success: false, message: 'No authenticated school session.' });
      }

      return res.json({
        success: true,
        school: {
          schoolId: req.school.schoolId,
          schoolName: req.school.schoolName,
          schoolCode: req.school.schoolCode,
          email: req.school.email,
          mobileNumber: req.school.mobileNumber,
          establishedYear: req.school.establishedYear,
          address: req.school.address,
          websiteUrl: req.school.websiteUrl,
          schoolLogoUrl: req.school.schoolLogoUrl || '',
          mustChangePassword: req.school.mustChangePassword
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Role-Based User Login
   */
  static async userLogin(req, res, next) {
    try {
      const { roleCode, identifier, password } = req.body;

      if (!roleCode || !identifier || !password) {
        return res.status(400).json({
          success: false,
          message: 'Role, User ID / Email, and Password are all required.'
        });
      }

      // Ensure school session exists
      if (!req.school) {
        return res.status(401).json({
          success: false,
          message: 'No school authenticated. Please authenticate the school first.'
        });
      }

      const cleanIdentifier = identifier.trim();

      // Find user matching role, identifier (userId or email), and belongs to current school
      const user = await UserInfo.findOne({
        schoolId: req.school.schoolId,
        $or: [
          { userId: cleanIdentifier.toUpperCase() },
          { email: cleanIdentifier.toLowerCase() }
        ]
      }).populate('roleRef');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'The entered credentials are incorrect. Please try again.'
        });
      }

      // Fetch teaching assignments context first (needed for HEAD_TEACHER dual-panel login)
      const teachingAccess = await TeacherAccessService.getTeacherAccessContext(user);
      const requestedRole = roleCode.toUpperCase();
      const isHeadTeacherSwitchingToTeacher =
        user.roleCode === 'HEAD_TEACHER' && requestedRole === 'TEACHER';

      // Verify selected role matches user's assigned role, or is HEAD_TEACHER logging into Teacher Panel
      if (user.roleCode !== requestedRole && !isHeadTeacherSwitchingToTeacher) {
        return res.status(401).json({
          success: false,
          message: 'The selected role does not match this user account.'
        });
      }

      if (isHeadTeacherSwitchingToTeacher && !teachingAccess.hasTeachingAccess) {
        return res.status(403).json({
          success: false,
          message: 'Your Head Teacher account does not have active teaching or class-teacher assignments for Teacher Panel access.'
        });
      }

      if (user.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          message: 'Your account is currently inactive or suspended. Please contact the administrator.'
        });
      }

      // Verify password
      const isMatch = await PasswordService.comparePassword(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'The entered credentials are incorrect. Please try again.'
        });
      }

      // Fetch employee profile
      const employee = await EmployeeInfo.findById(user.employeeRef);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate user JWT token (retaining actual HEAD_TEACHER role, never downgrading)
      const userToken = AuthService.generateUserToken(user, req.school, employee);
      const activePanel = isHeadTeacherSwitchingToTeacher ? 'TEACHER' : user.roleCode;

      return res.json({
        success: true,
        message: 'Login successful. Welcome back!',
        token: userToken,
        activePanel,
        user: {
          userId: user.userId,
          email: user.email,
          roleCode: user.roleCode,
          roleName: user.roleName,
          fullName: employee ? employee.fullName : '',
          designation: employee ? employee.designation : '',
          profileImage: employee ? employee.profileImage : null,
          signatureUrl: employee ? employee.signatureUrl : null,
          teachingAccess,
          isFirstLogin: user.isFirstLogin,
          mustChangePassword: user.mustChangePassword
        },
        school: {
          schoolId: req.school.schoolId,
          schoolName: req.school.schoolName
        },
        mustChangePassword: user.mustChangePassword
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User Forgot Password
   */
  static async userForgotPassword(req, res, next) {
    try {
      const { roleCode, identifier } = req.body;

      if (!roleCode || !identifier) {
        return res.status(400).json({
          success: false,
          message: 'Role and User ID or registered email are required.'
        });
      }

      if (!req.school) {
        return res.status(401).json({
          success: false,
          message: 'No school authenticated. Please authenticate the school first.'
        });
      }

      const clean = identifier.trim();
      const user = await UserInfo.findOne({
        schoolId: req.school.schoolId,
        roleCode: roleCode.toUpperCase(),
        $or: [
          { userId: clean.toUpperCase() },
          { email: clean.toLowerCase() }
        ]
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'No user matching the provided details was found for this school.'
        });
      }

      const employee = await EmployeeInfo.findById(user.employeeRef);
      const tempPassword = PasswordService.generateSecurePassword(10);
      const hash = await PasswordService.hashPassword(tempPassword);

      user.passwordHash = hash;
      user.mustChangePassword = true;
      user.isFirstLogin = true;
      await user.save();

      const mailResult = await EmailService.sendUserResetPassword({
        userEmail: user.email,
        userName: employee ? employee.fullName : user.userId,
        userId: user.userId,
        tempPassword
      });

      return res.json({
        success: true,
        message: 'A temporary password has been sent to your registered email address.',
        emailDelivered: mailResult.success
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mandatory First Login Password Change
   */
  static async firstLoginChangePassword(req, res, next) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password, new password, and confirmation password are required.'
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

      const user = await UserInfo.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const isCurrentValid = await PasswordService.comparePassword(currentPassword, user.passwordHash);
      if (!isCurrentValid) {
        return res.status(400).json({
          success: false,
          message: 'The current password entered is incorrect.'
        });
      }

      const isSame = await PasswordService.comparePassword(newPassword, user.passwordHash);
      if (isSame) {
        return res.status(400).json({
          success: false,
          message: 'New password cannot be the same as your current temporary password.'
        });
      }

      const newHash = await PasswordService.hashPassword(newPassword);
      user.passwordHash = newHash;
      user.isFirstLogin = false;
      user.mustChangePassword = false;
      await user.save();

      // Return refreshed token without mustChangePassword flag
      const employee = await EmployeeInfo.findById(user.employeeRef);
      const school = await SchoolInfo.findOne({ schoolId: user.schoolId });
      const newToken = AuthService.generateUserToken(user, school, employee);

      return res.json({
        success: true,
        message: 'Password changed successfully! You now have full access to your dashboard.',
        token: newToken,
        user: {
          userId: user.userId,
          email: user.email,
          roleCode: user.roleCode,
          roleName: user.roleName,
          isFirstLogin: false,
          mustChangePassword: false
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
