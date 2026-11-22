import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSearchBar from '../../components/admin/AdminSearchBar';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  Calendar,
  Plus,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Layers,
  Clock,
  CheckSquare,
  Square,
  FileSpreadsheet,
  BookOpenCheck,
  Sliders
} from 'lucide-react';

const ExaminationManagementPage = () => {
  const navigate = useNavigate();
  const { selectedYear } = useAcademicYear();

  // Primary State
  const [examinations, setExaminations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeClasses, setActiveClasses] = useState([]);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  const [alert, setAlert] = useState({ type: '', message: '' });

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [selectedExam, setSelectedExam] = useState(null);

  const [formData, setFormData] = useState({
    examinationCode: '',
    examinationName: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'UPCOMING',
    classIds: []
  });

  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // 1. Initial Load: Active Classes
  useEffect(() => {
    fetchActiveClasses();
  }, []);

  // 2. Load Examinations when academic year or filters change
  useEffect(() => {
    if (selectedYear?._id) {
      fetchExaminations(1);
    } else {
      setExaminations([]);
      setPagination({ currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
      setLoading(false);
    }
  }, [selectedYear?._id, search, statusFilter]);

  const fetchActiveClasses = async () => {
    try {
      const res = await api.get('/admin/classes?status=ACTIVE&limit=100');
      if (res.success && res.classes) {
        setActiveClasses(res.classes);
      }
    } catch (err) {
      console.warn('[ExaminationManagement] Error loading classes:', err.message);
    }
  };

  const fetchExaminations = async (page = 1) => {
    if (!selectedYear?._id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        academicYearRef: selectedYear._id,
        page: page.toString(),
        limit: '10',
        search,
        status: statusFilter
      });

      const res = await api.get(`/admin/examinations?${params.toString()}`);
      if (res.success) {
        setExaminations(res.examinations || []);
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    if (!selectedYear?._id) {
      setAlert({ type: 'error', message: 'Please select an Academic Year from the header dropdown.' });
      return;
    }
    setModalMode('create');
    setSelectedExam(null);
    setFormData({
      examinationCode: '',
      examinationName: '',
      description: '',
      startDate: '',
      endDate: '',
      status: 'UPCOMING',
      classIds: activeClasses.map((c) => c._id) // default select all active classes
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (exam) => {
    setModalMode('edit');
    setSelectedExam(exam);
    setFormData({
      examinationCode: exam.examinationCode,
      examinationName: exam.examinationName,
      description: exam.description || '',
      startDate: exam.startDate ? new Date(exam.startDate).toISOString().split('T')[0] : '',
      endDate: exam.endDate ? new Date(exam.endDate).toISOString().split('T')[0] : '',
      status: exam.status,
      classIds: (exam.assignedClasses || []).map((c) => c.classRef?.toString() || c._id?.toString())
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Toggle class selection in modal
  const handleToggleClass = (classId) => {
    setFormData((prev) => {
      const exists = prev.classIds.includes(classId);
      const updated = exists ? prev.classIds.filter((id) => id !== classId) : [...prev.classIds, classId];
      return { ...prev, classIds: updated };
    });
  };

  const handleSelectAllClasses = () => {
    if (formData.classIds.length === activeClasses.length) {
      setFormData((prev) => ({ ...prev, classIds: [] }));
    } else {
      setFormData((prev) => ({ ...prev, classIds: activeClasses.map((c) => c._id) }));
    }
  };

  // Submit Create / Edit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.examinationCode.trim()) {
      setFormError('Examination Code is required.');
      return;
    }
    if (!formData.examinationName.trim()) {
      setFormError('Examination Name is required.');
      return;
    }
    if (formData.classIds.length === 0) {
      setFormError('Please assign at least one class to the examination.');
      return;
    }

    if (formData.startDate && formData.endDate) {
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        setFormError('Start date cannot be later than end date.');
        return;
      }
    }

    setFormSubmitting(true);
    try {
      if (modalMode === 'create') {
        const res = await api.post('/admin/examinations', {
          academicYearRef: selectedYear._id,
          examinationCode: formData.examinationCode,
          examinationName: formData.examinationName,
          description: formData.description,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          status: formData.status,
          classIds: formData.classIds
        });

        if (res.success) {
          setAlert({
            type: 'success',
            message: 'Examination created and assigned to classes successfully!'
          });
          setIsModalOpen(false);
          fetchExaminations(1);
        }
      } else {
        const res = await api.put(`/admin/examinations/${selectedExam._id}`, {
          examinationCode: formData.examinationCode,
          examinationName: formData.examinationName,
          description: formData.description,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          status: formData.status,
          classIds: formData.classIds
        });

        if (res.success) {
          setAlert({
            type: 'success',
            message: 'Examination and assigned classes updated successfully!'
          });
          setIsModalOpen(false);
          fetchExaminations(pagination.currentPage);
        }
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Quick Status Change
  const handleQuickStatusChange = async (exam, nextStatus) => {
    try {
      const res = await api.patch(`/admin/examinations/${exam._id}/status`, { status: nextStatus });
      if (res.success) {
        setAlert({
          type: 'success',
          message: `Examination status updated to ${nextStatus}.`
        });
        fetchExaminations(pagination.currentPage);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Upcoming
          </span>
        );
      case 'ONGOING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Ongoing
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  // Table Columns
  const columns = [
    {
      header: 'Exam Code',
      accessor: 'examinationCode',
      render: (item) => (
        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
          {item.examinationCode}
        </span>
      )
    },
    {
      header: 'Examination Name',
      accessor: 'examinationName',
      render: (item) => (
        <div>
          <span className="font-semibold text-slate-900">{item.examinationName}</span>
          {item.description && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.description}</p>
          )}
        </div>
      )
    },
    {
      header: 'Assigned Classes',
      accessor: 'assignedClasses',
      render: (item) => {
        const classesList = item.assignedClasses || [];
        if (classesList.length === 0) {
          return <span className="text-slate-400 text-xs italic">No classes assigned</span>;
        }

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {classesList.slice(0, 4).map((c, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded"
                >
                  {c.className}
                </span>
              ))}
              {classesList.length > 4 && (
                <span className="text-[11px] font-semibold text-slate-500">
                  +{classesList.length - 4} more
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-medium">
              {classesList.length} Class{classesList.length === 1 ? '' : 'es'} Assigned
            </p>
          </div>
        );
      }
    },
    {
      header: 'Examination Period',
      accessor: 'startDate',
      render: (item) => {
        if (!item.startDate && !item.endDate) {
          return <span className="text-slate-400 text-xs italic">Dates not set</span>;
        }
        const startStr = item.startDate ? new Date(item.startDate).toLocaleDateString('en-GB') : '—';
        const endStr = item.endDate ? new Date(item.endDate).toLocaleDateString('en-GB') : '—';
        return (
          <div className="text-xs text-slate-700 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {startStr} to {endStr}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (item) => (
        <div className="flex items-center space-x-2">
          {renderStatusBadge(item.status)}
          <select
            value={item.status}
            onChange={(e) => handleQuickStatusChange(item, e.target.value)}
            className="text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 focus:bg-white focus:outline-hidden"
          >
            <option value="UPCOMING">Upcoming</option>
            <option value="ONGOING">Ongoing</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      )
    },
    {
      header: 'Actions',
      align: 'right',
      render: (item) => (
        <div className="flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={() => navigate(`/admin/examinations/${item._id}/subjects`)}
            className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            title="Configure Subject Marks Structure"
          >
            <Sliders className="w-3.5 h-3.5 mr-1 text-blue-600" />
            <span>Configure Marks</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenEditModal(item)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Examination & Assigned Classes"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <AdminPageHeader
          title="Examination Management"
          description="Create examinations for the selected academic year, assign them across multiple classes, and manage schedules and statuses."
          actionLabel="+ Create Examination"
          onAction={handleOpenCreateModal}
          actionIcon={Plus}
        />

        {/* Academic Year Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider">
                Target Academic Year
              </p>
              <p className="text-sm font-bold text-slate-900">
                {selectedYear?.yearName || (
                  <span className="text-amber-700 italic">No Academic Year Selected (Select in Header)</span>
                )}
              </p>
            </div>
          </div>
          <div className="text-xs text-slate-500">
            Total Examinations: <strong className="text-blue-600 font-bold">{pagination.totalRecords}</strong>
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

        {/* Search & Filter Bar */}
        <AdminSearchBar
          searchValue={search}
          onSearchChange={(val) => {
            setSearch(val);
            setPagination((p) => ({ ...p, currentPage: 1 }));
          }}
          searchPlaceholder="Search examinations by code, name, description or class..."
          statusValue={statusFilter}
          onStatusChange={(val) => {
            setStatusFilter(val);
            setPagination((p) => ({ ...p, currentPage: 1 }));
          }}
          statusOptions={[
            { label: 'All Statuses', value: 'ALL' },
            { label: 'Upcoming', value: 'UPCOMING' },
            { label: 'Ongoing', value: 'ONGOING' },
            { label: 'Completed', value: 'COMPLETED' },
            { label: 'Cancelled', value: 'CANCELLED' }
          ]}
        />

        {/* Data Table */}
        <AdminDataTable
          columns={columns}
          data={examinations}
          loading={loading}
          emptyMessage="No examinations found for this academic year. Click '+ Create Examination' to configure your first examination."
        />

        {/* Pagination */}
        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          onPageChange={(page) => fetchExaminations(page)}
          limit={pagination.limit}
        />

        {/* ======================================================== */}
        {/* MODAL: CREATE / EDIT EXAMINATION                         */}
        {/* ======================================================== */}
        <AdminModal
          isOpen={isModalOpen}
          onClose={() => !formSubmitting && setIsModalOpen(false)}
          title={modalMode === 'create' ? 'Create New Examination' : 'Edit Examination'}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSubmitForm} className="space-y-4">
            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-800 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <div className="p-2.5 bg-blue-50/70 border border-blue-200/60 rounded-lg text-xs text-blue-900 flex items-center justify-between">
              <span>Academic Year:</span>
              <strong className="font-bold">{selectedYear?.yearName}</strong>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Examination Code */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Examination Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. UT-1, SEM-1, ANNUAL"
                  value={formData.examinationCode}
                  onChange={(e) => setFormData({ ...formData, examinationCode: e.target.value.toUpperCase() })}
                  disabled={formSubmitting}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500 uppercase"
                />
              </div>

              {/* Examination Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Examination Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Unit Test 1, First Semester Examination"
                  value={formData.examinationName}
                  onChange={(e) => setFormData({ ...formData, examinationName: e.target.value })}
                  disabled={formSubmitting}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                rows={2}
                placeholder="Optional notes or details about the examination..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={formSubmitting}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Dates & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  disabled={formSubmitting}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  disabled={formSubmitting}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  disabled={formSubmitting}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:ring-1 focus:ring-blue-500"
                >
                  <option value="UPCOMING">Upcoming</option>
                  <option value="ONGOING">Ongoing</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Assign Examination to Classes */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Assign to Classes <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllClasses}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
                >
                  {formData.classIds.length === activeClasses.length ? 'Deselect All' : 'Select All Classes'}
                </button>
              </div>

              {activeClasses.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  No active classes found in the school. Please configure classes in Class Management first.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  {activeClasses.map((cls) => {
                    const isChecked = formData.classIds.includes(cls._id);
                    return (
                      <label
                        key={cls._id}
                        onClick={() => handleToggleClass(cls._id)}
                        className={`flex items-center space-x-2.5 p-2 rounded-md border cursor-pointer select-none transition-all ${
                          isChecked
                            ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by label click
                          className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs truncate">{cls.className}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-slate-500 mt-1">
                Selected: <strong className="text-slate-800">{formData.classIds.length}</strong> of{' '}
                {activeClasses.length} classes
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={formSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formSubmitting || formData.classIds.length === 0}
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all disabled:opacity-50"
              >
                {formSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                  </>
                ) : modalMode === 'create' ? (
                  'Create Examination'
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default ExaminationManagementPage;
