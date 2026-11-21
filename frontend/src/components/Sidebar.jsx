import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UserCheck, KeyRound, Building, LogOut, Shield } from 'lucide-react';
import { useUserAuth } from '../context/UserAuthContext';
import { useSchoolAuth } from '../context/SchoolAuthContext';

const Sidebar = () => {
  const navigate = useNavigate();
  const { currentUser, logoutUser } = useUserAuth();
  const { currentSchool, logoutSchool } = useSchoolAuth();

  const handleSchoolLogout = () => {
    if (window.confirm('Are you sure you want to change school? This will clear the current school session.')) {
      logoutSchool();
      navigate('/school-login');
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
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col min-h-[calc(100vh-4rem)] border-r border-slate-800">
      {/* School Card in Sidebar */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/40">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-blue-600/10 rounded-lg border border-blue-500/20 text-blue-400 mt-0.5">
            <Building className="w-5 h-5" />
          </div>
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
      <div className="flex-1 py-4 px-3 space-y-1">
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
