import React from 'react';

export const PageHeader: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}> = ({ title, description, actions, badge }) => (
  <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        {badge}
      </div>
      {description && <p className="text-ink-600 mt-1">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-3">{actions}</div>}
  </div>
);
