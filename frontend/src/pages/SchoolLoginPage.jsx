import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useSchoolAuth } from '../context/SchoolAuthContext';
import api from '../services/api';
import { Building2, KeyRound, ArrowRight, AlertCircle, Loader2, HelpCircle, CheckCircle2 } from 'lucide-react';

const SchoolLoginPage = () => {
  const navigate = useNavigate();
  const { loginSchool } = useSchoolAuth();

  const [schoolId, setSchoolId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleSchoolLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!schoolId.trim() || !password) {
      setErrorMessage('Please enter both School ID and Password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/school/login', {
        schoolId: schoolId.trim().toUpperCase(),
        password: password
      });

      if (res.success && res.schoolToken) {
        loginSchool(res.schoolToken, res.school);
        navigate('/user-login');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotIdentifier.trim()) {
      setForgotError('Please enter your School ID or registered school email.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await api.post('/school/forgot-password', {
        identifier: forgotIdentifier.trim()
      });
      if (res.success) {
        setForgotSuccess(res.message);
      }
    } catch (err) {
      setForgotError(err.message || 'Could not reset school password.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-10">
            
            <div className="text-center mb-8">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                <Building2 className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                School Authentication
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Enter your School ID &amp; Password to access institutional portal
              </p>
            </div>

            {errorMessage && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSchoolLogin} className="space-y-5">
              {/* School ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  School ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={schoolId}
                    onChange={(e) => {
                      setSchoolId(e.target.value.toUpperCase());
                      setErrorMessage('');
                    }}
                    placeholder="e.g. KBPS_001"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm uppercase rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-hidden transition-all"
                    required
                  />
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    School Password
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
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying School...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate School</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500">
                School not registered yet?{' '}
                <Link to="/register-school" className="text-blue-600 hover:text-blue-800 font-semibold">
                  Register Your School
                </Link>
              </p>
            </div>

          </div>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8">
            <div className="flex items-center space-x-3 text-slate-900 mb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <HelpCircle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold">School Forgot Password</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Enter your registered School ID or School Email address. If found, a temporary password will be dispatched to the official school email.
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
                    School ID or Official Email
                  </label>
                  <input
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="e.g. KBPS_001 or admin@school.edu"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-hidden"
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
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center space-x-1.5"
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
                  className="w-full py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
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

export default SchoolLoginPage;
