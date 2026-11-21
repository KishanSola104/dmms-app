const UserInfo = require('../models/userInfo.model');

class UserIdService {
  /**
   * Generates initials from full name
   * @param {string} fullName
   * @returns {string}
   */
  static getInitials(fullName) {
    if (!fullName || typeof fullName !== 'string') {
      return 'USR';
    }

    const cleanName = fullName.trim().replace(/[^a-zA-Z\s]/g, '');
    const words = cleanName.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
      return words.map(w => w[0].toUpperCase()).join('');
    } else if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return 'USR';
  }

  /**
   * Generates unique User ID / Admin ID (e.g. KSKBPS_001 or KGSKBPS_001)
   * @param {string} fullName
   * @param {string} schoolCode
   * @returns {Promise<string>}
   */
  static async generateUniqueUserId(fullName, schoolCode) {
    const initials = this.getInitials(fullName);
    const prefix = `${initials}${schoolCode.toUpperCase()}`;

    const pattern = new RegExp(`^${prefix}_(\\d+)$`, 'i');
    const existingUsers = await UserInfo.find({
      userId: { $regex: pattern }
    }).select('userId').lean();

    let maxNum = 0;
    for (const u of existingUsers) {
      const match = u.userId.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }

    const nextSeq = maxNum + 1;
    const padded = String(nextSeq).padStart(3, '0');
    return `${prefix}_${padded}`;
  }
}

module.exports = UserIdService;
