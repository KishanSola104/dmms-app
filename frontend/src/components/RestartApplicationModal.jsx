import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, Loader2, X, ShieldAlert } from 'lucide-react';
import api from '../services/api';

const RestartApplicationModal = ({ isOpen, onClose }) => {
  const [phase, setPhase] = useState('CONFIRM'); // 'CONFIRM' | 'RESTARTING' | 'RECOVERED' | 'ERROR'
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollTimerRef = useRef(null);
  const submitLockRef = useRef(false);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const startHealthRecoveryPolling = () => {
    stopPolling();
    const startedAt = Date.now();
    let sawRestartDip = false;

    pollTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed > 60000) {
        stopPolling();
        setPhase('ERROR');
        setErrorMsg('Services took longer than expected to respond. Please click Refresh App or reload your browser.');
        return;
      }

      try {
        const [backendRes, frontendRes] = await Promise.all([
          fetch('/api/health', { cache: 'no-store' }),
          fetch('/', { method: 'HEAD', cache: 'no-store' })
        ]);

        if (!backendRes.ok || !frontendRes.ok) {
          sawRestartDip = true;
          return;
        }

        const healthData = await backendRes.json().catch(() => null);
        if (healthData?.status !== 'online') {
          sawRestartDip = true;
          return;
        }

        // Wait at least 4.5s (or after observing restart dip) so both processes complete restart before reload
        if (sawRestartDip || elapsed >= 4500) {
          stopPolling();
          setPhase('RECOVERED');
          setStatusMessage('Both backend and frontend services are back online. Reloading application...');
          setTimeout(() => {
            window.location.reload();
          }, 900);
        }
      } catch {
        sawRestartDip = true;
      }
    }, 1500);
  };

  useEffect(() => {
    if (!isOpen) {
      stopPolling();
      submitLockRef.current = false;
      setIsSubmitting(false);
      return undefined;
    }

    setPhase('CONFIRM');
    setErrorMsg('');
    setStatusMessage('');
    setIsSubmitting(false);
    submitLockRef.current = false;

    // Prevent duplicate restarts if another user/tab already triggered one
    api
      .get('/common/restart-status')
      .then((res) => {
        if (res?.restartInProgress) {
          setPhase('RESTARTING');
          setStatusMessage('An application restart is already in progress. Waiting for services to reconnect...');
          startHealthRecoveryPolling();
        }
      })
      .catch(() => {
        // Ignore status pre-check failure
      });

    return () => stopPolling();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmRestart = async () => {
    if (submitLockRef.current || isSubmitting || phase === 'RESTARTING') return;
    submitLockRef.current = true;
    setIsSubmitting(true);
    setErrorMsg('');
    setPhase('RESTARTING');
    setStatusMessage('Submitting controlled application restart request...');

    try {
      const res = await api.post('/common/restart-application');
      setStatusMessage(res?.message || 'Restarting DMMS backend and frontend services...');
      startHealthRecoveryPolling();
    } catch (err) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      if (err?.status === 409) {
        setPhase('RESTARTING');
        setStatusMessage(err.message || 'Restart already in progress. Waiting for services to reconnect...');
        startHealthRecoveryPolling();
      } else {
        setPhase('ERROR');
        setErrorMsg(err?.message || 'Failed to initiate application restart.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <RefreshCw className={`w-5 h-5 text-amber-400 ${phase === 'RESTARTING' ? 'animate-spin' : ''}`} />
            <h3 className="text-sm font-bold tracking-wide">Restart Application</h3>
          </div>
          {phase !== 'RESTARTING' && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-4">
          {phase === 'CONFIRM' && (
            <>
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1.5">
                  <p className="font-bold">Controlled Application Restart Warning</p>
                  <p>
                    Restarting DMMS will restart both the backend and frontend services on the school server.
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 font-medium">
                    <li>All connected users across the school network may be temporarily disconnected for a few seconds.</li>
                    <li>Please save any unsaved work (such as marks entries or forms) before proceeding.</li>
                    <li>Saved database records and user accounts will not be affected.</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                This action is audit-logged and protected against duplicate restarts. Are you sure you want to restart DMMS now?
              </p>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestart}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Confirm Restart</span>
                </button>
              </div>
            </>
          )}

          {phase === 'RESTARTING' && (
            <div className="py-4 text-center space-y-3">
              <Loader2 className="w-10 h-10 text-amber-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-900">Restarting DMMS Application...</p>
              <p className="text-xs text-slate-500">{statusMessage}</p>
              <p className="text-[11px] text-slate-400">Waiting for both frontend &amp; backend services to come back online...</p>
            </div>
          )}

          {phase === 'RECOVERED' && (
            <div className="py-4 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="text-sm font-bold text-emerald-900">Application Restarted</p>
              <p className="text-xs text-slate-600">{statusMessage}</p>
            </div>
          )}

          {phase === 'ERROR' && (
            <>
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-900">
                  <p className="font-bold">Restart Could Not Proceed</p>
                  <p className="mt-1">{errorMsg}</p>
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Refresh Page
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestartApplicationModal;
