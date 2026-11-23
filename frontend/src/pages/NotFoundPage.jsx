import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';
import { useSchoolAuth } from '../context/SchoolAuthContext';
import { Home, ArrowLeft, LayoutDashboard, ShieldAlert, LogIn } from 'lucide-react';
import logoImg from '../assets/logo.png';

const NotFoundPage = () => {
  const navigate = useNavigate();
  const { currentUser, isUserAuthenticated } = useUserAuth();
  const { isSchoolAuthenticated, currentSchool } = useSchoolAuth();

  // Determine role-aware dashboard button text and destination
  let dashboardPath = '/';
  let dashboardLabel = 'Go to Home';
  let DashboardIcon = Home;

  if (isUserAuthenticated && currentUser) {
    dashboardPath = '/dashboard';
    DashboardIcon = LayoutDashboard;
    switch (currentUser.roleCode) {
      case 'ADMIN':
        dashboardLabel = 'Go to Admin Dashboard';
        break;
      case 'HEAD_TEACHER':
        dashboardLabel = 'Go to Head Teacher Dashboard';
        break;
      case 'TEACHER':
        dashboardLabel = 'Go to Teacher Dashboard';
        break;
      case 'OFFICE_STAFF':
        dashboardLabel = 'Go to Office Staff Dashboard';
        break;
      default:
        dashboardLabel = 'Go to Dashboard';
        break;
    }
  } else if (isSchoolAuthenticated) {
    dashboardPath = '/user-login';
    dashboardLabel = 'Go to Staff Login';
    DashboardIcon = LogIn;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 py-3 px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2.5">
            <img
              src={logoImg}
              alt="DMMS Logo"
              className="h-9 w-auto object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/logo.png';
              }}
            />
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 block leading-tight">
                DMMS
              </span>
              <span className="text-[10px] uppercase font-semibold text-blue-600 tracking-wider">
                Digital Marksheet
              </span>
            </div>
          </Link>

          {isSchoolAuthenticated && currentSchool && (
            <div className="text-right text-xs">
              <span className="font-semibold text-slate-800">{currentSchool.schoolName}</span>
              <span className="ml-2 font-mono text-slate-400">({currentSchool.schoolId})</span>
            </div>
          )}
        </div>
      </header>

      {/* Main 404 Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          {/* Badge & Icon */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-rose-50 border border-rose-200 text-rose-500 mb-6 shadow-xs">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div className="inline-block px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold tracking-wider uppercase mb-3">
            Error 404
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl mb-3">
            404 – Page Not Found
          </h1>

          <p className="text-sm text-slate-600 leading-relaxed max-w-sm mx-auto mb-8">
            The page you are looking for does not exist or may have been moved.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={dashboardPath}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <DashboardIcon className="w-4 h-4 mr-2" />
              <span>{dashboardLabel}</span>
            </Link>

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg border border-slate-300 shadow-xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2 text-slate-500" />
              <span>Go Back</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-200 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Digital Marksheet Management System (DMMS). All rights reserved.
      </footer>
    </div>
  );
};

export default NotFoundPage;
