import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useSchoolAuth } from '../context/SchoolAuthContext';
import { useUserAuth } from '../context/UserAuthContext';
import { useAcademicYear } from '../context/AcademicYearContext';
import NotificationDropdown from './NotificationDropdown';
import { User, KeyRound, LogOut, Shield, ChevronDown, Calendar, Building2 } from 'lucide-react';
import logoImg from '../assets/logo.png';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSchool, isSchoolAuthenticated, logoutSchool } = useSchoolAuth();
  const { currentUser, isUserAuthenticated, logoutUser } = useUserAuth();
  const { academicYears, selectedYear, switchAcademicYear } = useAcademicYear();

  // The authenticated dashboard layout must only render when both school and user auth states are valid,
  // and never on unauthenticated layout routes (School Login, Register, User Login, Home).
  const unauthenticatedPaths = ['/school-login', '/register-school', '/user-login', '/'];
  const isUnauthenticatedPath = unauthenticatedPaths.includes(location.pathname);
  const showDashboardHeader = isSchoolAuthenticated && isUserAuthenticated && !isUnauthenticatedPath;

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Smart Login navigation
  const handleSmartLoginClick = () => {
    if (isUserAuthenticated) {
      navigate('/dashboard');
    } else if (isSchoolAuthenticated) {
      navigate('/user-login');
    } else {
      navigate('/school-login');
    }
  };

  const handleUserLogout = () => {
    setProfileDropdownOpen(false);
    logoutUser();
    navigate('/user-login');
  };

  const handleAcademicYearChange = async (e) => {
    const yearId = e.target.value;
    await switchAcademicYear(yearId);
  };

  const avatarUrl = currentUser?.profileImage
    ? (currentUser.profileImage.startsWith('http') ? currentUser.profileImage : currentUser.profileImage)
    : null;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo */}
          <div className="flex items-center space-x-3">
            <Link
              to={showDashboardHeader ? '/dashboard' : '/'}
              className="flex items-center space-x-2.5 focus:outline-hidden"
            >
              <img
                src={logoImg}
                alt="DMMS Logo"
                className="h-10 w-auto object-contain"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/logo.png';
                }}
              />
              <div className="hidden sm:block">
                <span className="text-xl font-bold tracking-tight text-slate-900 block leading-tight">
                  DMMS
                </span>
                <span className="text-[10px] uppercase font-semibold text-blue-600 tracking-wider">
                  Digital Marksheet
                </span>
              </div>
            </Link>

            {/* School identifier pill when in dashboard */}
            {showDashboardHeader && currentSchool && (
              <div className="hidden lg:flex items-center ml-4 pl-4 border-l border-slate-200 space-x-2">
                {currentSchool.schoolLogoUrl ? (
                  <img
                    src={currentSchool.schoolLogoUrl}
                    alt="Logo"
                    className="w-5 h-5 rounded object-contain shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <Building2 className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-xs font-medium text-slate-600 truncate max-w-[200px]" title={currentSchool.schoolName}>
                  {currentSchool.schoolName}
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-slate-100 text-slate-600 rounded">
                  {currentSchool.schoolId}
                </span>
              </div>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {showDashboardHeader ? (
              <>
                {/* 1. Academic Year Dropdown */}
                <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline font-medium text-slate-500">Year:</span>
                  <select
                    value={selectedYear?._id || ''}
                    onChange={handleAcademicYearChange}
                    className="bg-transparent border-none text-xs font-semibold text-slate-800 focus:outline-hidden cursor-pointer"
                    title="Select Academic Year"
                  >
                    {academicYears.map((year) => (
                      <option key={year._id} value={year._id}>
                        {year.yearCode} {year.isCurrent ? '(Active)' : ''}
                      </option>
                    ))}
                    {academicYears.length === 0 && (
                      <option value="">No Active Year</option>
                    )}
                  </select>
                </div>

                {/* 2. Notification Icon Dropdown */}
                <NotificationDropdown />

                {/* 3. User Profile Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center space-x-2.5 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-hidden"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-slate-100">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <span>
                          {currentUser?.fullName
                            ? currentUser.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                            : 'U'}
                        </span>
                      )}
                    </div>
                    <div className="hidden md:block text-left text-xs pr-1">
                      <p className="font-semibold text-slate-800 leading-tight">
                        {currentUser?.fullName || currentUser?.userId}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {currentUser?.roleName || currentUser?.roleCode}
                      </p>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                  </button>

                  {/* Dropdown Box */}
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in duration-100">
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-800 truncate">
                          {currentUser?.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          ID: {currentUser?.userId}
                        </p>
                        <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                          {currentUser?.roleName}
                        </span>
                      </div>

                      <div className="py-1">
                        <Link
                          to="/profile"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <User className="w-4 h-4 mr-2.5 text-slate-400" />
                          My Profile
                        </Link>

                        <Link
                          to="/change-password"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <KeyRound className="w-4 h-4 mr-2.5 text-slate-400" />
                          Change Password
                        </Link>

                        {currentUser?.roleCode === 'ADMIN' && (
                          <Link
                            to="/change-password?tab=school"
                            onClick={() => setProfileDropdownOpen(false)}
                            className="flex items-center px-4 py-2 text-xs text-indigo-700 hover:bg-indigo-50 transition-colors"
                          >
                            <Shield className="w-4 h-4 mr-2.5 text-indigo-500" />
                            Change School Password
                          </Link>
                        )}
                      </div>

                      <div className="border-t border-slate-100 pt-1">
                        <button
                          onClick={handleUserLogout}
                          className="w-full text-left flex items-center px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4 mr-2.5 text-rose-500" />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Public Header Buttons */
              <div className="flex items-center space-x-2 sm:space-x-3">
                <button
                  onClick={handleSmartLoginClick}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate('/register-school')}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs hover:shadow transition-all"
                >
                  Register School
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
