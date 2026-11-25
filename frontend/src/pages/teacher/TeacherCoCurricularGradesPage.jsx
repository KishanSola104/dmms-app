import React from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import TeacherMarksSheetEditor from '../../components/teacher/TeacherMarksSheetEditor';

const TeacherCoCurricularGradesPage = () => {
  return (
    <DashboardLayout>
      <TeacherMarksSheetEditor
        mode="CO_CURRICULAR"
        badgeLabel="Co-curricular Assessment"
        title="Co-curricular Grades"
        description="Enter and submit configured grades for your assigned co-curricular subjects."
      />
    </DashboardLayout>
  );
};

export default TeacherCoCurricularGradesPage;
