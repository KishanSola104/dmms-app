const mongoose = require('mongoose');

const resultComponentSchema = new mongoose.Schema({
  componentName: { type: String, required: true, trim: true },
  maximumMarks: { type: Number, required: true, min: 0 },
  marksObtained: { type: Number, default: 0, min: 0 }
}, { _id: false });

const resultAcademicSubjectSchema = new mongoose.Schema({
  subjectRef: { type: mongoose.Schema.Types.ObjectId, ref: 'SubjectInfo', required: true },
  subjectCode: { type: String, required: true, trim: true },
  subjectName: { type: String, required: true, trim: true },
  components: { type: [resultComponentSchema], default: [] },
  totalMaximumMarks: { type: Number, default: 0 },
  totalMarksObtained: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  grade: { type: String, default: '' },
  isAbsent: { type: Boolean, default: false },
  isPassing: { type: Boolean, default: true }
}, { _id: false });

const resultCoCurricularSubjectSchema = new mongoose.Schema({
  subjectRef: { type: mongoose.Schema.Types.ObjectId, ref: 'SubjectInfo', required: true },
  subjectCode: { type: String, required: true, trim: true },
  subjectName: { type: String, required: true, trim: true },
  grade: { type: String, default: '' },
  gradePoint: { type: Number, default: null },
  isAbsent: { type: Boolean, default: false }
}, { _id: false });

const examinationResultInfoSchema = new mongoose.Schema({
  schoolRef: { type: mongoose.Schema.Types.ObjectId, ref: 'SchoolInfo', required: true },
  schoolId: { type: String, required: true, trim: true, uppercase: true },
  academicYearRef: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYearInfo', required: true },
  examinationRef: { type: mongoose.Schema.Types.ObjectId, ref: 'ExaminationInfo', required: true },
  examinationCode: { type: String, required: true, trim: true },
  examinationName: { type: String, required: true, trim: true },
  classRef: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassInfo', required: true },
  className: { type: String, required: true, trim: true },
  sectionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'SectionInfo', required: true },
  sectionName: { type: String, required: true, trim: true },
  studentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentInfo', required: true },
  enrollmentRef: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentEnrollmentInfo', required: true },
  admissionNumber: { type: String, trim: true, default: '' },
  studentName: { type: String, required: true, trim: true },
  rollNumber: { type: String, trim: true, default: '' },
  academicSubjects: { type: [resultAcademicSubjectSchema], default: [] },
  coCurricularSubjects: { type: [resultCoCurricularSubjectSchema], default: [] },
  totalMarksObtained: { type: Number, default: 0 },
  totalMaximumMarks: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  overallGrade: { type: String, default: '' },
  resultStatus: {
    type: String,
    enum: ['PASS', 'NEEDS IMPROVEMENT', 'FAIL', 'INCOMPLETE'],
    default: 'PASS'
  },
  termRemark: { type: String, trim: true, default: '' },
  termRemarkApproved: { type: Boolean, default: false },
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
  collection: 'examination_result_info'
});

examinationResultInfoSchema.index(
  { schoolId: 1, academicYearRef: 1, examinationRef: 1, classRef: 1, sectionRef: 1, studentRef: 1 },
  { unique: true }
);
examinationResultInfoSchema.index({ schoolId: 1, academicYearRef: 1, examinationRef: 1, classRef: 1, sectionRef: 1, status: 1 });

module.exports = mongoose.model('ExaminationResultInfo', examinationResultInfoSchema);
