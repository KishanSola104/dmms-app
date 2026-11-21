import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSchoolAuth } from '../context/SchoolAuthContext';

const SchoolProtectedRoute = ({ children }) => {
  const { isSchoolAuthenticated, loading } = useSchoolAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isSchoolAuthenticated) {
    return <Navigate to="/school-login" state={{ from: location }} replace />;
  }

  return children;
};

export default SchoolProtectedRoute;
