import React from 'react';

export const EmptyState: React.FC<{
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-16 px-6">
    {Icon && (
      <div className="h-12 w-12 rounded-full bg-surface-elevated flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-ink-400" />
      </div>
    )}
    <p className="text-ink-900 font-semibold">{title}</p>
    {description && <p className="text-ink-600 text-sm mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
