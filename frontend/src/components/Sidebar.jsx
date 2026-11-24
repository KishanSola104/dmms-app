import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UserCheck,
  KeyRound,
  Building,
  LogOut,
  Shield,
  Settings,
  Users,
  Calendar,
  Layers,
  GraduationCap,
  BookOpen,
  ChevronDown,
  ChevronRight,
  UserPlus,
  ArrowRightLeft,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { useUserAuth } from '../context/UserAuthContext';
import { useSchoolAuth } from '../context/SchoolAuthContext';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logoutUser } = useUserAuth();
  const { currentSchool, logoutSchool } = useSchoolAuth();

  // Expandable sections state
  const isInsideAdmin =
    location.pathname.startsWith('/admin') &&
    !location.pathname.startsWith('/admin/subject-allocation') &&
    !location.pathname.startsWith('/admin/teacher-assignment') &&
    !location.pathname.startsWith('/admin/examinations') &&
    !location.pathname.startsWith('/admin/students');
  const isInsideClasses = location.pathname.startsWith('/admin/classes') || location.pathname.startsWith('/admin/sections');
  const isInsideAcademicManagement =
    location.pathname.startsWith('/admin/subject-allocation') ||
    location.pathname.startsWith('/admin/teacher-assignment') ||
    location.pathname.startsWith('/admin/examinations');
  const isInsideStudentManagement = location.pathname.startsWith('/admin/students');
  const isInsideHeadTeacherAcademic = location.pathname.startsWith('/head-teacher');

  const [adminSetupOpen, setAdminSetupOpen] = useState(true);
  const [classesSectionsOpen, setClassesSectionsOpen] = useState(true);
  const [academicManagementOpen, setAcademicManagementOpen] = useState(true);
  const [studentManagementOpen, setStudentManagementOpen] = useState(true);
  const [headTeacherAcademicOpen, setHeadTeacherAcademicOpen] = useState(true);

  // Auto-expand active branches if navigating
  useEffect(() => {
    if (isInsideAdmin) {
      setAdminSetupOpen(true);
    }
    if (isInsideClasses) {
      setClassesSectionsOpen(true);
    }
    if (isInsideAcademicManagement) {
      setAcademicManagementOpen(true);
    }
    if (isInsideStudentManagement) {
      setStudentManagementOpen(true);
    }
    if (isInsideHeadTeacherAcademic) {
      setHeadTeacherAcademicOpen(true);
    }
  }, [location.pathname]);

  const handleSchoolLogout = () => {
    if (window.confirm('Are you sure you want to change school? This will clear the current school session.')) {
      logoutUser();
      logoutSchool();
      navigate('/school-login', { replace: true });
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'HEAD_TEACHER':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'TEACHER':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'OFFICE_STAFF':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col min-h-[calc(100vh-4rem)] border-r border-slate-800 select-none">
      {/* School Card in Sidebar */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-start space-x-3">
          {currentSchool?.schoolLogoUrl ? (
            <img
              src={currentSchool.schoolLogoUrl}
              alt="School Logo"
              className="w-9 h-9 rounded-lg object-contain bg-white/10 p-1 border border-slate-700 mt-0.5 shrink-0"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="p-2 bg-blue-600/10 rounded-lg border border-blue-500/20 text-blue-400 mt-0.5 shrink-0">
              <Building className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate" title={currentSchool?.schoolName}>
              {currentSchool?.schoolName || 'School Portal'}
            </p>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              ID: {currentSchool?.schoolId}
            </p>
            <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-medium rounded border ${getRoleBadgeColor(currentUser?.roleCode)}`}>
              {currentUser?.roleName || currentUser?.roleCode}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
          Main Menu
        </div>

        {/* Dashboard link (Active for all roles) */}
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex items-center px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4 mr-3" />
          <span>Dashboard</span>
        </NavLink>

        {/* HEAD TEACHER ONLY: Module 1 Academic Overview Expandable Menu */}
        {currentUser?.roleCode === 'HEAD_TEACHER' && (
          <div className="pt-2">
            <div className="px-3 pb-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Academic Oversight
            </div>

            {/* Expandable Header */}
            <button
              type="button"
              onClick={() => setHeadTeacherAcademicOpen(!headTeacherAcademicOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                isInsideHeadTeacherAcademic
                  ? 'text-white bg-slate-800/80'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center">
                <GraduationCap className="w-4 h-4 mr-3 text-purple-400" />
                <span>Academic Overview</span>
              </div>
              {headTeacherAcademicOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {/* Expandable Sub-items */}
            {headTeacherAcademicOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-slate-800 space-y-1 animate-in fade-in duration-100">
                {/* 1. Classes & Sections */}
                <NavLink
                  to="/head-teacher/classes"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Layers className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Classes &amp; Sections</span>
                </NavLink>

                {/* 2. Subject Overview */}
                <NavLink
                  to="/head-teacher/subjects"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <BookOpen className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Subject Overview</span>
                </NavLink>

                {/* 3. Teacher Overview */}
                <NavLink
                  to="/head-teacher/teachers"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <GraduationCap className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Teacher Overview</span>
                </NavLink>

                {/* 4. Teacher Assignments */}
                <NavLink
                  to="/head-teacher/teacher-assignments"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Teacher Assignments</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* ADMIN ONLY: Administrative Setup Expandable Menu */}
        {currentUser?.roleCode === 'ADMIN' && (
          <div className="pt-2">
            <div className="px-3 pb-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Administration
            </div>

            {/* Expandable Header */}
            <button
              type="button"
              onClick={() => setAdminSetupOpen(!adminSetupOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                isInsideAdmin
                  ? 'text-white bg-slate-800/80'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center">
                <Settings className="w-4 h-4 mr-3 text-blue-400" />
                <span>Administrative Setup</span>
              </div>
              {adminSetupOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {/* Expandable Sub-items */}
            {adminSetupOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-slate-800 space-y-1 animate-in fade-in duration-100">
                {/* 1. User Management */}
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Users className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>User Management</span>
                </NavLink>

                {/* 2. Academic Year Management */}
                <NavLink
                  to="/admin/academic-years"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Calendar className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Academic Year Management</span>
                </NavLink>

                {/* 3. Classes & Sections Nested Expandable Menu */}
                <div>
                  <button
                    type="button"
                    onClick={() => setClassesSectionsOpen(!classesSectionsOpen)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isInsideClasses
                        ? 'text-white font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center">
                      <Layers className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                      <span>Classes &amp; Sections</span>
                    </div>
                    {classesSectionsOpen ? (
                      <ChevronDown className="w-3 h-3 text-slate-500" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-slate-500" />
                    )}
                  </button>

                  {/* Nested Class & Section links */}
                  {classesSectionsOpen && (
                    <div className="ml-4 pl-2 border-l border-slate-800/80 space-y-1 mt-1">
                      <NavLink
                        to="/admin/classes"
                        className={({ isActive }) =>
                          `flex items-center px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                          }`
                        }
                      >
                        <GraduationCap className="w-3 h-3 mr-2" />
                        <span>Class Management</span>
                      </NavLink>

                      <NavLink
                        to="/admin/sections"
                        className={({ isActive }) =>
                          `flex items-center px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                          }`
                        }
                      >
                        <Layers className="w-3 h-3 mr-2" />
                        <span>Section Management</span>
                      </NavLink>
                    </div>
                  )}
                </div>

                {/* 4. Subjects Management */}
                <NavLink
                  to="/admin/subjects"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <BookOpen className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Subjects Management</span>
                </NavLink>

                {/* 5. School Profile */}
                <NavLink
                  to="/admin/school-profile"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Building className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>School Profile</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* ADMIN ONLY: Academic Management Expandable Menu (Module 3) */}
        {currentUser?.roleCode === 'ADMIN' && (
          <div className="pt-2">
            {/* Expandable Header */}
            <button
              type="button"
              onClick={() => setAcademicManagementOpen(!academicManagementOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                isInsideAcademicManagement
                  ? 'text-white bg-slate-800/80'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center">
                <GraduationCap className="w-4 h-4 mr-3 text-indigo-400" />
                <span>Academic Management</span>
              </div>
              {academicManagementOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {/* Expandable Sub-items */}
            {academicManagementOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-slate-800 space-y-1 animate-in fade-in duration-100">
                {/* 1. Subject Allocation */}
                <NavLink
                  to="/admin/subject-allocation"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <BookOpen className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Subject Allocation</span>
                </NavLink>

                {/* 2. Teacher Assignment */}
                <NavLink
                  to="/admin/teacher-assignment"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Users className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Teacher Assignment</span>
                </NavLink>

                {/* 3. Examination Management */}
                <NavLink
                  to="/admin/examinations"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Calendar className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Examination Management</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* ADMIN ONLY: Student Management Expandable Menu (Module 4) */}
        {currentUser?.roleCode === 'ADMIN' && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setStudentManagementOpen(!studentManagementOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                isInsideStudentManagement
                  ? 'text-white bg-slate-800/80'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center">
                <UserPlus className="w-4 h-4 mr-3 text-emerald-400" />
                <span>Student Management</span>
              </div>
              {studentManagementOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {studentManagementOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-slate-800 space-y-1 animate-in fade-in duration-100">
                <NavLink
                  to="/admin/students"
                  end
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Users className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Student Directory</span>
                </NavLink>

                <NavLink
                  to="/admin/students/admission"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <UserPlus className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Student Admission</span>
                </NavLink>

                <NavLink
                  to="/admin/students/enrollments"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Enrollment &amp; Transfers</span>
                </NavLink>

                <NavLink
                  to="/admin/students/promotion"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <TrendingUp className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Student Promotion</span>
                </NavLink>

                <NavLink
                  to="/admin/students/import"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Import Students</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 px-3 pb-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
          Account &amp; Security
        </div>

        {/* My Profile */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex items-center px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`
          }
        >
          <UserCheck className="w-4 h-4 mr-3" />
          <span>My Profile</span>
        </NavLink>

        {/* Change Password */}
        <NavLink
          to="/change-password"
          className={({ isActive }) =>
            `flex items-center px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`
          }
        >
          <KeyRound className="w-4 h-4 mr-3" />
          <span>Change Password</span>
        </NavLink>

        {/* Admin only: Change School Password */}
        {currentUser?.roleCode === 'ADMIN' && (
          <NavLink
            to="/change-password?tab=school"
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/60'
              }`
            }
          >
            <Shield className="w-4 h-4 mr-3" />
            <span>School Password</span>
          </NavLink>
        )}
      </div>

      {/* Bottom Switch School option */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/20">
        <button
          onClick={handleSchoolLogout}
          className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          title="Switch to another school or clear school session"
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span>Change / Exit School</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
