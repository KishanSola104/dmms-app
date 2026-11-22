const mongoose = require('mongoose');

const examinationSubjectInfoSchema = new mongoose.Schema({
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
  examinationRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExaminationInfo',
    required: [true, 'Examination reference is required']
  },
  examinationClassRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExaminationClassInfo',
    required: [true, 'Examination class reference is required']
  },
  classRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassInfo',
    required: [true, 'Class reference is required']
  },
  classSubjectRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassSubjectInfo',
    required: [true, 'Class subject reference is required']
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
    enum: ['ACADEMIC', 'CO_CURRICULAR'],
    default: 'ACADEMIC'
  },
  totalMaximumMarks: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Total maximum marks cannot be negative']
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  collection: 'examination_subject_info',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound unique index: Only one subject configuration per examination-class combination
examinationSubjectInfoSchema.index(
  { schoolId: 1, examinationRef: 1, classRef: 1, subjectRef: 1 },
  { unique: true }
);

// Lookup indexes
examinationSubjectInfoSchema.index({ schoolId: 1, examinationRef: 1, classRef: 1 });
examinationSubjectInfoSchema.index({ schoolId: 1, academicYearRef: 1, classRef: 1 });

// Virtual relationship to examination components
examinationSubjectInfoSchema.virtual('components', {
  ref: 'ExaminationComponentInfo',
  localField: '_id',
  foreignField: 'examinationSubjectRef'
});

module.exports = mongoose.model('ExaminationSubjectInfo', examinationSubjectInfoSchema);
