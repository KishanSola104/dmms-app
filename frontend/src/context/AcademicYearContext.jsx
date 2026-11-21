import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useUserAuth } from './UserAuthContext';

const AcademicYearContext = createContext();

export const AcademicYearProvider = ({ children }) => {
  const { isUserAuthenticated } = useUserAuth();
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(() => {
    const saved = localStorage.getItem('dmms_active_academic_year');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  const fetchAcademicYears = async () => {
    if (!isUserAuthenticated) return;
    setLoading(true);
    try {
      const res = await api.get('/common/academic-years');
      if (res.success && res.academicYears) {
        setAcademicYears(res.academicYears);
        // If no selected year or selected year not in list, pick the current one
        if (!selectedYear || !res.academicYears.some(y => y._id === selectedYear._id)) {
          const current = res.currentYear || res.academicYears[0];
          setSelectedYear(current);
          if (current) {
            localStorage.setItem('dmms_active_academic_year', JSON.stringify(current));
          }
        }
      }
    } catch (err) {
      console.warn('[AcademicYear] Error loading years:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isUserAuthenticated) {
      fetchAcademicYears();
    } else {
      setAcademicYears([]);
      setSelectedYear(null);
    }
  }, [isUserAuthenticated]);

  const switchAcademicYear = async (yearId) => {
    try {
      const res = await api.post('/common/academic-years/switch', { yearId });
      if (res.success && res.activeYear) {
        setSelectedYear(res.activeYear);
        localStorage.setItem('dmms_active_academic_year', JSON.stringify(res.activeYear));
        // refresh list so active flags reflect accurately
        await fetchAcademicYears();
        return { success: true };
      }
    } catch (err) {
      // Fallback: switch locally if endpoint fails
      const found = academicYears.find(y => y._id === yearId);
      if (found) {
        setSelectedYear(found);
        localStorage.setItem('dmms_active_academic_year', JSON.stringify(found));
        return { success: true };
      }
      return { success: false, error: err.message };
    }
  };

  return (
    <AcademicYearContext.Provider
      value={{
        academicYears,
        selectedYear,
        switchAcademicYear,
        fetchAcademicYears,
        loading
      }}
    >
      {children}
    </AcademicYearContext.Provider>
  );
};

export const useAcademicYear = () => useContext(AcademicYearContext);
