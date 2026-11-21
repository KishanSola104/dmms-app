const SchoolInfo = require('../models/schoolInfo.model');

class SchoolIdService {
  /**
   * Generates school code abbreviation from school name
   * @param {string} schoolName
   * @returns {string}
   */
  static generateSchoolCode(schoolName) {
    if (!schoolName || typeof schoolName !== 'string') {
      return 'SCH';
    }

    const cleanName = schoolName.trim().replace(/[^a-zA-Z0-9\s]/g, '');
    const words = cleanName.split(/\s+/).filter(Boolean);

    if (words.length >= 2) {
      const code = words.map(w => w[0].toUpperCase()).join('');
      return code.slice(0, 6);
    } else if (words.length === 1) {
      return words[0].slice(0, 4).toUpperCase();
    }
    return 'SCH';
  }

  /**
   * Generates a unique School ID (e.g. KBPS_001)
   * @param {string} schoolName
   * @returns {Promise<{ schoolCode: string, schoolId: string }>}
   */
  static async generateUniqueSchoolId(schoolName) {
    const schoolCode = this.generateSchoolCode(schoolName);

    // Search for existing school IDs with this pattern
    const pattern = new RegExp(`^${schoolCode}_(\\d+)$`, 'i');
    const existingSchools = await SchoolInfo.find({
      schoolId: { $regex: pattern }
    }).select('schoolId').lean();

    let maxNum = 0;
    for (const school of existingSchools) {
      const match = school.schoolId.match(pattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }

    // Also check total school count to prevent collision if generic
    const totalCount = await SchoolInfo.countDocuments();
    const nextSeq = Math.max(maxNum + 1, 1);
    const padded = String(nextSeq).padStart(3, '0');
    const schoolId = `${schoolCode}_${padded}`;

    return { schoolCode, schoolId };
  }
}

module.exports = SchoolIdService;
