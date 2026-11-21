import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useUserAuth } from '../context/UserAuthContext';
import api from '../services/api';
import { KeyRound, ShieldAlert, CheckCircle2, AlertCircle, Loader2, Lock } from 'lucide-react';

const FirstLoginPasswordChangePage = () => {
  const navigate = useNavigate();
  const { currentUser, updateUser, loginUser } = useUserAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('The new passwords do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage('The new password cannot be the same as your temporary password.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setErrorMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/user/first-login-change-password', {
        currentPassword,
        newPassword,
        confirmPassword
      });

      if (res.success) {
        setSuccessMessage('Password changed successfully! Redirecting to your dashboard...');
        if (res.token) {
          loginUser(res.token, {
            ...currentUser,
            ...res.user,
            mustChangePassword: false,
            isFirstLogin: false
          });
        } else {
          updateUser({ mustChangePassword: false, isFirstLogin: false });
        }

        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to change password. Please verify your current temporary password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-10">
            
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 ring-8 ring-amber-50">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Mandatory Password Setup
              </h1>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Welcome, <strong>{currentUser?.fullName || currentUser?.userId}</strong>. Because this is your initial login with a system-generated temporary password, you must establish a new permanent password to continue.
              </p>
            </div>

            {errorMessage && (
              <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-800 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Temporary Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter received temporary password"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Create strong new password"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              {/* Password Requirements Guidance */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">Password Requirements:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>At least 6 characters in length</li>
                  <li>At least one uppercase letter (A-Z)</li>
                  <li>At least one lowercase letter (a-z)</li>
                  <li>At least one number (0-9)</li>
                  <li>At least one special character (!@#$%^&amp;*)</li>
                </ul>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving New Password...</span>
                    </>
                  ) : (
                    <span>Set Permanent Password</span>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default FirstLoginPasswordChangePage;
