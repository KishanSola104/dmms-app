import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { useBackendHealth } from '../context/BackendHealthContext';

const BackendStatusBanner = () => {
  const location = useLocation();
  const { isBackendOffline, isChecking, retryCountdown, checkHealth, refreshApp } = useBackendHealth();

  // Do not duplicate banner on the dedicated /refresh-app recovery page
  if (!isBackendOffline || location.pathname === '/refresh-app') {
    return null;
  }

  return (
    <div
      role="alert"
      className="bg-amber-50 border-b border-amber-300 text-amber-950 px-4 py-2.5 shadow-xs z-50"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div className="flex items-start sm:items-center space-x-2.5 text-xs sm:text-sm">
          <WifiOff className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <span className="font-semibold">
              DMMS is temporarily unavailable. Please wait while the system reconnects.
            </span>
            <span className="ml-2 text-xs text-amber-800">
              {isChecking ? 'Checking connection...' : `Retrying automatically in ${retryCountdown}s`}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={() => checkHealth()}
            disabled={isChecking}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-60 cursor-pointer"
          >
            {isChecking ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Retry Now</span>
          </button>

          <button
            type="button"
            onClick={() => refreshApp({ reloadPage: true })}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh App</span>
          </button>

          <Link
            to="/refresh-app"
            className="px-2.5 py-1.5 text-xs font-semibold text-amber-900 underline hover:text-amber-700"
          >
            Recovery Page
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BackendStatusBanner;
