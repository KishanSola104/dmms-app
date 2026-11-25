const mongoose = require('mongoose');

const finalTermBreakdownSchema = new mongoose.Schema({
  examinationRef: { type: mongoose.Schema.Types.ObjectId, ref: 'ExaminationInfo', required: true },
  examinationCode: { type: String, required: true, trim: true },
  examinationName: { type: String, required: true, trim: true },
  components: { type: Array, default: [] },
  totalObtained: { type: Number, default: 0 },
  totalMaximum: { type: Number, default: 0 },
  isAbsent: { type: Boolean, default: false }
}, { _id: false });

const finalAcademicSubjectSchema = new mongoose.Schema({
  subjectRef: { type: mongoose.Schema.Types.ObjectId, ref: 'SubjectInfo', required: true },
  subjectCode: { type: String, required: true, trim: true },
  subjectName: { type: String, required: true, trim: true },
  termResults: { type: [finalTermBreakdownSchema], default: [] },
  additionalComponents: { type: Array, default: [] },
  additionalMarksObtained: { type: Number, default: 0 },
  additionalMarksMax: { type: Number, default: 0 },
  finalMarksObtained: { type: Number, default: 0 },
  finalMaxMarks: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  grade: { type: String, default: '' },
  isPassing: { type: Boolean, default: true }
}, { _id: false });

const finalCoCurricularSubjectSchema = new mongoose.Schema({
  subjectRef: { type: mongoose.Schema.Types.ObjectId, ref: 'SubjectInfo', required: true },
  subjectCode: { type: String, required: true, trim: true },
  subjectName: { type: String, required: true, trim: true },
  termGrades: { type: Array, default: [] },
  finalGrade: { type: String, default: '' },
  finalGradePoint: { type: Number, default: null },
  workflowUsed: { type: String, enum: ['AUTO_AVERAGE', 'SEPARATE_SUBMISSION'], default: 'AUTO_AVERAGE' }
}, { _id: false });

const finalAcademicResultInfoSchema = new mongoose.Schema({
  schoolRef: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolInfo', required: true },
  schoolId: { type: String, required: true, trim: true, uppercase: true },
  academicYearRef: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYearInfo', required: true },
  academicYearName: { type: String, required: true, trim: true },
  classRef: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassInfo', required: true },
  className: { type: String, required: true, trim: true },
  sectionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'SectionInfo', required: true },
  sectionName: { type: String, required: true, trim: true },
  studentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentInfo', required: true },
  enrollmentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentEnrollmentInfo', required: true },
  admissionNumber: { type: String, trim: true, default: '' },
  studentName: { type: String, required: true, trim: true },
  rollNumber: { type: String, trim: true, default: '' },
  examinationsIncluded: { type: Array, default: [] },
  academicSubjects: { type: [finalAcademicSubjectSchema], default: [] },
  coCurricularSubjects: { type: [finalCoCurricularSubjectSchema], default: [] },
  overallTotalObtained: { type: Number, default: 0 },
  overallMaxMarks: { type: Number, default: 0 },
  finalPercentage: { type: Number, default: 0 },
  overallGrade: { type: String, default: '' },
  resultStatus: {
    type: String,
    enum: ['PASS', 'NEEDS IMPROVEMENT', 'FAIL', 'INCOMPLETE'],
    default: 'PASS'
  },
  promotionStatus: {
    type: String,
    enum: ['PROMOTED', 'RETAINED', 'PENDING'],
    default: 'PROMOTED'
  },
  termRemarks: { type: Array, default: [] },
  finalRemark: { type: String, trim: true, default: '' },
  finalRemarkApproved: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['GENERATED', 'SUBMITTED_TO_HEAD_TEACHER', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'PUBLISHED'],
    default: 'GENERATED'
  },
  version: { type: Number, default: 1, min: 1 },
  configVersion: { type: Number, default: 1 },
  configSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  generatedByUserRef: { type: mongoose.Schema.Types.ObjectId, ref: 'UserInfo', required: true },
  generatedByEmployeeRef: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeInfo', default: null },
  generatedAt: { type: Date, default: Date.now },
  submittedByUserRef: { type: mongoose.Schema.Types.ObjectId, ref: 'UserInfo', default: null },
  submittedAt: { type: Date, default: null },
  reviewedByUserRef: { type: mongoose.Schema.Types.ObjectId, ref: 'UserInfo', default: null },
  reviewedAt: { type: Date, default: null },
  returnedByUserRef: { type: mongoose.Schema.Types.ObjectId, ref: 'UserInfo', default: null },
  returnedAt: { type: Date, default: null },
  returnReason: { type: String, trim: true, default: '' },
  approvedByUserRef: { type: mongoose.Schema.Types.ObjectId, ref: 'UserInfo', default: null },
  approvedAt: { type: Date, default: null },
  publishedByUserRef: { type: mongoose.Schema.Types.ObjectId, ref: 'UserInfo', default: null },
  publishedAt: { type: Date, default: null }
}, {
  timestamps: true,
  collection: 'final_academic_result_info'
});

finalAcademicResultInfoSchema.index(
  { schoolId: 1, academicYearRef: 1, classRef: 1, sectionRef: 1, studentRef: 1 },
  { unique: true }
);
finalAcademicResultInfoSchema.index({ schoolId: 1, academicYearRef: 1, classRef: 1, sectionRef: 1, status: 1 });

module.exports = mongoose.model('FinalAcademicResultInfo', finalAcademicResultInfoSchema);
