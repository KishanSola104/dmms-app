import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const SchoolAuthContext = createContext();

export const SchoolAuthProvider = ({ children }) => {
  const [schoolToken, setSchoolToken] = useState(() => localStorage.getItem('dmms_school_token') || null);
  const [currentSchool, setCurrentSchool] = useState(() => {
    const saved = localStorage.getItem('dmms_school_info');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifySchool = async () => {
      if (schoolToken) {
        try {
          const res = await api.get('/auth/current-school');
          if (res.success && res.school) {
            setCurrentSchool(res.school);
            localStorage.setItem('dmms_school_info', JSON.stringify(res.school));
          }
        } catch (err) {
          console.warn('[SchoolAuth] Session expired or invalid:', err.message);
          logoutSchool();
        }
      }
      setLoading(false);
    };

    verifySchool();
  }, [schoolToken]);

  const loginSchool = (token, schoolData) => {
    setSchoolToken(token);
    setCurrentSchool(schoolData);
    localStorage.setItem('dmms_school_token', token);
    localStorage.setItem('dmms_school_info', JSON.stringify(schoolData));
  };

  const updateSchoolData = (updatedSchool) => {
    setCurrentSchool(prev => {
      const merged = { ...prev, ...updatedSchool };
      localStorage.setItem('dmms_school_info', JSON.stringify(merged));
      return merged;
    });
  };

  const logoutSchool = () => {
    setSchoolToken(null);
    setCurrentSchool(null);
    localStorage.removeItem('dmms_school_token');
    localStorage.removeItem('dmms_school_info');

    // Also clear any user session
    localStorage.removeItem('dmms_user_token');
    localStorage.removeItem('dmms_user_info');
    localStorage.removeItem('dmms_active_academic_year');

    // Dispatch event to notify dependent contexts (UserAuthContext, AcademicYearContext)
    window.dispatchEvent(new Event('dmms:school-logout'));
  };

  const isSchoolAuthenticated = !!schoolToken && !!currentSchool;

  return (
    <SchoolAuthContext.Provider
      value={{
        schoolToken,
        currentSchool,
        isSchoolAuthenticated,
        loginSchool,
        updateSchoolData,
        logoutSchool,
        loading
      }}
    >
      {children}
    </SchoolAuthContext.Provider>
  );
};

export const useSchoolAuth = () => useContext(SchoolAuthContext);
