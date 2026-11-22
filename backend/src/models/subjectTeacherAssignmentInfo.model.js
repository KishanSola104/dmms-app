const mongoose = require('mongoose');

const subjectTeacherAssignmentInfoSchema = new mongoose.Schema({
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
  classSubjectRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassSubjectInfo',
    required: [true, 'Class subject allocation reference is required']
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
  subjectRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubjectInfo',
    required: [true, 'Subject reference is required']
  },
  teacherEmployeeRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EmployeeInfo',
    required: [true, 'Teacher employee reference is required']
  },
  teacherUserRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserInfo',
    required: [true, 'Teacher user account reference is required']
  },
  // Denormalized fields for performant search & rendering
  classCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  className: {
    type: String,
    required: true,
    trim: true
  },
  sectionCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  sectionName: {
    type: String,
    required: true,
    trim: true
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
  teacherName: {
    type: String,
    required: true,
    trim: true
  },
  teacherUserId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  teacherEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  collection: 'subject_teacher_assignment_info'
});

// Enforce only ONE active teacher assignment for the same school, academic year, class, section, and subject
subjectTeacherAssignmentInfoSchema.index(
  { schoolId: 1, academicYearRef: 1, classRef: 1, sectionRef: 1, subjectRef: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } }
);

// Lookup indexes
subjectTeacherAssignmentInfoSchema.index({ schoolId: 1, academicYearRef: 1, teacherEmployeeRef: 1 });
subjectTeacherAssignmentInfoSchema.index({ schoolId: 1, classRef: 1, sectionRef: 1 });

module.exports = mongoose.model('SubjectTeacherAssignmentInfo', subjectTeacherAssignmentInfoSchema);
