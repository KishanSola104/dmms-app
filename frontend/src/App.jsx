import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SchoolAuthProvider } from './context/SchoolAuthContext';
import { UserAuthProvider } from './context/UserAuthContext';
import { AcademicYearProvider } from './context/AcademicYearContext';

// Guards
import SchoolProtectedRoute from './components/SchoolProtectedRoute';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import HomePage from './pages/HomePage';
import SchoolRegisterPage from './pages/SchoolRegisterPage';
import SchoolLoginPage from './pages/SchoolLoginPage';
import UserLoginPage from './pages/UserLoginPage';
import FirstLoginPasswordChangePage from './pages/FirstLoginPasswordChangePage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import ChangePasswordPage from './pages/ChangePasswordPage';

function App() {
  return (
    <SchoolAuthProvider>
      <UserAuthProvider>
        <AcademicYearProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/register-school" element={<SchoolRegisterPage />} />
              <Route path="/school-login" element={<SchoolLoginPage />} />

              {/* School Session Protected Route */}
              <Route
                path="/user-login"
                element={
                  <SchoolProtectedRoute>
                    <UserLoginPage />
                  </SchoolProtectedRoute>
                }
              />

              {/* User Session Protected Routes */}
              <Route
                path="/first-login-change-password"
                element={
                  <SchoolProtectedRoute>
                    <FirstLoginPasswordChangePage />
                  </SchoolProtectedRoute>
                }
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/change-password"
                element={
                  <ProtectedRoute>
                    <ChangePasswordPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AcademicYearProvider>
      </UserAuthProvider>
    </SchoolAuthProvider>
  );
}

export default App;
