import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminModal from '../../components/admin/AdminModal';
import StatusBadge from '../../components/admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  TrendingUp,
  ArrowRight,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  X,
  RotateCcw
} from 'lucide-react';

const StudentPromotionPage = () => {
  const navigate = useNavigate();
  const { academicYears } = useAcademicYear();

  // Academic Year Selection
  const [previousAyId, setPreviousAyId] = useState('');
  const [nextAyId, setNextAyId] = useState('');

  // Classes & Sections
  const [classes, setClasses] = useState([]);
  const [sourceClassId, setSourceClassId] = useState('');
  const [sourceSections, setSourceSections] = useState([]);
  const [sourceSectionId, setSourceSectionId] = useState('ALL');

  // Destination Class & Sections
  const [destClassId, setDestClassId] = useState('');
  const [destSections, setDestSections] = useState([]);

  // Loaded Source Students
  const [sourceStudents, setSourceStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [studentActions, setStudentActions] = useState({}); // { [studentId]: 'PROMOTE' | 'REPEAT' }

  // Distribution Settings
  const [sectionMethod, setSectionMethod] = useState('AUTO'); // 'AUTO' | 'MANUAL'
  const [manualSectionMap, setManualSectionMap] = useState({}); // { [studentId]: sectionId }
  const [rollMethod, setRollMethod] = useState('AUTO'); // 'AUTO' | 'MANUAL'
  const [manualRollMap, setManualRollMap] = useState({}); // { [studentId]: rollNumber }

  // Preview & Review State
  const [previewData, setPreviewData] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [editableAssignments, setEditableAssignments] = useState([]);

  // Execution Modal & Status
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);

  const [alert, setAlert] = useState({ type: '', message: '' });

  // Initialize AYs
  useEffect(() => {
    if (academicYears.length >= 2) {
      // Find current year as previous AY, and next year
      const current = academicYears.find((y) => y.isCurrent) || academicYears[0];
      setPreviousAyId(current._id);

      // Find an academic year with a start date after current start date
      const nextY = academicYears.find(
        (y) => y._id !== current._id && new Date(y.startDate) > new Date(current.startDate)
      );
      if (nextY) {
        setNextAyId(nextY._id);
      } else {
        const remaining = academicYears.filter((y) => y._id !== current._id);
        if (remaining.length > 0) setNextAyId(remaining[0]._id);
      }
    } else if (academicYears.length === 1) {
      setPreviousAyId(academicYears[0]._id);
    }
  }, [academicYears]);

  // Load Classes
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/admin/classes?status=ACTIVE&limit=100');
        if (res.success && res.classes.length > 0) {
          setClasses(res.classes);
          if (!sourceClassId) {
            setSourceClassId(res.classes[0]._id);
            // Default destination to next class if available
            if (res.classes.length > 1) {
              setDestClassId(res.classes[1]._id);
            } else {
              setDestClassId(res.classes[0]._id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load classes:', err);
      }
    };
    fetchClasses();
  }, []);

  // Load Source Sections
  useEffect(() => {
    if (sourceClassId) {
      const fetchSections = async () => {
        try {
          const res = await api.get(`/admin/sections?classId=${sourceClassId}&status=ACTIVE&limit=100`);
          if (res.success) {
            setSourceSections(res.sections || []);
            setSourceSectionId('ALL');
          }
        } catch (err) {
          console.error('Failed to load source sections:', err);
        }
      };
      fetchSections();
    }
  }, [sourceClassId]);

  // Load Destination Sections
  useEffect(() => {
    if (destClassId) {
      const fetchSections = async () => {
        try {
          const res = await api.get(`/admin/sections?classId=${destClassId}&status=ACTIVE&limit=100`);
          if (res.success) {
            setDestSections(res.sections || []);
          }
        } catch (err) {
          console.error('Failed to load dest sections:', err);
        }
      };
      fetchSections();
    }
  }, [destClassId]);

  // Fetch Source Students
  const handleLoadStudents = async () => {
    if (!previousAyId || !sourceClassId) {
      setAlert({ type: 'error', message: 'Please select both Previous Academic Year and Source Class.' });
      return;
    }

    setLoadingStudents(true);
    setPreviewData(null);
    setExecutionResult(null);

    try {
      const params = new URLSearchParams({
        previousAcademicYearRef: previousAyId,
        classRef: sourceClassId
      });
      if (nextAyId) {
        params.append('nextAcademicYearRef', nextAyId);
      }
      if (sourceSectionId && sourceSectionId !== 'ALL') {
        params.append('sectionRef', sourceSectionId);
      }

      const res = await api.get(`/admin/promotions/source-students?${params.toString()}`);
      if (res.success) {
        setSourceStudents(res.students || []);

        // Pre-select all students who are NOT already enrolled in next year
        const eligible = new Set();
        const initialActions = {};
        (res.students || []).forEach((s) => {
          if (!s.isAlreadyEnrolledInNextYear) {
            eligible.add(s.studentId);
          }
          initialActions[s.studentId] = 'PROMOTE';
        });

        setSelectedStudentIds(eligible);
        setStudentActions(initialActions);

        if ((res.students || []).length === 0) {
          setAlert({ type: 'error', message: 'No students found enrolled in the selected source class and year.' });
        }
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to load source students.' });
    } finally {
      setLoadingStudents(false);
    }
  };

  // Toggle Single Student Selection
  const toggleStudentSelection = (studentId) => {
    const next = new Set(selectedStudentIds);
    if (next.has(studentId)) {
      next.delete(studentId);
    } else {
      next.add(studentId);
    }
    setSelectedStudentIds(next);
  };

  // Toggle All Selection
  const toggleSelectAll = () => {
    const eligibleStudents = sourceStudents.filter((s) => !s.isAlreadyEnrolledInNextYear);
    if (selectedStudentIds.size === eligibleStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(eligibleStudents.map((s) => s.studentId)));
    }
  };

  // Change action for student (PROMOTE vs REPEAT)
  const setActionForStudent = (studentId, action) => {
    setStudentActions((prev) => ({ ...prev, [studentId]: action }));
  };

  // Preview Distribution
  const handleGeneratePreview = async () => {
    if (selectedStudentIds.size === 0) {
      setAlert({ type: 'error', message: 'Please select at least one student to promote or repeat.' });
      return;
    }
    if (!nextAyId) {
      setAlert({ type: 'error', message: 'Please select the Destination Academic Year.' });
      return;
    }
    if (!destClassId) {
      setAlert({ type: 'error', message: 'Please select Destination Class.' });
      return;
    }

    setPreviewing(true);
    setAlert({ type: '', message: '' });

    try {
      const selectedList = sourceStudents
        .filter((s) => selectedStudentIds.has(s.studentId))
        .map((s) => ({
          studentId: s.studentId,
          enrollmentId: s.enrollmentId,
          studentName: s.fullName,
          admissionNumber: s.admissionNumber,
          action: studentActions[s.studentId] || 'PROMOTE'
        }));

      if (sectionMethod === 'AUTO') {
        const res = await api.post('/admin/promotions/preview-distribution', {
          nextAcademicYearRef: nextAyId,
          destinationClassRef: destClassId,
          targetSectionRefs: destSections.map((s) => s._id),
          students: selectedList,
          rollNumberMethod: rollMethod
        });

        if (res.success) {
          setPreviewData(res);
          setEditableAssignments(res.assignments || []);
        }
      } else {
        // Manual section assignment
        const assignments = selectedList.map((s, idx) => {
          const chosenSecId = manualSectionMap[s.studentId] || (destSections[0]?._id || '');
          const secObj = destSections.find((ds) => ds._id === chosenSecId);
          return {
            studentId: s.studentId,
            previousEnrollmentId: s.enrollmentId,
            studentName: s.studentName,
            admissionNumber: s.admissionNumber,
            action: s.action,
            destinationClassRef: destClassId,
            destinationSectionRef: chosenSecId,
            destinationSectionName: secObj?.sectionName || 'Section A',
            rollNumber: manualRollMap[s.studentId] || (rollMethod === 'AUTO' ? String(idx + 1) : '')
          };
        });

        setPreviewData({ assignments, unassigned: [] });
        setEditableAssignments(assignments);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to generate distribution preview.' });
    } finally {
      setPreviewing(false);
    }
  };

  // Modify assignment in editable preview
  const handleUpdateAssignment = (index, field, value) => {
    const updated = [...editableAssignments];
    if (field === 'destinationSectionRef') {
      const secObj = destSections.find((s) => s._id === value);
      updated[index].destinationSectionRef = value;
      updated[index].destinationSectionName = secObj?.sectionName || '';
    } else {
      updated[index][field] = value;
    }
    setEditableAssignments(updated);
  };

  // Confirm & Execute Promotion
  const handleExecutePromotion = async () => {
    setExecuting(true);
    try {
      const payload = {
        previousAcademicYearRef: previousAyId,
        nextAcademicYearRef: nextAyId,
        promotions: editableAssignments.map((a) => ({
          studentId: a.studentId,
          previousEnrollmentId: a.previousEnrollmentId,
          action: a.action,
          destinationClassRef: a.destinationClassRef,
          destinationSectionRef: a.destinationSectionRef,
          rollNumber: a.rollNumber,
          remarks: a.action === 'REPEAT' ? 'Repeating class' : 'Promoted to next grade'
        }))
      };

      const res = await api.post('/admin/promotions/execute', payload);
      if (res.success) {
        setExecutionResult(res);
        setConfirmModalOpen(false);
        setAlert({
          type: 'success',
          message: `Promotion complete! ${res.successful} students successfully enrolled in next year.`
        });
        // Reload students
        handleLoadStudents();
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to execute promotions.' });
    } finally {
      setExecuting(false);
    }
  };

  const eligibleCount = sourceStudents.filter((s) => !s.isAlreadyEnrolledInNextYear).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <AdminPageHeader
          title="Student Promotion Management"
          subtitle="Promote students to higher classes, manage repeating students, and distribute sections across academic years."
        />

        {/* Global Alert Notification */}
        {alert.message && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between border shadow-sm animate-in fade-in duration-200 ${
              alert.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{alert.message}</p>
            </div>
            <button
              onClick={() => setAlert({ type: '', message: '' })}
              className="p-1 hover:bg-black/5 rounded-lg text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 1: Academic Year & Source Selection Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 font-bold text-slate-800 text-sm">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Step 1: Academic Years &amp; Source Class</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Previous AY */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Previous Academic Year (From)</label>
              <select
                value={previousAyId}
                onChange={(e) => setPreviousAyId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {academicYears.map((ay) => (
                  <option key={ay._id} value={ay._id}>
                    {ay.yearName} {ay.isCurrent ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Next AY */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Next Academic Year (To)</label>
              <select
                value={nextAyId}
                onChange={(e) => setNextAyId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Next Academic Year</option>
                {academicYears.map((ay) => (
                  <option key={ay._id} value={ay._id} disabled={ay._id === previousAyId}>
                    {ay.yearName} {ay._id === previousAyId ? '(Source)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Source Class */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Source Class</label>
              <select
                value={sourceClassId}
                onChange={(e) => setSourceClassId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {classes.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.className}
                  </option>
                ))}
              </select>
            </div>

            {/* Source Section */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">Source Section (Optional)</label>
              <select
                value={sourceSectionId}
                onChange={(e) => setSourceSectionId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Sections</option>
                {sourceSections.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.sectionName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleLoadStudents}
              disabled={loadingStudents || !previousAyId || !sourceClassId}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center space-x-2"
            >
              {loadingStudents ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading Students...</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>Load Enrolled Students</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* STEP 2: Loaded Source Students & Action Selection */}
        {sourceStudents.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center space-x-3">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Select Students to Promote / Retain
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    ({selectedStudentIds.size} of {eligibleCount} eligible selected)
                  </span>
                </h3>
              </div>

              <div className="flex items-center space-x-3 text-xs">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="font-semibold text-blue-600 hover:text-blue-800"
                >
                  {selectedStudentIds.size === eligibleCount ? 'Deselect All' : 'Select All Eligible'}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={eligibleCount > 0 && selectedStudentIds.size === eligibleCount}
                        onChange={toggleSelectAll}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Adm No</th>
                    <th className="py-3 px-4">Current Section</th>
                    <th className="py-3 px-4">Current Roll</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Next Year Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {sourceStudents.map((st) => (
                    <tr
                      key={st.studentId}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        st.isAlreadyEnrolledInNextYear ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          disabled={st.isAlreadyEnrolledInNextYear}
                          checked={selectedStudentIds.has(st.studentId)}
                          onChange={() => toggleStudentSelection(st.studentId)}
                          className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                        />
                      </td>

                      {/* Student Name */}
                      <td className="py-3 px-4 font-bold text-slate-900">{st.fullName}</td>

                      {/* Adm No */}
                      <td className="py-3 px-4 font-mono text-slate-700">{st.admissionNumber}</td>

                      {/* Section */}
                      <td className="py-3 px-4 text-slate-700">{st.sectionName}</td>

                      {/* Roll */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {st.rollNumber ? `#${st.rollNumber}` : '—'}
                      </td>

                      {/* Action Pill / Dropdown */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <button
                            type="button"
                            disabled={st.isAlreadyEnrolledInNextYear}
                            onClick={() => setActionForStudent(st.studentId, 'PROMOTE')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                              (studentActions[st.studentId] || 'PROMOTE') === 'PROMOTE'
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            Promote
                          </button>
                          <button
                            type="button"
                            disabled={st.isAlreadyEnrolledInNextYear}
                            onClick={() => setActionForStudent(st.studentId, 'REPEAT')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                              studentActions[st.studentId] === 'REPEAT'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            Repeat
                          </button>
                        </div>
                      </td>

                      {/* Next Year Status */}
                      <td className="py-3 px-4">
                        {st.isAlreadyEnrolledInNextYear ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold rounded text-[10px] border border-blue-200">
                            Already in {st.nextYearPlacement?.className} - {st.nextYearPlacement?.sectionName}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Not enrolled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 3: Destination Configuration & Distribution Parameters */}
        {selectedStudentIds.size > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 font-bold text-slate-800 text-sm">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Step 2: Destination Placement &amp; Distribution Rules</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Destination Class */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Destination Class *</label>
                <select
                  value={destClassId}
                  onChange={(e) => setDestClassId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {classes.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.className}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Assignment Method */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Section Distribution *</label>
                <select
                  value={sectionMethod}
                  onChange={(e) => setSectionMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AUTO">Automatic Balanced Distribution</option>
                  <option value="MANUAL">Manual Section Assignment</option>
                </select>
              </div>

              {/* Roll Number Method */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Roll Number Generation *</label>
                <select
                  value={rollMethod}
                  onChange={(e) => setRollMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AUTO">Automatic Sequential Roll Numbers</option>
                  <option value="MANUAL">Manual Roll Numbers</option>
                </select>
              </div>
            </div>

            {/* Destination Active Sections Overview */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                Destination Sections in {classes.find((c) => c._id === destClassId)?.className}:
              </span>
              <div className="flex flex-wrap gap-3">
                {destSections.length === 0 ? (
                  <span className="text-xs text-red-500 font-medium">
                    No active sections found for this destination class. Please create sections first.
                  </span>
                ) : (
                  destSections.map((s) => (
                    <div
                      key={s._id}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 flex items-center space-x-2"
                    >
                      <span className="font-bold">{s.sectionName}</span>
                      <span className="text-slate-400">|</span>
                      <span className="text-slate-500">Max Cap: {s.maxCapacity}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleGeneratePreview}
                disabled={previewing || destSections.length === 0}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-sm disabled:opacity-50 flex items-center space-x-2"
              >
                {previewing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Calculating Distribution...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Preview Proposed Placement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Review Proposed Assignments & Confirm */}
        {previewData && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Step 3: Review Proposed Placement &amp; Assignments
                </h3>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg border border-emerald-200">
                {editableAssignments.length} Assignments Ready
              </span>
            </div>

            {/* Capacity Warnings if any unassigned */}
            {previewData.unassigned && previewData.unassigned.length > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl space-y-2">
                <div className="flex items-center space-x-2 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>
                    Capacity Restriction: {previewData.unassigned.length} student(s) could not be assigned!
                  </span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-amber-700">
                  {previewData.unassigned.map((u, i) => (
                    <li key={i}>
                      <strong>{u.studentName}</strong> ({u.admissionNumber}): {u.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Assignments Table with Inline Adjustments */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Adm No</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Assigned Section</th>
                    <th className="py-3 px-4">Assigned Roll No</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editableAssignments.map((a, index) => (
                    <tr key={a.studentId} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{a.studentName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{a.admissionNumber}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            a.action === 'REPEAT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {a.action}
                        </span>
                      </td>
                      {/* Section Dropdown */}
                      <td className="py-3 px-4">
                        <select
                          value={a.destinationSectionRef}
                          onChange={(e) =>
                            handleUpdateAssignment(index, 'destinationSectionRef', e.target.value)
                          }
                          className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                        >
                          {destSections.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.sectionName}
                            </option>
                          ))}
                        </select>
                      </td>
                      {/* Roll Number Input */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={a.rollNumber}
                          onChange={(e) =>
                            handleUpdateAssignment(index, 'rollNumber', e.target.value)
                          }
                          placeholder="e.g. 1"
                          className="w-20 px-2 py-1 text-xs border border-slate-300 rounded-lg font-mono font-bold"
                        >
                        </input>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(true)}
                disabled={editableAssignments.length === 0}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-sm flex items-center space-x-2"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Confirm &amp; Execute Promotion ({editableAssignments.length} Students)</span>
              </button>
            </div>
          </div>
        )}

        {/* CONFIRMATION MODAL */}
        <AdminModal
          isOpen={confirmModalOpen}
          onClose={() => setConfirmModalOpen(false)}
          title="Confirm Student Promotion & Retention"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-800">
              Are you sure you want to promote{' '}
              <strong>{editableAssignments.length} student(s)</strong> into the selected academic year?
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 text-slate-600">
              <p>• Previous academic year enrollments will be marked as COMPLETED.</p>
              <p>• New active enrollments will be created with assigned sections &amp; roll numbers.</p>
              <p>• Promotion and repetition audit history will be permanently logged.</p>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={executing}
                onClick={handleExecutePromotion}
                className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-sm disabled:opacity-50 flex items-center space-x-2"
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <span>Yes, Execute Promotion</span>
                )}
              </button>
            </div>
          </div>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default StudentPromotionPage;
