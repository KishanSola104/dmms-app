const SchoolResultConfig = require('../models/schoolResultConfig.model');
const SchoolInfo = require('../models/schoolInfo.model');

class SchoolResultConfigService {
  /**
   * Retrieve or initialize default SchoolResultConfig for a school
   */
  static async getOrCreateConfig(schoolId) {
    const sId = schoolId.toUpperCase().trim();
    let config = await SchoolResultConfig.findOne({ schoolId: sId }).lean();
    if (!config) {
      const school = await SchoolInfo.findOne({ schoolId: sId });
      if (!school) {
        const err = new Error('School not found.');
        err.statusCode = 404;
        throw err;
      }
      const created = new SchoolResultConfig({
        schoolRef: school._id,
        schoolId: sId
      });
      await created.save();
      config = created.toObject();
    }
    return config;
  }

  /**
   * Admin update of result calculation & grading policy (increments version!)
   */
  static async updateConfig(schoolId, userId, payload = {}) {
    const sId = schoolId.toUpperCase().trim();
    let config = await SchoolResultConfig.findOne({ schoolId: sId });
    if (!config) {
      const school = await SchoolInfo.findOne({ schoolId: sId });
      if (!school) {
        const err = new Error('School not found.');
        err.statusCode = 404;
        throw err;
      }
      config = new SchoolResultConfig({ schoolRef: school._id, schoolId: sId });
    }

    if (payload.academicFinalRule) {
      const r = payload.academicFinalRule;
      if (r.formulaType && ['SUM_DIVIDED_PLUS_ADDITIONAL', 'WEIGHTED_SUM_PLUS_ADDITIONAL', 'DIRECT_AVERAGE_PLUS_ADDITIONAL'].includes(r.formulaType)) {
        config.academicFinalRule.formulaType = r.formulaType;
      }
      if (r.termSumDivisor !== undefined) {
        const d = Number(r.termSumDivisor);
        if (isNaN(d) || d <= 0) throw new Error('Term sum divisor must be greater than 0.');
        config.academicFinalRule.termSumDivisor = d;
      }
      if (r.includeAdditionalComponents !== undefined) {
        config.academicFinalRule.includeAdditionalComponents = !!r.includeAdditionalComponents;
      }
      if (r.expectedExamCount !== undefined) {
        const c = parseInt(r.expectedExamCount, 10);
        if (isNaN(c) || c < 1) throw new Error('Expected exam count must be at least 1.');
        config.academicFinalRule.expectedExamCount = c;
      }
      if (r.roundingMode && ['ROUND_HALF_UP', 'FLOOR', 'CEIL', 'EXACT_TWO_DECIMALS'].includes(r.roundingMode)) {
        config.academicFinalRule.roundingMode = r.roundingMode;
      }
    }

    if (payload.passingRules) {
      const p = payload.passingRules;
      if (p.passingPercentage !== undefined) {
        const pct = Number(p.passingPercentage);
        if (isNaN(pct) || pct < 0 || pct > 100) throw new Error('Passing percentage must be between 0 and 100.');
        config.passingRules.passingPercentage = pct;
      }
      if (p.requireAllAcademicSubjectsPass !== undefined) {
        config.passingRules.requireAllAcademicSubjectsPass = !!p.requireAllAcademicSubjectsPass;
      }
      if (p.absentCountsAsZero !== undefined) {
        config.passingRules.absentCountsAsZero = !!p.absentCountsAsZero;
      }
      if (p.absentFailsSubject !== undefined) {
        config.passingRules.absentFailsSubject = !!p.absentFailsSubject;
      }
      if (p.failResultLabel) {
        config.passingRules.failResultLabel = String(p.failResultLabel).trim().toUpperCase();
      }
      if (p.passResultLabel) {
        config.passingRules.passResultLabel = String(p.passResultLabel).trim().toUpperCase();
      }
      if (p.includeCoCurricularInAcademicTotal !== undefined) {
        config.passingRules.includeCoCurricularInAcademicTotal = !!p.includeCoCurricularInAcademicTotal;
      }
    }

    if (Array.isArray(payload.gradingScale) && payload.gradingScale.length > 0) {
      config.gradingScale = payload.gradingScale.map(b => ({
        grade: String(b.grade).trim().toUpperCase(),
        minPercentage: Number(b.minPercentage),
        maxPercentage: Number(b.maxPercentage),
        minInclusive: b.minInclusive !== undefined ? !!b.minInclusive : true,
        maxInclusive: b.maxInclusive !== undefined ? !!b.maxInclusive : false,
        isPassing: b.isPassing !== undefined ? !!b.isPassing : true,
        description: b.description || ''
      }));
    }

    if (payload.coCurricularConfig) {
      const cc = payload.coCurricularConfig;
      if (cc.finalWorkflow && ['AUTO_AVERAGE', 'SEPARATE_SUBMISSION'].includes(cc.finalWorkflow)) {
        config.coCurricularConfig.finalWorkflow = cc.finalWorkflow;
      }
      if (cc.roundingRule && ['ROUND_HALF_UP', 'FLOOR', 'CEIL'].includes(cc.roundingRule)) {
        config.coCurricularConfig.roundingRule = cc.roundingRule;
      }
      if (Array.isArray(cc.gradeOptions) && cc.gradeOptions.length > 0) {
        config.coCurricularConfig.gradeOptions = cc.gradeOptions.map(g => ({
          grade: String(g.grade).trim().toUpperCase(),
          points: Number(g.points),
          label: g.label || ''
        }));
      }
    }

    if (payload.useESignaturesOnMarksheet !== undefined) {
      config.useESignaturesOnMarksheet = !!payload.useESignaturesOnMarksheet;
    }

    config.version = (config.version || 1) + 1;
    config.updatedByUserRef = userId || null;
    await config.save();
    return config.toObject();
  }

