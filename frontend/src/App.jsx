import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SchoolAuthProvider } from './context/SchoolAuthContext';
import { UserAuthProvider } from './context/UserAuthContext';
import { AcademicYearProvider } from './context/AcademicYearContext';

// Guards
import SchoolProtectedRoute from './components/SchoolProtectedRoute';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

// Module 1 Pages
import HomePage from './pages/HomePage';
import SchoolRegisterPage from './pages/SchoolRegisterPage';
import SchoolLoginPage from './pages/SchoolLoginPage';
import UserLoginPage from './pages/UserLoginPage';
import FirstLoginPasswordChangePage from './pages/FirstLoginPasswordChangePage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import ChangePasswordPage from './pages/ChangePasswordPage';

// Module 2 Admin Pages
import UserManagementPage from './pages/admin/UserManagementPage';
import AcademicYearManagementPage from './pages/admin/AcademicYearManagementPage';
import ClassManagementPage from './pages/admin/ClassManagementPage';
import SectionManagementPage from './pages/admin/SectionManagementPage';
import SubjectManagementPage from './pages/admin/SubjectManagementPage';

// Module 3 Admin Pages
import SubjectAllocationPage from './pages/admin/SubjectAllocationPage';
import TeacherAssignmentPage from './pages/admin/TeacherAssignmentPage';
import ExaminationManagementPage from './pages/admin/ExaminationManagementPage';
import ExaminationSubjectConfigPage from './pages/admin/ExaminationSubjectConfigPage';

// Module 4 Admin Pages
import StudentAdmissionPage from './pages/admin/StudentAdmissionPage';
import StudentListPage from './pages/admin/StudentListPage';
import StudentProfilePage from './pages/admin/StudentProfilePage';
import StudentEnrollmentPage from './pages/admin/StudentEnrollmentPage';
import StudentPromotionPage from './pages/admin/StudentPromotionPage';
import StudentImportPage from './pages/admin/StudentImportPage';
import SchoolProfilePage from './pages/admin/SchoolProfilePage';

// Head Teacher Module 1 Pages
import HeadTeacherClassesPage from './pages/headTeacher/HeadTeacherClassesPage';
import HeadTeacherSubjectsPage from './pages/headTeacher/HeadTeacherSubjectsPage';
import HeadTeacherTeachersPage from './pages/headTeacher/HeadTeacherTeachersPage';
import HeadTeacherTeacherAssignmentsPage from './pages/headTeacher/HeadTeacherTeacherAssignmentsPage';

// Common 404 Page
import NotFoundPage from './pages/NotFoundPage';

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

              {/* Module 2: Administrative Setup Routes (Admin Only) */}
              <Route
                path="/admin/users"
                element={
                  <AdminRoute>
                    <UserManagementPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/academic-years"
                element={
                  <AdminRoute>
                    <AcademicYearManagementPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/classes"
                element={
                  <AdminRoute>
                    <ClassManagementPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/sections"
                element={
                  <AdminRoute>
                    <SectionManagementPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/subjects"
                element={
                  <AdminRoute>
                    <SubjectManagementPage />
                  </AdminRoute>
                }
              />

              {/* Module 3: Academic Management Routes (Admin Only) */}
              <Route
                path="/admin/subject-allocation"
                element={
                  <AdminRoute>
                    <SubjectAllocationPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/teacher-assignment"
                element={
                  <AdminRoute>
                    <TeacherAssignmentPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/examinations"
                element={
                  <AdminRoute>
                    <ExaminationManagementPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/examinations/:examinationId/subjects"
                element={
                  <AdminRoute>
                    <ExaminationSubjectConfigPage />
                  </AdminRoute>
                }
              />

              {/* Module 4: Student Management Routes (Admin Only) */}
              <Route
                path="/admin/students"
                element={
                  <AdminRoute>
                    <StudentListPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/students/admission"
                element={
                  <AdminRoute>
                    <StudentAdmissionPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/students/enrollments"
                element={
                  <AdminRoute>
                    <StudentEnrollmentPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/students/promotion"
                element={
                  <AdminRoute>
                    <StudentPromotionPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/students/import"
                element={
                  <AdminRoute>
                    <StudentImportPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/students/:studentId"
                element={
                  <AdminRoute>
                    <StudentProfilePage />
                  </AdminRoute>
                }
              />

              {/* Module 4: School Profile Management (Admin Only) */}
              <Route
                path="/admin/school-profile"
                element={
                  <AdminRoute>
                    <SchoolProfilePage />
                  </AdminRoute>
                }
              />

              {/* Head Teacher Panel: Module 1 Academic Overview Routes */}
              <Route
                path="/head-teacher/classes"
                element={
                  <ProtectedRoute>
                    <HeadTeacherClassesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/subjects"
                element={
                  <ProtectedRoute>
                    <HeadTeacherSubjectsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/teachers"
                element={
                  <ProtectedRoute>
                    <HeadTeacherTeachersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/teacher-assignments"
                element={
                  <ProtectedRoute>
                    <HeadTeacherTeacherAssignmentsPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </AcademicYearProvider>
      </UserAuthProvider>
    </SchoolAuthProvider>
  );
}

export default App;
