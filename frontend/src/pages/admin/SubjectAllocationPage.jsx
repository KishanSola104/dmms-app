import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminSearchBar from '../../components/admin/AdminSearchBar';
import AdminDataTable from '../../components/admin/AdminDataTable';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Layers,
  Calendar,
  CheckSquare,
  Square,
  HelpCircle
} from 'lucide-react';

const SubjectAllocationPage = () => {
  const { academicYears, selectedYear } = useAcademicYear();

  // Academic Year & Class Selection State
  const [targetAcademicYearId, setTargetAcademicYearId] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(false);

  const targetYear =
    academicYears.find((y) => y._id === targetAcademicYearId) || selectedYear || null;

  // Allocations Table State
  const [allocations, setAllocations] = useState([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  const [alert, setAlert] = useState({ type: '', message: '' });

  // Allocate Modal State
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [subjectConfigs, setSubjectConfigs] = useState({}); // { [subjectId]: { hasAdditional: boolean, components: [{ componentName, maximumMarks }] } }
  const [allocateSubmitting, setAllocateSubmitting] = useState(false);
  const [allocateError, setAllocateError] = useState('');

  // Edit Single Allocation Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState(null);
  const [editHasAdditional, setEditHasAdditional] = useState(false);
  const [editComponents, setEditComponents] = useState([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Deallocate / Re-allocate Confirmation Modal State
  const [deallocateModalOpen, setDeallocateModalOpen] = useState(false);
  const [allocationToDeallocate, setAllocationToDeallocate] = useState(null);
  const [deallocateSubmitting, setDeallocateSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // Sync default target academic year from header context when available
  useEffect(() => {
    if (selectedYear?._id && !targetAcademicYearId) {
      setTargetAcademicYearId(selectedYear._id);
    } else if (academicYears.length > 0 && !targetAcademicYearId) {
      const curr = academicYears.find((y) => y.isCurrent) || academicYears[0];
      setTargetAcademicYearId(curr._id);
    }
  }, [selectedYear, academicYears]);

  // Load Classes when school session or year is active
  useEffect(() => {
    fetchActiveClasses();
  }, []);

  // When class or academic year changes, reset and fetch allocations
  useEffect(() => {
    if (selectedClassId && targetYear?._id) {
      fetchAllocations(1);
    } else {
      setAllocations([]);
      setPagination({ currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
    }
  }, [selectedClassId, targetYear?._id, search, typeFilter, statusFilter]);

  const fetchActiveClasses = async () => {
    setLoadingClasses(true);
    try {
      const res = await api.get('/admin/classes?status=ACTIVE&limit=100');
      if (res.success && res.classes) {
        setClasses(res.classes);
        if (res.classes.length > 0 && !selectedClassId) {
          setSelectedClassId(res.classes[0]._id);
        }
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to load classes: ' + err.message });
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchAllocations = async (page = 1) => {
    if (!selectedClassId || !targetYear?._id) return;
    setLoadingAllocations(true);
    try {
      const params = new URLSearchParams({
        academicYearRef: targetYear._id,
        classRef: selectedClassId,
        page: page.toString(),
        limit: '10',
        search,
        type: typeFilter,
        status: statusFilter
      });

      const res = await api.get(`/admin/class-subjects?${params.toString()}`);
      if (res.success) {
        setAllocations(res.allocations || []);
        setPagination(res.pagination || { currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
    } finally {
      setLoadingAllocations(false);
    }
  };

  // Open Allocate Modal & load available subjects
  const handleOpenAllocateModal = async () => {
    if (!selectedClassId) {
      setAlert({ type: 'error', message: 'Please select a class first.' });
      return;
    }
    if (!targetYear?._id) {
      setAlert({ type: 'error', message: 'Please select an academic year first.' });
      return;
    }

    setAllocateError('');
    setSelectedSubjectIds([]);
    setSubjectConfigs({});
    setIsAllocateModalOpen(true);
    setLoadingAvailable(true);

    try {
      const res = await api.get(
        `/admin/class-subjects/available?academicYearRef=${targetYear._id}&classRef=${selectedClassId}`
      );
      if (res.success && res.subjects) {
        setAvailableSubjects(res.subjects);
      }
    } catch (err) {
      setAllocateError('Failed to load available subjects: ' + err.message);
    } finally {
      setLoadingAvailable(false);
    }
  };

  // Toggle subject selection in allocate modal
  const handleToggleSubject = (subjectId) => {
    setSelectedSubjectIds((prev) => {
      const exists = prev.includes(subjectId);
      if (exists) {
        const next = prev.filter((id) => id !== subjectId);
        // remove config
        setSubjectConfigs((c) => {
          const updated = { ...c };
          delete updated[subjectId];
          return updated;
        });
        return next;
      } else {
        // default config: no additional components
        setSubjectConfigs((c) => ({
          ...c,
          [subjectId]: {
            hasAdditional: false,
            components: [{ componentName: 'Project Work', maximumMarks: 10 }]
          }
        }));
        return [...prev, subjectId];
      }
    });
  };

  const handleSelectAllAvailable = () => {
    const unallocated = availableSubjects.filter((s) => !s.isAllocated);
    if (selectedSubjectIds.length === unallocated.length) {
      // deselect all
      setSelectedSubjectIds([]);
      setSubjectConfigs({});
    } else {
      const allIds = unallocated.map((s) => s._id);
      setSelectedSubjectIds(allIds);
      const newConfigs = {};
      allIds.forEach((id) => {
        newConfigs[id] = {
          hasAdditional: false,
          components: [{ componentName: 'Project Work', maximumMarks: 10 }]
        };
      });
      setSubjectConfigs(newConfigs);
    }
  };

  const handleConfigChange = (subjectId, field, value) => {
    setSubjectConfigs((prev) => ({
      ...prev,
      [subjectId]: {
        ...prev[subjectId],
        [field]: value
      }
    }));
  };

  const handleAddComponent = (subjectId) => {
    setSubjectConfigs((prev) => {
      const current = prev[subjectId] || { hasAdditional: true, components: [] };
      return {
        ...prev,
        [subjectId]: {
          ...current,
          components: [...current.components, { componentName: '', maximumMarks: 10 }]
        }
      };
    });
  };

  const handleRemoveComponent = (subjectId, index) => {
    setSubjectConfigs((prev) => {
      const current = prev[subjectId];
      if (!current) return prev;
      const updated = current.components.filter((_, i) => i !== index);
      return {
        ...prev,
        [subjectId]: {
          ...current,
          components: updated
        }
      };
    });
  };

  const handleComponentFieldChange = (subjectId, index, field, value) => {
    setSubjectConfigs((prev) => {
      const current = prev[subjectId];
      if (!current) return prev;
      const updated = [...current.components];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return {
        ...prev,
        [subjectId]: {
          ...current,
          components: updated
        }
      };
    });
  };

  // Submit allocation
  const handleSaveAllocations = async (e) => {
    e.preventDefault();
    setAllocateError('');

    if (selectedSubjectIds.length === 0) {
      setAllocateError('Please select at least one subject to allocate.');
      return;
    }

    // Build payload and validate client-side
    const payloadAllocations = [];
    for (const subId of selectedSubjectIds) {
      const config = subjectConfigs[subId] || { hasAdditional: false, components: [] };
      const subInfo = availableSubjects.find((s) => s._id === subId);

      if (config.hasAdditional) {
        if (!config.components || config.components.length === 0) {
          setAllocateError(`Please add at least one component for subject "${subInfo?.subjectName}".`);
          return;
        }

        const names = new Set();
        for (const comp of config.components) {
          const name = (comp.componentName || '').trim();
          const marks = Number(comp.maximumMarks);
          if (!name) {
            setAllocateError(`Component name is required for "${subInfo?.subjectName}".`);
            return;
          }
          if (names.has(name.toLowerCase())) {
            setAllocateError(`Duplicate component name "${name}" in "${subInfo?.subjectName}".`);
            return;
          }
          names.add(name.toLowerCase());
          if (isNaN(marks) || marks <= 0) {
            setAllocateError(`Marks for "${name}" in "${subInfo?.subjectName}" must be a positive number.`);
            return;
          }
        }
      }

      payloadAllocations.push({
        subjectRef: subId,
        hasAdditionalComponents: config.hasAdditional,
        additionalComponents: config.hasAdditional ? config.components : []
      });
    }

    setAllocateSubmitting(true);
    try {
      const res = await api.post('/admin/class-subjects', {
        academicYearRef: targetYear._id,
        classRef: selectedClassId,
        allocations: payloadAllocations
      });

      if (res.success) {
        setAlert({
          type: 'success',
          message: res.message || 'Subjects successfully allocated to class.'
        });
        setIsAllocateModalOpen(false);
        fetchAllocations(pagination.currentPage);
      }
    } catch (err) {
      setAllocateError(err.message);
    } finally {
      setAllocateSubmitting(false);
    }
  };

  // Edit single allocation
  const handleOpenEditModal = (allocation) => {
    setEditingAllocation(allocation);
    setEditHasAdditional(Boolean(allocation.hasAdditionalComponents));
    setEditComponents(
      allocation.additionalComponents && allocation.additionalComponents.length > 0
        ? allocation.additionalComponents.map((c) => ({
            componentName: c.componentName,
            maximumMarks: c.maximumMarks
          }))
        : [{ componentName: 'Project Work', maximumMarks: 10 }]
    );
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleEditAddComponent = () => {
    setEditComponents((prev) => [...prev, { componentName: '', maximumMarks: 10 }]);
  };

  const handleEditRemoveComponent = (index) => {
    setEditComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditComponentFieldChange = (index, field, value) => {
    setEditComponents((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveEditAllocation = async (e) => {
    e.preventDefault();
    setEditError('');

    if (editHasAdditional) {
      if (!editComponents || editComponents.length === 0) {
        setEditError('Please add at least one component.');
        return;
      }
      const names = new Set();
      for (const comp of editComponents) {
        const name = (comp.componentName || '').trim();
        const marks = Number(comp.maximumMarks);
        if (!name) {
          setEditError('Component name cannot be empty.');
          return;
        }
        if (names.has(name.toLowerCase())) {
          setEditError(`Duplicate component name "${name}".`);
          return;
        }
        names.add(name.toLowerCase());
        if (isNaN(marks) || marks <= 0) {
          setEditError(`Marks for "${name}" must be a positive number greater than 0.`);
          return;
        }
      }
    }

    setEditSubmitting(true);
    try {
      const res = await api.put(`/admin/class-subjects/${editingAllocation._id}`, {
        hasAdditionalComponents: editHasAdditional,
        additionalComponents: editHasAdditional ? editComponents : []
      });

      if (res.success) {
        setAlert({
          type: 'success',
          message: 'Subject allocation updated successfully.'
        });
        setIsEditModalOpen(false);
        fetchAllocations(pagination.currentPage);
      }
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  // Open Deallocate Confirmation Modal
  const handleOpenDeallocateModal = (allocation) => {
    setAllocationToDeallocate(allocation);
    setDeallocateModalOpen(true);
  };

  // Confirm Deallocate Subject from Class
  const handleConfirmDeallocate = async () => {
    if (!allocationToDeallocate) return;
    setDeallocateSubmitting(true);
    try {
      const res = await api.post(`/admin/class-subjects/${allocationToDeallocate._id}/deallocate`);
      if (res.success) {
        setAlert({
          type: 'success',
          message:
            res.message ||
            `Subject '${allocationToDeallocate.subjectName}' deallocated from ${currentClassDoc?.className || 'class'} for ${targetYear?.yearName || 'selected year'}.`
        });
        setDeallocateModalOpen(false);
        setAllocationToDeallocate(null);
        fetchAllocations(pagination.currentPage);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message });
      setDeallocateModalOpen(false);
    } finally {
      setDeallocateSubmitting(false);
    }
  };

  // Re-allocate an inactive subject allocation
  const handleReactivateAllocation = async (allocation) => {
    setTogglingId(allocation._id);
    try {
      const res = await api.patch(`/admin/class-subjects/${allocation._id}/status`, {
        status: 'ACTIVE'
      });
      if (res.success) {
        setAlert({
          type: 'success',
          message: res.message || `Subject '${allocation.subjectName}' re-allocated to this class.`
        });
        fetchAllocations(pagination.currentPage);
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
      header: 'Subject Code',
      accessor: 'subjectCode',
      render: (item) => (
        <span className="font-mono font-bold text-slate-800 text-xs px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
          {item.subjectCode}
        </span>
      )
    },
    {
      header: 'Subject Name',
      accessor: 'subjectName',
      render: (item) => (
        <span className="font-semibold text-slate-900">{item.subjectName}</span>
      )
    },
    {
      header: 'Subject Type',
      accessor: 'subjectType',
      render: (item) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            item.subjectType === 'ACADEMIC'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-purple-50 text-purple-700 border border-purple-200'
          }`}
        >
          {item.subjectTypeLabel}
        </span>
      )
    },
    {
      header: 'Additional / Project Work',
      accessor: 'additionalComponents',
      render: (item) => {
        if (!item.hasAdditionalComponents || !item.additionalComponents || item.additionalComponents.length === 0) {
          return <span className="text-slate-400 text-xs italic">No additional components</span>;
        }
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.additionalComponents.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded"
                >
                  {c.componentName}: <strong className="ml-1">{c.maximumMarks}M</strong>
                </span>
              ))}
            </div>
            <div className="text-[11px] font-semibold text-slate-600">
              Total Additional: <span className="text-amber-700 font-bold">{item.totalAdditionalMarks} Marks</span>
            </div>
          </div>
        );
      }
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
            onClick={() => handleOpenEditModal(item)}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Additional Components"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {item.status === 'ACTIVE' ? (
            <button
              type="button"
              onClick={() => handleOpenDeallocateModal(item)}
              disabled={togglingId === item._id}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              title="Deallocate subject from this class for the selected academic year"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Deallocate</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleReactivateAllocation(item)}
              disabled={togglingId === item._id}
              className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
              title="Re-allocate subject to this class"
            >
              {togglingId === item._id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>Re-allocate</span>
            </button>
          )}
        </div>
      )
    }
  ];

  const currentClassDoc = classes.find((c) => c._id === selectedClassId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <AdminPageHeader
          title="Subject Allocation to Classes"
          description="Allocate subjects from the school pool to individual classes for the selected academic year, and configure any additional/project components."
          actionLabel="+ Allocate Subjects"
          onAction={handleOpenAllocateModal}
          actionIcon={Plus}
        />

        {/* Academic Year & Class Selection Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            {/* Academic Year Selector Dropdown */}
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 text-white rounded-md shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <label htmlFor="ay-select" className="block text-[11px] font-bold text-blue-900 uppercase tracking-wider mb-1">
                  Select Academic Year
                </label>
                <select
                  id="ay-select"
                  value={targetYear?._id || ''}
                  onChange={(e) => setTargetAcademicYearId(e.target.value)}
                  disabled={academicYears.length === 0}
                  className="w-full px-3.5 py-2 bg-blue-50/50 border border-blue-200 rounded-lg text-sm font-semibold text-blue-950 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                >
                  {academicYears.length === 0 ? (
                    <option value="">No Academic Years Found</option>
                  ) : (
                    academicYears.map((ay) => (
                      <option key={ay._id} value={ay._id}>
                        {ay.yearName} {ay.isCurrent ? '(Active)' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Class Selector Dropdown */}
            <div className="flex items-center space-x-3">
              <label htmlFor="class-select" className="text-xs font-bold uppercase tracking-wider text-slate-700 shrink-0">
                Select Class:
              </label>
              <div className="relative flex-1">
                <select
                  id="class-select"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={loadingClasses || classes.length === 0}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  {classes.length === 0 ? (
                    <option value="">No Active Classes Found</option>
                  ) : (
                    classes.map((cls) => (
                      <option key={cls._id} value={cls._id}>
                        {cls.className} ({cls.classCode}) — {cls.numberOfSections} Section(s)
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>
          </div>

          {currentClassDoc && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-600">
              <span>
                Class: <strong className="text-slate-900">{currentClassDoc.className}</strong>
              </span>
              <span>•</span>
              <span>
                Class Code: <strong className="font-mono text-slate-900">{currentClassDoc.classCode}</strong>
              </span>
              <span>•</span>
              <span>
                Class Teacher:{' '}
                <strong className="text-slate-900">{currentClassDoc.classTeacherName || 'Not Assigned'}</strong>
              </span>
              <span>•</span>
              <span>
                Allocated Subjects: <strong className="text-blue-600 font-bold">{pagination.totalRecords}</strong>
              </span>
            </div>
          )}
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
          searchPlaceholder="Search allocated subjects by name or code..."
          filterValue={typeFilter}
          onFilterChange={(val) => {
            setTypeFilter(val);
            setPagination((p) => ({ ...p, currentPage: 1 }));
          }}
          filterOptions={[
            { label: 'All Subject Types', value: 'ALL' },
            { label: 'Academic (Scholastic)', value: 'ACADEMIC' },
            { label: 'Co-curricular (Co-Scholastic)', value: 'CO_CURRICULAR' }
          ]}
          statusValue={statusFilter}
          onStatusChange={(val) => {
            setStatusFilter(val);
            setPagination((p) => ({ ...p, currentPage: 1 }));
          }}
          statusOptions={[
            { label: 'All Statuses', value: 'ALL' },
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Inactive', value: 'INACTIVE' }
          ]}
        />

        {/* Data Table */}
        <AdminDataTable
          columns={columns}
          data={allocations}
          loading={loadingAllocations}
          emptyMessage={
            selectedClassId
              ? `No subjects have been allocated to ${currentClassDoc?.className || 'this class'} for ${targetYear?.yearName || 'the selected academic year'}. Click "+ Allocate Subjects" to get started.`
              : 'Please select a class to view its subject allocations.'
          }
        />

        {/* Pagination */}
        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          onPageChange={(page) => fetchAllocations(page)}
          limit={pagination.limit}
        />

        {/* ======================================================== */}
        {/* MODAL 1: ALLOCATE SUBJECTS TO CLASS                      */}
        {/* ======================================================== */}
        <AdminModal
          isOpen={isAllocateModalOpen}
          onClose={() => !allocateSubmitting && setIsAllocateModalOpen(false)}
          title={`Allocate Subjects to ${currentClassDoc?.className || 'Class'}`}
          maxWidth="max-w-3xl"
        >
          <form onSubmit={handleSaveAllocations} className="space-y-6">
            {allocateError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-800 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{allocateError}</span>
              </div>
            )}

            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                Academic Year: <strong className="text-slate-800">{targetYear?.yearName}</strong> | Class:{' '}
                <strong className="text-slate-800">{currentClassDoc?.className}</strong>
              </div>
              <button
                type="button"
                onClick={handleSelectAllAvailable}
                className="text-blue-600 hover:text-blue-800 font-semibold underline"
              >
                {selectedSubjectIds.length === availableSubjects.filter((s) => !s.isAllocated).length &&
                availableSubjects.filter((s) => !s.isAllocated).length > 0
                  ? 'Deselect All'
                  : 'Select All Unallocated'}
              </button>
            </div>

            {loadingAvailable ? (
              <div className="py-12 text-center text-slate-500">
                <Loader2 className="w-7 h-7 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-sm">Loading available subjects pool...</p>
              </div>
            ) : availableSubjects.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                No active subjects found in the school pool. Please create subjects in Subject Management first.
              </div>
            ) : (
              <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                {availableSubjects.map((subject) => {
                  const isSelected = selectedSubjectIds.includes(subject._id);
                  const isAlreadyAllocated = subject.isAllocated;
                  const config = subjectConfigs[subject._id] || { hasAdditional: false, components: [] };
                  const totalCompMarks = (config.components || []).reduce(
                    (sum, c) => sum + (Number(c.maximumMarks) || 0),
                    0
                  );

                  return (
                    <div
                      key={subject._id}
                      className={`border rounded-xl transition-all ${
                        isAlreadyAllocated
                          ? 'bg-slate-50/80 border-slate-200 opacity-70'
                          : isSelected
                          ? 'bg-blue-50/30 border-blue-300 ring-1 ring-blue-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Subject Selection Row */}
                      <div className="p-3.5 flex items-center justify-between gap-3">
                        <label className="flex items-center space-x-3 cursor-pointer select-none flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected || isAlreadyAllocated}
                            disabled={isAlreadyAllocated}
                            onChange={() => handleToggleSubject(subject._id)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {subject.subjectCode}
                              </span>
                              <span className="text-sm font-semibold text-slate-900 truncate">
                                {subject.subjectName}
                              </span>
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  subject.subjectType === 'ACADEMIC'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {subject.subjectTypeLabel}
                              </span>
                            </div>
                          </div>
                        </label>

                        {isAlreadyAllocated ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded">
                            <CheckCircle className="w-3 h-3 mr-1" /> Already Allocated
                          </span>
                        ) : null}
                      </div>

                      {/* Expandable Configuration: Additional Components */}
                      {isSelected && !isAlreadyAllocated && (
                        <div className="p-4 border-t border-blue-100 bg-white rounded-b-xl space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-medium text-slate-700">
                              Does this subject have any additional components or project work whose marks will contribute
                              to final result?
                            </span>
                            <div className="flex items-center space-x-4">
                              <label className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`hasAdditional_${subject._id}`}
                                  checked={!config.hasAdditional}
                                  onChange={() => handleConfigChange(subject._id, 'hasAdditional', false)}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                                <span>No</span>
                              </label>
                              <label className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`hasAdditional_${subject._id}`}
                                  checked={config.hasAdditional}
                                  onChange={() => handleConfigChange(subject._id, 'hasAdditional', true)}
                                  className="text-blue-600 focus:ring-blue-500"
                                />
                                <span>Yes</span>
                              </label>
                            </div>
                          </div>

                          {/* Components Builder if Yes */}
                          {config.hasAdditional && (
                            <div className="mt-3 p-3 bg-amber-50/50 border border-amber-200 rounded-lg space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                                  Additional / Project Components
                                </p>
                                <span className="text-xs font-bold text-amber-800">
                                  Total: {totalCompMarks} Maximum Marks
                                </span>
                              </div>

                              <div className="space-y-2">
                                {(config.components || []).map((comp, idx) => (
                                  <div key={idx} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Component Name (e.g. Project Work, Oral)"
                                      value={comp.componentName}
                                      onChange={(e) =>
                                        handleComponentFieldChange(subject._id, idx, 'componentName', e.target.value)
                                      }
                                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                                    />
                                    <div className="flex items-center space-x-1">
                                      <input
                                        type="number"
                                        min="1"
                                        placeholder="Max Marks"
                                        value={comp.maximumMarks}
                                        onChange={(e) =>
                                          handleComponentFieldChange(subject._id, idx, 'maximumMarks', e.target.value)
                                        }
                                        className="w-24 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-bold text-slate-800"
                                      />
                                      <span className="text-xs text-slate-500 font-medium">Marks</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveComponent(subject._id, idx)}
                                      disabled={config.components.length === 1}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors disabled:opacity-40"
                                      title="Remove component"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAddComponent(subject._id)}
                                className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add Component
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsAllocateModalOpen(false)}
                disabled={allocateSubmitting}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={allocateSubmitting || selectedSubjectIds.length === 0}
                className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs hover:shadow transition-all disabled:opacity-50"
              >
                {allocateSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving Allocation...
                  </>
                ) : (
                  `Allocate Selected Subjects (${selectedSubjectIds.length})`
                )}
              </button>
            </div>
          </form>
        </AdminModal>

        {/* ======================================================== */}
        {/* MODAL 2: EDIT ADDITIONAL COMPONENTS                      */}
        {/* ======================================================== */}
        <AdminModal
          isOpen={isEditModalOpen}
          onClose={() => !editSubmitting && setIsEditModalOpen(false)}
          title={`Edit Additional Components – ${editingAllocation?.subjectName || ''}`}
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleSaveEditAllocation} className="space-y-5">
            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-800 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
              <div>
                Class: <strong className="text-slate-800">{currentClassDoc?.className}</strong>
              </div>
              <div>
                Subject:{' '}
                <strong className="text-slate-800">
                  {editingAllocation?.subjectName} ({editingAllocation?.subjectCode})
                </strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                Does this subject have any additional components or project work whose marks will contribute to the
                student's final result?
              </label>
              <div className="flex items-center space-x-6">
                <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="editHasAdditional"
                    checked={!editHasAdditional}
                    onChange={() => setEditHasAdditional(false)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>No</span>
                </label>
                <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="editHasAdditional"
                    checked={editHasAdditional}
                    onChange={() => setEditHasAdditional(true)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>Yes</span>
                </label>
              </div>
            </div>

            {editHasAdditional && (
              <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">Components List</span>
                  <span className="text-xs font-bold text-amber-800">
                    Total: {editComponents.reduce((sum, c) => sum + (Number(c.maximumMarks) || 0), 0)} Marks
                  </span>
                </div>

                <div className="space-y-2">
                  {editComponents.map((comp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Component Name"
                        value={comp.componentName}
                        onChange={(e) => handleEditComponentFieldChange(idx, 'componentName', e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Marks"
                        value={comp.maximumMarks}
                        onChange={(e) => handleEditComponentFieldChange(idx, 'maximumMarks', e.target.value)}
                        className="w-20 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => handleEditRemoveComponent(idx)}
                        disabled={editComponents.length === 1}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleEditAddComponent}
                  className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Component
                </button>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                disabled={editSubmitting}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSubmitting}
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                {editSubmitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </form>
        </AdminModal>

        {/* ======================================================== */}
        {/* MODAL 3: CONFIRM SUBJECT DEALLOCATION                    */}
        {/* ======================================================== */}
        <AdminModal
          isOpen={deallocateModalOpen}
          onClose={() => !deallocateSubmitting && setDeallocateModalOpen(false)}
          title="Confirm Subject Deallocation"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-3 text-xs text-rose-900">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="font-bold">
                  Deallocate {allocationToDeallocate?.subjectName} ({allocationToDeallocate?.subjectCode})?
                </p>
                <p>
                  This will deallocate the subject from{' '}
                  <strong>{currentClassDoc?.className}</strong> for academic year{' '}
                  <strong>{targetYear?.yearName}</strong>.
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Teachers will no longer be able to enter new marks for this subject in this class &amp; year.</li>
                  <li>Previous academic years, historical marks, and results will NOT be deleted.</li>
                  <li>The subject remains in the school pool and can be re-allocated later if needed.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeallocateModalOpen(false)}
                disabled={deallocateSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeallocate}
                disabled={deallocateSubmitting}
                className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {deallocateSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deallocating...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm Deallocate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default SubjectAllocationPage;
