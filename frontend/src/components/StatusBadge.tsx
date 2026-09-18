import React from 'react';
import type { PaymentStatus, AlertType, UserRole } from '../types';

/**
 * Single source of truth for status/role color mapping across the app.
 * Tone = green (pass) / amber (review) / red (blocked) / blue (processing) / gray (unknown).
 * Always pair color with an icon/label elsewhere — never rely on color alone.
 */
export type Tone = 'pass' | 'review' | 'blocked' | 'processing' | 'unknown';

const toneClasses: Record<Tone, string> = {
  pass: 'bg-status-pass/10 text-status-pass border-status-pass/20',
  review: 'bg-status-review/10 text-status-review border-status-review/20',
  blocked: 'bg-status-blocked/10 text-status-blocked border-status-blocked/20',
  processing: 'bg-status-processing/10 text-status-processing border-status-processing/20',
  unknown: 'bg-status-unknown/10 text-status-unknown border-status-unknown/20',
};

const toneDotClasses: Record<Tone, string> = {
  pass: 'bg-status-pass',
  review: 'bg-status-review',
  blocked: 'bg-status-blocked',
  processing: 'bg-status-processing',
  unknown: 'bg-status-unknown',
};

export function getStatusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (['approved', 'executed', 'pass', 'clear', 'verified', 'online', 'completed', 'active'].includes(s)) return 'pass';
  if (['blocked', 'failed', 'fail', 'rejected', 'offline', 'sanctioned'].includes(s)) return 'blocked';
  if (['under_review', 'review', 'pending_review', 'revalidation', 'manual_review', 'flagged', 'degraded'].includes(s)) return 'review';
  if (['pending', 'processing', 'executing', 'in_progress'].includes(s)) return 'processing';
  return 'unknown';
}

const roleTone: Record<UserRole, string> = {
  Admin: 'bg-navy-700/10 text-navy-700 border-navy-700/20',
  'Treasury Officer': 'bg-status-pass/10 text-status-pass border-status-pass/20',
  'Compliance Officer': 'bg-status-review/10 text-status-review border-status-review/20',
  Auditor: 'bg-status-processing/10 text-status-processing border-status-processing/20',
  Reviewer: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
  Viewer: 'bg-status-unknown/10 text-status-unknown border-status-unknown/20',
};

export function formatRoleLabel(role: string): UserRole {
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') as UserRole;
}

export function getRoleTone(role: string): string {
  return roleTone[formatRoleLabel(role)] || 'bg-status-unknown/10 text-status-unknown border-status-unknown/20';
}

export const Tag: React.FC<{ tone: Tone; children: React.ReactNode; className?: string }> = ({ tone, children, className = '' }) => (
  <span className={`badge ${toneClasses[tone]} ${className}`}>{children}</span>
);

/** Flat status dot — replaces the old glow-shadow "live" indicator pattern. */
export const StatusDot: React.FC<{ tone: Tone; className?: string }> = ({ tone, className = '' }) => (
  <span className={`inline-block h-2 w-2 rounded-full ${toneDotClasses[tone]} ${className}`} />
);

export const StatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => (
  <Tag tone={getStatusTone(status)}>{status.replace(/_/g, ' ')}</Tag>
);

export const AlertBadge: React.FC<{ type: AlertType }> = ({ type }) => (
  <Tag tone={getStatusTone(type)}>{type.replace(/_/g, ' ')}</Tag>
);

export const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const formattedRole = formatRoleLabel(role);
  return <span className={`badge border ${getRoleTone(role)}`}>{formattedRole}</span>;
};

export const RiskBadge: React.FC<{ score: number }> = ({ score }) => {
  const tone: Tone = score >= 70 ? 'blocked' : score >= 40 ? 'review' : 'pass';
  return <Tag tone={tone}>{score}</Tag>;
};

export const DecisionBadge: React.FC<{ status: 'PASS' | 'FAIL' | 'WARNING' }> = ({ status }) => {
  const tone: Tone = status === 'PASS' ? 'pass' : status === 'FAIL' ? 'blocked' : 'review';
  return <Tag tone={tone}>{status}</Tag>;
};
