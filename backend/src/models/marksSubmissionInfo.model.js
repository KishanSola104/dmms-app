const mongoose = require('mongoose');

const marksSubmissionInfoSchema = new mongoose.Schema({
  schoolRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SchoolInfo',
    required: true
  },
  schoolId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  academicYearRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYearInfo',
    required: true
  },
  // Null for EXTRA_COMPONENT and CO_CURRICULAR_FINAL
  examinationRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExaminationInfo',
    default: null
  },
  classRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassInfo',
    required: true
  },
  sectionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SectionInfo',
    required: true
  },
  subjectRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubjectInfo',
    required: true
  },
  entryType: {
    type: String,
    enum: ['EXAM_ACADEMIC', 'EXTRA_COMPONENT', 'CO_CURRICULAR_TERM', 'CO_CURRICULAR_FINAL'],
    required: true
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'RETURNED', 'VERIFIED'],
    default: 'DRAFT'
  },
  totalStudents: {
    type: Number,
    default: 0
  },
  enteredCount: {
    type: Number,
    default: 0
  },
  lastEnteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    default: null
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    default: null
  },
  submittedAt: {
    type: Date,
    default: null
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  returnedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    default: null
  },
  returnedAt: {
    type: Date,
    default: null
  },
  returnReason: {
    type: String,
    trim: true,
    default: ''
  },
  resubmittedAt: {
    type: Date,
    default: null
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    default: null
  },
  requestedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'marks_submission_info'
});

marksSubmissionInfoSchema.index(
  { schoolId: 1, academicYearRef: 1, examinationRef: 1, classRef: 1, sectionRef: 1, subjectRef: 1, entryType: 1 },
  { unique: true }
);
marksSubmissionInfoSchema.index({ schoolId: 1, academicYearRef: 1, classRef: 1, sectionRef: 1, status: 1 });

module.exports = mongoose.model('MarksSubmissionInfo', marksSubmissionInfoSchema);
