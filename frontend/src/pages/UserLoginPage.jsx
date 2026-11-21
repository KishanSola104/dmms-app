import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useSchoolAuth } from '../context/SchoolAuthContext';
import { useUserAuth } from '../context/UserAuthContext';
import api from '../services/api';
import {
  Building2,
  User,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Loader2,
  HelpCircle,
  CheckCircle2,
  LogOut,
  RefreshCw
} from 'lucide-react';

const UserLoginPage = () => {
  const navigate = useNavigate();
  const { currentSchool, logoutSchool } = useSchoolAuth();
  const { loginUser } = useUserAuth();

  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotRole, setForgotRole] = useState('');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Fetch roles dynamically from role_info table
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await api.get('/auth/roles');
        if (res.success && res.roles) {
          setRoles(res.roles);
          if (res.roles.length > 0) {
            setSelectedRole(res.roles[0].roleCode);
            setForgotRole(res.roles[0].roleCode);
          }
        }
      } catch (err) {
        console.error('[UserLogin] Error loading roles:', err.message);
        setErrorMessage('Failed to load system roles. Please check network connection.');
      } finally {
        setRolesLoading(false);
      }
    };

    fetchRoles();
  }, []);

  const handleUserLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedRole || !identifier.trim() || !password) {
      setErrorMessage('Please select a Role and enter your User ID/Email and Password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/user/login', {
        roleCode: selectedRole,
        identifier: identifier.trim(),
        password: password
      });

      if (res.success && res.token) {
        loginUser(res.token, res.user);

        // Check for mandatory first login password change (Rule 8.4)
        if (res.mustChangePassword || res.user.mustChangePassword) {
          navigate('/first-login-change-password');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please verify your credentials and role.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotRole || !forgotIdentifier.trim()) {
      setForgotError('Please select your role and enter your User ID or email.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.post('/auth/user/forgot-password', {
        roleCode: forgotRole,
        identifier: forgotIdentifier.trim()
      });
      if (res.success) {
        setForgotSuccess(res.message);
      }
    } catch (err) {
      setForgotError(err.message || 'Could not reset password.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleChangeSchool = () => {
    logoutSchool();
    navigate('/school-login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          
          {/* Active School Badge */}
          <div className="mb-4 bg-white rounded-xl shadow-xs border border-slate-200 p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase font-bold text-slate-400">Authenticated School</p>
                <p className="text-xs font-bold text-slate-800 truncate" title={currentSchool?.schoolName}>
                  {currentSchool?.schoolName}
                </p>
                <span className="text-[10px] font-mono text-blue-600 font-semibold">
                  ID: {currentSchool?.schoolId}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleChangeSchool}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition-colors shrink-0 flex items-center space-x-1"
              title="Authenticate a different school"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Change</span>
            </button>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-10">
            
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Role-Based User Login
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Select your assigned role and enter your DMMS account credentials
              </p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleUserLogin} className="space-y-4">
              
              {/* Dynamic Role Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned System Role <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  {rolesLoading ? (
                    <div className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-xs text-slate-400 flex items-center space-x-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>Loading available roles...</span>
                    </div>
                  ) : (
                    <select
                      value={selectedRole}
                      onChange={(e) => {
                        setSelectedRole(e.target.value);
                        setErrorMessage('');
                      }}
                      className="w-full pl-3.5 pr-8 py-2.5 text-xs font-medium rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all cursor-pointer"
                      required
                    >
                      {roles.map((r) => (
                        <option key={r.roleCode} value={r.roleCode}>
                          {r.roleName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* User ID or Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  User ID / Registered Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="e.g. KSKBPS_001 or email@domain.com"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all"
                    required
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    User Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(true);
                      setForgotError('');
                      setForgotSuccess('');
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="••••••••••"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all"
                    required
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || rolesLoading}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying User...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Need school login?</span>
              <button
                type="button"
                onClick={handleChangeSchool}
                className="text-blue-600 hover:text-blue-800 font-semibold"
              >
                Return to School Login
              </button>
            </div>

          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8">
            <div className="flex items-center space-x-3 text-slate-900 mb-4">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">User Forgot Password</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Enter your assigned role and registered User ID or email for school <strong>{currentSchool?.schoolName}</strong>. A temporary password will be dispatched to your registered email address.
            </p>

            {forgotError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {!forgotSuccess ? (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Assigned Role
                  </label>
                  <select
                    value={forgotRole}
                    onChange={(e) => setForgotRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500 outline-hidden"
                  >
                    {roles.map((r) => (
                      <option key={r.roleCode} value={r.roleCode}>
                        {r.roleName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    User ID or Registered Email
                  </label>
                  <input
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="e.g. KSKBPS_001 or user@school.edu"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    required
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center space-x-1.5"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Request Password</span>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                >
                  Close &amp; Proceed to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default UserLoginPage;
