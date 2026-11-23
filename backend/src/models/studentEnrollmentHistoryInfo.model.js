const mongoose = require('mongoose');

const studentEnrollmentHistoryInfoSchema = new mongoose.Schema({
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
  studentRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentInfo',
    required: [true, 'Student reference is required']
  },
  enrollmentRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentEnrollmentInfo',
    required: [true, 'Enrollment reference is required']
  },
  academicYearRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYearInfo',
    required: [true, 'Academic year reference is required']
  },
  previousClassRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassInfo',
    default: null
  },
  previousSectionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SectionInfo',
    default: null
  },
  newClassRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassInfo',
    required: [true, 'New class reference is required']
  },
  newSectionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SectionInfo',
    required: [true, 'New section reference is required']
  },
  changeType: {
    type: String,
    enum: ['ADMISSION', 'PROMOTION', 'REPETITION', 'SECTION_TRANSFER', 'CLASS_TRANSFER'],
    required: [true, 'Change type is required']
  },
  remarks: {
    type: String,
    trim: true,
    default: ''
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    default: null
  },
  changedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'student_enrollment_history_info'
});

// Lookup indexes
studentEnrollmentHistoryInfoSchema.index({ schoolId: 1, studentRef: 1 });
studentEnrollmentHistoryInfoSchema.index({ schoolId: 1, enrollmentRef: 1 });
studentEnrollmentHistoryInfoSchema.index({ schoolId: 1, academicYearRef: 1 });

module.exports = mongoose.model('StudentEnrollmentHistoryInfo', studentEnrollmentHistoryInfoSchema);
