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
    trim: true,
    uppercase: true
  },
  module: {
    type: String,
    trim: true,
    uppercase: true,
    default: 'MARKS_ENTRY'
  },
  entityType: {
    type: String,
    trim: true,
    default: ''
  },
  entityId: {
    type: String,
    trim: true,
    default: ''
  },
  details: {
    type: String,
    trim: true,
    default: ''
  },
  previousValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  newValue: {
    type: mongoose.Schema.Types.Mixed,
    default: null
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
marksAuditLogInfoSchema.index({ schoolId: 1, module: 1, performedAt: -1 });
marksAuditLogInfoSchema.index({ schoolId: 1, performedByRole: 1, performedAt: -1 });

module.exports = mongoose.model('MarksAuditLogInfo', marksAuditLogInfoSchema);
