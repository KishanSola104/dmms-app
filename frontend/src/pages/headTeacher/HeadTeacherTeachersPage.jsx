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
  GraduationCap,
  Users,
  Eye,
  Mail,
  Phone,
  BookOpen,
  Layers,
  Calendar,
  Building,
  CheckCircle2,
  RefreshCw,
  User,
  ShieldCheck,
  Briefcase,
  MapPin,
  Award
} from 'lucide-react';

const HeadTeacherTeachersPage = () => {
  const { selectedYear } = useAcademicYear();

  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [classesList, setClassesList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10
  });

  // Modal State
  const [selectedTeacherData, setSelectedTeacherData] = useState(null);
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchDropdownOptions = async () => {
    try {
      const [classRes, subRes] = await Promise.all([
        api.get('/head-teacher/classes?limit=100'),
        api.get('/head-teacher/subjects?limit=100')
      ]);
      if (classRes.success) setClassesList(classRes.classes || []);
      if (subRes.success) setSubjectsList(subRes.subjects || []);
    } catch (err) {
      console.error('[HeadTeacherTeachers] Filter load error:', err);
    }
  };

  const fetchTeachers = async (page = 1) => {
    setLoading(true);
    try {
      const yearQuery = selectedYear?._id ? `&academicYearId=${selectedYear._id}` : '';
      const res = await api.get(
        `/head-teacher/teachers?page=${page}&limit=${pagination.limit}&search=${encodeURIComponent(search)}&status=${statusFilter}&classId=${classFilter}&subjectId=${subjectFilter}${yearQuery}`
      );
      if (res.success) {
        setTeachers(res.teachers);
        setPagination(res.pagination);
      }
    } catch (err) {
      console.error('[HeadTeacherTeachers] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDropdownOptions();
  }, []);

  useEffect(() => {
    fetchTeachers(1);
  }, [search, statusFilter, classFilter, subjectFilter, selectedYear]);

  // Open Teacher Profile Modal
  const handleOpenTeacherView = async (t) => {
    setTeacherModalOpen(true);
    setModalLoading(true);
    try {
      const yearQuery = selectedYear?._id ? `?academicYearId=${selectedYear._id}` : '';
      const res = await api.get(`/head-teacher/teachers/${t.userId}${yearQuery}`);
      if (res.success) {
        setSelectedTeacherData(res);
      }
    } catch (err) {
      console.error('[HeadTeacherTeachers] Profile fetch error:', err);
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
      header: 'User ID',
      accessor: 'userId',
      render: (t) => <span className="font-mono text-xs font-bold text-slate-800">{t.userId}</span>
    },
    {
      header: 'Teacher Name',
      accessor: 'teacherName',
      render: (t) => (
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
            {t.profileImage ? (
              <img src={t.profileImage} alt="" className="w-full h-full object-cover" />
            ) : (
              t.teacherName?.slice(0, 2).toUpperCase() || 'T'
            )}
          </div>
          <div>
            <p className="font-semibold text-slate-900 leading-tight">{t.teacherName}</p>
            <p className="text-[11px] text-slate-500">{t.designation || 'Teacher'}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Contact Info',
      accessor: 'email',
      render: (t) => (
        <div className="text-xs text-slate-600 space-y-0.5">
          <div className="flex items-center space-x-1.5">
            <Mail className="w-3 h-3 text-slate-400" />
            <span>{t.email}</span>
          </div>
          {t.mobileNumber && t.mobileNumber !== '—' && (
            <div className="flex items-center space-x-1.5 text-slate-500 text-[11px]">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{t.mobileNumber}</span>
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Assigned Classes',
      accessor: 'assignedClasses',
      render: (t) => (
        <div className="text-xs">
          {t.assignedClasses?.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {t.assignedClasses.map((cls, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold text-[10px]">
                  {cls}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-400 italic">None</span>
          )}
        </div>
      )
    },
    {
      header: 'Teaching Subjects',
      accessor: 'assignedSubjects',
      render: (t) => (
        <div className="text-xs">
          {t.assignedSubjects?.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {t.assignedSubjects.map((sub, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded font-semibold text-[10px]">
                  {sub}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-400 italic">None</span>
          )}
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'accountStatus',
      render: (t) => <StatusBadge status={t.accountStatus} />
    },
    {
      header: 'Actions',
      align: 'right',
      render: (t) => (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => handleOpenTeacherView(t)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200 shadow-2xs"
            title="View Teacher Profile & Academic Responsibilities"
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
              Teacher Overview
            </h1>
            <p className="mt-1 text-sm text-slate-500 max-w-2xl">
              Inspect faculty accounts, designations, academic appointments, and teaching responsibilities.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-600 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            <span>Active Session: <strong>{selectedYear?.yearCode || 'N/A'}</strong></span>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="w-full lg:w-80">
            <AdminSearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by teacher name, email, ID..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Class */}
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

            {/* Filter by Subject */}
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

        {/* Teachers Table */}
        <AdminDataTable
          columns={columns}
          data={teachers}
          loading={loading}
          emptyMessage="No faculty accounts found matching the criteria."
        />

        {/* Pagination */}
        <AdminPagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          limit={pagination.limit}
          onPageChange={(p) => fetchTeachers(p)}
        />

        {/* 7.2 TEACHER PROFILE MODAL (READ-ONLY) */}
        <AdminModal
          isOpen={teacherModalOpen}
          onClose={() => setTeacherModalOpen(false)}
          title={selectedTeacherData?.personalInfo?.teacherName || 'Teacher Profile'}
          subtitle={`User ID: ${selectedTeacherData?.accountInfo?.userId || ''} • Academic Session: ${selectedTeacherData?.academicResponsibilities?.selectedAcademicYear?.yearCode || selectedYear?.yearCode || ''}`}
          maxWidth="max-w-4xl"
        >
          {modalLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-600 mx-auto mb-2" />
              Loading faculty profile &amp; responsibilities...
            </div>
          ) : selectedTeacherData ? (
            <div className="space-y-6">
              {/* Personal Information & Account Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-lg ring-4 ring-purple-100 overflow-hidden shrink-0">
                    {selectedTeacherData.personalInfo.profileImage ? (
                      <img src={selectedTeacherData.personalInfo.profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      selectedTeacherData.personalInfo.teacherName?.slice(0, 2).toUpperCase() || 'T'
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedTeacherData.personalInfo.teacherName}</h3>
                    <p className="text-xs font-semibold text-purple-700">{selectedTeacherData.personalInfo.designation}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Emp ID: {selectedTeacherData.personalInfo.employeeId} &bull; User ID: {selectedTeacherData.accountInfo.userId}
                    </p>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                  <StatusBadge status={selectedTeacherData.accountInfo.accountStatus} />
                  <span className="text-[10px] text-slate-400">
                    Registered: {formatDate(selectedTeacherData.accountInfo.createdAt)}
                  </span>
                </div>
              </div>

              {/* Personal Details Grid */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Personal Information
                </h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <dt className="text-slate-400 font-medium">Email Address</dt>
                    <dd className="font-semibold text-slate-800 mt-0.5 truncate">{selectedTeacherData.personalInfo.email}</dd>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <dt className="text-slate-400 font-medium">Mobile Number</dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">{selectedTeacherData.personalInfo.mobileNumber}</dd>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <dt className="text-slate-400 font-medium">Qualification</dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">{selectedTeacherData.personalInfo.qualification}</dd>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <dt className="text-slate-400 font-medium">Joining Date</dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">{formatDate(selectedTeacherData.personalInfo.joiningDate)}</dd>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 sm:col-span-2">
                    <dt className="text-slate-400 font-medium">Residential Address</dt>
                    <dd className="text-slate-700 mt-0.5">{selectedTeacherData.personalInfo.address}</dd>
                  </div>
                </dl>
              </div>

              {/* Academic Responsibilities Section */}
              <div className="space-y-4 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Academic Responsibilities &bull; Session {selectedTeacherData.academicResponsibilities?.selectedAcademicYear?.yearCode}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Class Teacher Duties */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-800 flex items-center">
                      <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
                      Class Teacher Roles
                    </p>
                    {selectedTeacherData.academicResponsibilities.classTeacherClasses?.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {selectedTeacherData.academicResponsibilities.classTeacherClasses.map(c => (
                          <span key={c._id} className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-semibold mr-1">
                            {c.className} ({c.classCode})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-1.5">No class teacher responsibilities assigned.</p>
                    )}
                  </div>

                  {/* Section Teacher Duties */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-800 flex items-center">
                      <Layers className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                      Section Teacher Roles
                    </p>
                    {selectedTeacherData.academicResponsibilities.sectionTeacherSections?.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {selectedTeacherData.academicResponsibilities.sectionTeacherSections.map(s => (
                          <span key={s._id} className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-semibold mr-1">
                            {s.className} &bull; Section {s.sectionName}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-1.5">No section teacher responsibilities assigned.</p>
                    )}
                  </div>
                </div>

                {/* Current Teaching Assignments Table */}
                <div>
                  <p className="text-xs font-bold text-slate-800 mb-2 flex items-center">
                    <BookOpen className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    Subject Teaching Assignments ({selectedTeacherData.academicResponsibilities.currentAssignments?.length || 0})
                  </p>
                  {selectedTeacherData.academicResponsibilities.currentAssignments?.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Class</th>
                            <th className="py-2 px-3">Section</th>
                            <th className="py-2 px-3">Subject</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedTeacherData.academicResponsibilities.currentAssignments.map(a => (
                            <tr key={a._id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-semibold text-slate-800">{a.className}</td>
                              <td className="py-2 px-3 text-slate-700">{a.sectionName}</td>
                              <td className="py-2 px-3 font-bold text-purple-900">{a.subjectName}</td>
                              <td className="py-2 px-3"><StatusBadge status={a.subjectType} /></td>
                              <td className="py-2 px-3 text-right"><StatusBadge status={a.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                      No active subject teaching assignments found for this session.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </AdminModal>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherTeachersPage;
