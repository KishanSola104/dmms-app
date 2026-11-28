import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BackendHealthProvider } from './context/BackendHealthContext';
import { SchoolAuthProvider } from './context/SchoolAuthContext';
import { UserAuthProvider } from './context/UserAuthContext';
import { AcademicYearProvider } from './context/AcademicYearContext';
import BackendStatusBanner from './components/BackendStatusBanner';

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
import HeadTeacherPlaceholderPage from './pages/headTeacher/HeadTeacherPlaceholderPage';

// Head Teacher Module 2 Pages
import HeadTeacherStudentListPage from './pages/headTeacher/HeadTeacherStudentListPage';
import HeadTeacherStudentProfilePage from './pages/headTeacher/HeadTeacherStudentProfilePage';
import HeadTeacherStudentPerformancePage from './pages/headTeacher/HeadTeacherStudentPerformancePage';

// Head Teacher Module 4 Examination Management Pages
import HeadTeacherExaminationOverviewPage from './pages/headTeacher/HeadTeacherExaminationOverviewPage';
import HeadTeacherExaminationSchedulePage from './pages/headTeacher/HeadTeacherExaminationSchedulePage';
import HeadTeacherSubjectConfigPage from './pages/headTeacher/HeadTeacherSubjectConfigPage';
import HeadTeacherMarksMonitoringPage from './pages/headTeacher/HeadTeacherMarksMonitoringPage';
import HeadTeacherResultApprovalPage from './pages/headTeacher/HeadTeacherResultApprovalPage';
import HeadTeacherAcademicReportsPage from './pages/headTeacher/HeadTeacherAcademicReportsPage';
import HeadTeacherNotificationsPage from './pages/headTeacher/HeadTeacherNotificationsPage';
import HeadTeacherSendNotificationsPage from './pages/headTeacher/HeadTeacherSendNotificationsPage';

// Admin & Head Teacher Governance Pages
import MarksEntryLockPage from './pages/admin/MarksEntryLockPage';
import AuditLogPage from './pages/admin/AuditLogPage';

// Office Staff Portal Pages
import OfficePublishedResultsPage from './pages/office/OfficePublishedResultsPage';
import OfficeAcademicReportsPage from './pages/office/OfficeAcademicReportsPage';
import OfficeDownloadHistoryPage from './pages/office/OfficeDownloadHistoryPage';
import OfficeNotificationsPage from './pages/office/OfficeNotificationsPage';

// Teacher Panel Pages
import TeacherDashboardPage from './pages/teacher/TeacherDashboardPage';
import TeacherMyClassesPage from './pages/teacher/TeacherMyClassesPage';
import TeacherMarksEntryPage from './pages/teacher/TeacherMarksEntryPage';
import TeacherSubmittedMarksPage from './pages/teacher/TeacherSubmittedMarksPage';
import TeacherExtraComponentsPage from './pages/teacher/TeacherExtraComponentsPage';
import TeacherCoCurricularGradesPage from './pages/teacher/TeacherCoCurricularGradesPage';
import TeacherMarksVerificationPage from './pages/teacher/TeacherMarksVerificationPage';
import TeacherExaminationResultsPage from './pages/teacher/TeacherExaminationResultsPage';
import TeacherFinalResultPage from './pages/teacher/TeacherFinalResultPage';
import TeacherResultPerformancePage from './pages/teacher/TeacherResultPerformancePage';

