const UserInfo = require('../models/userInfo.model');
const EmployeeInfo = require('../models/employeeInfo.model');
const RoleInfo = require('../models/roleInfo.model');
const SchoolInfo = require('../models/schoolInfo.model');
const ClassInfo = require('../models/classInfo.model');
const SectionInfo = require('../models/sectionInfo.model');
const ConfirmationCode = require('../models/confirmationCode.model');
const UserIdService = require('./userId.service');
const PasswordService = require('./password.service');
const EmailService = require('./email.service');
const bcrypt = require('bcryptjs');

class AdminUserService {
  /**
   * Get dynamic active roles from role_info
   */
  static async getAvailableRoles() {
    return await RoleInfo.find({ status: 'ACTIVE' })
      .select('roleCode roleName description')
      .sort({ roleCode: 1 });
  }

  /**
   * List users for a school with search, filters, and pagination
   */
  static async listUsers({ schoolId, search = '', role = '', status = '', page = 1, limit = 10 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);
    const skip = (pageNum - 1) * limitNum;

    const query = { schoolId };

    // Role filter
    if (role && role !== 'ALL') {
      query.roleCode = role.toUpperCase();
    }

    // Status filter
    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        query.status = 'ACTIVE';
      } else if (status === 'INACTIVE' || status === 'DEACTIVATED') {
        query.status = 'INACTIVE';
      }
    }

    // Fetch users with populated employeeRef
    let usersQuery = UserInfo.find(query)
      .populate('employeeRef')
      .populate('roleRef')
      .sort({ createdAt: -1 });

    const allMatching = await usersQuery;

    // Search filter across Full Name, Email, and User ID
    let filtered = allMatching;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = allMatching.filter(u => {
        const fullName = u.employeeRef?.fullName?.toLowerCase() || '';
        const email = u.email?.toLowerCase() || '';
        const userId = u.userId?.toLowerCase() || '';
        return fullName.includes(q) || email.includes(q) || userId.includes(q);
      });
    }

    const totalRecords = filtered.length;
    const paginated = filtered.slice(skip, skip + limitNum);

    const formatted = paginated.map(u => ({
      _id: u._id,
      userId: u.userId,
      fullName: u.employeeRef?.fullName || 'N/A',
      email: u.email,
      mobileNumber: u.employeeRef?.mobileNumber || 'N/A',
      designation: u.employeeRef?.designation || u.roleName,
      roleCode: u.roleCode,
      roleName: u.roleName,
      roleRef: u.roleRef?._id,
      employeeRef: u.employeeRef?._id,
      address: u.employeeRef?.address || '',
      qualification: u.employeeRef?.qualification || '',
      status: u.status,
      isFirstLogin: u.isFirstLogin,
      createdAt: u.createdAt
    }));

    return {
      users: formatted,
      pagination: {
        totalRecords,
        currentPage: pageNum,
        totalPages: Math.ceil(totalRecords / limitNum) || 1,
        limit: limitNum
      }
    };
  }

  /**
   * Validate role limits
   */
  static async validateRoleLimit(schoolId, targetRoleCode, excludeUserId = null) {
    const code = targetRoleCode.toUpperCase();
    const query = { schoolId, roleCode: code, status: { $ne: 'DELETED' } };
    if (excludeUserId) {
      query.userId = { $ne: excludeUserId };
    }

    const currentCount = await UserInfo.countDocuments(query);

    if (code === 'ADMIN' && currentCount >= 2) {
      throw new Error('Maximum limit reached for School Administrator (Limit: 2 per school).');
    }
    if (code === 'HEAD_TEACHER' && currentCount >= 1) {
      throw new Error('Maximum limit reached for Head Teacher (Limit: 1 per school).');
    }

    return true;
  }

  /**
   * Create a new user account
   */
  static async createUser({ schoolId, schoolRef, schoolCode, schoolName, fullName, email, mobileNumber, designation, roleCode }) {
    if (!fullName || !email || !mobileNumber || !roleCode) {
      throw new Error('Full Name, Email, Mobile Number, and Role are mandatory.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please provide a valid email address.');
    }

    const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
    if (!phoneRegex.test(mobileNumber)) {
      throw new Error('Please provide a valid mobile number.');
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check duplicate email within this school
    const existingUser = await UserInfo.findOne({ schoolId, email: cleanEmail });
    if (existingUser) {
      throw new Error(`A user with email '${cleanEmail}' already exists in this school.`);
    }

    // Verify role exists
    const roleDoc = await RoleInfo.findOne({ roleCode: roleCode.toUpperCase(), status: 'ACTIVE' });
    if (!roleDoc) {
      throw new Error(`Role '${roleCode}' is invalid or inactive.`);
    }

    // Enforce role limits
    await this.validateRoleLimit(schoolId, roleDoc.roleCode);

    // Create Employee record
    const employee = new EmployeeInfo({
      schoolRef,
      schoolId,
      fullName: fullName.trim(),
      email: cleanEmail,
      mobileNumber: mobileNumber.trim(),
      designation: designation?.trim() || roleDoc.roleName,
      joiningDate: new Date()
    });
    const savedEmployee = await employee.save();

    // Generate unique User ID
    const userId = await UserIdService.generateUniqueUserId(fullName, schoolCode);

    // Generate temporary password & hash
    const rawPassword = PasswordService.generateSecurePassword(10);
    const passwordHash = await PasswordService.hashPassword(rawPassword);

    // Create User account
    const user = new UserInfo({
      userId,
      schoolRef,
      schoolId,
      employeeRef: savedEmployee._id,
      roleRef: roleDoc._id,
      roleCode: roleDoc.roleCode,
      roleName: roleDoc.roleName,
      email: cleanEmail,
      passwordHash,
      isFirstLogin: true,
      mustChangePassword: true,
      status: 'ACTIVE'
    });
    const savedUser = await user.save();

    // Send credentials email
    let emailDelivered = false;
    try {
      const mailRes = await EmailService.sendUserCredentials({
        userEmail: cleanEmail,
        userName: fullName.trim(),
        schoolName,
        schoolId,
        userId,
        tempPassword: rawPassword,
        roleName: roleDoc.roleName
      });
      emailDelivered = mailRes.success;
    } catch (err) {
      console.error('[AdminUserService] Error sending credentials email:', err.message);
    }

    return {
      user: {
        userId: savedUser.userId,
        employeeRef: savedEmployee._id,
        employeeId: savedEmployee._id,
        fullName: savedEmployee.fullName,
        email: savedUser.email,
        mobileNumber: savedEmployee.mobileNumber,
        roleCode: savedUser.roleCode,
        roleName: savedUser.roleName,
        status: savedUser.status,
        emailDelivered
      }
    };
  }

  /**
   * Edit existing user
   */
  static async editUser({ schoolId, userId, fullName, email, mobileNumber, designation, roleCode, address, qualification }) {
    const user = await UserInfo.findOne({ schoolId, userId }).populate('roleRef');
    if (!user) {
      throw new Error('User not found.');
    }

    const employee = await EmployeeInfo.findById(user.employeeRef);
    if (!employee) {
      throw new Error('Employee profile not found.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      throw new Error('Please provide a valid email address.');
    }

    const cleanEmail = email ? email.toLowerCase().trim() : user.email;

    // Check duplicate email if changed
    if (cleanEmail !== user.email) {
      const duplicate = await UserInfo.findOne({ schoolId, email: cleanEmail, userId: { $ne: userId } });
      if (duplicate) {
        throw new Error(`Another user with email '${cleanEmail}' already exists in this school.`);
      }
      user.email = cleanEmail;
      employee.email = cleanEmail;
    }

    // Role check if changing
    if (roleCode && roleCode.toUpperCase() !== user.roleCode) {
      const newRole = await RoleInfo.findOne({ roleCode: roleCode.toUpperCase(), status: 'ACTIVE' });
      if (!newRole) {
        throw new Error(`Role '${roleCode}' is invalid.`);
      }

      // Check role limit for target role
      await this.validateRoleLimit(schoolId, newRole.roleCode, userId);

      // Check if user is the last Admin
      if (user.roleCode === 'ADMIN') {
        const remainingAdmins = await UserInfo.countDocuments({ schoolId, roleCode: 'ADMIN', status: 'ACTIVE', userId: { $ne: userId } });
        if (remainingAdmins < 1) {
          throw new Error('Cannot change role of the last remaining School Administrator.');
        }
      }

      user.roleRef = newRole._id;
      user.roleCode = newRole.roleCode;
      user.roleName = newRole.roleName;
    }

    if (fullName) {
      employee.fullName = fullName.trim();
    }
    if (mobileNumber) {
      employee.mobileNumber = mobileNumber.trim();
    }
    if (designation) {
      employee.designation = designation.trim();
    }
    if (address !== undefined) {
      employee.address = address.trim();
    }
    if (qualification !== undefined) {
      employee.qualification = qualification.trim();
    }

    await employee.save();
    await user.save();

    return {
      userId: user.userId,
      fullName: employee.fullName,
      email: user.email,
      mobileNumber: employee.mobileNumber,
      designation: employee.designation,
      roleCode: user.roleCode,
      roleName: user.roleName,
      status: user.status
    };
  }

  /**
   * Request confirmation code for Deactivate or Delete user
   */
  static async requestConfirmationCode({ adminUser, school, action, targetUserId }) {
    if (!['DEACTIVATE_USER', 'DELETE_USER'].includes(action)) {
      throw new Error('Invalid action for confirmation code.');
    }

    if (adminUser.userId === targetUserId) {
      throw new Error(`Administrators cannot ${action === 'DELETE_USER' ? 'delete' : 'deactivate'} their own account.`);
    }

    const targetUser = await UserInfo.findOne({ schoolId: adminUser.schoolId, userId: targetUserId }).populate('employeeRef');
    if (!targetUser) {
      throw new Error('Target user not found.');
    }

    if (targetUser.roleCode === 'ADMIN') {
      const activeAdmins = await UserInfo.countDocuments({
        schoolId: adminUser.schoolId,
        roleCode: 'ADMIN',
        status: 'ACTIVE',
        userId: { $ne: targetUserId }
      });
      if (activeAdmins < 1) {
        throw new Error('Operation denied: school must retain at least one active School Administrator.');
      }
    }

    // Generate random 6-digit OTP code
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(rawCode, 10);

    // Invalidate existing unused codes for this action/target
    await ConfirmationCode.deleteMany({
      adminUserId: adminUser.userId,
      schoolId: adminUser.schoolId,
      action,
      targetUserId
    });

    // Save confirmation code (TTL 10 min)
    await ConfirmationCode.create({
      adminUserId: adminUser.userId,
      adminEmail: adminUser.email,
      schoolId: adminUser.schoolId,
      action,
      targetUserId,
      codeHash,
      attempts: 0
    });

    // Send email with confirmation code to Admin's registered email
    const mailResult = await EmailService.sendAdminConfirmationOtp({
      adminEmail: adminUser.email,
      adminName: adminUser.fullName || adminUser.userId,
      schoolName: school.schoolName,
      action,
      targetUserName: targetUser.employeeRef?.fullName || targetUser.userId,
      code: rawCode
    });

    return {
      success: true,
      message: `A 6-digit confirmation code has been sent to your registered email (${adminUser.email}). It will expire in 10 minutes.`,
      emailDelivered: mailResult.success
    };
  }

  /**
   * Verify confirmation code helper
   */
  static async verifyConfirmationCode({ adminUserId, schoolId, action, targetUserId, code }) {
    if (!code || typeof code !== 'string' || code.trim().length !== 6) {
      throw new Error('Please enter a valid 6-digit confirmation code.');
    }

    const record = await ConfirmationCode.findOne({
      adminUserId,
      schoolId,
      action,
      targetUserId,
      isUsed: false
    });

    if (!record) {
      throw new Error('No active confirmation request found or the code has expired. Please request a new code.');
    }

    if (record.attempts >= 5) {
      await ConfirmationCode.deleteOne({ _id: record._id });
      throw new Error('Too many incorrect attempts. This confirmation code has been invalidated for security. Please request a new one.');
    }

    const isMatch = await bcrypt.compare(code.trim(), record.codeHash);
    if (!isMatch) {
      record.attempts += 1;
      await record.save();
      const remaining = 5 - record.attempts;
      throw new Error(`Invalid confirmation code. ${remaining} attempt(s) remaining.`);
    }

    // Mark as used & delete
    await ConfirmationCode.deleteOne({ _id: record._id });
    return true;
  }

  /**
   * Deactivate User (requires confirmation code)
   */
  static async deactivateUser({ adminUser, schoolId, targetUserId, confirmationCode }) {
    if (adminUser.userId === targetUserId) {
      throw new Error('Administrators cannot deactivate their own account.');
    }

    await this.verifyConfirmationCode({
      adminUserId: adminUser.userId,
      schoolId,
      action: 'DEACTIVATE_USER',
      targetUserId,
      code: confirmationCode
    });

    const targetUser = await UserInfo.findOne({ schoolId, userId: targetUserId });
    if (!targetUser) {
      throw new Error('Target user not found.');
    }

    if (targetUser.roleCode === 'ADMIN') {
      const activeAdmins = await UserInfo.countDocuments({
        schoolId,
        roleCode: 'ADMIN',
        status: 'ACTIVE',
        userId: { $ne: targetUserId }
      });
      if (activeAdmins < 1) {
        throw new Error('Cannot deactivate the last remaining School Administrator.');
      }
    }

    targetUser.status = 'INACTIVE';
    await targetUser.save();

    return {
      success: true,
      message: `User account '${targetUserId}' has been deactivated successfully.`
    };
  }

  /**
   * Activate User
   */
  static async activateUser({ schoolId, targetUserId }) {
    const targetUser = await UserInfo.findOne({ schoolId, userId: targetUserId });
    if (!targetUser) {
      throw new Error('User not found.');
    }

    targetUser.status = 'ACTIVE';
    await targetUser.save();

    return {
      success: true,
      message: `User account '${targetUserId}' has been activated.`
    };
  }

  /**
   * Delete User (requires confirmation code and safety checks)
   */
  static async deleteUser({ adminUser, schoolId, targetUserId, confirmationCode }) {
    if (adminUser.userId === targetUserId) {
      throw new Error('Administrators cannot delete their own account.');
    }

    await this.verifyConfirmationCode({
      adminUserId: adminUser.userId,
      schoolId,
      action: 'DELETE_USER',
      targetUserId,
      code: confirmationCode
    });

    const targetUser = await UserInfo.findOne({ schoolId, userId: targetUserId });
    if (!targetUser) {
      throw new Error('Target user not found.');
    }

    if (targetUser.roleCode === 'ADMIN') {
      const activeAdmins = await UserInfo.countDocuments({
        schoolId,
        roleCode: 'ADMIN',
        status: 'ACTIVE',
        userId: { $ne: targetUserId }
      });
      if (activeAdmins < 1) {
        throw new Error('Cannot delete the last remaining School Administrator.');
      }
    }

    // Protect academic records: check if user is assigned as class teacher or section teacher
    const classAssigned = await ClassInfo.findOne({ schoolId, classTeacherRef: targetUser.employeeRef });
    if (classAssigned) {
      throw new Error(`Cannot delete user: user is assigned as Class Teacher for class '${classAssigned.className}'. Please reassign the class teacher first.`);
    }

    const sectionAssigned = await SectionInfo.findOne({ schoolId, sectionTeacherRef: targetUser.employeeRef });
    if (sectionAssigned) {
      throw new Error(`Cannot delete user: user is assigned as Section Teacher for section '${sectionAssigned.sectionName}' (${sectionAssigned.className}). Please reassign the section teacher first.`);
    }

    // Safely remove user and employee
    await EmployeeInfo.deleteOne({ _id: targetUser.employeeRef });
    await UserInfo.deleteOne({ _id: targetUser._id });

    return {
      success: true,
      message: `User account '${targetUserId}' and employee record have been deleted safely.`
    };
  }
}

module.exports = AdminUserService;
