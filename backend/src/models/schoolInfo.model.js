const mongoose = require('mongoose');

const contactPersonSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Contact person full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Contact person email is required'],
    trim: true,
    lowercase: true
  },
  mobileNumber: {
    type: String,
    required: [true, 'Contact person mobile number is required'],
    trim: true
  },
  designation: {
    type: String,
    required: [true, 'Contact person designation is required'],
    trim: true
  }
}, { _id: true });

const schoolInfoSchema = new mongoose.Schema({
  schoolId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  schoolCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  schoolName: {
    type: String,
    required: [true, 'School name is required'],
    trim: true
  },
  establishedYear: {
    type: Number,
    required: [true, 'Established year is required']
  },
  email: {
    type: String,
    required: [true, 'School email address is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  mobileNumber: {
    type: String,
    required: [true, 'School mobile number is required'],
    trim: true
  },
  address: {
    type: String,
    required: [true, 'School address is required'],
    trim: true
  },
  websiteUrl: {
    type: String,
    trim: true,
    default: ''
  },
  passwordHash: {
    type: String,
    required: [true, 'School password hash is required']
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  contactPersons: {
    type: [contactPersonSchema],
    validate: {
      validator: function(val) {
        return val && val.length >= 2 && val.length <= 3;
      },
      message: 'School must have between 2 and 3 contact persons'
    }
  },
  termsAccepted: {
    type: Boolean,
    required: true,
    default: true
  },
  termsAcceptedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true,
  collection: 'school_info'
});

module.exports = mongoose.model('SchoolInfo', schoolInfoSchema);