// Common 404 & Recovery Pages
import RefreshAppPage from './pages/RefreshAppPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <BackendHealthProvider>
      <SchoolAuthProvider>
        <UserAuthProvider>
          <AcademicYearProvider>
            <BrowserRouter>
              <BackendStatusBanner />
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/register-school" element={<SchoolRegisterPage />} />
                <Route path="/school-login" element={<SchoolLoginPage />} />
                <Route path="/refresh-app" element={<RefreshAppPage />} />

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

              {/* Module 3: Academic Management Routes (Admin & Head Teacher) */}
              <Route
                path="/admin/subject-allocation"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'HEAD_TEACHER']}>
                    <SubjectAllocationPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/teacher-assignment"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'HEAD_TEACHER']}>
                    <TeacherAssignmentPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/examinations"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'HEAD_TEACHER']}>
                    <ExaminationManagementPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/examinations/:examinationId/subjects"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'HEAD_TEACHER']}>
                    <ExaminationSubjectConfigPage />
                  </ProtectedRoute>
                }
              />

              {/* Module 4: Student Management Routes (Admin & Head Teacher) */}
              <Route
                path="/admin/students"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'HEAD_TEACHER']}>
                    <StudentListPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/students/admission"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'HEAD_TEACHER']}>
                    <StudentAdmissionPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/students/enrollments"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'HEAD_TEACHER']}>
                    <StudentEnrollmentPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/students/promotion"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'HEAD_TEACHER']}>
                    <StudentPromotionPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/students/import"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'HEAD_TEACHER']}>
                    <StudentImportPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/students/:studentId"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'HEAD_TEACHER']}>
                    <StudentProfilePage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/marks-lock"
                element={
                  <AdminRoute>
                    <MarksEntryLockPage />
                  </AdminRoute>
                }
              />

              <Route
                path="/admin/audit-logs"
                element={
                  <AdminRoute>
                    <AuditLogPage />
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

              {/* Head Teacher Panel: Module 2 Student Overview Routes */}
              <Route
                path="/head-teacher/students"
                element={
                  <ProtectedRoute>
                    <HeadTeacherStudentListPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/students/:studentId"
                element={
                  <ProtectedRoute>
                    <HeadTeacherStudentProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/student-profile"
                element={
                  <ProtectedRoute>
                    <HeadTeacherStudentProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/students/:studentId/performance"
                element={
                  <ProtectedRoute>
                    <HeadTeacherStudentPerformancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/student-performance"
                element={
                  <ProtectedRoute>
                    <HeadTeacherStudentPerformancePage />
                  </ProtectedRoute>
                }
              />

              {/* Head Teacher Panel: Module 4 Examination Management Routes */}
              <Route
                path="/head-teacher/examinations"
                element={
                  <ProtectedRoute>
                    <HeadTeacherExaminationOverviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/examination-schedule"
                element={
                  <ProtectedRoute>
                    <HeadTeacherExaminationSchedulePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/subject-configurations"
                element={
                  <ProtectedRoute>
                    <HeadTeacherSubjectConfigPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/marks-entry-monitoring"
                element={
                  <ProtectedRoute allowedRoles={['HEAD_TEACHER', 'ADMIN']}>
                    <HeadTeacherMarksMonitoringPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/result-approval"
                element={
                  <ProtectedRoute allowedRoles={['HEAD_TEACHER', 'ADMIN']}>
                    <HeadTeacherResultApprovalPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/marks-lock"
                element={
                  <ProtectedRoute allowedRoles={['HEAD_TEACHER', 'ADMIN']}>
                    <MarksEntryLockPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/reports"
                element={
                  <ProtectedRoute allowedRoles={['HEAD_TEACHER', 'ADMIN']}>
                    <HeadTeacherAcademicReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/notifications"
                element={
                  <ProtectedRoute allowedRoles={['HEAD_TEACHER', 'ADMIN']}>
                    <HeadTeacherNotificationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/send-notifications"
                element={
                  <ProtectedRoute allowedRoles={['HEAD_TEACHER', 'ADMIN']}>
                    <HeadTeacherSendNotificationsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/head-teacher/audit-logs"
                element={
                  <ProtectedRoute allowedRoles={['HEAD_TEACHER', 'ADMIN']}>
                    <AuditLogPage />
                  </ProtectedRoute>
                }
              />

              {/* Office Staff Portal Routes */}
              <Route
                path="/office/published-results"
                element={
                  <ProtectedRoute allowedRoles={['OFFICE_STAFF', 'ADMIN']}>
                    <OfficePublishedResultsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/office/academic-reports"
                element={
                  <ProtectedRoute allowedRoles={['OFFICE_STAFF', 'ADMIN']}>
                    <OfficeAcademicReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/office/download-history"
                element={
                  <ProtectedRoute allowedRoles={['OFFICE_STAFF', 'ADMIN']}>
                    <OfficeDownloadHistoryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/office/notifications"
                element={
                  <ProtectedRoute allowedRoles={['OFFICE_STAFF', 'ADMIN']}>
                    <OfficeNotificationsPage />
                  </ProtectedRoute>
                }
              />

              {/* Teacher Panel Routes (TEACHER & HEAD_TEACHER with teaching duties) */}
              <Route
                path="/teacher/dashboard"
                element={
                  <ProtectedRoute requireTeacherAccess>
                    <TeacherDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/my-classes"
                element={
                  <ProtectedRoute requireTeacherAccess>
                    <TeacherMyClassesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/marks-entry"
                element={
                  <ProtectedRoute requireTeacherAccess>
                    <TeacherMarksEntryPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/submitted-marks"
                element={
                  <ProtectedRoute requireTeacherAccess>
                    <TeacherSubmittedMarksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/extra-components"
                element={
                  <ProtectedRoute requireTeacherAccess>
                    <TeacherExtraComponentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/co-curricular-grades"
                element={
                  <ProtectedRoute requireTeacherAccess>
                    <TeacherCoCurricularGradesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/marks-verification"
                element={
                  <ProtectedRoute requireTeacherAccess>
                    <TeacherMarksVerificationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/examination-results"
                element={
                  <ProtectedRoute requireTeacherAccess>
                    <TeacherExaminationResultsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/final-result"
                element={
                  <ProtectedRoute requireTeacherAccess>
                    <TeacherFinalResultPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/result-performance"
                element={
                  <ProtectedRoute requireTeacherAccess>
                    <TeacherResultPerformancePage />
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
    </BackendHealthProvider>
  );
}

export default App;
