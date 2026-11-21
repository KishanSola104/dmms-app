import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const UserAuthContext = createContext();

export const UserAuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(() => localStorage.getItem('dmms_user_token') || null);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('dmms_user_info');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      if (userToken) {
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
              isFirstLogin: res.profile.isFirstLogin,
              mustChangePassword: res.profile.mustChangePassword
            };
            setCurrentUser(updated);
            localStorage.setItem('dmms_user_info', JSON.stringify(updated));
          }
        } catch (err) {
          console.warn('[UserAuth] Session expired or invalid:', err.message);
          logoutUser();
        }
      }
      setLoading(false);
    };

    verifyUser();
  }, [userToken]);

  const loginUser = (token, userData) => {
    setUserToken(token);
    setCurrentUser(userData);
    localStorage.setItem('dmms_user_token', token);
    localStorage.setItem('dmms_user_info', JSON.stringify(userData));
  };

  const logoutUser = () => {
    setUserToken(null);
    setCurrentUser(null);
    localStorage.removeItem('dmms_user_token');
    localStorage.removeItem('dmms_user_info');
  };

  const updateUser = (fields) => {
    setCurrentUser((prev) => {
      const next = { ...prev, ...fields };
      localStorage.setItem('dmms_user_info', JSON.stringify(next));
      return next;
    });
  };

  const isUserAuthenticated = !!userToken && !!currentUser;

  return (
    <UserAuthContext.Provider
      value={{
        userToken,
        currentUser,
        isUserAuthenticated,
        loginUser,
        logoutUser,
        updateUser,
        loading
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = () => useContext(UserAuthContext);
