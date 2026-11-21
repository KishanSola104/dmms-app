const mongoose = require('mongoose');

const employeeInfoSchema = new mongoose.Schema({
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
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    trim: true,
    lowercase: true
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true
  },
  designation: {
    type: String,
    required: [true, 'Designation is required'],
    trim: true
  },
  profileImage: {
    type: String,
    default: null
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  qualification: {
    type: String,
    trim: true,
    default: ''
  },
  joiningDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'employee_info'
});

module.exports = mongoose.model('EmployeeInfo', employeeInfoSchema);
