const jwt = require('jsonwebtoken');

class AuthService {
  /**
   * Generates a signed JWT token for school session
   */
  static generateSchoolToken(school) {
    const payload = {
      schoolId: school.schoolId,
      schoolRef: school._id,
      schoolName: school.schoolName,
      schoolCode: school.schoolCode,
      type: 'SCHOOL_SESSION'
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'dmms_jwt_secret_key', {
      expiresIn: process.env.JWT_EXPIRE || '24h'
    });
  }

  /**
   * Generates a signed JWT token for user session
   */
  static generateUserToken(user, school, employee) {
    const payload = {
      userId: user.userId,
      userRef: user._id,
      schoolId: user.schoolId,
      schoolRef: user.schoolRef,
      schoolName: school ? school.schoolName : '',
      roleCode: user.roleCode,
      roleName: user.roleName,
      employeeRef: user.employeeRef,
      fullName: employee ? employee.fullName : '',
      email: user.email,
      isFirstLogin: user.isFirstLogin,
      mustChangePassword: user.mustChangePassword,
      type: 'USER_SESSION'
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'dmms_jwt_secret_key', {
      expiresIn: process.env.JWT_EXPIRE || '24h'
    });
  }

  /**
   * Verifies any token
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET || 'dmms_jwt_secret_key');
    } catch (error) {
      return null;
    }
  }
}

module.exports = AuthService;
