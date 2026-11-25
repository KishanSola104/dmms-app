import React, { useState, useEffect, useMemo } from 'react';
import StatusBadge from '../admin/StatusBadge';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  Lock,
  AlertTriangle,
  Loader2,
  Info,
  RefreshCw
} from 'lucide-react';

/**
 * Reusable Marks / Extra Components / Co-curricular Grade Entry Workspace
 * mode: 'EXAM_ACADEMIC' | 'EXTRA_COMPONENT' | 'CO_CURRICULAR'
 */
const TeacherMarksSheetEditor = ({ mode, title, description, badgeLabel }) => {
  const { selectedYear } = useAcademicYear();

  const [academicYearId, setAcademicYearId] = useState(selectedYear?._id || '');
  const [availableYears, setAvailableYears] = useState([]);
  const [examinations, setExaminations] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [resultConfig, setResultConfig] = useState(null);

  // Selected Filters
  const [coCurricularPeriod, setCoCurricularPeriod] = useState('CO_CURRICULAR_TERM'); // or 'CO_CURRICULAR_FINAL'
  const [extraScope, setExtraScope] = useState('CLASS_ADDITIONAL');
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  // Sheet Data
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [rows, setRows] = useState([]);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (selectedYear?._id) {
      setAcademicYearId(selectedYear._id);
    }
  }, [selectedYear?._id]);

  const currentExtraAssignment = useMemo(
    () =>
      assignments.find(
        (a) =>
          a.classId === selectedClassId &&
          a.sectionId === selectedSectionId &&
          a.subjectId === selectedSubjectId
      ) || null,
    [assignments, selectedClassId, selectedSectionId, selectedSubjectId]
  );

  const extraScopeOptions = useMemo(() => {
    if (mode !== 'EXTRA_COMPONENT' || !currentExtraAssignment) return [];
    const opts = [];
    if (currentExtraAssignment.hasClassAdditionalComponents) {
      opts.push({
        value: 'CLASS_ADDITIONAL',
        label: 'Class-Subject Additional / Project'
      });
    }
    const examSet = new Set(currentExtraAssignment.examIdsWithComponents || []);
    examinations.forEach((ex) => {
      if (examSet.has(ex._id)) {
        opts.push({
          value: ex._id,
          label: `Exam: ${ex.examinationName} (${ex.examinationCode})`
        });
      }
    });
    return opts;
  }, [mode, currentExtraAssignment, examinations]);

  useEffect(() => {
    if (mode === 'EXTRA_COMPONENT' && extraScopeOptions.length > 0) {
      if (!extraScopeOptions.some((o) => o.value === extraScope)) {
        setExtraScope(extraScopeOptions[0].value);
      }
    }
  }, [mode, extraScopeOptions, extraScope]);

  // Determine active entryType for API
  const activeEntryType =
    mode === 'EXAM_ACADEMIC'
      ? 'EXAM_ACADEMIC'
      : mode === 'EXTRA_COMPONENT'
      ? extraScope === 'CLASS_ADDITIONAL' || !extraScope
        ? 'EXTRA_COMPONENT'
        : 'EXAM_ACADEMIC'
      : coCurricularPeriod;

  const effectiveExamId =
    mode === 'EXTRA_COMPONENT' && extraScope && extraScope !== 'CLASS_ADDITIONAL'
      ? extraScope
      : selectedExamId;

  const needsExamSelection =
    activeEntryType === 'EXAM_ACADEMIC' || activeEntryType === 'CO_CURRICULAR_TERM';

  // Fetch authorized filter options
  const fetchOptions = async () => {
    setLoadingOptions(true);
    setFeedback({ type: '', message: '' });
    try {
      const params = new URLSearchParams({ mode });
      if (academicYearId) params.append('academicYearId', academicYearId);

      const res = await api.get(`/teacher/marks/options?${params.toString()}`);
      if (res.success) {
        setAvailableYears(res.availableAcademicYears || []);
        if (res.selectedAcademicYear?._id && !academicYearId) {
          setAcademicYearId(res.selectedAcademicYear._id);
        }
        setExaminations(res.examinations || []);
        setAssignments(res.assignments || []);
        setResultConfig(res.resultConfig || null);

        // Reset invalid downstream selections cleanly
        const exams = res.examinations || [];
        const assigns = res.assignments || [];

        if (exams.length > 0 && !exams.some(e => e._id === selectedExamId)) {
          setSelectedExamId(exams[0]._id);
        } else if (exams.length === 0) {
          setSelectedExamId('');
        }

        if (assigns.length > 0) {
          const validPair = assigns.find(
            a => a.classId === selectedClassId && a.sectionId === selectedSectionId && a.subjectId === selectedSubjectId
          );
          if (!validPair) {
            setSelectedClassId(assigns[0].classId);
            setSelectedSectionId(assigns[0].sectionId);
            setSelectedSubjectId(assigns[0].subjectId);
          }
        } else {
          setSelectedClassId('');
          setSelectedSectionId('');
          setSelectedSubjectId('');
        }
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load assigned options.' });
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, [academicYearId, mode]);

  // Cascade Class -> Section -> Subject options from authorized assignments
  const classOptions = useMemo(() => {
    const map = new Map();
    assignments.forEach(a => {
      if (!map.has(a.classId)) {
        map.set(a.classId, { classId: a.classId, className: a.className, classCode: a.classCode });
      }
    });
    return Array.from(map.values());
  }, [assignments]);

  const sectionOptions = useMemo(() => {
    const map = new Map();
    assignments
      .filter(a => a.classId === selectedClassId)
      .forEach(a => {
        if (!map.has(a.sectionId)) {
          map.set(a.sectionId, { sectionId: a.sectionId, sectionName: a.sectionName, sectionCode: a.sectionCode });
        }
      });
    return Array.from(map.values());
  }, [assignments, selectedClassId]);

  const subjectOptions = useMemo(() => {
    return assignments.filter(a => a.classId === selectedClassId && a.sectionId === selectedSectionId);
  }, [assignments, selectedClassId, selectedSectionId]);

  // Keep section & subject synchronized on class change
  useEffect(() => {
    if (sectionOptions.length > 0 && !sectionOptions.some(s => s.sectionId === selectedSectionId)) {
      setSelectedSectionId(sectionOptions[0].sectionId);
    }
  }, [sectionOptions, selectedSectionId]);

  useEffect(() => {
    if (subjectOptions.length > 0 && !subjectOptions.some(s => s.subjectId === selectedSubjectId)) {
      setSelectedSubjectId(subjectOptions[0].subjectId);
    }
  }, [subjectOptions, selectedSubjectId]);

  // Fetch Student Sheet whenever selection is ready
  const fetchSheet = async () => {
    if (!selectedClassId || !selectedSectionId || !selectedSubjectId) {
      setSheet(null);
      setRows([]);
      return;
    }
    if (needsExamSelection && !effectiveExamId) {
      setSheet(null);
      setRows([]);
      return;
    }

    setLoadingSheet(true);
    setFeedback({ type: '', message: '' });
    try {
      const params = new URLSearchParams({
        classId: selectedClassId,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
        entryType: activeEntryType
      });
      if (academicYearId) params.append('academicYearId', academicYearId);
      if (needsExamSelection && effectiveExamId) params.append('examinationId', effectiveExamId);

      const res = await api.get(`/teacher/marks/sheet?${params.toString()}`);
      if (res.success) {
        setSheet(res);
        setRows(
          (res.students || []).map(st => ({
            ...st,
            componentMarks: (st.componentMarks || []).map(cm => ({
              ...cm,
              marksObtained: cm.marksObtained !== null && cm.marksObtained !== undefined ? String(cm.marksObtained) : ''
            })),
            grade: st.grade || '',
            isAbsent: !!st.isAbsent,
            remarks: st.remarks || ''
          }))
        );
      }
    } catch (err) {
      setSheet(null);
      setRows([]);
      setFeedback({ type: 'error', message: err.message || 'Unable to load marks sheet for selected filters.' });
    } finally {
      setLoadingSheet(false);
    }
  };

  useEffect(() => {
    if (!loadingOptions) {
      fetchSheet();
    }
  }, [loadingOptions, academicYearId, effectiveExamId, selectedClassId, selectedSectionId, selectedSubjectId, activeEntryType]);

  const handleComponentChange = (studentIdx, compName, val) => {
    setRows(prev => {
      const copy = [...prev];
      const row = { ...copy[studentIdx] };
      row.componentMarks = row.componentMarks.map(cm =>
        cm.componentName === compName ? { ...cm, marksObtained: val } : cm
      );
      copy[studentIdx] = row;
      return copy;
    });
  };

  const handleRowFieldChange = (studentIdx, field, val) => {
    setRows(prev => {
      const copy = [...prev];
      const row = { ...copy[studentIdx], [field]: val };
      if (field === 'isAbsent' && val === true) {
        row.componentMarks = row.componentMarks.map(cm => ({ ...cm, marksObtained: '0' }));
        row.grade = '';
      }
      copy[studentIdx] = row;
      return copy;
    });
  };

  const computeRowTotal = (row) => {
    if (row.isAbsent) return 0;
    let sum = 0;
    let hasAny = false;
    for (const cm of row.componentMarks || []) {
      if (cm.marksObtained !== '' && cm.marksObtained !== null && cm.marksObtained !== undefined) {
        const n = Number(cm.marksObtained);
        if (!isNaN(n)) {
          sum += n;
          hasAny = true;
        }
      }
    }
    return hasAny ? sum : '—';
  };

  const validateClientSide = (actionType) => {
    const isCoCurricular = activeEntryType === 'CO_CURRICULAR_TERM' || activeEntryType === 'CO_CURRICULAR_FINAL';
    for (const row of rows) {
      if (isCoCurricular) {
        if (actionType === 'SUBMIT' && !row.isAbsent && !row.grade) {
          return `Please select a grade for ${row.studentName} (or mark Absent) before submitting.`;
        }
      } else {
        for (const cm of row.componentMarks || []) {
          if (row.isAbsent) continue;
          if (cm.marksObtained === '' || cm.marksObtained === null) {
            if (actionType === 'SUBMIT') {
              return `Please enter marks for '${cm.componentName}' (${row.studentName}) before submitting.`;
            }
            continue;
          }
          const n = Number(cm.marksObtained);
          if (isNaN(n) || n < 0) {
            return `Marks for '${cm.componentName}' (${row.studentName}) cannot be negative.`;
          }
          if (n > cm.maximumMarks) {
            return `Marks for '${cm.componentName}' (${row.studentName}) cannot exceed ${cm.maximumMarks}.`;
          }
        }
      }
    }
    return null;
  };

  const handleSaveOrSubmit = async (actionType) => {
    setFeedback({ type: '', message: '' });
    const validationErr = validateClientSide(actionType);
    if (validationErr) {
      setFeedback({ type: 'error', message: validationErr });
      return;
    }

    if (
      actionType === 'SUBMIT' &&
      !window.confirm('Once submitted, marks will be locked until reviewed by the Class Teacher. Continue?')
    ) {
      return;
    }

    setSaving(true);
    try {
      const payloadEntries = rows.map(r => ({
        studentId: r.studentId,
        isAbsent: r.isAbsent,
        remarks: r.remarks,
        grade: r.grade || null,
        componentMarks: (r.componentMarks || []).map(cm => ({
          componentName: cm.componentName,
          marksObtained: cm.marksObtained === '' ? null : Number(cm.marksObtained)
        }))
      }));

      const res = await api.post('/teacher/marks/save', {
        academicYearId,
        examinationId: needsExamSelection ? effectiveExamId : null,
        classId: selectedClassId,
        sectionId: selectedSectionId,
        subjectId: selectedSubjectId,
        entryType: activeEntryType,
        action: actionType,
        entries: payloadEntries
      });

      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        await fetchSheet();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save marks.' });
    } finally {
      setSaving(false);
    }
  };

  const isCoCurricular = activeEntryType === 'CO_CURRICULAR_TERM' || activeEntryType === 'CO_CURRICULAR_FINAL';
  const showFinalCoCurricularOption =
    mode === 'CO_CURRICULAR' && resultConfig?.coCurricularConfig?.finalWorkflow === 'SEPARATE_SUBMISSION';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded">
            {badgeLabel}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={fetchOptions}
          className="inline-flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Reload
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Academic Year</label>
          <select
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
            className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            {availableYears.map((y) => (
              <option key={y._id} value={y._id}>
                {y.yearName || y.yearCode} {y.isCurrent ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        {mode === 'CO_CURRICULAR' && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Assessment Period</label>
            <select
              value={coCurricularPeriod}
              onChange={(e) => setCoCurricularPeriod(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="CO_CURRICULAR_TERM">Term Examination Grades</option>
              {showFinalCoCurricularOption && (
                <option value="CO_CURRICULAR_FINAL">Separate Final Grades (Option B)</option>
              )}
            </select>
          </div>
        )}

        {mode === 'EXTRA_COMPONENT' && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">
              Assessment Scope
            </label>
            <select
              value={extraScope}
              onChange={(e) => setExtraScope(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              {extraScopeOptions.length === 0 ? (
                <option value="">No extra components configured</option>
              ) : (
                extraScopeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {mode !== 'EXTRA_COMPONENT' && needsExamSelection && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Examination</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
            >
              {examinations.length === 0 ? (
                <option value="">No examinations available</option>
              ) : (
                examinations.map((ex) => (
                  <option key={ex._id} value={ex._id}>
                    {ex.examinationName} ({ex.examinationCode})
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Class</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            {classOptions.length === 0 ? (
              <option value="">No assigned classes</option>
            ) : (
              classOptions.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.className} ({c.classCode})
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Section</label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            {sectionOptions.length === 0 ? (
              <option value="">No assigned sections</option>
            ) : (
              sectionOptions.map((s) => (
                <option key={s.sectionId} value={s.sectionId}>
                  {s.sectionName}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Subject</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg"
          >
            {subjectOptions.length === 0 ? (
              <option value="">No assigned subjects</option>
            ) : (
              subjectOptions.map((sub) => (
                <option key={sub.subjectId} value={sub.subjectId}>
                  {sub.subjectName} ({sub.subjectCode})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Feedback Alerts */}
      {feedback.message && (
        <div
          className={`p-3.5 rounded-xl border flex items-start space-x-2.5 text-xs ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Sheet Area */}
      {loadingOptions || loadingSheet ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading marks entry sheet...</p>
        </div>
      ) : !sheet ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500 space-y-1">
          <Info className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">No marks entry sheet available for this selection.</p>
          <p>
            {assignments.length === 0
              ? 'You currently have no matching subject assignments for this academic year.'
              : 'Select a valid examination, class, section, and configured subject above.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Subject & Submission Status Banner */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  {sheet.assignment?.subjectName} ({sheet.assignment?.subjectCode})
                </h2>
                <span className="text-xs text-slate-500">
                  &bull; {sheet.assignment?.className} - {sheet.assignment?.sectionName}
                </span>
                {sheet.examination && (
                  <span className="text-xs font-semibold text-indigo-700">
                    &bull; {sheet.examination.examinationName}
                  </span>
                )}
                <StatusBadge status={sheet.submission?.status || 'DRAFT'} />
                {activeEntryType === 'CO_CURRICULAR_FINAL' && sheet.submission?.requestedAt && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                    Requested by Class Teacher
                  </span>
                )}
              </div>

              {!isCoCurricular && (
                <p className="text-xs text-slate-600">
                  Maximum Marks: <strong>{sheet.totalMaximumMarks}</strong> &bull; Passing Marks ({sheet.passingPercentage}%):{' '}
                  <strong>{sheet.passingMarks}</strong> &bull; Components:{' '}
                  {sheet.components?.map(c => `${c.componentName} (${c.maximumMarks})`).join(', ') || 'None'}
                </p>
              )}
              {isCoCurricular && (
                <p className="text-xs text-slate-600">
                  Allowed Grades: <strong>{(sheet.gradeOptions || []).map(g => g.grade).join(', ')}</strong>
                </p>
              )}
            </div>

            {sheet.isLocked ? (
              <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                <Lock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                Locked ({sheet.submission?.status})
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={saving || rows.length === 0}
                  onClick={() => handleSaveOrSubmit('DRAFT')}
                  className="inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Draft
                </button>
                <button
                  type="button"
                  disabled={saving || rows.length === 0}
                  onClick={() => handleSaveOrSubmit('SUBMIT')}
                  className="inline-flex items-center px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {sheet.submission?.status === 'RETURNED' ? 'Resubmit Corrected' : 'Submit'}
                </button>
              </div>
            )}
          </div>

          {/* Return Reason Warning if Returned */}
          {sheet.submission?.status === 'RETURNED' && sheet.submission?.returnReason && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Returned by Class Teacher for Correction</p>
                <p className="mt-0.5">Reason: {sheet.submission.returnReason}</p>
              </div>
            </div>
          )}

          {/* Student Marks / Grades Entry Table */}
          {rows.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No active enrolled students found in {sheet.assignment?.className} - {sheet.assignment?.sectionName}.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      <th className="py-3 px-4">Roll No</th>
                      <th className="py-3 px-4">Student Name</th>
                      {!isCoCurricular ? (
                        <>
                          {(sheet.components || []).map((comp) => (
                            <th key={comp.componentName} className="py-3 px-3 text-center">
                              {comp.componentName} <span className="text-slate-400">(/{comp.maximumMarks})</span>
                            </th>
                          ))}
                          <th className="py-3 px-3 text-center">Max Marks</th>
                          <th className="py-3 px-3 text-center">Marks Obtained</th>
                        </>
                      ) : (
                        <th className="py-3 px-4">Grade</th>
                      )}
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, idx) => (
                      <tr key={row.studentId} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-mono text-slate-600">{row.rollNumber}</td>
                        <td className="py-2.5 px-4">
                          <p className="font-semibold text-slate-900">{row.studentName}</p>
                          <p className="text-[10px] font-mono text-slate-400">{row.admissionNumber}</p>
                        </td>

                        {!isCoCurricular ? (
                          <>
                            {(row.componentMarks || []).map((cm) => (
                              <td key={cm.componentName} className="py-2.5 px-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={cm.maximumMarks}
                                  step="0.5"
                                  disabled={sheet.isLocked || row.isAbsent}
                                  value={row.isAbsent ? '0' : cm.marksObtained}
                                  onChange={(e) => handleComponentChange(idx, cm.componentName, e.target.value)}
                                  className="w-20 px-2 py-1.5 text-center font-mono border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              </td>
                            ))}
                            <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-600">
                              {sheet.totalMaximumMarks}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">
                              {row.isAbsent ? 'AB (0)' : computeRowTotal(row)}
                            </td>
                          </>
                        ) : (
                          <td className="py-2.5 px-4">
                            <select
                              disabled={sheet.isLocked || row.isAbsent}
                              value={row.isAbsent ? '' : row.grade}
                              onChange={(e) => handleRowFieldChange(idx, 'grade', e.target.value)}
                              className="w-40 px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100"
                            >
                              <option value="">-- Select Grade --</option>
                              {(sheet.gradeOptions || []).map((opt) => (
                                <option key={opt.grade} value={opt.grade}>
                                  {opt.grade} {opt.label ? `(${opt.label})` : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                        )}

                        <td className="py-2.5 px-3 text-center">
                          <select
                            disabled={sheet.isLocked}
                            value={row.isAbsent ? 'ABSENT' : 'PRESENT'}
                            onChange={(e) => handleRowFieldChange(idx, 'isAbsent', e.target.value === 'ABSENT')}
                            className={`px-2 py-1 rounded-lg border text-[11px] font-semibold ${
                              row.isAbsent
                                ? 'bg-rose-50 border-rose-200 text-rose-700'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}
                          >
                            <option value="PRESENT">Present</option>
                            <option value="ABSENT">Absent</option>
                          </select>
                        </td>

                        <td className="py-2.5 px-4">
                          <input
                            type="text"
                            disabled={sheet.isLocked}
                            value={row.remarks}
                            onChange={(e) => handleRowFieldChange(idx, 'remarks', e.target.value)}
                            placeholder="Optional remark"
                            className="w-full min-w-[140px] px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white disabled:bg-slate-100"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherMarksSheetEditor;
