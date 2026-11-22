import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  Users,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  BookOpen,
  UserCheck,
  Search,
  Filter
} from 'lucide-react';

const TeacherAssignmentPage = () => {
  const { selectedYear } = useAcademicYear();

  // Primary Data States
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter Options & Selections
  const [classes, setClasses] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [filterClassId, setFilterClassId] = useState('ALL');
  const [filterSectionId, setFilterSectionId] = useState('ALL');
  const [filterTeacherId, setFilterTeacherId] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [classSectionsList, setClassSectionsList] = useState([]);

  // Pagination
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  const [alert, setAlert] = useState({ type: '', message: '' });

  // Modal 1: Assign Teacher
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [modalClassId, setModalClassId] = useState('');
  const [modalSectionId, setModalSectionId] = useState('');
  const [modalClassSubjectId, setModalClassSubjectId] = useState('');
  const [modalTeacherEmpId, setModalTeacherEmpId] = useState('');

  // Dependent Options for Modal
  const [modalSections, setModalSections] = useState([]);
  const [modalAllocatedSubjects, setModalAllocatedSubjects] = useState([]);
  const [modalTeachers, setModalTeachers] = useState([]);
  const [loadingModalOptions, setLoadingModalOptions] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Modal 2: Reassign Teacher
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [reassignTeacherEmpId, setReassignTeacherEmpId] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [reassignError, setReassignError] = useState('');

  // Toggle status loading
  const [togglingId, setTogglingId] = useState(null);

  // 1. Initial Load: Classes and Teachers
  useEffect(() => {
    fetchInitialDropdowns();
  }, []);

  // 2. Fetch Assignments whenever filters or academic year changes
  useEffect(() => {
    if (selectedYear?._id) {
      fetchAssignments(1);
    } else {
      setAssignments([]);
      setPagination({ currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
      setLoading(false);
    }
  }, [selectedYear?._id, filterClassId, filterSectionId, filterTeacherId, filterStatus, search]);

  // 3. Update sections dropdown when filter class changes
  useEffect(() => {
    if (filterClassId && filterClassId !== 'ALL') {
      fetchSectionsForFilter(filterClassId);
    } else {
      setClassSectionsList([]);
      setFilterSectionId('ALL');
    }
  }, [filterClassId]);

  // 4. Update Modal Options when modal class changes
  useEffect(() => {
    if (isAssignModalOpen && modalClassId && selectedYear?._id) {
      fetchModalOptions(modalClassId);
    }
  }, [modalClassId, isAssignModalOpen]);

  const fetchInitialDropdowns = async () => {
    try {
      const [classRes, teacherRes] = await Promise.all([
        api.get('/admin/classes?status=ACTIVE&limit=100'),
        api.get('/admin/teachers')
      ]);

      if (classRes.success && classRes.classes) {
        setClasses(classRes.classes);
      }
      if (teacherRes.success && teacherRes.teachers) {
        setAllTeachers(teacherRes.teachers);
        setModalTeachers(teacherRes.teachers);
      }
    } catch (err) {
      console.warn('[TeacherAssignment] Error loading initial dropdowns:', err.message);
    }
  };

  const fetchSectionsForFilter = async (classId) => {
    try {
      const res = await api.get(`/admin/sections?classId=${classId}&status=ACTIVE&limit=100`);
      if (res.success && res.sections) {
        setClassSectionsList(res.sections);
      }
    } catch (err) {
      console.warn('[TeacherAssignment] Error fetching filter sections:', err.message);
    }
  };

  const fetchAssignments = async (page = 1) => {
    if (!selectedYear?._id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearRef: selectedYear._id,
        page: page.toString(),
        limit: '10'
      });

      if (filterClassId && filterClassId !== 'ALL') params.append('classRef', filterClassId);
      if (filterSectionId && filterSectionId !== 'ALL') params.append('sectionRef', filterSectionId);
      if (filterTeacherId && filterTeacherId !== 'ALL') params.append('teacherId', filterTeacherId);
      if (filterStatus && filterStatus !== 'ALL') params.append('status', filterStatus);
      if (search && search.trim()) params.append('search', search.trim());

      const res = await api.get(`/admin/teacher-assignments?${params.toString()}`);
      if (res.success) {
        setAssignments(res.assignments || []);
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Fetch eligible sections, subjects, teachers for modal
  const fetchModalOptions = async (classId) => {
    setLoadingModalOptions(true);
    setAssignError('');
    try {
      const res = await api.get(
        `/admin/teacher-assignments/eligible-options?academicYearRef=${selectedYear._id}&classRef=${classId}`
      );
      if (res.success) {
        setModalSections(res.sections || []);
        setModalAllocatedSubjects(res.allocatedSubjects || []);
        if (res.teachers) setModalTeachers(res.teachers);

        // Preselect first section if available
        if (res.sections && res.sections.length > 0) {
          setModalSectionId(res.sections[0]._id);
        } else {
          setModalSectionId('');
        }

        // Preselect first subject if available
        if (res.allocatedSubjects && res.allocatedSubjects.length > 0) {
          setModalClassSubjectId(res.allocatedSubjects[0]._id);
        } else {
          setModalClassSubjectId('');
        }
      }
    } catch (err) {
      setAssignError('Failed to load class options: ' + err.message);
    } finally {
      setLoadingModalOptions(false);
    }
  };

  const handleOpenAssignModal = () => {
    if (!selectedYear?._id) {
      setAlert({ type: 'error', message: 'Please select an Academic Year from the header dropdown.' });
      return;
    }
    setAssignError('');
    const initialClassId = classes.length > 0 ? classes[0]._id : '';
    setModalClassId(initialClassId);
    setModalSectionId('');
    setModalClassSubjectId('');
    setModalTeacherEmpId(modalTeachers.length > 0 ? modalTeachers[0].employeeId : '');
    setIsAssignModalOpen(true);
  };

  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    setAssignError('');

    if (!modalClassId) {
      setAssignError('Please select a class.');
      return;
    }
    if (!modalSectionId) {
      setAssignError('Please select a section.');
      return;
    }
    if (!modalClassSubjectId) {
      setAssignError('Please select an allocated subject.');
      return;
    }
    if (!modalTeacherEmpId) {
      setAssignError('Please select a teacher.');
      return;
    }

    setAssignSubmitting(true);
    try {
      const res = await api.post('/admin/teacher-assignments', {
        academicYearRef: selectedYear._id,
        classRef: modalClassId,
        sectionRef: modalSectionId,
        classSubjectRef: modalClassSubjectId,
        teacherEmployeeId: modalTeacherEmpId
      });

      if (res.success) {
        setAlert({
          type: 'success',
          message: 'Teacher successfully assigned to subject! Notifications dispatched to all relevant users.'
        });
        setIsAssignModalOpen(false);
        fetchAssignments(pagination.currentPage);
      }
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Reassign Modal
  const handleOpenReassignModal = (assignment) => {
    setSelectedAssignment(assignment);
    setReassignTeacherEmpId('');
    setReassignError('');
    setIsReassignModalOpen(true);
  };

  const handleSaveReassignment = async (e) => {
    e.preventDefault();
    setReassignError('');

    if (!reassignTeacherEmpId) {
      setReassignError('Please select the replacement teacher.');
      return;
    }

    setReassignSubmitting(true);
    try {
      const res = await api.put(`/admin/teacher-assignments/${selectedAssignment._id}`, {
        newTeacherEmployeeId: reassignTeacherEmpId
      });

      if (res.success) {
        setAlert({
          type: 'success',
          message: 'Teacher reassigned successfully! Notifications dispatched to all relevant users.'
        });
        setIsReassignModalOpen(false);
        fetchAssignments(pagination.currentPage);
      }
    } catch (err) {
      setReassignError(err.message);
    } finally {
      setReassignSubmitting(false);
    }
  };

  // Status toggle
  const handleToggleStatus = async (assignment) => {
    const nextStatus = assignment.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const confirmMsg =
      nextStatus === 'INACTIVE'
        ? `Are you sure you want to deactivate ${assignment.teacherName}'s assignment to ${assignment.subjectName} in ${assignment.className} ${assignment.sectionName}?`
        : `Activate assignment for ${assignment.teacherName} in ${assignment.className} ${assignment.sectionName}?`;

    if (!window.confirm(confirmMsg)) return;

    setTogglingId(assignment._id);
    try {
      const res = await api.patch(`/admin/teacher-assignments/${assignment._id}/status`, {
        status: nextStatus
      });
      if (res.success) {
        setAlert({
          type: 'success',
          message: `Assignment status changed to ${nextStatus}.`
        });
        fetchAssignments(pagination.currentPage);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    } finally {
      setTogglingId(null);
    }
  };

  // Table Columns
  const columns = [
    {
      header: 'Class & Section',
      accessor: 'className',
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-900">{item.className}</span>
          <span className="ml-2 font-mono text-xs px-2 py-0.5 bg-blue-50 text-blue-800 rounded border border-blue-200 font-bold">
            Section {item.sectionCode}
          </span>
        </div>
      )
    },
    {
      header: 'Subject',
      accessor: 'subjectName',
      render: (item) => (
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              {item.subjectCode}
            </span>
            <span className="font-semibold text-slate-900">{item.subjectName}</span>
          </div>
          <span
            className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.2 rounded-full ${
              item.subjectType === 'ACADEMIC'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-purple-100 text-purple-800'
            }`}
          >
            {item.subjectType === 'ACADEMIC' ? 'Academic (Scholastic)' : 'Co-curricular'}
          </span>
        </div>
      )
    },
    {
      header: 'Assigned Teacher',
      accessor: 'teacherName',
      render: (item) => (
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-900">{item.teacherName}</span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                item.teacherRoleCode === 'HEAD_TEACHER'
                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {item.teacherRoleName}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{item.teacherEmail}</p>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (item) => <StatusBadge status={item.status} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={() => handleOpenReassignModal(item)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Reassign Teacher"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleStatus(item)}
            disabled={togglingId === item._id}
            className={`p-1.5 rounded-lg transition-colors ${
              item.status === 'ACTIVE'
                ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
            }`}
            title={item.status === 'ACTIVE' ? 'Deactivate Assignment' : 'Activate Assignment'}
          >
            {togglingId === item._id ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            ) : item.status === 'ACTIVE' ? (
              <XCircle className="w-4 h-4 text-amber-500" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            )}
          </button>
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <AdminPageHeader
          title="Teacher Assignment to Subjects"
          description="Assign teachers to subjects for specific class sections in the selected academic year. Automated notifications are sent to the assigned teacher, class teacher, section teacher, and Head Teacher."
          actionLabel="+ Assign Teacher"
          onAction={handleOpenAssignModal}
          actionIcon={Plus}
        />

        {/* Academic Year Info Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 text-white rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">
                Active Academic Year
              </p>
              <p className="text-sm font-bold text-slate-900">
                {selectedYear?.yearName || (
                  <span className="text-amber-700 italic">No Academic Year Selected (Select in Header)</span>
                )}
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Total Active Assignments: <strong className="text-indigo-600 font-bold">{pagination.totalRecords}</strong>
          </div>
        </div>

        {/* Global Alert Notification */}
        {alert.message && (
          <div
            className={`p-4 rounded-xl flex items-start space-x-3 text-sm animate-in fade-in duration-200 ${
              alert.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-800'
            }`}
          >
            {alert.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{alert.message}</div>
            <button
              onClick={() => setAlert({ type: '', message: '' })}
              className="text-slate-400 hover:text-slate-600"
            >
              &times;
            </button>
          </div>
        )}

        {/* Advanced Filters Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Search &amp; Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search teacher, subject..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            </div>

            {/* Class Filter */}
            <select
              value={filterClassId}
              onChange={(e) => {
                setFilterClassId(e.target.value);
                setFilterSectionId('ALL');
              }}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Classes</option>
              {classes.map((cls) => (
                <option key={cls._id} value={cls._id}>
                  {cls.className} ({cls.classCode})
                </option>
              ))}
            </select>

            {/* Section Filter */}
            <select
              value={filterSectionId}
              onChange={(e) => setFilterSectionId(e.target.value)}
              disabled={filterClassId === 'ALL' || classSectionsList.length === 0}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="ALL">All Sections</option>
              {classSectionsList.map((sec) => (
                <option key={sec._id} value={sec._id}>
                  Section {sec.sectionCode}
                </option>
              ))}
            </select>

            {/* Teacher Filter */}
            <select
              value={filterTeacherId}
              onChange={(e) => setFilterTeacherId(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Teachers</option>
              {allTeachers.map((t) => (
                <option key={t.employeeId} value={t.employeeId}>
                  {t.fullName} ({t.roleName})
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <AdminDataTable
          columns={columns}
          data={assignments}
          loading={loading}
          emptyMessage="No teacher assignments found matching your criteria. Click '+ Assign Teacher' to create a new assignment."
        />

        {/* Pagination */}
        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          onPageChange={(page) => fetchAssignments(page)}
          limit={pagination.limit}
        />

        {/* ======================================================== */}
        {/* MODAL 1: ASSIGN TEACHER TO SUBJECT                       */}
        {/* ======================================================== */}
        <AdminModal
          isOpen={isAssignModalOpen}
          onClose={() => !assignSubmitting && setIsAssignModalOpen(false)}
          title="Assign Teacher to Subject"
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleSaveAssignment} className="space-y-4">
            {assignError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-800 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{assignError}</span>
              </div>
            )}

            {/* Academic Year display */}
            <div className="p-2.5 bg-blue-50/70 border border-blue-200/60 rounded-lg text-xs text-blue-900 flex items-center justify-between">
              <span>Academic Year:</span>
              <strong className="font-bold">{selectedYear?.yearName}</strong>
            </div>

            {/* 1. Class Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Class <span className="text-rose-500">*</span>
              </label>
              <select
                value={modalClassId}
                onChange={(e) => setModalClassId(e.target.value)}
                disabled={assignSubmitting || loadingModalOptions}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
              >
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.className} ({cls.classCode})
                  </option>
                ))}
              </select>
            </div>

            {loadingModalOptions ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin mx-auto mb-1.5" />
                Loading sections and allocated subjects...
              </div>
            ) : (
              <>
                {/* 2. Section Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Section <span className="text-rose-500">*</span>
                  </label>
                  {modalSections.length === 0 ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      No active sections found for this class. Please create a section in Section Management first.
                    </div>
                  ) : (
                    <select
                      value={modalSectionId}
                      onChange={(e) => setModalSectionId(e.target.value)}
                      disabled={assignSubmitting}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
                    >
                      {modalSections.map((sec) => (
                        <option key={sec._id} value={sec._id}>
                          {sec.sectionName} ({sec.sectionCode}) — Max Capacity: {sec.maxCapacity}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 3. Allocated Subject Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Allocated Subject <span className="text-rose-500">*</span>
                  </label>
                  {modalAllocatedSubjects.length === 0 ? (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                      No subjects have been allocated to this class for {selectedYear?.yearName}. Please allocate
                      subjects under <strong>Academic Management → Subject Allocation</strong> first.
                    </div>
                  ) : (
                    <select
                      value={modalClassSubjectId}
                      onChange={(e) => setModalClassSubjectId(e.target.value)}
                      disabled={assignSubmitting}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
                    >
                      {modalAllocatedSubjects.map((sub) => (
                        <option key={sub._id} value={sub._id}>
                          {sub.subjectName} ({sub.subjectCode}) — {sub.subjectType === 'ACADEMIC' ? 'Academic' : 'Co-curricular'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 4. Teacher Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Teacher <span className="text-rose-500">*</span>
                  </label>
                  {modalTeachers.length === 0 ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      No active Teachers or Head Teachers found in the school.
                    </div>
                  ) : (
                    <select
                      value={modalTeacherEmpId}
                      onChange={(e) => setModalTeacherEmpId(e.target.value)}
                      disabled={assignSubmitting}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
                    >
                      {modalTeachers.map((t) => (
                        <option key={t.employeeId} value={t.employeeId}>
                          {t.fullName} ({t.roleName}) — {t.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Info Note about notifications */}
                <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  ℹ️ On save, notifications will be automatically delivered to the assigned teacher, class teacher,
                  section teacher, and Head Teacher.
                </p>
              </>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                disabled={assignSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  assignSubmitting ||
                  modalSections.length === 0 ||
                  modalAllocatedSubjects.length === 0 ||
                  modalTeachers.length === 0
                }
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all disabled:opacity-50"
              >
                {assignSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Assigning...
                  </>
                ) : (
                  'Assign Teacher'
                )}
              </button>
            </div>
          </form>
        </AdminModal>

        {/* ======================================================== */}
        {/* MODAL 2: REASSIGN TEACHER                                */}
        {/* ======================================================== */}
        <AdminModal
          isOpen={isReassignModalOpen}
          onClose={() => !reassignSubmitting && setIsReassignModalOpen(false)}
          title="Reassign Teacher to Subject"
          maxWidth="max-w-md"
        >
          <form onSubmit={handleSaveReassignment} className="space-y-4">
            {reassignError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-800 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{reassignError}</span>
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <div>
                Class &amp; Section:{' '}
                <strong className="text-slate-900">
                  {selectedAssignment?.className} — Section {selectedAssignment?.sectionCode}
                </strong>
              </div>
              <div>
                Subject:{' '}
                <strong className="text-slate-900">
                  {selectedAssignment?.subjectName} ({selectedAssignment?.subjectCode})
                </strong>
              </div>
              <div>
                Currently Assigned:{' '}
                <strong className="text-indigo-700">{selectedAssignment?.teacherName}</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Replacement Teacher <span className="text-rose-500">*</span>
              </label>
              <select
                value={reassignTeacherEmpId}
                onChange={(e) => setReassignTeacherEmpId(e.target.value)}
                disabled={reassignSubmitting}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- Choose New Teacher --</option>
                {allTeachers
                  .filter((t) => t.employeeId !== selectedAssignment?.teacherEmployeeRef?.toString())
                  .map((t) => (
                    <option key={t.employeeId} value={t.employeeId}>
                      {t.fullName} ({t.roleName}) — {t.email}
                    </option>
                  ))}
              </select>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              ℹ️ Reassigning will automatically send update notifications to the new teacher, previous teacher, class
              teacher, section teacher, and Head Teacher.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsReassignModalOpen(false)}
                disabled={reassignSubmitting}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reassignSubmitting || !reassignTeacherEmpId}
                className="inline-flex items-center justify-center px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:opacity-50"
              >
                {reassignSubmitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Confirm Reassignment
              </button>
            </div>
          </form>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default TeacherAssignmentPage;
