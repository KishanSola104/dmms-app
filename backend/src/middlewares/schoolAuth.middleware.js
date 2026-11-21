const AuthService = require('../services/auth.service');
const SchoolInfo = require('../models/schoolInfo.model');

const verifySchoolSession = async (req, res, next) => {
  try {
    const authHeader = req.headers['x-school-token'] || req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'School authentication required. Please authenticate the school first.'
      });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    const decoded = AuthService.verifyToken(token);

    if (!decoded || decoded.type !== 'SCHOOL_SESSION') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired school session. Please log in to your school again.'
      });
    }

    const school = await SchoolInfo.findOne({ schoolId: decoded.schoolId });
    if (!school || school.status !== 'ACTIVE') {
      return res.status(401).json({
        success: false,
        message: 'School not found or is currently inactive.'
      });
    }

    req.school = school;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'School authorization check failed: ' + error.message
    });
  }
};

module.exports = { verifySchoolSession };
