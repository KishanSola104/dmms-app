import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminModal from '../../components/admin/AdminModal';
import { useAcademicYear } from '../../context/AcademicYearContext';
import api from '../../services/api';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  FileText,
  Users,
  Building2,
  Calendar,
  Layers,
  ArrowRight
} from 'lucide-react';

const StudentImportPage = () => {
  const navigate = useNavigate();
  const { academicYears, selectedAcademicYear } = useAcademicYear();

  const [importType, setImportType] = useState('NEW_ADMISSION');
  const [academicYearId, setAcademicYearId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // Preview State
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [activeTab, setActiveTab] = useState('valid'); // 'valid' | 'invalid'

  // Commit State
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);

  const [alert, setAlert] = useState({ type: '', message: '' });

  useEffect(() => {
    if (selectedAcademicYear?._id && !academicYearId) {
      setAcademicYearId(selectedAcademicYear._id);
    } else if (academicYears.length > 0 && !academicYearId) {
      const current = academicYears.find((y) => y.isCurrent) || academicYears[0];
      setAcademicYearId(current._id);
    }
  }, [selectedAcademicYear, academicYears]);

  // Download Template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(
        `http://127.0.0.1:8000/api/admin/students/import/template?importType=${importType}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'x-school-token': localStorage.getItem('schoolToken') || ''
          }
        }
      );
      if (!response.ok) throw new Error('Failed to download template.');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DMMS_Student_Import_Template_${importType}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to download template.' });
    }
  };

  // Handle File Change
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setAlert({ type: 'error', message: 'Please select an Excel file (.xlsx or .xls).' });
        return;
      }
      setSelectedFile(file);
      setPreviewData(null);
      setCommitResult(null);
      setAlert({ type: '', message: '' });
    }
  };

  // Upload & Preview
  const handlePreviewUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setAlert({ type: 'error', message: 'Please select an Excel file to upload.' });
      return;
    }
    if (!academicYearId) {
      setAlert({ type: 'error', message: 'Please select a target Academic Year.' });
      return;
    }

    setPreviewing(true);
    setAlert({ type: '', message: '' });
    setPreviewData(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('academicYearRef', academicYearId);
    formData.append('importType', importType);

    try {
      const res = await api.post('/admin/students/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.success) {
        setPreviewData(res);
        if (res.invalidCount > 0 && res.validCount === 0) {
          setActiveTab('invalid');
        } else {
          setActiveTab('valid');
        }
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to parse Excel file.' });
    } finally {
      setPreviewing(false);
    }
  };

  // Commit Import
  const handleCommitImport = async () => {
    if (!previewData || previewData.validRows.length === 0) return;

    setCommitting(true);
    try {
      const res = await api.post('/admin/students/import/commit', {
        academicYearRef: academicYearId,
        importType,
        fileName: previewData.fileName,
        validRows: previewData.validRows
      });

      if (res.success) {
        setCommitResult(res);
        setResultModalOpen(true);
        setSelectedFile(null);
        setPreviewData(null);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Failed to complete import process.' });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <AdminPageHeader
          title="Import Students"
          subtitle="Bulk import new student admissions or enroll existing students into an academic year from Excel."
          primaryAction={{
            label: 'Download Template',
            icon: Download,
            onClick: handleDownloadTemplate
          }}
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
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
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

        {/* Configuration Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 font-bold text-slate-800 text-sm">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Import Configuration</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Import Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Import Mode *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => {
                    setImportType('NEW_ADMISSION');
                    setPreviewData(null);
                  }}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    importType === 'NEW_ADMISSION'
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-slate-900 block mb-1">New Student Admissions</span>
                  <p className="text-[11px] text-slate-500">
                    Creates student master records + initial enrollments.
                  </p>
                </div>

                <div
                  onClick={() => {
                    setImportType('EXISTING_ENROLLMENT');
                    setPreviewData(null);
                  }}
                  className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                    importType === 'EXISTING_ENROLLMENT'
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-bold text-slate-900 block mb-1">Existing Students Placement</span>
                  <p className="text-[11px] text-slate-500">
                    Matches Admission Number and adds a new academic-year enrollment.
                  </p>
                </div>
              </div>
            </div>

            {/* Target Academic Year */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Target Academic Year *</label>
              <select
                value={academicYearId}
                onChange={(e) => {
                  setAcademicYearId(e.target.value);
                  setPreviewData(null);
                }}
                className="w-full px-3 py-2.5 text-xs border border-slate-300 rounded-lg bg-slate-50 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {academicYears.map((ay) => (
                  <option key={ay._id} value={ay._id}>
                    {ay.yearName} {ay.isCurrent ? '(Active)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                All uploaded students will be enrolled under this academic year.
              </p>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div className="pt-2">
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              Upload Completed Excel File (.xlsx)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:bg-slate-50/60 transition-colors flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700">
                  {selectedFile ? (
                    <span className="text-blue-600 font-bold">{selectedFile.name}</span>
                  ) : (
                    'Click to select or drag and drop your completed Excel template'
                  )}
                </p>
                <p className="text-[11px] text-slate-400">Maximum file size: 10MB</p>
              </div>

              <label className="cursor-pointer px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 shadow-xs">
                <span>{selectedFile ? 'Change File' : 'Browse File'}</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handlePreviewUpload}
              disabled={previewing || !selectedFile}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm disabled:opacity-50 flex items-center space-x-2"
            >
              {previewing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validating File...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Upload &amp; Validate Preview</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* PREVIEW CARD */}
        {previewData && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-4 p-5">
            {/* Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    File Preview: {previewData.fileName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Total Rows: <strong>{previewData.totalRows}</strong> | Target AY:{' '}
                    <strong>{previewData.academicYearName}</strong>
                  </p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('valid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'valid'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Valid Rows ({previewData.validCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('invalid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center space-x-1.5 ${
                    activeTab === 'invalid'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Invalid Rows ({previewData.invalidCount})</span>
                </button>
              </div>
            </div>

            {/* TAB: VALID ROWS */}
            {activeTab === 'valid' && (
              <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">Adm No</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Gender</th>
                      <th className="py-2.5 px-3">DOB</th>
                      <th className="py-2.5 px-3">Class &amp; Section</th>
                      <th className="py-2.5 px-3">Roll No</th>
                      <th className="py-2.5 px-3">Guardian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.validRows.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="py-6 text-center text-slate-400 italic">
                          No valid rows found in this file. Please inspect the invalid rows tab.
                        </td>
                      </tr>
                    ) : (
                      previewData.validRows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-mono text-slate-400">#{r.rowNumber}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                            {r.admissionNumber || <span className="text-slate-400 italic">Auto</span>}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{r.fullName}</td>
                          <td className="py-2.5 px-3 capitalize">{r.gender?.toLowerCase()}</td>
                          <td className="py-2.5 px-3 text-slate-600">{r.dateOfBirth}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {r.className} - {r.sectionName}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{r.rollNumber || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {r.guardianDetails?.[0]?.fullName} ({r.guardianDetails?.[0]?.mobileNumber})
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB: INVALID ROWS */}
            {activeTab === 'invalid' && (
              <div className="overflow-x-auto max-h-96 border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Row</th>
                      <th className="py-2.5 px-3">Adm No</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Validation Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.invalidRows.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="py-6 text-center text-emerald-600 font-semibold">
                          Awesome! There are zero invalid rows in this file.
                        </td>
                      </tr>
                    ) : (
                      previewData.invalidRows.map((r, i) => (
                        <tr key={i} className="hover:bg-red-50/20 bg-red-50/10">
                          <td className="py-2.5 px-3 font-mono font-bold text-red-600">#{r.rowNumber}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">{r.admissionNumber || '—'}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{r.fullName || '—'}</td>
                          <td className="py-2.5 px-3 space-y-1">
                            {(r.errors || []).map((err, errIdx) => (
                              <span
                                key={errIdx}
                                className="inline-block bg-red-100 text-red-800 border border-red-200 rounded px-2 py-0.5 text-[11px] font-medium mr-1.5 mb-1"
                              >
                                {err}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
              <p className="text-xs text-slate-500">
                {previewData.validCount > 0 ? (
                  <span>
                    Ready to commit <strong>{previewData.validCount} valid records</strong>. Invalid rows will be
                    skipped.
                  </span>
                ) : (
                  <span className="text-red-600 font-semibold">
                    Fix the row errors in your Excel file and re-upload.
                  </span>
                )}
              </p>

              <button
                type="button"
                onClick={handleCommitImport}
                disabled={committing || previewData.validCount === 0}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-sm disabled:opacity-50 flex items-center space-x-2"
              >
                {committing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Batch Import...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm &amp; Import {previewData.validCount} Students</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* RESULT MODAL */}
        <AdminModal
          isOpen={resultModalOpen}
          onClose={() => setResultModalOpen(false)}
          title="Import Summary"
          size="md"
        >
          <div className="space-y-4 text-center py-2">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800">Import Batch Finished!</h3>
              <p className="text-xs text-slate-500">
                The student records have been successfully created and enrolled.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Total Rows</span>
                <span className="font-bold text-slate-800 text-sm">{commitResult?.totalRecords}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Successful</span>
                <span className="font-bold text-emerald-600 text-sm">{commitResult?.successfulRecords}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Failed</span>
                <span className="font-bold text-red-600 text-sm">{commitResult?.failedRecords}</span>
              </div>
            </div>

            <div className="flex justify-center space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setResultModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/students')}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
              >
                Go to Student Directory
              </button>
            </div>
          </div>
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default StudentImportPage;
