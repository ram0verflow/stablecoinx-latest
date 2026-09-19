import React from 'react';

type IconProps = { className?: string };

/** Sidebar nav icons — exact paths from the reference design, ported to JSX (camelCase SVG attrs). */
export const IcOverview: React.FC<IconProps> = ({ className = 'ic' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M3 10l7-7 7 7M5 8v9h10V8" stroke="currentColor" strokeWidth="1.6" /></svg>
);
export const IcPayments: React.FC<IconProps> = ({ className = 'ic' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M2 6h16M2 10h16M2 14h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);
export const IcCheck: React.FC<IconProps & { strokeWidth?: number }> = ({ className = 'ic', strokeWidth = 1.6 }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-9" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IcPolicies: React.FC<IconProps> = ({ className = 'ic' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M6 8h8M6 12h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);
export const IcShield: React.FC<IconProps> = ({ className = 'ic' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M10 2l7 3v5c0 4.5-3 7-7 8-4-1-7-3.5-7-8V5l7-3z" stroke="currentColor" strokeWidth="1.6" /></svg>
);
export const IcRevalidation: React.FC<IconProps> = ({ className = 'ic' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M4 10a6 6 0 1010-4.5M4 10V5m0 5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);
export const IcDoc: React.FC<IconProps> = ({ className = 'ic' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M5 3h7l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" /><path d="M7 10h6M7 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);
export const IcIntegrations: React.FC<IconProps> = ({ className = 'ic' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" /><path d="M3 8h14" stroke="currentColor" strokeWidth="1.6" /></svg>
);
export const IcInfrastructure: React.FC<IconProps> = ({ className = 'ic' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none">
    <rect x="3" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
    <rect x="11" y="3" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
    <rect x="3" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
    <rect x="11" y="11" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);
export const IcSettings: React.FC<IconProps> = ({ className = 'ic' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.4 4.6l-1.4 1.4M6 12.9l-1.4 1.4M15.4 15.4l-1.4-1.4M6 7.1L4.6 5.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/** Common inline icons used across pages. */
export const IcChevronDown: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" /></svg>
);
export const IcChevronLeft: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IcChevronRight: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IcSelectChevron: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.6" /></svg>
);
export const IcSearch: React.FC<IconProps> = ({ className = 'ic' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" /><path d="M17 17l-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);
export const IcArrowRight: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M3 10h14M12 5l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IcLock: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><rect x="4" y="9" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" /><path d="M7 9V6a3 3 0 016 0v3" stroke="currentColor" strokeWidth="1.6" /></svg>
);
export const IcAlertTriangle: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M10 3l8 14H2l8-14z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M10 8.5v3.2M10 14.2h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);
export const IcAlertCircle: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none"><path d="M10 6v5M10 14h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" /></svg>
);
export const IcSeal: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const IcCircleTimer: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="3.6" stroke="currentColor" strokeWidth="1.4" /></svg>
);
export const IcMiniCheck: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.2 2.2L9.5 3.5" stroke="currentColor" strokeWidth="1.6" /></svg>
);
