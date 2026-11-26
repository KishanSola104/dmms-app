import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import HeadTeacherDashboard from '../components/headTeacher/HeadTeacherDashboard';
import TeacherDashboard from '../components/teacher/TeacherDashboard';
import { useUserAuth } from '../context/UserAuthContext';
import { useSchoolAuth } from '../context/SchoolAuthContext';
import { useAcademicYear } from '../context/AcademicYearContext';
import api from '../services/api';
import { Link } from 'react-router-dom';
import {
  Shield,
  GraduationCap,
  BookOpen,
  Users,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  KeyRound,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  RefreshCw,
  FileText,
  AlertCircle
} from 'lucide-react';

const DashboardPage = () => {
  const { currentUser, activePanel } = useUserAuth();
  const { currentSchool } = useSchoolAuth();
  const { selectedYear } = useAcademicYear();

  const isTeacherPanel =
    activePanel === 'TEACHER' &&
    (currentUser?.roleCode === 'TEACHER' ||
      (currentUser?.roleCode === 'HEAD_TEACHER' && !!currentUser?.teachingAccess?.hasTeachingAccess));

  // If active panel is HEAD_TEACHER, render dedicated Head Teacher Dashboard
  if (currentUser?.roleCode === 'HEAD_TEACHER' && !isTeacherPanel) {
    return (
      <DashboardLayout>
        <HeadTeacherDashboard />
      </DashboardLayout>
    );
  }

  // If authenticated user is in Teacher Panel (TEACHER or HEAD_TEACHER with teaching duties), render Teacher Dashboard
  if (isTeacherPanel) {
    return (
      <DashboardLayout>
        <TeacherDashboard />
      </DashboardLayout>
    );
  }

  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/common/dashboard-stats');
      if (res.success) {
        setStatsData(res);
      }
    } catch (err) {
      console.warn('[Dashboard] Stats fetch error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [selectedYear]);

  // Icon mapping
  const renderIcon = (name) => {
    switch (name) {
      case 'Users':
        return <Users className="w-5 h-5" />;
      case 'ShieldCheck':
        return <Shield className="w-5 h-5" />;
      case 'Phone':
        return <Phone className="w-5 h-5" />;
      case 'Calendar':
        return <Calendar className="w-5 h-5" />;
      case 'GraduationCap':
        return <GraduationCap className="w-5 h-5" />;
      case 'BookOpen':
        return <BookOpen className="w-5 h-5" />;
      case 'Layers':
        return <Layers className="w-5 h-5" />;
      case 'CheckCircle':
        return <CheckCircle2 className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getColorClasses = (color) => {
    switch (color) {
      case 'blue':
        return { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' };
      case 'emerald':
        return { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' };
      case 'indigo':
        return { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-100' };
      case 'purple':
        return { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-100' };
      case 'amber':
        return { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' };
      default:
        return { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-100' };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-200">
        
        {/* Welcome Banner */}
        <div className="bg-linear-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-2xl text-white p-6 sm:p-8 shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/10 backdrop-blur-xs rounded-full text-xs font-medium text-blue-200 mb-3 border border-white/10">
              <span>{statsData?.roleTitle || `${currentUser?.roleName} Dashboard`}</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {currentUser?.fullName || currentUser?.userId}!
            </h1>
            
            <p className="text-sm sm:text-base text-slate-200 mt-1 max-w-2xl opacity-90">
              Digital Marksheet Management System &bull; {currentSchool?.schoolName} ({currentSchool?.schoolId})
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-blue-100">
              <div className="flex items-center space-x-1.5 bg-black/20 px-3 py-1 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-blue-300" />
                <span>Active Year: <strong>{selectedYear?.yearCode || 'N/A'}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5 bg-black/20 px-3 py-1 rounded-lg">
                <Shield className="w-3.5 h-3.5 text-emerald-300" />
                <span>Role: <strong>{currentUser?.roleName}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Metric Cards */}
        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : Array.isArray(statsData?.stats) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {statsData.stats.map((stat, i) => {
                const style = getColorClasses(stat.color);
                return (
                  <div key={i} className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${style.bg} ${style.text} ring-4 ${style.ring}`}>
                      {renderIcon(stat.icon)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.title}</p>
                      <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{stat.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>
        ) : null}

        {/* ROLE 1: SCHOOL ADMINISTRATOR SPECIFIC CONTENT */}
        {currentUser?.roleCode === 'ADMIN' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* School Profile Card */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Institutional Profile</h2>
                    <p className="text-xs text-slate-500">Official registered school parameters</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
                  Status: Active
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <dt className="text-slate-500 font-medium">School Full Name</dt>
                  <dd className="text-slate-900 font-bold text-sm mt-0.5">{statsData?.schoolProfile?.schoolName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 font-medium">School ID &amp; Code</dt>
                  <dd className="font-mono font-bold text-blue-700 text-sm mt-0.5">{statsData?.schoolProfile?.schoolId}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 font-medium">Established Year</dt>
                  <dd className="text-slate-900 font-semibold mt-0.5">{statsData?.schoolProfile?.establishedYear}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 font-medium">Official Email Address</dt>
                  <dd className="text-slate-900 font-semibold mt-0.5">{statsData?.schoolProfile?.email}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 font-medium">Contact Phone</dt>
                  <dd className="text-slate-900 font-semibold mt-0.5">{statsData?.schoolProfile?.mobileNumber}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 font-medium">Complete Campus Address</dt>
                  <dd className="text-slate-900 mt-0.5">{statsData?.schoolProfile?.address}</dd>
                </div>
              </dl>

              {/* Contact Persons Table */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Designated Contact Persons
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {statsData?.schoolProfile?.contactPersons?.map((cp, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1">
                      <p className="font-bold text-slate-900">{cp.fullName}</p>
                      <p className="text-blue-600 font-medium">{cp.designation}</p>
                      <p className="text-slate-500">{cp.email}</p>
                      <p className="text-slate-500">{cp.mobileNumber}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                  Administrator Actions
                </h3>
                <div className="space-y-2.5">
                  <Link
                    to="/change-password?tab=school"
                    className="flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100/70 border border-indigo-200/80 rounded-xl text-xs font-semibold text-indigo-900 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Shield className="w-4 h-4 text-indigo-600" />
                      <span>Update School Password</span>
                    </div>
                    <span>&rarr;</span>
                  </Link>

                  <Link
                    to="/profile"
                    className="flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100/70 border border-blue-200/80 rounded-xl text-xs font-semibold text-blue-900 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      <span>Manage My Profile</span>
                    </div>
                    <span>&rarr;</span>
                  </Link>

                  <Link
                    to="/change-password"
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 transition-colors"
                  >
                    <div className="flex items-center space-x-2.5">
                      <KeyRound className="w-4 h-4 text-slate-600" />
                      <span>Change Personal Password</span>
                    </div>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </div>

              {/* System Security Notice */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-amber-950">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Security &amp; Data Isolation</span>
                </div>
                <p className="leading-relaxed">
                  All marksheet records, student details, and faculty entries are strictly scoped to School ID <strong>{currentSchool?.schoolId}</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ROLE 2: HEAD TEACHER SPECIFIC CONTENT */}
        {currentUser?.roleCode === 'HEAD_TEACHER' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
              <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
                <GraduationCap className="w-5 h-5 text-purple-600" />
                <span>Academic Oversight &amp; Curriculum Supervision</span>
              </h2>

              <div className="space-y-4">
                {statsData?.academicHighlights?.map((item, i) => (
                  <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">{item.label}</span>
                    <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded border border-slate-200">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-1">
                <p className="font-bold">Next Sprint Roadmap (Module 2):</p>
                <p className="text-slate-600">Class management, teacher subject allocations, and grading policy configuration will be available in the upcoming Sprint.</p>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                Head Teacher Shortcuts
              </h3>
              <div className="space-y-2.5">
                <Link to="/profile" className="block p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700">
                  View Faculty Profile
                </Link>
                <Link to="/change-password" className="block p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700">
                  Update Account Password
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ROLE 3: TEACHER SPECIFIC CONTENT */}
        {currentUser?.roleCode === 'TEACHER' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
              <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-emerald-600" />
                <span>Today's Classroom &amp; Teaching Schedule</span>
              </h2>

              <div className="space-y-3">
                {statsData?.teachingSchedule?.map((item, i) => (
                  <div key={i} className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{item.subject}</p>
                      <p className="text-slate-500 mt-0.5">{item.period}</p>
                    </div>
                    <span className="font-semibold text-emerald-800 bg-white px-2.5 py-1 rounded border border-emerald-200">
                      {item.classRoom}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                Marksheet Portal Status
              </h3>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-2">
                <p className="font-semibold">Term: {selectedYear?.yearCode}</p>
                <p className="text-slate-600">Marks entry portal will unlock automatically once examination schedules are published.</p>
              </div>
            </div>
          </div>
        )}

        {/* ROLE 4: OFFICE STAFF SPECIFIC CONTENT */}
        {currentUser?.roleCode === 'OFFICE_STAFF' && (
          <div className="space-y-6">
            {/* Live Office KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Published Final Results</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{statsData?.stats?.totalPublishedFinalResults ?? 0}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Published Exam Results</p>
                <p className="text-2xl font-bold text-indigo-700 mt-1">{statsData?.stats?.totalPublishedExamResults ?? 0}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Available Reports</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{statsData?.stats?.availableAcademicReportsCount ?? 0}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">My Total Downloads</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{statsData?.stats?.myTotalDownloads ?? 0}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Unread Notifications</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{statsData?.stats?.unreadNotifications ?? 0}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Recently Published Results */}
              <div className="lg:col-span-7 bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Recently Published Results</span>
                  </h2>
                  <Link to="/office/published-results" className="text-xs font-semibold text-blue-600 hover:underline">
                    View All &rarr;
                  </Link>
                </div>

                {(statsData?.recentlyPublishedResults || []).length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center bg-slate-50 rounded-xl">
                    No officially published results recorded for this academic year yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {statsData.recentlyPublishedResults.map((b) => (
                      <div key={b.key} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{b.title} — {b.className} ({b.sectionName})</p>
                          <p className="text-slate-500 mt-0.5">
                            Students: <strong>{b.studentCount}</strong> &bull; Passed: <strong className="text-emerald-700">{b.passCount}</strong>
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full font-semibold border ${
                          b.type === 'FINAL'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {b.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Recent Downloads</h3>
                    <Link to="/office/download-history" className="text-xs font-semibold text-blue-600 hover:underline">
                      Download History &rarr;
                    </Link>
                  </div>
                  {(statsData?.recentDownloads || []).length === 0 ? (
                    <p className="text-xs text-slate-400">No recent downloads recorded.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {statsData.recentDownloads.slice(0, 4).map((d) => (
                        <div key={d._id} className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-slate-50 rounded-lg">
                          <span className="font-medium text-slate-800 truncate max-w-xs">{d.documentName}</span>
                          <span className="text-[11px] text-slate-500 shrink-0">
                            {d.downloadedAt ? new Date(d.downloadedAt).toLocaleDateString('en-GB') : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notifications & Shortcuts */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Recent Notifications</h3>
                    <Link to="/office/notifications" className="text-xs font-semibold text-blue-600 hover:underline">
                      Inbox &rarr;
                    </Link>
                  </div>
                  {(statsData?.notifications || []).length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">No notifications received yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {statsData.notifications.slice(0, 4).map((n) => (
                        <div key={n._id} className={`p-3 rounded-xl border text-xs ${n.isRead ? 'bg-slate-50 border-slate-200' : 'bg-blue-50/70 border-blue-200'}`}>
                          <p className="font-bold text-slate-900">{n.title}</p>
                          <p className="text-slate-600 mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Quick Shortcuts</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <Link to="/office/published-results" className="block p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
                      Published Results &amp; Marksheets
                    </Link>
                    <Link to="/office/academic-reports" className="block p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-800">
                      Published Academic Reports (PDF)
                    </Link>
                    <Link to="/office/download-history" className="block p-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700">
                      My Download History
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
