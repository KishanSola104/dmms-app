import React from 'react';

const StatusBadge = ({ status, label }) => {
  const norm = (status || '').toUpperCase();
  let badgeClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let displayLabel = label || status;

  switch (norm) {
    case 'ACTIVE':
      badgeClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      displayLabel = displayLabel || 'Active';
      break;
    case 'INACTIVE':
    case 'DEACTIVATED':
      badgeClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      displayLabel = displayLabel || 'Deactivated';
      break;
    case 'CURRENT':
      badgeClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      displayLabel = displayLabel || 'Current';
      break;
    case 'UPCOMING':
      badgeClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      displayLabel = displayLabel || 'Upcoming';
      break;
    case 'FINISHED':
    case 'COMPLETED':
      badgeClasses = 'bg-slate-100 text-slate-600 border-slate-300';
      displayLabel = displayLabel || 'Completed';
      break;
    case 'TRANSFERRED':
      badgeClasses = 'bg-purple-50 text-purple-700 border-purple-200';
      displayLabel = displayLabel || 'Transferred';
      break;
    case 'WITHDRAWN':
      badgeClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      displayLabel = displayLabel || 'Withdrawn';
      break;
    case 'ACADEMIC':
      badgeClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      displayLabel = displayLabel || 'Academic (Scholastic)';
      break;
    case 'CO_CURRICULAR':
      badgeClasses = 'bg-purple-50 text-purple-700 border-purple-200';
      displayLabel = displayLabel || 'Co-curricular (Co-Scholastic)';
      break;
    default:
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeClasses}`}>
      <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-current opacity-70"></span>
      {displayLabel}
    </span>
  );
};

export default StatusBadge;
