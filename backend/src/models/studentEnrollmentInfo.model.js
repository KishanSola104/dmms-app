const mongoose = require('mongoose');

const studentEnrollmentInfoSchema = new mongoose.Schema({
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
  sectionRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SectionInfo',
    required: [true, 'Section reference is required']
  },
  rollNumber: {
    type: String,
    trim: true,
    default: ''
  },
  enrollmentDate: {
    type: Date,
    required: [true, 'Enrollment date is required'],
    default: Date.now
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'WITHDRAWN', 'TRANSFERRED'],
    default: 'ACTIVE'
  },
  promotionOutcome: {
    type: String,
    enum: ['PROMOTED', 'REPEATED', 'NOT_PROMOTED', null],
    default: null
  },
  remarks: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'student_enrollment_info'
});

// A student can have only ONE enrollment per academic year within a school
studentEnrollmentInfoSchema.index(
  { schoolId: 1, academicYearRef: 1, studentRef: 1 },
  { unique: true }
);

// Roll numbers must be unique within school + academic year + class + section when supplied
studentEnrollmentInfoSchema.index(
  { schoolId: 1, academicYearRef: 1, classRef: 1, sectionRef: 1, rollNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      rollNumber: { $type: 'string', $gt: '' },
      status: 'ACTIVE'
    }
  }
);

// General lookup indexes
studentEnrollmentInfoSchema.index({ schoolId: 1, studentRef: 1 });
studentEnrollmentInfoSchema.index({ schoolId: 1, academicYearRef: 1, classRef: 1, sectionRef: 1, status: 1 });

module.exports = mongoose.model('StudentEnrollmentInfo', studentEnrollmentInfoSchema);
