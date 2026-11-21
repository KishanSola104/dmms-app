import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useUserAuth } from '../context/UserAuthContext';
import api from '../services/api';
import { KeyRound, Shield, Check, AlertCircle, Loader2, Lock, Building } from 'lucide-react';

const ChangePasswordPage = () => {
  const { currentUser } = useUserAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab: 'personal' or 'school'
  const initialTab = searchParams.get('tab') === 'school' && currentUser?.roleCode === 'ADMIN' ? 'school' : 'personal';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Personal Password State
  const [personalCurrent, setPersonalCurrent] = useState('');
  const [personalNew, setPersonalNew] = useState('');
  const [personalConfirm, setPersonalConfirm] = useState('');
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState('');
  const [personalSuccess, setPersonalSuccess] = useState('');

  // School Password State (Admin only)
  const [schoolCurrent, setSchoolCurrent] = useState('');
  const [schoolNew, setSchoolNew] = useState('');
  const [schoolConfirm, setSchoolConfirm] = useState('');
  const [schoolLoading, setSchoolLoading] = useState(false);
  const [schoolError, setSchoolError] = useState('');
  const [schoolSuccess, setSchoolSuccess] = useState('');

  useEffect(() => {
    if (searchParams.get('tab') === 'school' && currentUser?.roleCode === 'ADMIN') {
      setActiveTab('school');
    }
  }, [searchParams, currentUser]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'school' ? { tab: 'school' } : {});
  };

  const handlePersonalSubmit = async (e) => {
    e.preventDefault();
    setPersonalError('');
    setPersonalSuccess('');

    if (!personalCurrent || !personalNew || !personalConfirm) {
      setPersonalError('All password fields are required.');
      return;
    }
    if (personalNew !== personalConfirm) {
      setPersonalError('New password and confirm password do not match.');
      return;
    }
    if (personalNew === personalCurrent) {
      setPersonalError('New password cannot be the same as the current password.');
      return;
    }
    if (personalNew.length < 6) {
      setPersonalError('Password must be at least 6 characters long.');
      return;
    }
    if (!/[A-Z]/.test(personalNew) || !/[a-z]/.test(personalNew) || !/[0-9]/.test(personalNew)) {
      setPersonalError('Password must contain at least one uppercase letter, one lowercase letter, and one number.');
      return;
    }

    setPersonalLoading(true);
    try {
      const res = await api.post('/profile/change-password', {
        currentPassword: personalCurrent,
        newPassword: personalNew,
        confirmPassword: personalConfirm
      });

      if (res.success) {
        setPersonalSuccess('Your personal account password has been changed successfully.');
        setPersonalCurrent('');
        setPersonalNew('');
        setPersonalConfirm('');
      }
    } catch (err) {
      setPersonalError(err.message || 'Failed to change personal password.');
    } finally {
      setPersonalLoading(false);
    }
  };

  const handleSchoolSubmit = async (e) => {
    e.preventDefault();
    setSchoolError('');
    setSchoolSuccess('');

    if (!schoolCurrent || !schoolNew || !schoolConfirm) {
      setSchoolError('All school password fields are required.');
      return;
    }
    if (schoolNew !== schoolConfirm) {
      setSchoolError('New school password and confirm password do not match.');
      return;
    }
    if (schoolNew === schoolCurrent) {
      setSchoolError('New school password cannot be the same as current password.');
      return;
    }
    if (schoolNew.length < 6) {
      setSchoolError('Password must be at least 6 characters long.');
      return;
    }
    if (!/[A-Z]/.test(schoolNew) || !/[a-z]/.test(schoolNew) || !/[0-9]/.test(schoolNew)) {
      setSchoolError('Password must contain at least one uppercase, one lowercase, and one number.');
      return;
    }

    setSchoolLoading(true);
    try {
      const res = await api.post('/school/change-password', {
        currentPassword: schoolCurrent,
        newPassword: schoolNew,
        confirmPassword: schoolConfirm
      });

      if (res.success) {
        setSchoolSuccess('The institutional School Password has been changed successfully.');
        setSchoolCurrent('');
        setSchoolNew('');
        setSchoolConfirm('');
      }
    } catch (err) {
      setSchoolError(err.message || 'Failed to change school password.');
    } finally {
      setSchoolLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Title */}
        <div className="pb-4 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Security &amp; Password Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Update your individual credentials or manage institutional school password
          </p>
        </div>

        {/* Tab Selection (School Admin gets two tabs: Personal & School Password) */}
        {currentUser?.roleCode === 'ADMIN' && (
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => handleTabChange('personal')}
              className={`py-3 px-5 text-xs sm:text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
                activeTab === 'personal'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Personal User Password</span>
            </button>

            <button
              onClick={() => handleTabChange('school')}
              className={`py-3 px-5 text-xs sm:text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
                activeTab === 'school'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>Institutional School Password</span>
            </button>
          </div>
        )}

        {/* TAB 1: Personal User Password */}
        {activeTab === 'personal' && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 sm:p-8 animate-in fade-in duration-150">
            <div className="flex items-center space-x-3 mb-6 pb-3 border-b border-slate-100">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Change My Password</h2>
                <p className="text-xs text-slate-500">Update password for account {currentUser?.userId}</p>
              </div>
            </div>

            {personalError && (
              <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <span>{personalError}</span>
              </div>
            )}

            {personalSuccess && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-800 text-xs">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>{personalSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePersonalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={personalCurrent}
                    onChange={(e) => setPersonalCurrent(e.target.value)}
                    placeholder="Enter existing password"
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
                    value={personalNew}
                    onChange={(e) => setPersonalNew(e.target.value)}
                    placeholder="Create new strong password"
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
                    value={personalConfirm}
                    onChange={(e) => setPersonalConfirm(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-hidden"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={personalLoading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
                >
                  {personalLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <span>Change My Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: Institutional School Password (ADMIN ONLY) */}
        {activeTab === 'school' && currentUser?.roleCode === 'ADMIN' && (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 sm:p-8 animate-in fade-in duration-150">
            <div className="flex items-center space-x-3 mb-6 pb-3 border-b border-slate-100">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Change Institutional School Password</h2>
                <p className="text-xs text-slate-500">School Administrator Privilege &bull; School Level Authentication</p>
              </div>
            </div>

            <div className="mb-5 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-900 leading-relaxed">
              <strong>Notice:</strong> This password is used on the primary School Login page. Changing this will require all faculty and staff to authenticate using the new School Password.
            </div>

            {schoolError && (
              <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <span>{schoolError}</span>
              </div>
            )}

            {schoolSuccess && (
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-3 text-emerald-800 text-xs">
                <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span>{schoolSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSchoolSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Current School Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={schoolCurrent}
                    onChange={(e) => setSchoolCurrent(e.target.value)}
                    placeholder="Enter current school password"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    required
                  />
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New School Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={schoolNew}
                    onChange={(e) => setSchoolNew(e.target.value)}
                    placeholder="Create new strong school password"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm New School Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={schoolConfirm}
                    onChange={(e) => setSchoolConfirm(e.target.value)}
                    placeholder="Repeat new school password"
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-hidden"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={schoolLoading}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
                >
                  {schoolLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating School Password...</span>
                    </>
                  ) : (
                    <span>Update School Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default ChangePasswordPage;
