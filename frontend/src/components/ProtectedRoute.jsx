import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSchoolAuth } from '../context/SchoolAuthContext';
import { useUserAuth } from '../context/UserAuthContext';

const ProtectedRoute = ({ children, allowedRoles = null, requireTeacherAccess = false }) => {
  const { isSchoolAuthenticated, loading: schoolLoading } = useSchoolAuth();
  const { currentUser, isUserAuthenticated, loading: userLoading } = useUserAuth();
  const location = useLocation();

  if (schoolLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 1. Must have authenticated school
  if (!isSchoolAuthenticated) {
    return <Navigate to="/school-login" state={{ from: location }} replace />;
  }

  // 2. Must have authenticated user
  if (!isUserAuthenticated) {
    return <Navigate to="/user-login" state={{ from: location }} replace />;
  }

  // 3. Mandatory password change check (Rule 8.4)
  if (currentUser?.mustChangePassword && location.pathname !== '/first-login-change-password') {
    return <Navigate to="/first-login-change-password" replace />;
  }

  // 4. Optional panel/role enforcement
  if (requireTeacherAccess) {
    const hasAccess =
      currentUser?.roleCode === 'TEACHER' ||
      (currentUser?.roleCode === 'HEAD_TEACHER' && !!currentUser?.teachingAccess?.hasTeachingAccess);
    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />;
    }
  } else if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!allowedRoles.includes(currentUser?.roleCode)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
