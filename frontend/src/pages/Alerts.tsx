import React, { useEffect } from 'react';
import { useAlertStore } from '../store/alertStore';
import { alertApi } from '../lib/api';
import { AlertBadge } from '../components/StatusBadge';
import { Check, Clock } from 'lucide-react';

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
        // keep mock data in demo mode
      }
    };
    load();
  }, [setAlerts]);

  const handleMarkRead = async (id: string) => {
    try {
      await alertApi.markRead(id);
    } catch {
      // Demo mode
    }
    markRead(id);
  };

  const timeSince = (ts: string) => {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="page-title">Alerts & Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">System-wide compliance and workflow alerts</p>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`glass-card p-5 flex items-start gap-4 transition-all duration-300 ${
              !alert.read ? 'border-indigo-500/30 bg-indigo-500/5' : ''
            }`}
          >
            <div className="shrink-0">
              <AlertBadge type={alert.type} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs text-slate-400">Payment: {alert.paymentId}</span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {timeSince(alert.timestamp)}
                </span>
              </div>
              <p className={`text-sm ${!alert.read ? 'text-white font-medium' : 'text-slate-400'}`}>
                {alert.message}
              </p>
            </div>
            {!alert.read && (
              <button
                onClick={() => handleMarkRead(alert.id)}
                className="shrink-0 p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                title="Mark as read"
              >
                <Check className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
        {alerts.length === 0 && (
          <div className="glass-card p-12 text-center text-slate-500">
            No alerts found.
          </div>
        )}
      </div>
    </div>
  );
};
