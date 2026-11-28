import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useBackendHealth } from '../context/BackendHealthContext';
import { useSchoolAuth } from '../context/SchoolAuthContext';
import { useUserAuth } from '../context/UserAuthContext';
import {
  RefreshCw,
  CheckCircle2,
  WifiOff,
  Loader2,
  Home,
  LogIn,
  Building2,
  LayoutDashboard,
  ShieldCheck
} from 'lucide-react';

const RefreshAppPage = () => {
  const navigate = useNavigate();
  const {
    healthStatus,
    isBackendOnline,
    statusMessage,
    databaseStatus,
    lastCheckedAt,
    isChecking,
    retryCountdown,
    checkHealth,
    refreshApp
  } = useBackendHealth();
  const { isSchoolAuthenticated } = useSchoolAuth();
  const { isUserAuthenticated } = useUserAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleManualRetry = async () => {
    await checkHealth();
  };

  const handleRefreshApp = async () => {
    setRefreshing(true);
    await refreshApp({ reloadPage: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 p-7 sm:p-9 space-y-6">
          <div className="text-center space-y-2">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
                isBackendOnline
                  ? 'bg-emerald-100 text-emerald-600'
                  : healthStatus === 'checking'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-amber-100 text-amber-600'
              }`}
            >
              {isChecking || healthStatus === 'checking' ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : isBackendOnline ? (
                <CheckCircle2 className="w-7 h-7" />
              ) : (
                <WifiOff className="w-7 h-7" />
              )}
            </div>

            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              DMMS Connection &amp; App Recovery
            </h1>
            <p className="text-xs text-slate-500">
              Safely refresh your browser session and check DMMS server availability without restarting the server or losing saved data.
            </p>
          </div>

          {/* Live Connection Status Card */}
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              isBackendOnline
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : healthStatus === 'checking'
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-[11px]">System Status</span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                  isBackendOnline
                    ? 'bg-emerald-200/80 text-emerald-900'
                    : healthStatus === 'checking'
                      ? 'bg-blue-200/80 text-blue-900'
                      : 'bg-amber-200/80 text-amber-950'
                }`}
              >
                {isBackendOnline ? 'Online' : healthStatus === 'checking' ? 'Checking' : 'Reconnecting'}
              </span>
            </div>

            <p className="font-semibold text-sm">{statusMessage}</p>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] opacity-85">
              <span>Database: {databaseStatus === 'connected' ? 'Connected' : 'Waiting for connection'}</span>
              {lastCheckedAt && <span>Last checked: {lastCheckedAt.toLocaleTimeString()}</span>}
            </div>

            {!isBackendOnline && healthStatus === 'offline' && (
              <p className="text-[11px] font-medium pt-1">
                Automatic connection check in {retryCountdown}s...
              </p>
            )}
          </div>

          {/* Primary Recovery Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleManualRetry}
              disabled={isChecking || refreshing}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold rounded-xl border border-slate-300 shadow-2xs flex items-center justify-center space-x-2 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {isChecking ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <RefreshCw className="w-4 h-4 text-blue-600" />
              )}
              <span>Retry Connection</span>
            </button>

            <button
              type="button"
              onClick={handleRefreshApp}
              disabled={refreshing}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm flex items-center justify-center space-x-2 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Refresh App</span>
            </button>
          </div>

          {/* Data Safety Guarantee */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-2.5 text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Safe Recovery:</strong> Refreshing the app clears only temporary browser cache and preserves your login session, school setup, and all saved marks and records.
            </span>
          </div>

          {/* Navigation Shortcuts (Always usable offline too) */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">
              Quick Navigation
            </p>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <Link
                to="/"
                className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home Page</span>
              </Link>

              <Link
                to="/register-school"
                className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>School Registration</span>
              </Link>

              <Link
                to="/school-login"
                className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>School Login</span>
              </Link>

              {isUserAuthenticated ? (
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold transition-colors cursor-pointer"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>
              ) : (
                <Link
                  to={isSchoolAuthenticated ? '/user-login' : '/school-login'}
                  className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isSchoolAuthenticated ? 'User Login' : 'Forgot Password'}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default RefreshAppPage;
