import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useSchoolAuth } from './SchoolAuthContext';

const UserAuthContext = createContext();

export const UserAuthProvider = ({ children }) => {
  const { isSchoolAuthenticated } = useSchoolAuth();
  const [userToken, setUserToken] = useState(() => localStorage.getItem('dmms_user_token') || null);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('dmms_user_info');
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedPanel, setSelectedPanel] = useState(() => localStorage.getItem('dmms_active_panel') || null);
  const [loading, setLoading] = useState(true);

  // Synchronize with school authentication lifecycle
  useEffect(() => {
    const handleSchoolLogout = () => {
      logoutUser();
    };

    window.addEventListener('dmms:school-logout', handleSchoolLogout);
    return () => window.removeEventListener('dmms:school-logout', handleSchoolLogout);
  }, []);

  useEffect(() => {
    if (!isSchoolAuthenticated) {
      logoutUser();
    }
  }, [isSchoolAuthenticated]);

  useEffect(() => {
    const verifyUser = async () => {
      if (userToken && isSchoolAuthenticated) {
        try {
          const res = await api.get('/profile/me');
          if (res.success && res.profile) {
            const updated = {
              userId: res.profile.userId,
              email: res.profile.email,
              roleCode: res.profile.roleCode,
              roleName: res.profile.roleName,
              fullName: res.profile.fullName,
              designation: res.profile.designation,
              profileImage: res.profile.profileImage,
              signatureUrl: res.profile.signatureUrl,
              teachingAccess: res.profile.teachingAccess || null,
              isFirstLogin: res.profile.isFirstLogin,
              mustChangePassword: res.profile.mustChangePassword
            };
            setCurrentUser(updated);
            localStorage.setItem('dmms_user_info', JSON.stringify(updated));
            const storedPanel = localStorage.getItem('dmms_active_panel');
            if (
              updated.roleCode === 'HEAD_TEACHER' &&
              updated.teachingAccess?.hasTeachingAccess &&
              storedPanel === 'TEACHER'
            ) {
              setSelectedPanel('TEACHER');
            } else {
              setSelectedPanel(updated.roleCode);
              localStorage.setItem('dmms_active_panel', updated.roleCode);
            }
          }
        } catch (err) {
          console.warn('[UserAuth] Session expired or invalid:', err.message);
          logoutUser();
        }
      }
      setLoading(false);
    };

    verifyUser();
  }, [userToken, isSchoolAuthenticated]);

  const loginUser = (token, userData, initialPanel = null) => {
    setUserToken(token);
    setCurrentUser(userData);
    localStorage.setItem('dmms_user_token', token);
    localStorage.setItem('dmms_user_info', JSON.stringify(userData));
    const panelToUse =
      userData?.roleCode === 'HEAD_TEACHER' &&
      userData?.teachingAccess?.hasTeachingAccess &&
      initialPanel === 'TEACHER'
        ? 'TEACHER'
        : userData?.roleCode || null;
    setSelectedPanel(panelToUse);
    if (panelToUse) {
      localStorage.setItem('dmms_active_panel', panelToUse);
    }
  };

  const logoutUser = () => {
    setUserToken(null);
    setCurrentUser(null);
    setSelectedPanel(null);
    localStorage.removeItem('dmms_user_token');
    localStorage.removeItem('dmms_user_info');
    localStorage.removeItem('dmms_active_panel');
  };

  const switchPanel = (panelCode) => {
    if (!currentUser) return;
    if (
      panelCode === 'TEACHER' &&
      currentUser.roleCode === 'HEAD_TEACHER' &&
      currentUser.teachingAccess?.hasTeachingAccess
    ) {
      setSelectedPanel('TEACHER');
      localStorage.setItem('dmms_active_panel', 'TEACHER');
      return;
    }
    const nextPanel = currentUser.roleCode;
    setSelectedPanel(nextPanel);
    localStorage.setItem('dmms_active_panel', nextPanel);
  };

  const activePanel =
    currentUser?.roleCode === 'HEAD_TEACHER' &&
    currentUser?.teachingAccess?.hasTeachingAccess &&
    selectedPanel === 'TEACHER'
      ? 'TEACHER'
      : currentUser?.roleCode || null;

  const updateUser = (fields) => {
    setCurrentUser((prev) => {
      const next = { ...prev, ...fields };
      localStorage.setItem('dmms_user_info', JSON.stringify(next));
      return next;
    });
  };

  const isUserAuthenticated = !!userToken && !!currentUser && isSchoolAuthenticated;

  return (
    <UserAuthContext.Provider
      value={{
        userToken,
        currentUser,
        activePanel,
        isUserAuthenticated,
        loginUser,
        logoutUser,
        switchPanel,
        updateUser,
        loading
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = () => useContext(UserAuthContext);
