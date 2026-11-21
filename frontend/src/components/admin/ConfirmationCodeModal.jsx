import React, { useState, useEffect } from 'react';
import AdminModal from './AdminModal';
import api from '../../services/api';
import { ShieldAlert, KeyRound, Loader2, RefreshCw } from 'lucide-react';

const ConfirmationCodeModal = ({
  isOpen,
  onClose,
  action, // 'DEACTIVATE_USER' or 'DELETE_USER'
  targetUser,
  onSuccess
}) => {
  const [code, setCode] = useState('');
  const [requestingCode, setRequestingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(0);

  const isDelete = action === 'DELETE_USER';
  const actionTitle = isDelete ? 'Confirm Account Deletion' : 'Confirm Account Deactivation';

  // Countdown timer effect
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Request code when modal opens
  useEffect(() => {
    if (isOpen && targetUser) {
      setCode('');
      setErrorMessage('');
      setInfoMessage('');
      handleRequestCode();
    }
  }, [isOpen, targetUser]);

  const handleRequestCode = async () => {
    if (!targetUser) return;
    setRequestingCode(true);
    setErrorMessage('');
    try {
      const res = await api.post('/admin/users/request-confirmation-code', {
        action,
        targetUserId: targetUser.userId
      });
      if (res.success) {
        setCodeSent(true);
        setInfoMessage(res.message || 'Confirmation code sent to your administrator email.');
        setCountdown(60); // 60 seconds before allowing resend
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setRequestingCode(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!code || code.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit confirmation code.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const endpoint = isDelete ? '/admin/users/delete' : '/admin/users/deactivate';
      const res = await api.post(endpoint, {
        targetUserId: targetUser.userId,
        confirmationCode: code.trim()
      });

      if (res.success) {
        onSuccess(res.message);
        onClose();
      }
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={actionTitle}
      subtitle={`Security authorization required for ${targetUser?.fullName || targetUser?.userId}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        {/* Warning Banner */}
        <div className={`p-3.5 rounded-xl border flex items-start space-x-3 ${isDelete ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed">
            {isDelete ? (
              <p>
                <strong>Warning:</strong> You are about to permanently delete account{' '}
                <span className="font-mono font-semibold">{targetUser?.userId}</span> ({targetUser?.fullName}).
                This operation requires email verification.
              </p>
            ) : (
              <p>
                You are about to deactivate account{' '}
                <span className="font-mono font-semibold">{targetUser?.userId}</span> ({targetUser?.fullName}).
                Deactivated users cannot log into the platform.
              </p>
            )}
          </div>
        </div>

        {/* Status Message */}
        {infoMessage && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg">
            {infoMessage}
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {errorMessage}
          </div>
        )}

        {/* Confirmation Code Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Enter 6-Digit Email Confirmation Code
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="123456"
              className="w-full pl-9 pr-3 py-2.5 text-center text-lg font-mono tracking-widest bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              autoFocus
              required
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs">
            <span className="text-slate-400">Code expires in 10 minutes</span>
            <button
              type="button"
              onClick={handleRequestCode}
              disabled={requestingCode || countdown > 0}
              className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {requestingCode ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Sending...
                </>
              ) : countdown > 0 ? (
                `Resend in ${countdown}s`
              ) : (
                <>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Resend Code
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className={`inline-flex items-center px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all focus:outline-hidden disabled:opacity-50 disabled:cursor-not-allowed ${
              isDelete
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            <span>{isDelete ? 'Verify & Delete' : 'Verify & Deactivate'}</span>
          </button>
        </div>
      </form>
    </AdminModal>
  );
};

export default ConfirmationCodeModal;
