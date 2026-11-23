const SchoolInfo = require('../models/schoolInfo.model');
const fs = require('fs');
const path = require('path');

class SchoolProfileService {
  /**
   * Helper to format sanitized school profile response
   */
  static formatProfile(school) {
    return {
      _id: school._id,
      schoolId: school.schoolId,
      schoolCode: school.schoolCode,
      schoolName: school.schoolName,
      establishedYear: school.establishedYear,
      email: school.email,
      mobileNumber: school.mobileNumber,
      address: school.address,
      websiteUrl: school.websiteUrl || '',
      contactPersons: school.contactPersons || [],
      schoolLogoUrl: school.schoolLogoUrl || '',
      status: school.status,
      createdAt: school.createdAt,
      updatedAt: school.updatedAt
    };
  }

  /**
   * Get School Profile by School ID
   */
  static async getSchoolProfile(schoolId) {
    if (!schoolId) {
      const err = new Error('School ID is required.');
      err.statusCode = 400;
      throw err;
    }

    const school = await SchoolInfo.findOne({ schoolId: schoolId.toUpperCase().trim() });
    if (!school) {
      const err = new Error('School profile not found.');
      err.statusCode = 404;
      throw err;
    }

    return this.formatProfile(school);
  }

  /**
   * Update School Profile Details
   * Strictly enforces that schoolId, email, passwordHash, and schoolCode are immutable.
   */
  static async updateSchoolProfile(schoolId, updateData = {}) {
    if (!schoolId) {
      const err = new Error('School ID is required.');
      err.statusCode = 400;
      throw err;
    }

    const school = await SchoolInfo.findOne({ schoolId: schoolId.toUpperCase().trim() });
    if (!school) {
      const err = new Error('School profile not found.');
      err.statusCode = 404;
      throw err;
    }

    const {
      schoolName,
      establishedYear,
      mobileNumber,
      address,
      websiteUrl,
      contactPersons,
      schoolLogoUrl
    } = updateData;

    // 1. Validate School Name
    if (!schoolName || typeof schoolName !== 'string' || !schoolName.trim()) {
      const err = new Error('School name is required and cannot be empty.');
      err.statusCode = 400;
      throw err;
    }

    // 2. Validate Established Year
    const currentYear = new Date().getFullYear();
    const estYearNum = parseInt(establishedYear, 10);
    if (isNaN(estYearNum) || estYearNum < 1800 || estYearNum > currentYear) {
      const err = new Error(`Established year must be a valid year between 1800 and ${currentYear}.`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Validate Mobile Number
    const phoneRegex = /^[0-9+\-\s()]{7,15}$/;
    if (!mobileNumber || !phoneRegex.test(mobileNumber.trim())) {
      const err = new Error('Please enter a valid school mobile number (7-15 digits).');
      err.statusCode = 400;
      throw err;
    }

    // 4. Validate Address
    if (!address || typeof address !== 'string' || !address.trim()) {
      const err = new Error('School address is required.');
      err.statusCode = 400;
      throw err;
    }

    // 5. Validate Contact Persons (Must be between 2 and 3)
    if (!contactPersons || !Array.isArray(contactPersons) || contactPersons.length < 2 || contactPersons.length > 3) {
      const err = new Error('School must have between 2 and 3 contact persons.');
      err.statusCode = 400;
      throw err;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validatedContactPersons = [];

    for (let i = 0; i < contactPersons.length; i++) {
      const cp = contactPersons[i];
      if (!cp.fullName || !cp.fullName.trim()) {
        const err = new Error(`Contact person #${i + 1} full name is required.`);
        err.statusCode = 400;
        throw err;
      }
      if (!cp.email || !emailRegex.test(cp.email.trim())) {
        const err = new Error(`Contact person #${i + 1} has an invalid email address.`);
        err.statusCode = 400;
        throw err;
      }
      if (!cp.mobileNumber || !phoneRegex.test(cp.mobileNumber.trim())) {
        const err = new Error(`Contact person #${i + 1} has an invalid mobile number.`);
        err.statusCode = 400;
        throw err;
      }
      if (!cp.designation || !cp.designation.trim()) {
        const err = new Error(`Contact person #${i + 1} designation is required.`);
        err.statusCode = 400;
        throw err;
      }

      validatedContactPersons.push({
        _id: cp._id,
        fullName: cp.fullName.trim(),
        email: cp.email.toLowerCase().trim(),
        mobileNumber: cp.mobileNumber.trim(),
        designation: cp.designation.trim()
      });
    }

    // Apply allowed updates
    school.schoolName = schoolName.trim();
    school.establishedYear = estYearNum;
    school.mobileNumber = mobileNumber.trim();
    school.address = address.trim();
    school.websiteUrl = websiteUrl ? websiteUrl.trim() : '';
    school.contactPersons = validatedContactPersons;

    if (typeof schoolLogoUrl === 'string') {
      school.schoolLogoUrl = schoolLogoUrl.trim();
    }

    // Save
    await school.save();

    return this.formatProfile(school);
  }

  /**
   * Upload / Replace School Logo
   */
  static async uploadSchoolLogo(schoolId, file) {
    if (!schoolId) {
      const err = new Error('School ID is required.');
      err.statusCode = 400;
      throw err;
    }

    if (!file) {
      const err = new Error('Please select an image file to upload.');
      err.statusCode = 400;
      throw err;
    }

    const school = await SchoolInfo.findOne({ schoolId: schoolId.toUpperCase().trim() });
    if (!school) {
      // Remove uploaded file if school doesn't exist
      try {
        fs.unlinkSync(file.path);
      } catch (e) {}
      const err = new Error('School profile not found.');
      err.statusCode = 404;
      throw err;
    }

    // If an existing logo is stored on disk, remove it safely
    if (school.schoolLogoUrl && school.schoolLogoUrl.startsWith('/uploads/logos/')) {
      const oldFileName = path.basename(school.schoolLogoUrl);
      const oldPath = path.join(__dirname, '../../uploads/logos', oldFileName);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (unlinkErr) {
          console.warn('[SchoolProfile] Could not delete old logo:', unlinkErr.message);
        }
      }
    }

    const logoUrl = `/uploads/logos/${file.filename}`;
    school.schoolLogoUrl = logoUrl;
    await school.save();

    return {
      schoolLogoUrl: logoUrl
    };
  }
}

module.exports = SchoolProfileService;
