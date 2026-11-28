import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const BackendHealthContext = createContext();

const RETRY_INTERVAL_SECONDS = 6;
const UNAVAILABLE_MSG = 'DMMS is temporarily unavailable. Please wait while the system reconnects.';

// Only keys safe to clear on Refresh App (never clear auth tokens, school/user session, or active academic year)
const SAFE_TEMP_SESSION_KEYS = ['dmms_temp_ui_cache', 'dmms_last_route_error'];

export const BackendHealthProvider = ({ children }) => {
  const [healthStatus, setHealthStatus] = useState('checking'); // 'checking' | 'online' | 'offline'
  const [statusMessage, setStatusMessage] = useState('Checking connection to DMMS server...');
  const [databaseStatus, setDatabaseStatus] = useState('unknown');
  const [lastCheckedAt, setLastCheckedAt] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [countdown, setCountdown] = useState(RETRY_INTERVAL_SECONDS);

  const inFlightRef = useRef(false);
  const retryTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const wasOfflineRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const checkHealth = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    if (!silent) {
      setIsChecking(true);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      setLastCheckedAt(new Date());

      if (response.ok && data?.status === 'online') {
        const reconnected = wasOfflineRef.current;
        wasOfflineRef.current = false;
        setHealthStatus('online');
        setDatabaseStatus(data.database || 'connected');
        setStatusMessage('Connected to DMMS server.');
        clearTimers();
        if (reconnected) {
          window.dispatchEvent(new Event('dmms:backend-reconnected'));
        }
        return true;
      }

      wasOfflineRef.current = true;
      setHealthStatus('offline');
      setDatabaseStatus(data?.database || 'disconnected');
      setStatusMessage(data?.message || UNAVAILABLE_MSG);
      return false;
    } catch {
      wasOfflineRef.current = true;
      setLastCheckedAt(new Date());
      setHealthStatus('offline');
      setDatabaseStatus('unreachable');
      setStatusMessage(UNAVAILABLE_MSG);
      return false;
    } finally {
      inFlightRef.current = false;
      setIsChecking(false);
    }
  }, [clearTimers]);

  // Controlled periodic retry ONLY while offline (no rapid infinite polling)
  useEffect(() => {
    clearTimers();
    if (healthStatus !== 'offline') {
      return undefined;
    }

    setCountdown(RETRY_INTERVAL_SECONDS);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : RETRY_INTERVAL_SECONDS));
    }, 1000);

    retryTimerRef.current = setTimeout(() => {
      checkHealth({ silent: true });
    }, RETRY_INTERVAL_SECONDS * 1000);

    return () => clearTimers();
  }, [healthStatus, lastCheckedAt, checkHealth, clearTimers]);

  // Initial health check when application opens or browser refreshes
  useEffect(() => {
    checkHealth();

    const handleUnavailable = (e) => {
      wasOfflineRef.current = true;
      setHealthStatus('offline');
      setStatusMessage(e?.detail?.message || UNAVAILABLE_MSG);
      setLastCheckedAt(new Date());
    };

    const handleOnline = () => {
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        setHealthStatus('online');
        setDatabaseStatus('connected');
        setStatusMessage('Connected to DMMS server.');
        clearTimers();
        window.dispatchEvent(new Event('dmms:backend-reconnected'));
      }
    };

    const handleBrowserOnline = () => {
      checkHealth();
    };

    window.addEventListener('dmms:backend-unavailable', handleUnavailable);
    window.addEventListener('dmms:backend-online', handleOnline);
    window.addEventListener('online', handleBrowserOnline);

    return () => {
      window.removeEventListener('dmms:backend-unavailable', handleUnavailable);
      window.removeEventListener('dmms:backend-online', handleOnline);
      window.removeEventListener('online', handleBrowserOnline);
      clearTimers();
    };
  }, [checkHealth, clearTimers]);

  const clearSafeTemporaryState = useCallback(() => {
    try {
      SAFE_TEMP_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
      sessionStorage.clear();
      // Preserve auth/session keys in localStorage; clear only transient UI keys if any
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('dmms_temp_')) {
          localStorage.removeItem(k);
        }
      });
    } catch {
      // Ignore storage errors
    }
  }, []);

  const refreshApp = useCallback(
    async ({ reloadPage = true } = {}) => {
      clearSafeTemporaryState();
      const online = await checkHealth();
      if (reloadPage) {
        window.location.reload();
      }
      return online;
    },
    [clearSafeTemporaryState, checkHealth]
  );

  return (
    <BackendHealthContext.Provider
      value={{
        healthStatus,
        isBackendOnline: healthStatus === 'online',
        isBackendOffline: healthStatus === 'offline',
        statusMessage,
        databaseStatus,
        lastCheckedAt,
        isChecking,
        retryCountdown: countdown,
        checkHealth,
        clearSafeTemporaryState,
        refreshApp
      }}
    >
      {children}
    </BackendHealthContext.Provider>
  );
};

export const useBackendHealth = () => useContext(BackendHealthContext);
