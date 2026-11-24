import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminSearchBar from '../../components/admin/AdminSearchBar';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  CheckCircle2,
  Users,
  BookOpen,
  Layers,
  GraduationCap,
  Calendar,
  Eye,
  AlertTriangle,
  RefreshCw,
  Info,
  Clock
} from 'lucide-react';

const HeadTeacherTeacherAssignmentsPage = () => {
  const { selectedYear } = useAcademicYear();

  const [assignments, setAssignments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [sectionFilter, setSectionFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [teacherFilter, setTeacherFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Dropdown options
  const [classesList, setClassesList] = useState([]);
  const [sectionsList, setSectionsList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [teachersList, setTeachersList] = useState([]);

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  // Modal State
  const [selectedAssignmentData, setSelectedAssignmentData] = useState(null);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchDropdownOptions = async () => {
    try {
      const [classRes, subRes, teachRes] = await Promise.all([
        api.get('/head-teacher/classes?limit=100'),
        api.get('/head-teacher/subjects?limit=100'),
        api.get('/head-teacher/teachers?limit=100')
      ]);
      if (classRes.success) setClassesList(classRes.classes || []);
      if (subRes.success) setSubjectsList(subRes.subjects || []);
      if (teachRes.success) setTeachersList(teachRes.teachers || []);
    } catch (err) {
      console.error('[HeadTeacherAssignments] Options error:', err);
    }
  };

  const fetchAssignments = async (page = 1) => {
    setLoading(true);
    try {
      const yearQuery = selectedYear?._id ? `&academicYearId=${selectedYear._id}` : '';
      const res = await api.get(
        `/head-teacher/teacher-assignments?page=${page}&limit=${pagination.limit}&search=${encodeURIComponent(search)}&classId=${classFilter}&sectionId=${sectionFilter}&subjectId=${subjectFilter}&teacherId=${teacherFilter}&status=${statusFilter}${yearQuery}`
      );
      if (res.success) {
        setAssignments(res.assignments);
        setSummary(res.summary);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('[HeadTeacherAssignments] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDropdownOptions();
  }, []);

  useEffect(() => {
    fetchAssignments(1);
  }, [search, classFilter, sectionFilter, subjectFilter, teacherFilter, statusFilter, selectedYear]);

  // Open Details Modal
  const handleOpenAssignmentView = async (a) => {
    setAssignmentModalOpen(true);
    setModalLoading(true);
    try {
      const res = await api.get(`/head-teacher/teacher-assignments/${a._id}`);
      if (res.success) {
        setSelectedAssignmentData(res);
      }
    } catch (err) {
      console.error('[HeadTeacherAssignments] Details error:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '—';
    }
  };

  const columns = [
    {
      header: 'Assigned Teacher',
      accessor: 'teacherName',
      render: (a) => (
        <div className="flex items-center space-x-2">
          <GraduationCap className="w-4 h-4 text-purple-600 shrink-0" />
          <div>
            <p className="font-semibold text-slate-900 leading-tight">{a.teacherName}</p>
            <p className="font-mono text-[10px] text-slate-400">ID: {a.teacherUserId}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Class',
      accessor: 'className',
      render: (a) => (
        <span className="font-bold text-slate-800">{a.className}</span>
      )
    },
    {
      header: 'Section',
      accessor: 'sectionName',
      render: (a) => (
        <span className="font-medium text-slate-700">Section {a.sectionName}</span>
      )
    },
    {
      header: 'Subject',
      accessor: 'subjectName',
      render: (a) => (
        <div>
          <span className="font-bold text-purple-900">{a.subjectName}</span>
          <span className="ml-1.5 font-mono text-[10px] text-slate-500">[{a.subjectCode}]</span>
        </div>
      )
    },
    {
      header: 'Curriculum Type',
      accessor: 'subjectType',
      render: (a) => <StatusBadge status={a.subjectType} />
    },
    {
      header: 'Academic Session',
      accessor: 'academicYearCode',
      render: (a) => (
        <span className="font-mono text-xs text-slate-600 font-semibold">{a.academicYearCode}</span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (a) => <StatusBadge status={a.status} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (a) => (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => handleOpenAssignmentView(a)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200 shadow-2xs"
            title="View Assignment Record Details"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            <span>View</span>
          </button>
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Module 1 &bull; Academic Overview
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
              Teacher Assignments Overview
            </h1>
            <p className="mt-1 text-sm text-slate-500 max-w-2xl">
              Understand faculty teaching assignments, subject coverage, and classroom responsibilities for this session.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-600 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            <span>Active Session: <strong>{selectedYear?.yearCode || 'N/A'}</strong></span>
          </div>
        </div>

        {/* 8.4 Assignment Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Pairings</span>
              <p className="text-xl font-extrabold text-slate-900 mt-1">{summary.totalActiveAssignments}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Total assignments</p>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assigned Faculty</span>
              <p className="text-xl font-extrabold text-purple-700 mt-1">{summary.totalAssignedTeachers}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Active teachers</p>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Subjects Covered</span>
              <p className="text-xl font-extrabold text-emerald-700 mt-1">{summary.subjectsWithAssignedTeachers}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">With assigned faculty</p>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Subjects Unassigned</span>
              <p className="text-xl font-extrabold text-amber-700 mt-1">{summary.subjectsWithoutAssignedTeachers}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Lacking teacher</p>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Incomplete Classes</span>
              <p className="text-xl font-extrabold text-indigo-700 mt-1">{summary.classesWithIncompleteAssignments}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Pending subject faculty</p>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unassigned Sections</span>
              <p className="text-xl font-extrabold text-rose-700 mt-1">{summary.sectionsWithoutSectionTeachers}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">No section teacher</p>
            </div>
          </div>
        )}

        {/* 8.3 Filters Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="w-full md:w-80">
              <AdminSearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search teacher, subject, class..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Class Filter */}
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="text-slate-500 font-medium">Class:</span>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Classes</option>
                  {classesList.map(c => (
                    <option key={c._id} value={c._id}>{c.className}</option>
                  ))}
                </select>
              </div>

              {/* Subject Filter */}
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="text-slate-500 font-medium">Subject:</span>
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Subjects</option>
                  {subjectsList.map(s => (
                    <option key={s._id} value={s._id}>{s.subjectName}</option>
                  ))}
                </select>
              </div>

              {/* Teacher Filter */}
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="text-slate-500 font-medium">Teacher:</span>
                <select
                  value={teacherFilter}
                  onChange={(e) => setTeacherFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Teachers</option>
                  {teachersList.map(t => (
                    <option key={t.userId} value={t.employeeId}>{t.teacherName}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center space-x-1.5 text-xs">
                <span className="text-slate-500 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Assignments Table */}
        <AdminDataTable
          columns={columns}
          data={assignments}
          loading={loading}
          emptyMessage="No teacher assignment records found for this academic session."
        />

        {/* Pagination */}
        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={(p) => fetchAssignments(p)}
        />

        {/* 8.2 ASSIGNMENT DETAILS MODAL (READ-ONLY) */}
        <AdminModal
          isOpen={assignmentModalOpen}
          onClose={() => setAssignmentModalOpen(false)}
          title="Teacher Assignment Record"
          subtitle={`Session: ${selectedAssignmentData?.academicYear || selectedYear?.yearCode || ''}`}
          maxWidth="max-w-2xl"
        >
          {modalLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-600 mx-auto mb-2" />
              Loading assignment parameters...
            </div>
          ) : selectedAssignmentData ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-900">{selectedAssignmentData.teacherName}</h4>
                  <p className="text-xs text-slate-500">{selectedAssignmentData.teacherEmail}</p>
                </div>
                <StatusBadge status={selectedAssignmentData.assignmentStatus} />
              </div>

              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <dt className="text-slate-400 font-medium">Assigned Class</dt>
                  <dd className="font-bold text-slate-900 mt-0.5">
                    {selectedAssignmentData.className} ({selectedAssignmentData.classCode})
                  </dd>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <dt className="text-slate-400 font-medium">Assigned Section</dt>
                  <dd className="font-bold text-slate-900 mt-0.5">
                    Section {selectedAssignmentData.sectionName} ({selectedAssignmentData.sectionCode})
                  </dd>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <dt className="text-slate-400 font-medium">Teaching Subject</dt>
                  <dd className="font-bold text-purple-900 mt-0.5">
                    {selectedAssignmentData.subjectName} ({selectedAssignmentData.subjectCode})
                  </dd>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <dt className="text-slate-400 font-medium">Curriculum Classification</dt>
                  <div className="mt-1">
                    <StatusBadge status={selectedAssignmentData.subjectType} />
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <dt className="text-slate-400 font-medium">Academic Session</dt>
                  <dd className="font-mono font-semibold text-slate-800 mt-0.5">
                    {selectedAssignmentData.academicYear}
                  </dd>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <dt className="text-slate-400 font-medium">Assignment Date</dt>
                  <dd className="font-semibold text-slate-800 mt-0.5">
                    {formatDate(selectedAssignmentData.createdAt)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherTeacherAssignmentsPage;
