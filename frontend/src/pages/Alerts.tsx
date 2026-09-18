import React, { useEffect } from 'react';
import { useAlertStore } from '../store/alertStore';
import { alertApi } from '../lib/api';
import { Check, Clock, Bell, Trash2, Filter, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

const alertTypeColors = {
  approved: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
  blocked: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
  review: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
  system: 'text-brand-primary border-brand-primary/20 bg-brand-primary/5',
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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
           <div className="flex items-center gap-2 text-brand-primary text-[10px] font-black uppercase tracking-widest mb-2">
              <Bell className="w-3 h-3" />
              Intelligence Feed
           </div>
           <h1 className="text-3xl font-extrabold text-white">Alerts</h1>
           <p className="text-slate-500 font-medium">Real-time settlement lifecycle and compliance updates.</p>
        </div>
        <div className="flex items-center gap-2">
            <button className="btn-secondary py-2 px-4 text-[10px] uppercase font-black tracking-widest flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
            <button className="btn-secondary py-2 px-4 text-[10px] uppercase font-black tracking-widest flex items-center gap-2">
                <Filter className="w-3.5 h-3.5" /> Filters
            </button>
        </div>
      </header>

      <div className="space-y-4">
        {alerts.map((alert) => {
            const Icon = alertTypeIcons[alert.type as keyof typeof alertTypeIcons] || Zap;
            const colorClass = alertTypeColors[alert.type as keyof typeof alertTypeColors] || alertTypeColors.system;
            return (
                <div
                    key={alert.id}
                    className={`glass-card p-6 border group transition-all duration-300 ${
                        !alert.read ? 'border-brand-primary/30 bg-brand-primary/[0.03]' : 'border-white/5 bg-white/[0.01]'
                    }`}
                >
                    <div className="flex items-start gap-5">
                        <div className={`p-3 rounded-xl border ${colorClass} shrink-0`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payment Protocol</span>
                                    <span className="font-mono text-[10px] text-brand-primary font-bold">#{alert.paymentId.slice(0, 8)}</span>
                                </div>
                                <span className="text-[10px] text-slate-600 font-bold flex items-center gap-1 uppercase tracking-widest">
                                    <Clock className="w-3 h-3" /> {timeSince(alert.timestamp)}
                                </span>
                            </div>
                            <p className={`text-sm leading-relaxed ${!alert.read ? 'text-white font-semibold' : 'text-slate-400'}`}>
                                {alert.message}
                            </p>
                        </div>
                        {!alert.read && (
                            <button
                                onClick={() => handleMarkRead(alert.id)}
                                className="shrink-0 p-2 text-slate-600 hover:text-emerald-400 transition-colors"
                            >
                                <Check className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            );
        })}
        {alerts.length === 0 && (
          <div className="glass-card p-20 flex flex-col items-center justify-center text-center opacity-40 border-dashed border-white/10 bg-transparent">
            <Bell className="w-12 h-12 text-slate-700 mb-4" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-500">Your intelligence feed is clear</p>
          </div>
        )}
      </div>
    </div>
  );
};
