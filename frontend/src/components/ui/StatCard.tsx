import React from 'react';
import type { Tone } from '../StatusBadge';

const toneIconClasses: Record<Tone, string> = {
  pass: 'bg-status-pass/10 text-status-pass',
  review: 'bg-status-review/10 text-status-review',
  blocked: 'bg-status-blocked/10 text-status-blocked',
  processing: 'bg-status-processing/10 text-status-processing',
  unknown: 'bg-status-unknown/10 text-status-unknown',
};

export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  change?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: Tone;
}> = ({ label, value, change, icon: Icon, tone = 'processing' }) => (
  <div className="glass-card p-5">
    <div className="flex items-center justify-between mb-4">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneIconClasses[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      {change && <span className="text-xs font-semibold text-ink-400">{change}</span>}
    </div>
    <p className="text-sm text-ink-600">{label}</p>
    <p className="text-2xl font-bold text-ink-900 mt-1">{value}</p>
  </div>
);
