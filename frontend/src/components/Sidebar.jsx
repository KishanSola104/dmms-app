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
  CheckCircle2,
  ClipboardList,
  Clock,
  Sliders,
  BarChart3,
  Edit3,
  Send,
  Award,
  FileCheck2,
  Sparkles,
  ListChecks,
  Lock,
  Bell,
  History,
  FileBarChart2,
  RefreshCw,
  ScrollText
} from 'lucide-react';
import { useUserAuth } from '../context/UserAuthContext';
import { useSchoolAuth } from '../context/SchoolAuthContext';
import RestartApplicationModal from './RestartApplicationModal';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, activePanel, logoutUser } = useUserAuth();
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
  const isInsideHeadTeacherAcademic =
    location.pathname.startsWith('/head-teacher/classes') ||
    location.pathname.startsWith('/head-teacher/subjects') ||
    location.pathname.startsWith('/head-teacher/teachers') ||
    location.pathname.startsWith('/head-teacher/teacher-assignments');
  const isInsideHeadTeacherStudent =
    location.pathname.startsWith('/head-teacher/students') ||
    location.pathname.startsWith('/head-teacher/student-profile') ||
    location.pathname.startsWith('/head-teacher/student-performance');
  const isInsideHeadTeacherExamination =
    location.pathname.startsWith('/head-teacher/examinations') ||
    location.pathname.startsWith('/head-teacher/examination-schedule') ||
    location.pathname.startsWith('/head-teacher/subject-configurations') ||
    location.pathname.startsWith('/head-teacher/marks-entry-monitoring');
  const isInsideTeacherMarks =
    location.pathname.startsWith('/teacher/marks-entry') ||
    location.pathname.startsWith('/teacher/submitted-marks') ||
    location.pathname.startsWith('/teacher/extra-components') ||
    location.pathname.startsWith('/teacher/co-curricular-grades');
  const isInsideTeacherResults =
    location.pathname.startsWith('/teacher/marks-verification') ||
    location.pathname.startsWith('/teacher/examination-results') ||
    location.pathname.startsWith('/teacher/final-result') ||
    location.pathname.startsWith('/teacher/result-performance');

  const [adminSetupOpen, setAdminSetupOpen] = useState(true);
  const [classesSectionsOpen, setClassesSectionsOpen] = useState(true);
  const [academicManagementOpen, setAcademicManagementOpen] = useState(true);
  const [studentManagementOpen, setStudentManagementOpen] = useState(true);
  const [headTeacherAcademicOpen, setHeadTeacherAcademicOpen] = useState(true);
  const [headTeacherStudentOpen, setHeadTeacherStudentOpen] = useState(true);
  const [headTeacherExaminationOpen, setHeadTeacherExaminationOpen] = useState(true);
  const [teacherMarksOpen, setTeacherMarksOpen] = useState(true);
  const [teacherResultsOpen, setTeacherResultsOpen] = useState(true);
  const [restartModalOpen, setRestartModalOpen] = useState(false);

  const isDualAccessHT =
    currentUser?.roleCode === 'HEAD_TEACHER' && !!currentUser?.teachingAccess?.hasTeachingAccess;
  const effectivePanel = isDualAccessHT
    ? activePanel === 'TEACHER' || location.pathname.startsWith('/teacher/')
      ? 'TEACHER'
      : 'HEAD_TEACHER'
    : currentUser?.roleCode;
  const hasTeacherPanelAccess =
    effectivePanel === 'TEACHER' &&
    (currentUser?.roleCode === 'TEACHER' || isDualAccessHT);
  const isClassTeacher = !!currentUser?.teachingAccess?.hasClassTeacherAssignments;

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
    if (isInsideHeadTeacherStudent) {
      setHeadTeacherStudentOpen(true);
    }
    if (isInsideHeadTeacherExamination) {
      setHeadTeacherExaminationOpen(true);
    }
    if (isInsideTeacherMarks) {
      setTeacherMarksOpen(true);
    }
    if (isInsideTeacherResults) {
      setTeacherResultsOpen(true);
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
            <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-medium rounded border ${getRoleBadgeColor(effectivePanel || currentUser?.roleCode)}`}>
              {isDualAccessHT
                ? effectivePanel === 'TEACHER'
                  ? 'Teacher Panel (Head Teacher)'
                  : 'Head Teacher Panel'
                : currentUser?.roleName || currentUser?.roleCode}
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
        {effectivePanel === 'HEAD_TEACHER' && (
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

        {/* HEAD TEACHER ONLY: Module 2 Student Overview Expandable Menu */}
        {effectivePanel === 'HEAD_TEACHER' && (
          <div className="pt-2">
            <div className="px-3 pb-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Student Oversight
            </div>

            {/* Expandable Header */}
            <button
              type="button"
              onClick={() => setHeadTeacherStudentOpen(!headTeacherStudentOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                isInsideHeadTeacherStudent
                  ? 'text-white bg-slate-800/80'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-3 text-cyan-400" />
                <span>Student Overview</span>
              </div>
              {headTeacherStudentOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {/* Expandable Sub-items */}
            {headTeacherStudentOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-slate-800 space-y-1 animate-in fade-in duration-100">
                {/* 1. Student List */}
                <NavLink
                  to="/head-teacher/students"
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
                  <span>Student List</span>
                </NavLink>

                {/* 2. Student Profile */}
                <NavLink
                  to="/head-teacher/student-profile"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <UserCheck className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Student Profile</span>
                </NavLink>

                {/* 3. Student Performance */}
                <NavLink
                  to="/head-teacher/student-performance"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <TrendingUp className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Student Performance</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* HEAD TEACHER ONLY: Module 4 Examination Management Expandable Menu */}
        {effectivePanel === 'HEAD_TEACHER' && (
          <div className="pt-2">
            <div className="px-3 pb-2 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Examination Oversight
            </div>

            {/* Expandable Header */}
            <button
              type="button"
              onClick={() => setHeadTeacherExaminationOpen(!headTeacherExaminationOpen)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                isInsideHeadTeacherExamination
                  ? 'text-white bg-slate-800/80'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center">
                <ClipboardList className="w-4 h-4 mr-3 text-amber-400" />
                <span>Examination Management</span>
              </div>
              {headTeacherExaminationOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {/* Expandable Sub-items */}
            {headTeacherExaminationOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-slate-800 space-y-1 animate-in fade-in duration-100">
                {/* 1. Examination Overview */}
                <NavLink
                  to="/head-teacher/examinations"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <ClipboardList className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Examination Overview</span>
                </NavLink>

                {/* 2. Examination Schedule */}
                <NavLink
                  to="/head-teacher/examination-schedule"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Clock className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Examination Schedule</span>
                </NavLink>

                {/* 3. Subject Configuration Overview */}
                <NavLink
                  to="/head-teacher/subject-configurations"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <Sliders className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Subject Configuration Overview</span>
                </NavLink>

                {/* 4. Marks Entry Monitoring */}
                <NavLink
                  to="/head-teacher/marks-entry-monitoring"
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`
                  }
                >
                  <BarChart3 className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                  <span>Marks Entry Monitoring</span>
                </NavLink>
              </div>
            )}
          </div>
        )}

        {/* HEAD TEACHER ONLY: Result Approval, Lock Controls, Reports, Notifications & Audit Log */}
        {effectivePanel === 'HEAD_TEACHER' && (
          <div className="pt-2 space-y-1">
            <div className="px-3 pb-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Result Approval &amp; Reports
            </div>
            <NavLink
              to="/head-teacher/result-approval"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <Award className="w-4 h-4 mr-3 text-purple-400" />
              <span>Result Review &amp; Publish</span>
            </NavLink>
            <NavLink
              to="/head-teacher/marks-lock"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <Lock className="w-4 h-4 mr-3 text-amber-400" />
              <span>Marks Entry Lock Controls</span>
            </NavLink>
            <NavLink
              to="/head-teacher/reports"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <FileBarChart2 className="w-4 h-4 mr-3 text-indigo-400" />
              <span>Academic Reports</span>
            </NavLink>
            <NavLink
              to="/head-teacher/notifications"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <Bell className="w-4 h-4 mr-3 text-sky-400" />
              <span>Notifications</span>
            </NavLink>
            <NavLink
              to="/head-teacher/send-notifications"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <Send className="w-4 h-4 mr-3 text-emerald-400" />
              <span>Send Notifications</span>
            </NavLink>
            <NavLink
              to="/head-teacher/audit-logs"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <ScrollText className="w-4 h-4 mr-3 text-slate-400" />
              <span>Audit Log</span>
            </NavLink>
          </div>
        )}

        {/* TEACHER PANEL ONLY (Completely separate from Head Teacher sidebar) */}
        {hasTeacherPanelAccess && (
          <div className="pt-2 space-y-1">
            <div className="px-3 pb-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Teaching &amp; Assessment
            </div>

            {/* 2. My Classes & Assignments */}
            <NavLink
              to="/teacher/my-classes"
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <Layers className="w-4 h-4 mr-3 text-emerald-400" />
              <span>My Classes &amp; Assignments</span>
            </NavLink>

            {/* 3. Marks Management (Expandable) */}
            <div>
              <button
                type="button"
                onClick={() => setTeacherMarksOpen(!teacherMarksOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                  isInsideTeacherMarks
                    ? 'text-white bg-slate-800/80'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center">
                  <Edit3 className="w-4 h-4 mr-3 text-emerald-400" />
                  <span>Marks Management</span>
                </div>
                {teacherMarksOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              {teacherMarksOpen && (
                <div className="mt-1 ml-3 pl-3 border-l border-slate-800 space-y-1 animate-in fade-in duration-100">
                  <NavLink
                    to="/teacher/marks-entry"
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`
                    }
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                    <span>Marks Entry</span>
                  </NavLink>

                  <NavLink
                    to="/teacher/submitted-marks"
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`
                    }
                  >
                    <Send className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                    <span>Submitted Marks</span>
                  </NavLink>

                  <NavLink
                    to="/teacher/extra-components"
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`
                    }
                  >
                    <Sliders className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                    <span>Extra Components</span>
                  </NavLink>

                  <NavLink
                    to="/teacher/co-curricular-grades"
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`
                    }
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                    <span>Co-curricular Grades</span>
                  </NavLink>
                </div>
              )}
            </div>

            {/* 4. Class Result Management (Expandable) */}
            <div>
              <button
                type="button"
                onClick={() => setTeacherResultsOpen(!teacherResultsOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                  isInsideTeacherResults
                    ? 'text-white bg-slate-800/80'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center">
                  <Award className="w-4 h-4 mr-3 text-teal-400" />
                  <span>Class Result Management</span>
                </div>
                {teacherResultsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              {teacherResultsOpen && (
                <div className="mt-1 ml-3 pl-3 border-l border-slate-800 space-y-1 animate-in fade-in duration-100">
                  {isClassTeacher && (
                    <>
                      <NavLink
                        to="/teacher/marks-verification"
                        className={({ isActive }) =>
                          `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-xs font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                          }`
                        }
                      >
                        <ListChecks className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                        <span>Marks Verification</span>
                      </NavLink>

                      <NavLink
                        to="/teacher/examination-results"
                        className={({ isActive }) =>
                          `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-xs font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                          }`
                        }
                      >
                        <FileCheck2 className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                        <span>Examination Results</span>
                      </NavLink>

                      <NavLink
                        to="/teacher/final-result"
                        className={({ isActive }) =>
                          `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-xs font-semibold'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                          }`
                        }
                      >
                        <Award className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                        <span>Final Result</span>
                      </NavLink>
                    </>
                  )}

                  <NavLink
                    to="/teacher/result-performance"
                    className={({ isActive }) =>
                      `flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }`
                    }
                  >
                    <TrendingUp className="w-3.5 h-3.5 mr-2.5 text-slate-400" />
                    <span>Result &amp; Performance</span>
                  </NavLink>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OFFICE STAFF ONLY: Office & Academic Records Portal */}
        {effectivePanel === 'OFFICE_STAFF' && (
          <div className="pt-2 space-y-1">
            <div className="px-3 pb-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Office &amp; Published Records
            </div>
            <NavLink
              to="/office/published-results"
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <FileCheck2 className="w-4 h-4 mr-3 text-amber-400" />
              <span>Published Results</span>
            </NavLink>
            <NavLink
              to="/office/academic-reports"
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <FileBarChart2 className="w-4 h-4 mr-3 text-indigo-400" />
              <span>Academic Reports</span>
            </NavLink>
            <NavLink
              to="/office/download-history"
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <History className="w-4 h-4 mr-3 text-emerald-400" />
              <span>Download History</span>
            </NavLink>
            <NavLink
              to="/office/notifications"
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <Bell className="w-4 h-4 mr-3 text-sky-400" />
              <span>Notifications</span>
            </NavLink>
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

        {/* ADMIN & HEAD TEACHER: Academic Management Expandable Menu (Module 3) */}
        {(currentUser?.roleCode === 'ADMIN' || effectivePanel === 'HEAD_TEACHER') && (
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

        {/* ADMIN & HEAD TEACHER: Student Management Expandable Menu (Module 4) */}
        {(currentUser?.roleCode === 'ADMIN' || effectivePanel === 'HEAD_TEACHER') && (
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

        {/* Admin only: Marks Entry Lock Controls & Audit Log */}
        {currentUser?.roleCode === 'ADMIN' && (
          <div className="pt-2 space-y-1">
            <div className="px-3 pb-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Governance &amp; Controls
            </div>
            <NavLink
              to="/admin/marks-lock"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <Lock className="w-4 h-4 mr-3 text-amber-400" />
              <span>Marks Entry Lock Controls</span>
            </NavLink>
            <NavLink
              to="/admin/audit-logs"
              className={({ isActive }) =>
                `flex items-center px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`
              }
            >
              <ScrollText className="w-4 h-4 mr-3 text-indigo-400" />
              <span>Audit Log</span>
            </NavLink>
          </div>
        )}

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

        {/* Controlled Application Restart (All 4 Authenticated Roles) */}
        <button
          type="button"
          onClick={() => setRestartModalOpen(true)}
          className="w-full flex items-center px-3 py-2.5 text-xs font-semibold rounded-lg text-amber-400 hover:text-amber-300 hover:bg-slate-800/60 transition-colors"
          title="Safely restart DMMS backend & frontend services"
        >
          <RefreshCw className="w-4 h-4 mr-3" />
          <span>Restart Application</span>
        </button>
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

      <RestartApplicationModal
        isOpen={restartModalOpen}
        onClose={() => setRestartModalOpen(false)}
      />
    </aside>
  );
};

export default Sidebar;
