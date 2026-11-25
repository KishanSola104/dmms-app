import React from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import TeacherMarksSheetEditor from '../../components/teacher/TeacherMarksSheetEditor';

const TeacherMarksEntryPage = () => {
  return (
    <DashboardLayout>
      <TeacherMarksSheetEditor
        mode="EXAM_ACADEMIC"
        badgeLabel="Marks Management"
        title="Marks Entry"
        description="Enter, validate, save drafts, and submit term examination marks for your assigned academic subjects."
      />
    </DashboardLayout>
  );
};

export default TeacherMarksEntryPage;
