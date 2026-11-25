const mongoose = require('mongoose');

const marksAuditLogInfoSchema = new mongoose.Schema({
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
    default: null
  },
  examinationRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExaminationInfo',
    default: null
  },
  classRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassInfo',
    default: null
  },
  sectionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SectionInfo',
    default: null
  },
  subjectRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubjectInfo',
    default: null
  },
  submissionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MarksSubmissionInfo',
    default: null
  },
  resultRef: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  action: {
    type: String,
    required: true,
    enum: [
      'MARKS_SAVED_DRAFT',
      'MARKS_SUBMITTED',
      'MARKS_RETURNED',
      'MARKS_RESUBMITTED',
      'MARKS_VERIFIED',
      'CO_CURRICULAR_FINAL_REQUESTED',
      'EXAM_RESULT_GENERATED',
      'EXAM_RESULT_SUBMITTED',
      'EXAM_RESULT_UNDER_REVIEW',
      'EXAM_RESULT_RETURNED',
      'EXAM_RESULT_APPROVED',
      'EXAM_RESULT_PUBLISHED',
      'FINAL_RESULT_GENERATED',
      'FINAL_RESULT_SUBMITTED',
      'FINAL_RESULT_UNDER_REVIEW',
      'FINAL_RESULT_RETURNED',
      'FINAL_RESULT_APPROVED',
      'FINAL_RESULT_PUBLISHED'
    ]
  },
  details: {
    type: String,
    trim: true,
    default: ''
  },
  performedByUserRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    required: true
  },
  performedByName: {
    type: String,
    trim: true,
    default: ''
  },
  performedByRole: {
    type: String,
    trim: true,
    default: ''
  },
  performedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'marks_audit_log_info'
});

marksAuditLogInfoSchema.index({ schoolId: 1, academicYearRef: 1, performedAt: -1 });
marksAuditLogInfoSchema.index({ schoolId: 1, submissionRef: 1, performedAt: -1 });

module.exports = mongoose.model('MarksAuditLogInfo', marksAuditLogInfoSchema);
