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
      badgeClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      displayLabel = displayLabel || 'Upcoming';
      break;
    case 'ONGOING':
      badgeClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      displayLabel = displayLabel || 'Ongoing';
      break;
    case 'CANCELLED':
      badgeClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      displayLabel = displayLabel || 'Cancelled';
      break;
    case 'FINISHED':
    case 'COMPLETED':
      badgeClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      displayLabel = displayLabel || 'Completed';
      break;
    case 'PENDING':
    case 'NOT_CONFIGURED':
    case 'PENDING_CONFIGURATION':
    case 'NOT_REQUESTED':
    case 'NOT_SUBMITTED':
      badgeClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      displayLabel =
        displayLabel ||
        (norm === 'PENDING'
          ? 'Pending'
          : norm === 'NOT_REQUESTED'
          ? 'Not Requested'
          : norm === 'NOT_SUBMITTED'
          ? 'Not Submitted'
          : 'Not Configured');
      break;
    case 'IN_PROGRESS':
    case 'REQUESTED':
      badgeClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      displayLabel = displayLabel || (norm === 'REQUESTED' ? 'Requested' : 'In Progress');
      break;
    case 'SUBMITTED':
    case 'CONFIGURED':
    case 'VERIFIED':
    case 'APPROVED':
    case 'PUBLISHED':
    case 'PASS':
    case 'PROMOTED':
      badgeClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      displayLabel =
        displayLabel ||
        (norm === 'SUBMITTED'
          ? 'Submitted'
          : norm === 'CONFIGURED'
          ? 'Configured'
          : norm === 'VERIFIED'
          ? 'Verified'
          : norm === 'APPROVED'
          ? 'Approved'
          : norm === 'PUBLISHED'
          ? 'Published'
          : norm === 'PROMOTED'
          ? 'Promoted'
          : 'Pass');
      break;
    case 'DRAFT':
    case 'GENERATED':
      badgeClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      displayLabel = displayLabel || (norm === 'DRAFT' ? 'Draft' : 'Generated');
      break;
    case 'RETURNED':
    case 'FAIL':
    case 'NEEDS IMPROVEMENT':
    case 'RETAINED':
      badgeClasses = 'bg-rose-50 text-rose-700 border-rose-200';
      displayLabel =
        displayLabel ||
        (norm === 'RETURNED'
          ? 'Returned'
          : norm === 'RETAINED'
          ? 'Retained'
          : norm === 'FAIL'
          ? 'Fail'
          : 'Needs Improvement');
      break;
    case 'SUBMITTED_TO_HEAD_TEACHER':
      badgeClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      displayLabel = displayLabel || 'Submitted to Head Teacher';
      break;
    case 'UNDER_REVIEW':
      badgeClasses = 'bg-purple-50 text-purple-700 border-purple-200';
      displayLabel = displayLabel || 'Under Review';
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
