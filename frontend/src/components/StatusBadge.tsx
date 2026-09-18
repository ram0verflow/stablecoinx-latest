import React from 'react';
import type { PaymentStatus, AlertType, UserRole } from '../types';

const statusStyles: Record<PaymentStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  under_review: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  blocked: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  executed: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  failed: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  review: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  revalidation: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
};

const alertStyles: Record<AlertType, string> = {
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  blocked: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  review: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  revalidation: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  review_needed: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  settlement_executed: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  settlement_failed: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

const roleStyles: Record<UserRole, string> = {
  Admin: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  'Treasury Officer': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'Compliance Officer': 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  Auditor: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  Reviewer: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  Viewer: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

export const StatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => (
  <span className={`badge border ${statusStyles[status]}`}>
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
);

export const AlertBadge: React.FC<{ type: AlertType }> = ({ type }) => (
  <span className={`badge border ${alertStyles[type]}`}>
    {type.charAt(0).toUpperCase() + type.slice(1)}
  </span>
);

export const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const formattedRole = role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') as UserRole;
  
  const style = roleStyles[formattedRole] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  
  return <span className={`badge border ${style}`}>{formattedRole}</span>;
};

export const RiskBadge: React.FC<{ score: number }> = ({ score }) => {
  const style =
    score >= 70
      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
      : score >= 40
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  return <span className={`badge border ${style}`}>{score}</span>;
};

export const DecisionBadge: React.FC<{ status: 'PASS' | 'FAIL' | 'WARNING' }> = ({ status }) => {
  const s =
    status === 'PASS'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : status === 'FAIL'
        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
        : 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return <span className={`badge border ${s}`}>{status}</span>;
};
