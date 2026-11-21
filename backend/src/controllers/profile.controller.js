const UserInfo = require('../models/userInfo.model');
const EmployeeInfo = require('../models/employeeInfo.model');
const SchoolInfo = require('../models/schoolInfo.model');
const PasswordService = require('../services/password.service');
const fs = require('fs');
const path = require('path');

class ProfileController {
  /**
   * Get Current User Profile
   */
  static async getProfile(req, res, next) {
    try {
      const user = await UserInfo.findById(req.user._id).populate('roleRef');
      const employee = await EmployeeInfo.findById(user.employeeRef);
      const school = await SchoolInfo.findOne({ schoolId: user.schoolId });

      return res.json({
        success: true,
        profile: {
          userId: user.userId,
          email: user.email,
          roleCode: user.roleCode,
          roleName: user.roleName,
          status: user.status,
          isFirstLogin: user.isFirstLogin,
          mustChangePassword: user.mustChangePassword,
          lastLogin: user.lastLogin,

          // Employee Details
          fullName: employee ? employee.fullName : '',
          mobileNumber: employee ? employee.mobileNumber : '',
          designation: employee ? employee.designation : '',
          profileImage: employee && employee.profileImage ? employee.profileImage : null,
          address: employee ? employee.address : '',
          qualification: employee ? employee.qualification : '',
          joiningDate: employee ? employee.joiningDate : null,

          // School Details
          school: school ? {
            schoolId: school.schoolId,
            schoolName: school.schoolName,
            schoolCode: school.schoolCode,
            email: school.email,
            mobileNumber: school.mobileNumber
          } : null
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Permitted Profile Details
   */
  static async updateProfile(req, res, next) {
    try {
      const { fullName, mobileNumber, address, qualification } = req.body;

      if (!fullName || !mobileNumber) {
        return res.status(400).json({
          success: false,
          message: 'Full Name and Mobile Number are required.'
        });
      }

      const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
      if (!phoneRegex.test(mobileNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid mobile number.'
        });
      }

      const employee = await EmployeeInfo.findById(req.user.employeeRef);
      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee profile record not found.' });
      }

      employee.fullName = fullName.trim();
      employee.mobileNumber = mobileNumber.trim();
      if (address !== undefined) employee.address = address.trim();
      if (qualification !== undefined) employee.qualification = qualification.trim();

      await employee.save();

      return res.json({
        success: true,
        message: 'Profile updated successfully.',
        employee: {
          fullName: employee.fullName,
          mobileNumber: employee.mobileNumber,
          designation: employee.designation,
          address: employee.address,
          qualification: employee.qualification,
          profileImage: employee.profileImage
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload / Update Profile Image
   */
  static async uploadProfileImage(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please select an image file to upload.'
        });
      }

      const employee = await EmployeeInfo.findById(req.user.employeeRef);
      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee profile record not found.' });
      }

      // If user had an existing custom uploaded image, delete the old file
      if (employee.profileImage) {
        const oldPath = path.join(__dirname, '../../uploads/profiles', path.basename(employee.profileImage));
        if (fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {
            console.warn('[ProfileImage] Could not delete old image file:', e.message);
          }
        }
      }

      const imageRelativeUrl = `/uploads/profiles/${req.file.filename}`;
      employee.profileImage = imageRelativeUrl;
      await employee.save();

      return res.json({
        success: true,
        message: 'Profile image updated successfully.',
        profileImage: imageRelativeUrl
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change Own Password
   */
  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;

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
          message: 'New password cannot be the same as your current password.'
        });
      }

      const newHash = await PasswordService.hashPassword(newPassword);
      user.passwordHash = newHash;
      user.mustChangePassword = false;
      user.isFirstLogin = false;
      await user.save();

      return res.json({
        success: true,
        message: 'Password changed successfully.'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ProfileController;
