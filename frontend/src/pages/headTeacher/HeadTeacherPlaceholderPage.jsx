import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import {
  Layers,
  BookOpen,
  GraduationCap,
  Users,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ShieldAlert
} from 'lucide-react';

const HeadTeacherPlaceholderPage = () => {
  const location = useLocation();

  const getModuleInfo = () => {
    const path = location.pathname;
    if (path.includes('/classes')) {
      return {
        phase: 'Phase 1',
        title: 'Classes & Sections Overview',
        description: 'Read-only directory of academic classes, configured sections, student strength, and capacity.',
        icon: Layers,
        color: 'indigo'
      };
    }
    if (path.includes('/subjects')) {
      return {
        phase: 'Phase 2',
        title: 'Subject Overview',
        description: 'Curriculum structure, academic vs co-curricular classification, and class-wise allocations.',
        icon: BookOpen,
        color: 'purple'
      };
    }
    if (path.includes('/teachers')) {
      return {
        phase: 'Phase 3',
        title: 'Teacher Overview',
        description: 'Faculty profiles, contact details, designations, and academic responsibilities.',
        icon: GraduationCap,
        color: 'blue'
      };
    }
    if (path.includes('/teacher-assignments')) {
      return {
        phase: 'Phase 4',
        title: 'Teacher Assignments',
        description: 'Active subject-class-section teacher pairings and assignment coverage analysis.',
        icon: CheckCircle2,
        color: 'emerald'
      };
    }
    return {
      phase: 'Module 1',
      title: 'Academic Overview',
      description: 'Supervisory and academic monitoring module for the Head Teacher.',
      icon: Layers,
      color: 'slate'
    };
  };

  const info = getModuleInfo();
  const Icon = info.icon;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-5 ring-8 ring-purple-50/50">
            <Icon className="w-8 h-8" />
          </div>

          <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
            {info.phase} &bull; Head Teacher Panel
          </span>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {info.title}
          </h1>

          <p className="text-sm text-slate-600 mt-2 max-w-xl mx-auto">
            {info.description}
          </p>

          <div className="mt-8 p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-left max-w-lg mx-auto text-xs text-amber-900 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-amber-950">
              <Clock className="w-4 h-4 text-amber-700" />
              <span>Development Stage Notice</span>
            </div>
            <p className="leading-relaxed">
              In accordance with project development guidelines (Section 13), only the <strong>Head Teacher Dashboard</strong> is implemented in this stage.
              This phase will be activated immediately following formal approval of the Dashboard.
            </p>
          </div>

          <div className="mt-8 flex justify-center space-x-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span>Back to Head Teacher Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HeadTeacherPlaceholderPage;
