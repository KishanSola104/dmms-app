const AcademicYearInfo = require('../models/academicYearInfo.model');
const NotificationInfo = require('../models/notificationInfo.model');
const EmployeeInfo = require('../models/employeeInfo.model');
const UserInfo = require('../models/userInfo.model');
const SchoolInfo = require('../models/schoolInfo.model');

class CommonController {
  /**
   * Get Academic Years for the authenticated school
   */
  static async getAcademicYears(req, res, next) {
    try {
      const schoolId = req.user ? req.user.schoolId : (req.school ? req.school.schoolId : null);
      if (!schoolId) {
        return res.status(400).json({ success: false, message: 'School identification missing.' });
      }

      const years = await AcademicYearInfo.find({ schoolId })
        .sort({ isCurrent: -1, startDate: -1 });

      return res.json({
        success: true,
        academicYears: years,
        currentYear: years.find(y => y.isCurrent) || years[0] || null
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Switch Active Academic Year for the school
   */
  static async switchAcademicYear(req, res, next) {
    try {
      const { yearId } = req.body;
      const schoolId = req.user.schoolId;

      if (!yearId) {
        return res.status(400).json({ success: false, message: 'Academic Year ID is required.' });
      }

      const selectedYear = await AcademicYearInfo.findOne({ _id: yearId, schoolId });
      if (!selectedYear) {
        return res.status(404).json({ success: false, message: 'Academic year not found for this school.' });
      }

      // Mark all other years as not current, set this one as current
      await AcademicYearInfo.updateMany({ schoolId }, { $set: { isCurrent: false } });
      selectedYear.isCurrent = true;
      await selectedYear.save();

      return res.json({
        success: true,
        message: `Active academic year switched to ${selectedYear.yearCode}.`,
        activeYear: selectedYear
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Notifications for the current user/role/school
   */
  static async getNotifications(req, res, next) {
    try {
      const { schoolId, roleCode, _id: userRef } = req.user;

      const notifications = await NotificationInfo.find({
        schoolId,
        $or: [
          { targetUserRef: userRef },
          { targetRoleCode: roleCode },
          { targetRoleCode: 'ALL' }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(20);

      const unreadCount = notifications.filter(n => !n.isRead).length;

      return res.json({
        success: true,
        notifications,
        unreadCount
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark single notification as read
   */
  static async markNotificationRead(req, res, next) {
    try {
      const { id } = req.params;
      const notification = await NotificationInfo.findOne({
        _id: id,
        schoolId: req.user.schoolId
      });

      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found.' });
      }

      notification.isRead = true;
      notification.readAt = new Date();
      await notification.save();

      return res.json({ success: true, message: 'Notification marked as read.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllNotificationsRead(req, res, next) {
    try {
      const { schoolId, roleCode, _id: userRef } = req.user;

      await NotificationInfo.updateMany(
        {
          schoolId,
          isRead: false,
          $or: [
            { targetUserRef: userRef },
            { targetRoleCode: roleCode },
            { targetRoleCode: 'ALL' }
          ]
        },
        {
          $set: { isRead: true, readAt: new Date() }
        }
      );

      return res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get dynamic role-specific dashboard statistics
   */
  static async getDashboardStats(req, res, next) {
    try {
      const { schoolId, roleCode } = req.user;
      const school = await SchoolInfo.findOne({ schoolId });

      // Count staff members in this school
      const totalEmployees = await EmployeeInfo.countDocuments({ schoolId });
      const totalUsers = await UserInfo.countDocuments({ schoolId });
      const academicYears = await AcademicYearInfo.find({ schoolId });
      const activeAcademicYear = academicYears.find(y => y.isCurrent) || academicYears[0];

      let roleSpecificData = {};

      if (roleCode === 'ADMIN') {
        roleSpecificData = {
          roleTitle: 'School Administrator Portal',
          stats: [
            { title: 'Total Registered Staff', value: totalEmployees, icon: 'Users', color: 'blue' },
            { title: 'Active User Accounts', value: totalUsers, icon: 'ShieldCheck', color: 'emerald' },
            { title: 'Contact Persons', value: school ? school.contactPersons.length : 0, icon: 'Phone', color: 'indigo' },
            { title: 'Current Academic Year', value: activeAcademicYear ? activeAcademicYear.yearCode : 'N/A', icon: 'Calendar', color: 'amber' }
          ],
          schoolProfile: {
            schoolName: school.schoolName,
            schoolId: school.schoolId,
            establishedYear: school.establishedYear,
            email: school.email,
            mobileNumber: school.mobileNumber,
            address: school.address,
            contactPersons: school.contactPersons
          },
          quickActions: [
            { name: 'Update School Password', path: '/change-password', tab: 'school' },
            { name: 'Manage My Profile', path: '/profile' },
            { name: 'System Security Settings', path: '/change-password' }
          ]
        };
      } else if (roleCode === 'HEAD_TEACHER') {
        const teacherCount = await UserInfo.countDocuments({ schoolId, roleCode: 'TEACHER' });
        roleSpecificData = {
          roleTitle: 'Head Teacher Academic Portal',
          stats: [
            { title: 'Faculty Teachers', value: teacherCount, icon: 'GraduationCap', color: 'purple' },
            { title: 'Total School Staff', value: totalEmployees, icon: 'Users', color: 'blue' },
            { title: 'Active Academic Session', value: activeAcademicYear ? activeAcademicYear.yearCode : 'N/A', icon: 'Calendar', color: 'emerald' },
            { title: 'Pending Curricula Reviews', value: 0, icon: 'FileText', color: 'amber' }
          ],
          academicHighlights: [
            { label: 'Evaluation Period', value: 'First Term Examination 2026' },
            { label: 'Syllabus Coverage', value: 'On Track (Sprint 1 In Progress)' },
            { label: 'Supervised Grade Levels', value: 'Primary & Secondary Sections' }
          ]
        };
      } else if (roleCode === 'TEACHER') {
        roleSpecificData = {
          roleTitle: 'Teacher Teaching & Assessment Portal',
          stats: [
            { title: 'Assigned Classes', value: 3, icon: 'BookOpen', color: 'blue' },
            { title: 'Teaching Subjects', value: 2, icon: 'Layers', color: 'emerald' },
            { title: 'Marksheet Submissions', value: 'Ready', icon: 'CheckCircle', color: 'indigo' },
            { title: 'Academic Term', value: activeAcademicYear ? activeAcademicYear.yearCode : 'N/A', icon: 'Calendar', color: 'amber' }
          ],
          teachingSchedule: [
            { period: 'Period 1 (08:30 - 09:15 AM)', subject: 'Mathematics', classRoom: 'Class 8-A' },
            { period: 'Period 3 (10:15 - 11:00 AM)', subject: 'Science', classRoom: 'Class 8-B' },
            { period: 'Period 5 (01:00 - 01:45 PM)', subject: 'Computer Studies', classRoom: 'Lab 1' }
          ]
        };
      } else if (roleCode === 'OFFICE_STAFF') {
        roleSpecificData = {
          roleTitle: 'Office & Administrative Staff Portal',
          stats: [
            { title: 'Total School Employees', value: totalEmployees, icon: 'Users', color: 'blue' },
            { title: 'Registered Students', value: 450, icon: 'UserCheck', color: 'emerald' },
            { title: 'Office Enquiries', value: 12, icon: 'HelpCircle', color: 'indigo' },
            { title: 'Academic Year', value: activeAcademicYear ? activeAcademicYear.yearCode : 'N/A', icon: 'Calendar', color: 'amber' }
          ],
          administrativeTasks: [
            { task: 'Academic Record Verification', status: 'Pending Review', priority: 'High' },
            { task: 'New Student Enrollment Documentation', status: 'In Progress', priority: 'Medium' },
            { task: 'Contact Directory Verification', status: 'Completed', priority: 'Normal' }
          ]
        };
      }

      return res.json({
        success: true,
        academicYear: activeAcademicYear,
        ...roleSpecificData
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CommonController;
