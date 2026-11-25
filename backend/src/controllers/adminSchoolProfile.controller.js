const SchoolProfileService = require('../services/schoolProfile.service');
const SchoolResultConfigService = require('../services/schoolResultConfig.service');

class AdminSchoolProfileController {
  /**
   * Get School Profile for the authenticated Admin's school
   */
  static async getSchoolProfile(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const profile = await SchoolProfileService.getSchoolProfile(schoolId);

      return res.json({
        success: true,
        school: profile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update School Profile Details
   */
  static async updateSchoolProfile(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const updatedProfile = await SchoolProfileService.updateSchoolProfile(schoolId, req.body);

      return res.json({
        success: true,
        message: 'School profile updated successfully.',
        school: updatedProfile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload / Replace School Logo
   */
  static async uploadLogo(req, res, next) {
    try {
      const schoolId = req.user.schoolId;
      const result = await SchoolProfileService.uploadSchoolLogo(schoolId, req.file);

      return res.json({
        success: true,
        message: 'School logo uploaded successfully.',
        schoolLogoUrl: result.schoolLogoUrl
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get School Result & Grading Configuration
   */
  static async getResultConfig(req, res, next) {
    try {
      const config = await SchoolResultConfigService.getOrCreateConfig(req.user.schoolId);
      return res.json({ success: true, config });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update School Result & Grading Configuration
   */
  static async updateResultConfig(req, res, next) {
    try {
      const config = await SchoolResultConfigService.updateConfig(
        req.user.schoolId,
        req.user._id,
        req.body
      );
      return res.json({
        success: true,
        message: `Result & grading policy updated (Version ${config.version}).`,
        config
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminSchoolProfileController;
