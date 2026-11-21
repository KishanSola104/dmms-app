import React from 'react';
import { Plus } from 'lucide-react';

const AdminPageHeader = ({ title, description, actionLabel, onAction, actionIcon: ActionIcon = Plus }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-slate-200 gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500 max-w-2xl">{description}</p>
        )}
      </div>
      {actionLabel && (
        <div className="shrink-0">
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-xs hover:shadow transition-all focus:outline-hidden"
          >
            <ActionIcon className="w-4 h-4 mr-2" />
            <span>{actionLabel}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminPageHeader;
