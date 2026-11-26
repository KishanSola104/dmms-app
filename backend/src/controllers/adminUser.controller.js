const AdminUserService = require('../services/adminUser.service');

class AdminUserController {
  static async getRoles(req, res, next) {
    try {
      const roles = await AdminUserService.getAvailableRoles();
      return res.json({ success: true, roles });
    } catch (error) {
      next(error);
    }
  }

  static async listUsers(req, res, next) {
    try {
      const { search, role, status, page, limit } = req.query;
      const result = await AdminUserService.listUsers({
        schoolId: req.user.schoolId,
        search,
        role,
        status,
        page,
        limit
      });
      return res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async createUser(req, res, next) {
    try {
      const { fullName, email, mobileNumber, designation, roleCode } = req.body;
      const result = await AdminUserService.createUser({
        schoolId: req.user.schoolId,
        schoolRef: req.user.schoolRef,
        schoolCode: req.school.schoolCode,
        schoolName: req.school.schoolName,
        fullName,
        email,
        mobileNumber,
        designation,
        roleCode,
        adminUser: req.user
      });
      return res.status(201).json({
        success: true,
        message: 'User account created successfully. Credentials have been sent to their email.',
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  static async editUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { fullName, email, mobileNumber, designation, roleCode, address, qualification } = req.body;
      const result = await AdminUserService.editUser({
        schoolId: req.user.schoolId,
        userId,
        fullName,
        email,
        mobileNumber,
        designation,
        roleCode,
        address,
        qualification,
        adminUser: req.user
      });
      return res.json({
        success: true,
        message: 'User details updated successfully.',
        user: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async requestConfirmationCode(req, res, next) {
    try {
      const { action, targetUserId } = req.body;
      const result = await AdminUserService.requestConfirmationCode({
        adminUser: req.user,
        school: req.school,
        action,
        targetUserId
      });
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async deactivateUser(req, res, next) {
    try {
      const { targetUserId, confirmationCode } = req.body;
      const result = await AdminUserService.deactivateUser({
        adminUser: req.user,
        schoolId: req.user.schoolId,
        targetUserId,
        confirmationCode
      });
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async activateUser(req, res, next) {
    try {
      const { targetUserId } = req.body;
      const result = await AdminUserService.activateUser({
        schoolId: req.user.schoolId,
        targetUserId,
        adminUser: req.user
      });
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async deleteUser(req, res, next) {
    try {
      const { targetUserId, confirmationCode } = req.body;
      const result = await AdminUserService.deleteUser({
        adminUser: req.user,
        schoolId: req.user.schoolId,
        targetUserId,
        confirmationCode
      });
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminUserController;
