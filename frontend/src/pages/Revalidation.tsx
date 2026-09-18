import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, ChevronDown, AlertCircle, CheckCircle2, Shield, 
  History, Play, Layers, X, Info, Search, ChevronRight
} from 'lucide-react';
import { revalidationApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import type { RevalidationRecord } from '../types';

export const Revalidation: React.FC = () => {
  const { showToast } = useToast();
  const [records, setRecords] = useState<RevalidationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [triggerModal, setTriggerModal] = useState(false);
  const [stats, setStats] = useState({ flagged: 0, completed: 0, pending: 0 });
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const { data } = await revalidationApi.list();
      const recordList = Array.isArray(data) ? data : (data.records || []);
      setRecords(recordList);
      
      const flaggedCount = recordList.filter((r: any) => r.decision_changed).length || 0;
      const completedCount = recordList.filter((r: any) => r.status === 'completed').length || 0;
      const pendingCount = recordList.filter((r: any) => r.status === 'pending').length || 0;
      setStats({ flagged: flaggedCount, completed: completedCount, pending: pendingCount });
    } catch (error) {
      showToast('error', 'Failed to load revalidations', 'Could not fetch records');
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = async (type: string) => {
    try {
      setTriggering(true);
      let result;
      switch (type) {
        case 'sanctions': result = await revalidationApi.triggerSanctions(); break;
        case 'policy': result = await revalidationApi.triggerPolicy(); break;
        case 'wallet': result = await revalidationApi.triggerWallet(); break;
        case 'issuer': result = await revalidationApi.triggerIssuer(); break;
        default: result = await revalidationApi.trigger({ trigger_type: 'all' });
      }
      const flagged = result.data?.flagged_count ?? 0; // FIXED: H5
      const triggered = result.data?.triggered_count ?? 0; // FIXED: H5
      showToast('success', 'Revalidation Triggered', `${flagged} payments flagged, ${triggered} re-queued`); // FIXED: H5
      setTriggerModal(false);
      setTimeout(() => loadRecords(), 1000);
    } catch (error) {
      showToast('error', 'Trigger Failed', 'Could not start revalidation process');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
           <div className="flex items-center gap-2 text-brand-primary text-[10px] font-black uppercase tracking-widest mb-2">
              <History className="w-3 h-3" />
              Retroactive Compliance
           </div>
           <h1 className="text-3xl font-extrabold text-white">Historical Revalidation</h1>
           <p className="text-slate-500 font-medium">Re-evaluate historical transactions against dynamic policy updates.</p>
        </div>
        <button onClick={() => setTriggerModal(true)} className="btn-primary py-3 px-8 text-xs flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Start Global Rescan
        </button>
      </header>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
            { l: 'Policy Flagged', v: stats.flagged, c: 'text-rose-400', bg: 'bg-rose-500/5', b: 'border-rose-500/20' },
            { l: 'Verification Pass', v: stats.completed, c: 'text-emerald-400', bg: 'bg-emerald-500/5', b: 'border-emerald-500/20' },
            { l: 'Awaiting Rescan', v: stats.pending, c: 'text-amber-400', bg: 'bg-amber-500/5', b: 'border-amber-500/20' },
        ].map(s => (
            <div key={s.l} className={`glass-card p-6 border ${s.b} ${s.bg}`}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{s.l}</p>
                <p className={`text-3xl font-black ${s.c}`}>{s.v}</p>
            </div>
        ))}
      </div>

      {/* Records Table */}
      <div className="glass-card overflow-hidden border-white/5">
        <div className="px-8 py-5 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Rescan History</h3>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Engine Active</span>
                </div>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5">
                        <th className="px-8 py-4">Protocol ID</th>
                        <th className="px-8 py-4">Trigger Logic</th>
                        <th className="px-8 py-4">Historical Status</th>
                        <th className="px-8 py-4">New Evaluation</th>
                        <th className="px-8 py-4">Verification</th>
                        <th className="px-8 py-4 text-right">Age</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map((r: any) => (
                        <React.Fragment key={r.id}>
                            <tr 
                                className={`table-row group cursor-pointer ${selectedRecord === r.id ? 'bg-brand-primary/5' : ''}`}
                                onClick={() => setSelectedRecord(selectedRecord === r.id ? null : r.id)}
                            >
                                <td className="px-8 py-5">
                                    <span className="font-mono text-xs text-brand-primary font-bold">#{r.payment_id?.slice(0, 8)}</span>
                                </td>
                                <td className="px-8 py-5">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{r.trigger_reason}</span>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                                        r.original_decision === 'APPROVE' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' : 'text-rose-400 border-rose-500/20 bg-rose-500/5'
                                    }`}>
                                        {r.original_decision}
                                    </span>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase ${r.decision_changed ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {r.new_decision}
                                        </span>
                                        {r.decision_changed && <AlertCircle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />}
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`badge ${r.status === 'completed' ? 'badge-pass' : 'badge-pending'}`}>
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <span className="text-[10px] text-slate-600 font-bold uppercase">{new Date(r.created_at).toLocaleDateString()}</span>
                                        <ChevronDown className={`w-4 h-4 text-slate-700 group-hover:text-brand-primary transition-transform ${selectedRecord === r.id ? 'rotate-180' : ''}`} />
                                    </div>
                                </td>
                            </tr>
                            {selectedRecord === r.id && (
                                <tr className="bg-slate-950/40">
                                    <td colSpan={6} className="px-12 py-8 border-b border-white/5">
                                        <div className="grid md:grid-cols-2 gap-12 animate-fade-in">
                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                                    <Info className="w-3.5 h-3.5" /> Revalidation Summary
                                                </h4>
                                                <p className="text-sm text-slate-300 leading-relaxed italic">
                                                    "Retroactive scan triggered by {r.trigger_reason}. The risk profile has shifted from {r.original_decision} to {r.new_decision} based on the updated deterministic policy layer."
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40">
                                                    <p className="text-[9px] font-black uppercase text-slate-600 mb-1">Risk Delta</p>
                                                    <p className="text-lg font-black text-white">{r.new_risk_score ? `+${r.new_risk_score - 20}%` : '0%'}</p>
                                                </div>
                                                <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40">
                                                    <p className="text-[9px] font-black uppercase text-slate-600 mb-1">Status Code</p>
                                                    <p className="text-lg font-black text-brand-primary uppercase tracking-tighter">{r.status}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
        {records.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                <Search className="w-12 h-12 text-slate-700 mb-4" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">No revalidation records identified</p>
            </div>
        )}
      </div>

      {/* Trigger Modal */}
      {triggerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-card p-8 max-w-md w-full border-brand-primary/30 animate-scale-in">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-primary/10 text-brand-primary">
                        <RotateCcw className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-extrabold text-white">Trigger Scan</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Retroactive Policy Enforcement</p>
                    </div>
                </div>
                <button onClick={() => setTriggerModal(false)} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-3">
              {[
                { id: 'sanctions', l: 'Sanctions List Update', icon: Shield },
                { id: 'policy', l: 'Policy Engine Version Change', icon: Layers },
                { id: 'wallet', l: 'Graph Database Re-indexing', icon: Search },
                { id: 'issuer', l: 'Stablecoin Asset Audit', icon: Play },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTrigger(t.id)}
                  disabled={triggering}
                  className="w-full p-4 flex items-center justify-between group hover:bg-brand-primary/5 border border-white/5 rounded-xl transition-all disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <t.icon className="w-4 h-4 text-slate-500 group-hover:text-brand-primary transition-colors" />
                    <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{t.l}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-[10px] text-slate-600 font-medium leading-relaxed italic">
                    Triggering a revalidation scan will asynchronously process all historical settlements against the latest deterministic rulesets. 
                    This process may take several minutes depending on ledger depth.
                </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
