import React from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import TeacherDashboard from '../../components/teacher/TeacherDashboard';

const TeacherDashboardPage = () => {
  return (
    <DashboardLayout>
      <TeacherDashboard />
    </DashboardLayout>
  );
};

export default TeacherDashboardPage;
