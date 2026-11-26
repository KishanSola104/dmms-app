import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, Loader2, X, ShieldAlert } from 'lucide-react';
import api from '../services/api';

const RestartApplicationModal = ({ isOpen, onClose }) => {
  const [phase, setPhase] = useState('CONFIRM'); // 'CONFIRM' | 'RESTARTING' | 'RECOVERED' | 'ERROR'
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const pollTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPhase('CONFIRM');
      setErrorMsg('');
      setStatusMessage('');
    }
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const startHealthRecoveryPolling = () => {
    const startedAt = Date.now();
    let sawRestartDip = false;

    pollTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed > 60000) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
        setPhase('ERROR');
        setErrorMsg('Services took longer than expected to respond. Please refresh the browser manually.');
        return;
      }

      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) {
          sawRestartDip = true;
          return;
        }
        // Wait at least 3.5 seconds (or after observing restart dip) before confirming live recovery
        if (sawRestartDip || elapsed >= 4500) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setPhase('RECOVERED');
          setStatusMessage('Backend and frontend services have restarted. Refreshing session...');
          setTimeout(() => {
            window.location.reload();
          }, 900);
        }
      } catch (e) {
        sawRestartDip = true;
      }
    }, 1500);
  };

  const handleConfirmRestart = async () => {
    setErrorMsg('');
    setPhase('RESTARTING');
    setStatusMessage('Submitting controlled application restart request...');

    try {
      const res = await api.post('/common/restart-application');
      setStatusMessage(res?.message || 'Restarting DMMS services on ports 8000 & 5173...');
      startHealthRecoveryPolling();
    } catch (err) {
      setPhase('ERROR');
      setErrorMsg(err?.message || 'Failed to initiate application restart.');
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
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-bold">Controlled Application Restart</p>
                  <p>
                    This safely restarts both backend and frontend application servers without deleting any
                    database records or configuration files. Active sessions may briefly pause for a few seconds.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Protected by cooldown and audit logging. Do you want to restart DMMS services now?
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs flex items-center space-x-1.5 transition-colors"
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
              <p className="text-[11px] text-slate-400">Waiting for health check recovery...</p>
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
              <div className="flex justify-end pt-1">
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
