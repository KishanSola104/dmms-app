const mongoose = require('mongoose');

const downloadHistoryInfoSchema = new mongoose.Schema({
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
  academicYearName: {
    type: String,
    trim: true,
    default: ''
  },
  classRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassInfo',
    default: null
  },
  className: {
    type: String,
    trim: true,
    default: ''
  },
  sectionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SectionInfo',
    default: null
  },
  sectionName: {
    type: String,
    trim: true,
    default: ''
  },
  examinationRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExaminationInfo',
    default: null
  },
  documentName: {
    type: String,
    required: true,
    trim: true
  },
  documentType: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  resultType: {
    type: String,
    trim: true,
    default: ''
  },
  recordId: {
    type: String,
    trim: true,
    default: ''
  },
  downloadedByUserRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    required: true
  },
  downloadedByUserId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  downloadedByName: {
    type: String,
    trim: true,
    default: ''
  },
  downloadedByRole: {
    type: String,
    trim: true,
    uppercase: true,
    default: ''
  },
  downloadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'download_history_info'
});

downloadHistoryInfoSchema.index({ schoolId: 1, downloadedByUserRef: 1, downloadedAt: -1 });
downloadHistoryInfoSchema.index({ schoolId: 1, academicYearRef: 1, downloadedAt: -1 });

module.exports = mongoose.model('DownloadHistoryInfo', downloadHistoryInfoSchema);
