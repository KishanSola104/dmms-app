const mongoose = require('mongoose');

const additionalComponentSchema = new mongoose.Schema({
  componentName: {
    type: String,
    required: [true, 'Component name is required'],
    trim: true
  },
  maximumMarks: {
    type: Number,
    required: [true, 'Maximum marks is required'],
    min: [1, 'Maximum marks must be at least 1']
  }
}, { _id: true });

const classSubjectInfoSchema = new mongoose.Schema({
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
    required: [true, 'Academic year reference is required']
  },
  classRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassInfo',
    required: [true, 'Class reference is required']
  },
  subjectRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubjectInfo',
    required: [true, 'Subject reference is required']
  },
  subjectCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  subjectName: {
    type: String,
    required: true,
    trim: true
  },
  subjectType: {
    type: String,
    required: true,
    enum: ['ACADEMIC', 'CO_CURRICULAR']
  },
  hasAdditionalComponents: {
    type: Boolean,
    default: false
  },
  additionalComponents: {
    type: [additionalComponentSchema],
    default: []
  },
  totalAdditionalMarks: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  collection: 'class_subject_info'
});

// Compound unique index: A subject cannot be allocated twice to the same class in the same academic year within a school
classSubjectInfoSchema.index(
  { schoolId: 1, academicYearRef: 1, classRef: 1, subjectRef: 1 },
  { unique: true }
);

// Lookup index
classSubjectInfoSchema.index({ schoolId: 1, academicYearRef: 1, classRef: 1, status: 1 });

module.exports = mongoose.model('ClassSubjectInfo', classSubjectInfoSchema);
