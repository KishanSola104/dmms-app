import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import AdminModal from '../../components/admin/AdminModal';
import api from '../../services/api';
import {
  ArrowLeft,
  BookOpenCheck,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Layers,
  Calendar,
  Sliders,
  Copy,
  Info,
  CheckSquare,
  Sparkles
} from 'lucide-react';

const ExaminationSubjectConfigPage = () => {
  const { examinationId } = useParams();
  const navigate = useNavigate();

  // Primary State
  const [loading, setLoading] = useState(true);
  const [examination, setExamination] = useState(null);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  // Class Subjects state
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsData, setSubjectsData] = useState({
    subjects: [],
    summary: { totalAllocatedSubjects: 0, configuredSubjects: 0, unconfiguredSubjects: 0 }
  });

  // Alert State
  const [alert, setAlert] = useState({ type: '', message: '' });

  // Configure Modal State
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [currentSubject, setCurrentSubject] = useState(null);
  const [componentsList, setComponentsList] = useState([]);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Copy Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [sourceClassId, setSourceClassId] = useState('');
  const [copySubmitting, setCopySubmitting] = useState(false);
  const [copyError, setCopyError] = useState('');

  // 1. Initial Load: Fetch Examination details and assigned classes
  useEffect(() => {
    fetchExamAndClasses();
  }, [examinationId]);

  // 2. Whenever selectedClassId changes, fetch subjects
  useEffect(() => {
    if (examinationId && selectedClassId) {
      fetchClassSubjects(selectedClassId);
    }
  }, [examinationId, selectedClassId]);

  const fetchExamAndClasses = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/examinations/${examinationId}`);
      if (res.success && res.examination) {
        setExamination(res.examination);
        const classes = res.examination.assignedClasses || [];
        setAssignedClasses(classes);

        // Auto-select first class if not set
        if (classes.length > 0 && !selectedClassId) {
          const firstClassId = classes[0].classRef?._id || classes[0].classRef || classes[0]._id;
          setSelectedClassId(firstClassId.toString());
        }
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to load examination.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchClassSubjects = async (classId) => {
    setSubjectsLoading(true);
    try {
      const res = await api.get(`/admin/examinations/${examinationId}/classes/${classId}/subjects`);
      if (res.success) {
        setSubjectsData({
          subjects: res.subjects || [],
          summary: res.summary || { totalAllocatedSubjects: 0, configuredSubjects: 0, unconfiguredSubjects: 0 }
        });
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to load subjects for class.' });
    } finally {
      setSubjectsLoading(false);
    }
  };

  // Open Configure Modal
  const handleOpenConfigModal = (sub) => {
    setCurrentSubject(sub);
    setModalError('');

    if (sub.isConfigured) {
      // Existing saved configuration: preserve saved components without reinserting Written
      setComponentsList(
        (sub.components || []).map((c) => ({
          componentName: c.componentName,
          maximumMarks: c.maximumMarks.toString()
        }))
      );
    } else {
      // New subject configuration:
      // Academic subjects default to "Written" (50 marks); Co-curricular subjects start empty
      const isCoCurricular = (sub.subjectType || '').toUpperCase() === 'CO_CURRICULAR';
      if (isCoCurricular) {
        setComponentsList([]);
      } else {
        setComponentsList([
          { componentName: 'Written', maximumMarks: '50' }
        ]);
      }
    }

    setIsConfigModalOpen(true);
  };

  // Add Component Row
  const handleAddComponentRow = () => {
    setComponentsList((prev) => [...prev, { componentName: '', maximumMarks: '' }]);
  };

  // Remove Component Row
  const handleRemoveComponentRow = (index) => {
    setModalError('');
    setComponentsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update Component Field
  const handleUpdateComponent = (index, field, value) => {
    setModalError('');
    setComponentsList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Calculate live total maximum marks in modal
  const liveTotalMarks = componentsList.reduce((sum, c) => {
    const marks = Number(c.maximumMarks);
    return sum + (isNaN(marks) || marks <= 0 ? 0 : marks);
  }, 0);

  // Submit Subject Configuration
  const handleSaveConfiguration = async (e) => {
    e.preventDefault();
    setModalError('');

    // Validations: If components exist, validate names, duplicates, and positive marks
    const seen = new Set();
    for (let i = 0; i < componentsList.length; i++) {
      const comp = componentsList[i];
      if (!comp.componentName.trim()) {
        setModalError(`Component #${i + 1} name is required.`);
        return;
      }
      const lower = comp.componentName.trim().toLowerCase();
      if (seen.has(lower)) {
        setModalError(`Duplicate component name "${comp.componentName.trim()}".`);
        return;
      }
      seen.add(lower);

      const val = Number(comp.maximumMarks);
      if (isNaN(val) || val <= 0) {
        setModalError(`Maximum marks for "${comp.componentName.trim()}" must be a positive number.`);
        return;
      }
    }

    setModalSubmitting(true);
    try {
      const res = await api.post(
        `/admin/examinations/${examinationId}/classes/${selectedClassId}/subjects/${currentSubject.subjectRef}/configure`,
        {
          components: componentsList.map((c, idx) => ({
            componentName: c.componentName.trim(),
            maximumMarks: Number(c.maximumMarks),
            sequence: idx + 1
          }))
        }
      );

      if (res.success) {
        setAlert({
          type: 'success',
          message: componentsList.length > 0
            ? `Marks structure for "${currentSubject.subjectName}" configured successfully! Total: ${res.totalMaximumMarks} marks.`
            : `Marks structure for "${currentSubject.subjectName}" saved with zero components (Total: 0 marks).`
        });
        setIsConfigModalOpen(false);
        fetchClassSubjects(selectedClassId);
      }
    } catch (err) {
      setModalError(err.message || 'Failed to save configuration.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Submit Copy Class Configuration
  const handleCopyClassConfig = async (e) => {
    e.preventDefault();
    setCopyError('');

    if (!sourceClassId) {
      setCopyError('Please select a source class.');
      return;
    }

    setCopySubmitting(true);
    try {
      const res = await api.post(
        `/admin/examinations/${examinationId}/classes/${selectedClassId}/copy-from/${sourceClassId}`
      );

      if (res.success) {
        setAlert({
          type: 'success',
          message: res.message || 'Marks structure copied successfully!'
        });
        setIsCopyModalOpen(false);
        fetchClassSubjects(selectedClassId);
      }
    } catch (err) {
      setCopyError(err.message || 'Failed to copy configuration.');
    } finally {
      setCopySubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const selectedClass = assignedClasses.find(
    (c) => (c.classRef?._id || c.classRef || c._id)?.toString() === selectedClassId
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="space-y-1">
            <button
              onClick={() => navigate('/admin/examinations')}
              className="inline-flex items-center text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Examination Management
            </button>
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-lg">
                <Sliders className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>{examination?.examinationName}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {examination?.examinationCode}
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Phase 4: Configure examination marks components for each subject independently per class.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                examination?.status === 'UPCOMING'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : examination?.status === 'ONGOING'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : examination?.status === 'COMPLETED'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-slate-700 text-slate-300 border-slate-600'
              }`}
            >
              Status: {examination?.status}
            </span>
          </div>
        </div>

        {/* Global Alert Notification */}
        {alert.message && (
          <div
            className={`p-4 rounded-xl flex items-start space-x-3 border ${
              alert.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            {alert.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">{alert.message}</div>
            <button
              onClick={() => setAlert({ type: '', message: '' })}
              className="text-slate-400 hover:text-white text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Assigned Classes Selector Tabs */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Select Class to Configure
              </span>
            </div>
            {assignedClasses.length > 1 && (
              <button
                onClick={() => {
                  setSourceClassId('');
                  setCopyError('');
                  setIsCopyModalOpen(true);
                }}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                title="Copy configuration structure from another class"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                Copy From Class
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {assignedClasses.map((item) => {
              const classId = (item.classRef?._id || item.classRef || item._id).toString();
              const isSelected = selectedClassId === classId;
              const className = item.className || item.classRef?.className || 'Class';
              const classCode = item.classCode || item.classRef?.classCode || '';

              return (
                <button
                  key={classId}
                  onClick={() => setSelectedClassId(classId)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{className}</span>
                  {classCode && <span className="opacity-70 text-[10px] font-mono">({classCode})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Configuration Overview Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Allocated Subjects</p>
              <h3 className="text-xl font-bold text-white mt-0.5">
                {subjectsData.summary.totalAllocatedSubjects}
              </h3>
            </div>
            <div className="p-2.5 bg-slate-800 text-slate-300 rounded-lg">
              <BookOpenCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-emerald-400 font-medium">Configured</p>
              <h3 className="text-xl font-bold text-emerald-400 mt-0.5">
                {subjectsData.summary.configuredSubjects}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-amber-400 font-medium">Pending Configuration</p>
              <h3 className="text-xl font-bold text-amber-400 mt-0.5">
                {subjectsData.summary.unconfiguredSubjects}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Subjects List for Selected Class */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Allocated Subjects for</span>
                <span className="text-blue-400">
                  {selectedClass?.className || 'Selected Class'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Define examination marks components (e.g. Written, Oral, Practical). Totals are computed automatically on the backend.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span>Independent configuration for this class only.</span>
            </div>
          </div>

          {subjectsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin mr-2" />
              <span className="text-xs text-slate-400 font-medium">Loading class subjects...</span>
            </div>
          ) : subjectsData.subjects.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <BookOpenCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No Subjects Allocated</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                There are no active subjects allocated to this class for the examination's academic year. Go to "Subject Allocation" to allocate subjects first.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5">Subject</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Additional / Project (Phase 1)</th>
                    <th className="py-3 px-4">Exam Marks Components</th>
                    <th className="py-3 px-4 text-center">Exam Total</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {subjectsData.subjects.map((sub) => (
                    <tr
                      key={sub.subjectRef}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Subject Name & Code */}
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-white">{sub.subjectName}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {sub.subjectCode}
                        </div>
                      </td>

                      {/* Subject Type */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                            sub.subjectType === 'CO_CURRICULAR'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}
                        >
                          {sub.subjectType === 'CO_CURRICULAR' ? 'Co-Scholastic' : 'Scholastic'}
                        </span>
                      </td>

                      {/* Additional Components (Independent, from Phase 1) */}
                      <td className="py-3.5 px-4">
                        {sub.hasAdditionalComponents && sub.additionalComponents?.length > 0 ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {sub.additionalComponents.map((ac, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700"
                                >
                                  {ac.componentName}: {ac.maximumMarks}m
                                </span>
                              ))}
                            </div>
                            <p className="text-[10px] text-slate-500">
                              Total: {sub.totalAdditionalMarks}m (Independent of exam)
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">None</span>
                        )}
                      </td>

                      {/* Examination Marks Components */}
                      <td className="py-3.5 px-4">
                        {sub.isConfigured && sub.components?.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {sub.components.map((c, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 rounded text-[11px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 flex items-center space-x-1"
                              >
                                <span>{c.componentName}:</span>
                                <span className="font-bold text-white">{c.maximumMarks}</span>
                              </span>
                            ))}
                          </div>
                        ) : sub.isConfigured ? (
                          <span className="text-[11px] text-slate-400 italic">
                            No components (0 marks)
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-400/80 italic flex items-center">
                            <AlertCircle className="w-3.5 h-3.5 mr-1" />
                            Not configured
                          </span>
                        )}
                      </td>

                      {/* Total Maximum Marks */}
                      <td className="py-3.5 px-4 text-center">
                        {sub.isConfigured ? (
                          <span className="inline-block px-2.5 py-1 rounded-md font-mono text-xs font-bold bg-slate-800 text-white border border-slate-700">
                            {sub.totalMaximumMarks} marks
                          </span>
                        ) : (
                          <span className="text-slate-500 font-mono text-xs">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {sub.isConfigured ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Configured
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => handleOpenConfigModal(sub)}
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            sub.isConfigured
                              ? 'bg-slate-800 text-blue-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                              : 'bg-blue-600 text-white hover:bg-blue-500 shadow-sm'
                          }`}
                        >
                          <Sliders className="w-3.5 h-3.5 mr-1.5" />
                          <span>{sub.isConfigured ? 'Edit Marks' : 'Configure'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Configure Components Modal */}
        {isConfigModalOpen && (
          <AdminModal
            isOpen={isConfigModalOpen}
            onClose={() => !modalSubmitting && setIsConfigModalOpen(false)}
            title={`Configure Examination Marks – ${currentSubject?.subjectName}`}
            maxWidth="max-w-xl"
          >
            <form onSubmit={handleSaveConfiguration} className="space-y-4">
              <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-400">Class: </span>
                  <span className="text-white font-semibold">{selectedClass?.className}</span>
                </div>
                <div>
                  <span className="text-slate-400">Subject Type: </span>
                  <span
                    className={`font-semibold ${
                      currentSubject?.subjectType === 'CO_CURRICULAR'
                        ? 'text-purple-400'
                        : 'text-blue-400'
                    }`}
                  >
                    {currentSubject?.subjectType === 'CO_CURRICULAR'
                      ? 'Co-curricular (Co-Scholastic)'
                      : 'Academic (Scholastic)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Subject Code: </span>
                  <span className="text-white font-mono font-semibold">{currentSubject?.subjectCode}</span>
                </div>
              </div>

              {modalError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Marks Components
                  </label>
                  <button
                    type="button"
                    onClick={handleAddComponentRow}
                    className="inline-flex items-center text-xs text-blue-400 hover:text-blue-300 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add Component
                  </button>
                </div>

                {componentsList.length === 0 ? (
                  <div className="py-6 px-4 text-center rounded-lg border border-dashed border-slate-700 bg-slate-800/30 text-slate-400">
                    <p className="text-xs font-medium">No examination components added.</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {currentSubject?.subjectType === 'CO_CURRICULAR'
                        ? 'Co-curricular subjects can be saved with zero components for direct overall assessment. Click "Add Component" above if marks components are needed.'
                        : 'Academic subjects can be saved with zero components. Click "Add Component" above to define examination components.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                    {componentsList.map((comp, idx) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-2 bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/60"
                      >
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="e.g. Written, Oral, Practical"
                            value={comp.componentName}
                            onChange={(e) => handleUpdateComponent(idx, 'componentName', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            required
                          />
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            placeholder="Max Marks"
                            min="1"
                            max="500"
                            value={comp.maximumMarks}
                            onChange={(e) => handleUpdateComponent(idx, 'maximumMarks', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-right font-mono"
                            required
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveComponentRow(idx)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Remove Component"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Backend Total Preview */}
              <div className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs text-blue-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium">Total Maximum Marks:</span>
                </div>
                <span className="text-base font-bold text-white font-mono">
                  {liveTotalMarks} marks
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConfigModalOpen(false)}
                  disabled={modalSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center"
                >
                  {modalSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </button>
              </div>
            </form>
          </AdminModal>
        )}

        {/* Copy Configuration Modal */}
        {isCopyModalOpen && (
          <AdminModal
            isOpen={isCopyModalOpen}
            onClose={() => !copySubmitting && setIsCopyModalOpen(false)}
            title="Copy Marks Configuration From Another Class"
            maxWidth="max-w-md"
          >
            <form onSubmit={handleCopyClassConfig} className="space-y-4">
              <p className="text-xs text-slate-400">
                Copy all configured subject marks structures from a configured source class into{' '}
                <strong className="text-white">{selectedClass?.className}</strong>.
                Each class maintains independent records after copying.
              </p>

              {copyError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{copyError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Source Class
                </label>
                <select
                  value={sourceClassId}
                  onChange={(e) => setSourceClassId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                >
                  <option value="">-- Select Source Class --</option>
                  {assignedClasses
                    .filter(
                      (c) => (c.classRef?._id || c.classRef || c._id).toString() !== selectedClassId
                    )
                    .map((item) => {
                      const id = (item.classRef?._id || item.classRef || item._id).toString();
                      const name = item.className || item.classRef?.className || 'Class';
                      return (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  disabled={copySubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={copySubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center"
                >
                  {copySubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Copying...
                    </>
                  ) : (
                    'Copy Configuration'
                  )}
                </button>
              </div>
            </form>
          </AdminModal>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ExaminationSubjectConfigPage;
