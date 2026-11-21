const AuthService = require('../services/auth.service');
const UserInfo = require('../models/userInfo.model');
const SchoolInfo = require('../models/schoolInfo.model');
const EmployeeInfo = require('../models/employeeInfo.model');

const verifyUserAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required. Please log in.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = AuthService.verifyToken(token);

    if (!decoded || decoded.type !== 'USER_SESSION') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired user session. Please log in again.'
      });
    }

    const user = await UserInfo.findOne({ userId: decoded.userId }).populate('roleRef');
    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'User account not found or is currently inactive.'
      });
    }

    // Verify school status
    const school = await SchoolInfo.findOne({ schoolId: user.schoolId });
    if (!school || school.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'Associated school is inactive or suspended.'
      });
    }

    const employee = await EmployeeInfo.findById(user.employeeRef);

    req.user = user;
    req.school = school;
    req.employee = employee;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication failed: ' + error.message
    });
  }
};

/**
 * Role-Based Access Control Guard
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.roleCode)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user ? req.user.roleCode : 'UNKNOWN'}' is not authorized to access this resource.`
      });
    }
    next();
  };
};

module.exports = { verifyUserAuth, authorizeRoles };
