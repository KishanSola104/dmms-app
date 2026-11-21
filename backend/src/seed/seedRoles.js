const RoleInfo = require('../models/roleInfo.model');

const initialRoles = [
  {
    roleCode: 'ADMIN',
    roleName: 'School Administrator',
    description: 'Full administrative control over school settings, user management, and school operations.',
    status: 'ACTIVE'
  },
  {
    roleCode: 'HEAD_TEACHER',
    roleName: 'Head Teacher',
    description: 'Academic oversight, curriculum guidance, class scheduling, and teacher evaluation.',
    status: 'ACTIVE'
  },
  {
    roleCode: 'TEACHER',
    roleName: 'Teacher',
    description: 'Classroom teaching, marks entry, student evaluation, and attendance tracking.',
    status: 'ACTIVE'
  },
  {
    roleCode: 'OFFICE_STAFF',
    roleName: 'Office Staff',
    description: 'Administrative support, student enrollment, fee documentation, and records.',
    status: 'ACTIVE'
  }
];

const seedRoles = async () => {
  try {
    for (const role of initialRoles) {
      await RoleInfo.findOneAndUpdate(
        { roleCode: role.roleCode },
        { $set: role },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log('[Seed] System roles verified & seeded successfully.');
  } catch (error) {
    console.error('[Seed] Error seeding roles:', error.message);
  }
};

module.exports = seedRoles;
