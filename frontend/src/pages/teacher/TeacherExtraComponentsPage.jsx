import React from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import TeacherMarksSheetEditor from '../../components/teacher/TeacherMarksSheetEditor';

const TeacherExtraComponentsPage = () => {
  return (
    <DashboardLayout>
      <TeacherMarksSheetEditor
        mode="EXTRA_COMPONENT"
        badgeLabel="Extra Assessment Components"
        title="Extra Components"
        description="Enter and submit marks for configured additional assessment components (e.g. Project Work) assigned to your subjects."
      />
    </DashboardLayout>
  );
};

export default TeacherExtraComponentsPage;
