const mongoose = require('mongoose');

const guardianSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Guardian full name is required'],
    trim: true
  },
  relationship: {
    type: String,
    required: [true, 'Guardian relationship is required'],
    trim: true,
    uppercase: true
  },
  mobileNumber: {
    type: String,
    required: [true, 'Guardian mobile number is required'],
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  isPrimaryContact: {
    type: Boolean,
    default: false
  }
}, { _id: true });

const studentInfoSchema = new mongoose.Schema({
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
  admissionNumber: {
    type: String,
    required: [true, 'Admission number is required'],
    trim: true,
    uppercase: true
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  middleName: {
    type: String,
    trim: true,
    default: ''
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: {
      values: ['MALE', 'FEMALE', 'OTHER'],
      message: 'Gender must be MALE, FEMALE, or OTHER'
    },
    uppercase: true
  },
  profilePhotoUrl: {
    type: String,
    trim: true,
    default: ''
  },
  contact: {
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    }
  },
  guardianDetails: {
    type: [guardianSchema],
    validate: {
      validator: function(val) {
        return Array.isArray(val) && val.length > 0;
      },
      message: 'At least one guardian detail is required'
    }
  },
  admissionAcademicYearRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AcademicYearInfo',
    required: [true, 'Admission academic year reference is required']
  },
  admissionClassRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClassInfo',
    required: [true, 'Admission class reference is required']
  },
  admissionDate: {
    type: Date,
    required: [true, 'Admission date is required'],
    default: Date.now
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'TRANSFERRED', 'ALUMNI'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  collection: 'student_info',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound unique index: Admission number must be unique within a school
studentInfoSchema.index({ schoolId: 1, admissionNumber: 1 }, { unique: true });

// Lookup indexes
studentInfoSchema.index({ schoolId: 1, status: 1 });
studentInfoSchema.index({ schoolId: 1, admissionClassRef: 1 });
studentInfoSchema.index({ schoolId: 1, admissionAcademicYearRef: 1 });
studentInfoSchema.index({ schoolId: 1, firstName: 1, lastName: 1 });

// Virtual for full name
studentInfoSchema.virtual('fullName').get(function() {
  if (this.middleName) {
    return `${this.firstName} ${this.middleName} ${this.lastName}`;
  }
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('StudentInfo', studentInfoSchema);
