import React from 'react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }> = ({
  hover = false,
  className = '',
  children,
  ...props
}) => (
  <div className={`${hover ? 'glass-card-hover' : 'glass-card'} ${className}`} {...props}>
    {children}
  </div>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={`px-6 py-4 border-b border-surface-border ${className}`} {...props}>
    {children}
  </div>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...props }) => (
  <div className={`p-6 ${className}`} {...props}>
    {children}
  </div>
);
