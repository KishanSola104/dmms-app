import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  Layers,
  ShieldCheck,
  BookOpen,
  Users,
  Eye,
  RefreshCw,
  AlertCircle,
  Loader2,
  Info
} from 'lucide-react';

const TeacherMyClassesPage = () => {
  const { selectedYear } = useAcademicYear();

  const [academicYearFilter, setAcademicYearFilter] = useState(selectedYear?._id || '');
  const [availableYears, setAvailableYears] = useState([]);
  const [classTeacherAssignments, setClassTeacherAssignments] = useState([]);
  const [subjectTeacherAssignments, setSubjectTeacherAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Student Roster Modal
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState('');
  const [rosterTitle, setRosterTitle] = useState('');
  const [rosterStudents, setRosterStudents] = useState([]);

  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearFilter(selectedYear._id);
    }
  }, [selectedYear?._id]);

  const fetchAssignments = async () => {
    setLoading(true);
    setError('');
    try {
      const q = academicYearFilter ? `?academicYearId=${academicYearFilter}` : '';
      const res = await api.get(`/teacher/my-classes${q}`);
      if (res.success) {
        setAvailableYears(res.availableAcademicYears || []);
        setClassTeacherAssignments(res.classTeacherAssignments || []);
        setSubjectTeacherAssignments(res.subjectTeacherAssignments || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load teaching assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [academicYearFilter]);

  const handleOpenRoster = async (item) => {
    setRosterTitle(`${item.className} - ${item.sectionName}`);
    setRosterModalOpen(true);
    setRosterLoading(true);
    setRosterError('');
    setRosterStudents([]);
    try {
      const q = academicYearFilter ? `?academicYearId=${academicYearFilter}` : '';
      const res = await api.get(`/teacher/classes/${item.classId}/sections/${item.sectionId}/students${q}`);
      if (res.success) {
        setRosterStudents(res.students || []);
      }
    } catch (err) {
      setRosterError(err.message || 'Failed to load student roster.');
    } finally {
      setRosterLoading(false);
    }
  };

  const subjectColumns = [
    {
      header: 'Class',
      accessor: 'className',
      render: (item) => (
        <span className="font-semibold text-slate-900">
          {item.className} <span className="font-mono text-[11px] text-slate-400">({item.classCode})</span>
        </span>
      )
    },
    {
      header: 'Section',
      accessor: 'sectionName',
      render: (item) => (
        <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          {item.sectionName}
        </span>
      )
    },
    {
      header: 'Subject',
      accessor: 'subjectName',
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-800">{item.subjectName}</span>
          <span className="ml-1.5 font-mono text-[11px] text-slate-400">({item.subjectCode})</span>
          {item.hasAdditionalComponents && (
            <p className="text-[10px] text-purple-700 mt-0.5">
              Extra Components: {item.additionalComponents.map((c) => `${c.componentName} (${c.maximumMarks})`).join(', ')}
            </p>
          )}
        </div>
      )
    },
    {
      header: 'Assignment Type',
      accessor: 'subjectType',
      render: (item) => <StatusBadge status={item.subjectType} />
    },
    {
      header: 'Class Teacher Status',
      accessor: 'isClassTeacher',
      render: (item) =>
        item.isClassTeacher ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-purple-600" />
            Class Teacher
          </span>
        ) : (
          <span className="text-xs text-slate-500">Subject Teacher Only</span>
        )
    },
    {
      header: 'Students',
      accessor: 'studentCount',
      align: 'center',
      render: (item) => <span className="font-mono text-xs font-bold text-slate-800">{item.studentCount}</span>
    },
    {
      header: 'Action',
      align: 'right',
      render: (item) => (
        <button
          type="button"
          onClick={() => handleOpenRoster(item)}
          className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          Students
        </button>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Classes &amp; Assignments</h1>
            <p className="mt-1 text-sm text-slate-500">
              View your assigned class teacher sections, subject teaching allocations, and enrolled student rosters.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={academicYearFilter}
              onChange={(e) => setAcademicYearFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-lg"
            >
              {availableYears.map((y) => (
                <option key={y._id} value={y._id}>
                  {y.yearName || y.yearCode} {y.isCurrent ? '(Active)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={fetchAssignments}
              className="inline-flex items-center px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Section 1: Class Teacher Assignments */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-slate-900">Class Teacher Assignments</h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {classTeacherAssignments.length} Section{classTeacherAssignments.length === 1 ? '' : 's'}
            </span>
          </div>

          {loading ? (
            <p className="text-xs text-slate-500 py-4 text-center">Loading class teacher assignments...</p>
          ) : classTeacherAssignments.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
              You are not assigned as a Class Teacher for any class/section. Class-wide verification and result generation are available only to assigned Class Teachers.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classTeacherAssignments.map((ct) => (
                <div
                  key={ct._id}
                  className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-purple-100 text-purple-800">
                        Class Teacher
                      </span>
                      <span className="text-xs font-semibold text-slate-600">{ct.studentCount} Students</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mt-2">
                      {ct.className} &bull; {ct.sectionName}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Code: {ct.classCode} / {ct.sectionCode}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenRoster(ct)}
                    className="w-full py-1.5 text-xs font-semibold text-purple-800 bg-white hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <Users className="w-3.5 h-3.5 mr-1.5" />
                    View Enrolled Students
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Subject Teacher Assignments */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Subject Teacher Assignments</h2>
          </div>

          <AdminDataTable
            columns={subjectColumns}
            data={subjectTeacherAssignments}
            loading={loading}
            emptyMessage="No subject teacher assignments found for the selected academic year."
          />
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center space-x-2 text-xs text-slate-600">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Assignments are managed by the School Administrator and are read-only for teachers.</span>
        </div>

        {/* Student Roster Modal */}
        <AdminModal
          isOpen={rosterModalOpen}
          onClose={() => setRosterModalOpen(false)}
          title={`Enrolled Students — ${rosterTitle}`}
          subtitle="Read-only class/section student roster for the selected academic year"
          maxWidth="max-w-2xl"
        >
          {rosterLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="w-7 h-7 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Loading student roster...</p>
            </div>
          ) : rosterError ? (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">{rosterError}</div>
          ) : rosterStudents.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              No active students enrolled in this class and section.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Roll No</th>
                    <th className="py-2.5 px-3">Adm No</th>
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Gender</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rosterStudents.map((st) => (
                    <tr key={st._id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 font-mono text-slate-600">{st.rollNumber}</td>
                      <td className="py-2 px-3 font-mono font-semibold text-slate-800">{st.admissionNumber}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{st.fullName}</td>
                      <td className="py-2 px-3 text-slate-600">{st.gender}</td>
                      <td className="py-2 px-3">
                        <StatusBadge status={st.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default TeacherMyClassesPage;
