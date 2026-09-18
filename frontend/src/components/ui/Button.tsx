import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClasses: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'px-5 py-2.5 text-ink-600 font-semibold rounded-lg hover:bg-surface-elevated transition-colors duration-150 active:scale-[0.98]',
  danger: 'px-5 py-2.5 bg-status-blocked hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-150 shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
};

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
> = ({ variant = 'primary', className = '', children, ...props }) => (
  <button className={`${variantClasses[variant]} ${className}`} {...props}>
    {children}
  </button>
);