  /**
   * Pure calculation helpers driven by configSnapshot
   */
  static roundNumber(value, mode = 'ROUND_HALF_UP') {
    const num = Number(value) || 0;
    switch (mode) {
      case 'FLOOR':
        return Math.floor(num);
      case 'CEIL':
        return Math.ceil(num);
      case 'EXACT_TWO_DECIMALS':
        return Math.round(num * 100) / 100;
      case 'ROUND_HALF_UP':
      default:
        return Math.round(num);
    }
  }

  static computeGradeFromPercentage(percentage, config) {
    const pct = Number(percentage) || 0;
    const bands = Array.isArray(config?.gradingScale) ? config.gradingScale : [];
    for (const band of bands) {
      const minOk = band.minInclusive !== false ? pct >= band.minPercentage : pct > band.minPercentage;
      const maxOk = band.maxInclusive ? pct <= band.maxPercentage : pct < band.maxPercentage;
      if (minOk && maxOk) {
        return { grade: band.grade, isPassing: band.isPassing !== false };
      }
    }
    if (pct >= 100 && bands.length > 0) {
      const top = [...bands].sort((a, b) => b.maxPercentage - a.maxPercentage)[0];
      return { grade: top.grade, isPassing: top.isPassing !== false };
    }
    return { grade: 'F', isPassing: false };
  }

  static computeFinalAcademicSubject({ termEntries = [], additionalObtained = 0, additionalMax = 0, config }) {
    const rule = config?.academicFinalRule || {};
    const divisor = Number(rule.termSumDivisor) || 2;
    const includeAdditional = rule.includeAdditionalComponents !== false;
    const roundingMode = rule.roundingMode || 'ROUND_HALF_UP';

    const termSumObtained = termEntries.reduce((s, t) => s + (Number(t.totalObtained) || 0), 0);
    const termSumMax = termEntries.reduce((s, t) => s + (Number(t.totalMaximum) || 0), 0);

    let termPortionObtained = 0;
    let termPortionMax = 0;

    if (rule.formulaType === 'DIRECT_AVERAGE_PLUS_ADDITIONAL') {
      const cnt = termEntries.length || 1;
      termPortionObtained = termSumObtained / cnt;
      termPortionMax = termSumMax / cnt;
    } else {
      // Default KBPS: (T1 + T2 + T3) / divisor
      termPortionObtained = termSumObtained / divisor;
      termPortionMax = termSumMax / divisor;
    }

    const addObt = includeAdditional ? (Number(additionalObtained) || 0) : 0;
    const addMax = includeAdditional ? (Number(additionalMax) || 0) : 0;

    const finalMarksObtained = this.roundNumber(termPortionObtained + addObt, roundingMode);
    const finalMaxMarks = this.roundNumber(termPortionMax + addMax, roundingMode);
    const percentage = finalMaxMarks > 0 ? Math.round((finalMarksObtained / finalMaxMarks) * 10000) / 100 : 0;
    const { grade, isPassing } = this.computeGradeFromPercentage(percentage, config);

    return {
      finalMarksObtained,
      finalMaxMarks,
      percentage,
      grade,
      isPassing: isPassing && percentage >= (config?.passingRules?.passingPercentage ?? 40)
    };
  }

  static computeCoCurricularFinalGrade(termGradeStrings = [], config) {
    const cc = config?.coCurricularConfig || {};
    const options = Array.isArray(cc.gradeOptions) ? cc.gradeOptions : [];
    const pointMap = new Map();
    for (const opt of options) {
      pointMap.set(String(opt.grade).toUpperCase(), Number(opt.points));
    }

    const validPoints = termGradeStrings
      .map(g => pointMap.get(String(g || '').toUpperCase()))
      .filter(p => p !== undefined && !isNaN(p));

    if (validPoints.length === 0 || options.length === 0) {
      return { finalGrade: '', finalGradePoint: null };
    }

    const avg = validPoints.reduce((s, p) => s + p, 0) / validPoints.length;
    let roundedPoint;
    if (cc.roundingRule === 'FLOOR') roundedPoint = Math.floor(avg);
    else if (cc.roundingRule === 'CEIL') roundedPoint = Math.ceil(avg);
    else roundedPoint = Math.round(avg);

    // Find closest matching grade option
    let best = options[0];
    let minDiff = Math.abs(options[0].points - roundedPoint);
    for (const opt of options) {
      const diff = Math.abs(opt.points - roundedPoint);
      if (diff < minDiff) {
        minDiff = diff;
        best = opt;
      }
    }

    return { finalGrade: best.grade, finalGradePoint: roundedPoint };
  }
}

module.exports = SchoolResultConfigService;
