const mongoose = require('mongoose');

const gradeBandSchema = new mongoose.Schema({
  grade: { type: String, required: true, trim: true, uppercase: true },
  minPercentage: { type: Number, required: true, min: 0, max: 100 },
  maxPercentage: { type: Number, required: true, min: 0, max: 100 },
  minInclusive: { type: Boolean, default: true },
  maxInclusive: { type: Boolean, default: true },
  isPassing: { type: Boolean, default: true },
  description: { type: String, trim: true, default: '' }
}, { _id: false });

const coCurricularGradeOptionSchema = new mongoose.Schema({
  grade: { type: String, required: true, trim: true, uppercase: true },
  points: { type: Number, required: true, min: 0 },
  label: { type: String, trim: true, default: '' }
}, { _id: false });

const schoolResultConfigSchema = new mongoose.Schema({
  schoolRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SchoolInfo',
    required: true
  },
  schoolId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  // Academic final subject calculation rule:
  // Default KBPS formula: (T1 + T2 + T3) / 2 + Project(10) = 100
  academicFinalRule: {
    formulaType: {
      type: String,
      enum: ['SUM_DIVIDED_PLUS_ADDITIONAL', 'WEIGHTED_SUM_PLUS_ADDITIONAL', 'DIRECT_AVERAGE_PLUS_ADDITIONAL'],
      default: 'SUM_DIVIDED_PLUS_ADDITIONAL'
    },
    termSumDivisor: {
      type: Number,
      default: 2,
      min: 0.1
    },
    includeAdditionalComponents: {
      type: Boolean,
      default: true
    },
    expectedExamCount: {
      type: Number,
      default: 3,
      min: 1
    },
    roundingMode: {
      type: String,
      enum: ['ROUND_HALF_UP', 'FLOOR', 'CEIL', 'EXACT_TWO_DECIMALS'],
      default: 'ROUND_HALF_UP'
    }
  },
  // Pass / Absent rules
  passingRules: {
    passingPercentage: {
      type: Number,
      default: 40,
      min: 0,
      max: 100
    },
    requireAllAcademicSubjectsPass: {
      type: Boolean,
      default: true
    },
    absentCountsAsZero: {
      type: Boolean,
      default: true
    },
    absentFailsSubject: {
      type: Boolean,
      default: true
    },
    failResultLabel: {
      type: String,
      default: 'NEEDS IMPROVEMENT',
      trim: true
    },
    passResultLabel: {
      type: String,
      default: 'PASS',
      trim: true
    },
    includeCoCurricularInAcademicTotal: {
      type: Boolean,
      default: false
    }
  },
  // Overall grading bands (KBPS defaults: 90-100 A+, 80-90 A, 70-80 B, 60-70 C, 50-60 D, 40-50 E, <40 F)
  gradingScale: {
    type: [gradeBandSchema],
    default: () => [
      { grade: 'A+', minPercentage: 90, maxPercentage: 100, minInclusive: true, maxInclusive: true, isPassing: true, description: 'Outstanding' },
      { grade: 'A', minPercentage: 80, maxPercentage: 90, minInclusive: true, maxInclusive: false, isPassing: true, description: 'Excellent' },
      { grade: 'B', minPercentage: 70, maxPercentage: 80, minInclusive: true, maxInclusive: false, isPassing: true, description: 'Very Good' },
      { grade: 'C', minPercentage: 60, maxPercentage: 70, minInclusive: true, maxInclusive: false, isPassing: true, description: 'Good' },
      { grade: 'D', minPercentage: 50, maxPercentage: 60, minInclusive: true, maxInclusive: false, isPassing: true, description: 'Satisfactory' },
      { grade: 'E', minPercentage: 40, maxPercentage: 50, minInclusive: true, maxInclusive: false, isPassing: true, description: 'Pass' },
      { grade: 'F', minPercentage: 0, maxPercentage: 40, minInclusive: true, maxInclusive: false, isPassing: false, description: 'Needs Improvement' }
    ]
  },
  // Co-curricular grading scale and final workflow
  coCurricularConfig: {
    finalWorkflow: {
      type: String,
      enum: ['AUTO_AVERAGE', 'SEPARATE_SUBMISSION'],
      default: 'AUTO_AVERAGE'
    },
    roundingRule: {
      type: String,
      enum: ['ROUND_HALF_UP', 'FLOOR', 'CEIL'],
      default: 'ROUND_HALF_UP'
    },
    gradeOptions: {
      type: [coCurricularGradeOptionSchema],
      default: () => [
        { grade: 'A+', points: 6, label: 'Outstanding' },
        { grade: 'A', points: 5, label: 'Excellent' },
        { grade: 'B', points: 4, label: 'Very Good' },
        { grade: 'C', points: 3, label: 'Good' },
        { grade: 'D', points: 2, label: 'Satisfactory' },
        { grade: 'E', points: 1, label: 'Needs Support' }
      ]
    }
  },
  // Display E-signatures on marksheets when uploaded
  useESignaturesOnMarksheet: {
    type: Boolean,
    default: true
  },
  updatedByUserRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    default: null
  }
}, {
  timestamps: true,
  collection: 'school_result_config'
});

module.exports = mongoose.model('SchoolResultConfig', schoolResultConfigSchema);
