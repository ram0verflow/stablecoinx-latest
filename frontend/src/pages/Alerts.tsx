import React, { useEffect } from 'react';
import { useAlertStore } from '../store/alertStore';
import { alertApi } from '../lib/api';
import { Check, Clock, Bell, Trash2, Filter, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { getStatusTone, type Tone } from '../components/StatusBadge';

const toneCardClass: Record<Tone, string> = {
  pass: 'text-status-pass border-status-pass/20 bg-status-pass/5',
  blocked: 'text-status-blocked border-status-blocked/20 bg-status-blocked/5',
  review: 'text-status-review border-status-review/20 bg-status-review/5',
  processing: 'text-brand-primary border-brand-primary/20 bg-brand-soft',
  unknown: 'text-status-unknown border-status-unknown/20 bg-status-unknown/5',
};

const alertTypeIcons = {
  approved: ShieldCheck,
  blocked: AlertTriangle,
  review: Clock,
  system: Zap,
};

export const Alerts: React.FC = () => {
  const { alerts, markRead, setAlerts } = useAlertStore();

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await alertApi.list();
        const mapped = (Array.isArray(data) ? data : []).map((a: any) => ({
          id: String(a.id),
          type: a.alert_type || a.type || 'approved',
          paymentId: String(a.payment_id || ''),
          message: a.message,
          timestamp: a.created_at || a.timestamp || new Date().toISOString(),
          read: a.is_read ?? a.read ?? false,
        }));
        if (mapped.length > 0) setAlerts(mapped);
      } catch {
        // demo
      }
    };
    load();
  }, [setAlerts]);

  const handleMarkRead = async (id: string) => {
    try {
      await alertApi.markRead(id);
    } catch { /* demo */ }
    markRead(id);
  };

  const timeSince = (ts: string) => {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in pb-20">
      <PageHeader
        title="Alerts"
        description="Real-time settlement lifecycle and compliance updates."
        badge={
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-600 bg-surface-elevated border border-surface-border rounded-full px-3 py-1">
            <Bell className="w-3 h-3 text-brand-primary" /> Intelligence Feed
          </span>
        }
        actions={
          <>
            <button className="btn-secondary py-2 px-4 text-[11px] uppercase font-bold tracking-wide flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
            <button className="btn-secondary py-2 px-4 text-[11px] uppercase font-bold tracking-wide flex items-center gap-2">
                <Filter className="w-3.5 h-3.5" /> Filters
            </button>
          </>
        }
      />

      <div className="space-y-3">
        {alerts.map((alert) => {
            const Icon = alertTypeIcons[alert.type as keyof typeof alertTypeIcons] || Zap;
            const tone = getStatusTone(alert.type);
            const colorClass = toneCardClass[tone];
            return (
                <div
                    key={alert.id}
                    className={`glass-card p-5 border transition-all duration-200 ${
                        !alert.read ? 'border-brand-primary/30 bg-brand-soft/40' : ''
                    }`}
                >
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-lg border ${colorClass} shrink-0`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Payment Protocol</span>
                                    <span className="font-mono text-[11px] text-brand-primary font-semibold">#{alert.paymentId.slice(0, 8)}</span>
                                </div>
                                <span className="text-[11px] text-ink-400 font-semibold flex items-center gap-1 uppercase tracking-wide">
                                    <Clock className="w-3 h-3" /> {timeSince(alert.timestamp)}
                                </span>
                            </div>
                            <p className={`text-sm leading-relaxed ${!alert.read ? 'text-ink-900 font-semibold' : 'text-ink-600'}`}>
                                {alert.message}
                            </p>
                        </div>
                        {!alert.read && (
                            <button
                                onClick={() => handleMarkRead(alert.id)}
                                className="shrink-0 p-2 text-ink-400 hover:text-status-pass transition-colors"
                            >
                                <Check className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            );
        })}
        {alerts.length === 0 && (
          <EmptyState icon={Bell} title="Your intelligence feed is clear" />
        )}
      </div>
    </div>
  );
};
