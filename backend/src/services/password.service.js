const bcrypt = require('bcryptjs');

class PasswordService {
  /**
   * Generates a strong random password satisfying complexity requirements:
   * Min 8 chars, uppercase, lowercase, number, special char.
   * @param {number} length
   * @returns {string}
   */
  static generateSecurePassword(length = 10) {
    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$%^&*';

    // Ensure at least one of each required set
    let password = [
      uppers[Math.floor(Math.random() * uppers.length)],
      lowers[Math.floor(Math.random() * lowers.length)],
      numbers[Math.floor(Math.random() * numbers.length)],
      specials[Math.floor(Math.random() * specials.length)]
    ];

    const allChars = uppers + lowers + numbers + specials;
    while (password.length < length) {
      password.push(allChars[Math.floor(Math.random() * allChars.length)]);
    }

    // Shuffle characters
    for (let i = password.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [password[i], password[j]] = [password[j], password[i]];
    }

    return password.join('');
  }

  /**
   * Validates if a password meets complexity rules
   * Minimum 6 characters (or 8), at least one uppercase, one lowercase, one number, one special character
   * @param {string} password
   * @returns {{ isValid: boolean, error?: string }}
   */
  static validatePasswordComplexity(password) {
    if (!password || typeof password !== 'string') {
      return { isValid: false, error: 'Password is required' };
    }
    if (password.length < 6) {
      return { isValid: false, error: 'Password must be at least 6 characters long' };
    }
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one number' };
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      return { isValid: false, error: 'Password must contain at least one special character' };
    }
    return { isValid: true };
  }

  /**
   * Hashes a password using bcrypt
   * @param {string} password
   * @returns {Promise<string>}
   */
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  /**
   * Compares plain password with hashed password
   * @param {string} plain
   * @param {string} hashed
   * @returns {Promise<boolean>}
   */
  static async comparePassword(plain, hashed) {
    return await bcrypt.compare(plain, hashed);
  }
}

module.exports = PasswordService;
