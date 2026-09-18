import React, { useState, useEffect } from 'react';
import {
  RotateCcw, ChevronDown, AlertCircle, Shield,
  History, Play, Layers, X, Info, Search, ChevronRight
} from 'lucide-react';
import { revalidationApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import type { RevalidationRecord } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Tag, StatusDot, getStatusTone } from '../components/StatusBadge';

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
    <div className="space-y-6 animate-fade-in pb-20">
      <PageHeader
        title="Historical Revalidation"
        description="Re-evaluate historical transactions against dynamic policy updates."
        badge={
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-600 bg-surface-elevated border border-surface-border rounded-full px-3 py-1">
            <History className="w-3 h-3 text-brand-primary" /> Retroactive Compliance
          </span>
        }
        actions={
          <button onClick={() => setTriggerModal(true)} className="btn-primary py-2.5 px-6 text-xs flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Start Global Rescan
          </button>
        }
      />

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
            { l: 'Policy Flagged', v: stats.flagged, cls: 'text-status-blocked' },
            { l: 'Verification Pass', v: stats.completed, cls: 'text-status-pass' },
            { l: 'Awaiting Rescan', v: stats.pending, cls: 'text-status-review' },
        ].map(s => (
            <div key={s.l} className="glass-card p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400 mb-2">{s.l}</p>
                <p className={`text-3xl font-bold ${s.cls}`}>{s.v}</p>
            </div>
        ))}
      </div>

      {/* Records Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border bg-surface-elevated flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900">Rescan History</h3>
            <div className="flex items-center gap-2">
                <StatusDot tone="pass" />
                <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Engine Active</span>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-ink-400 border-b border-surface-border">
                        <th className="px-6 py-3">Protocol ID</th>
                        <th className="px-6 py-3">Trigger Logic</th>
                        <th className="px-6 py-3">Historical Status</th>
                        <th className="px-6 py-3">New Evaluation</th>
                        <th className="px-6 py-3">Verification</th>
                        <th className="px-6 py-3 text-right">Age</th>
                    </tr>
                </thead>
                <tbody>
                    {records.map((r: any) => (
                        <React.Fragment key={r.id}>
                            <tr
                                className={`table-row group cursor-pointer ${selectedRecord === r.id ? 'bg-brand-soft' : ''}`}
                                onClick={() => setSelectedRecord(selectedRecord === r.id ? null : r.id)}
                            >
                                <td className="px-6 py-4">
                                    <span className="font-mono text-xs text-brand-primary font-semibold">#{r.payment_id?.slice(0, 8)}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-[11px] font-semibold text-ink-600">{r.trigger_reason}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <Tag tone={getStatusTone(r.original_decision === 'APPROVE' ? 'pass' : 'blocked')}>{r.original_decision}</Tag>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[11px] font-bold uppercase ${r.decision_changed ? 'text-status-blocked' : 'text-status-pass'}`}>
                                            {r.new_decision}
                                        </span>
                                        {r.decision_changed && <AlertCircle className="w-3.5 h-3.5 text-status-blocked" />}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`badge ${r.status === 'completed' ? 'badge-pass' : 'badge-pending'}`}>
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-3">
                                        <span className="text-[11px] text-ink-400 font-semibold">{new Date(r.created_at).toLocaleDateString()}</span>
                                        <ChevronDown className={`w-4 h-4 text-ink-400 group-hover:text-brand-primary transition-transform ${selectedRecord === r.id ? 'rotate-180' : ''}`} />
                                    </div>
                                </td>
                            </tr>
                            {selectedRecord === r.id && (
                                <tr className="bg-surface-elevated">
                                    <td colSpan={6} className="px-10 py-6 border-b border-surface-border">
                                        <div className="grid md:grid-cols-2 gap-10 animate-fade-in">
                                            <div className="space-y-3">
                                                <h4 className="text-[11px] font-bold uppercase tracking-wide text-ink-400 flex items-center gap-2">
                                                    <Info className="w-3.5 h-3.5" /> Revalidation Summary
                                                </h4>
                                                <p className="text-sm text-ink-600 leading-relaxed italic">
                                                    "Retroactive scan triggered by {r.trigger_reason}. The risk profile has shifted from {r.original_decision} to {r.new_decision} based on the updated deterministic policy layer."
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 rounded-lg border border-surface-border bg-white">
                                                    <p className="text-[10px] font-bold uppercase text-ink-400 mb-1">Risk Delta</p>
                                                    <p className="text-lg font-bold text-ink-900">{r.new_risk_score ? `+${r.new_risk_score - 20}%` : '0%'}</p>
                                                </div>
                                                <div className="p-4 rounded-lg border border-surface-border bg-white">
                                                    <p className="text-[10px] font-bold uppercase text-ink-400 mb-1">Status Code</p>
                                                    <p className="text-lg font-bold text-brand-primary uppercase">{r.status}</p>
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
            <EmptyState icon={Search} title="No revalidation records identified" />
        )}
      </div>

      {/* Trigger Modal */}
      {triggerModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-md w-full animate-scale-in bg-white">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-brand-soft text-brand-primary">
                        <RotateCcw className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-ink-900">Trigger Scan</h2>
                        <p className="text-[11px] text-ink-400 uppercase tracking-wide font-bold">Retroactive Policy Enforcement</p>
                    </div>
                </div>
                <button onClick={() => setTriggerModal(false)} className="text-ink-400 hover:text-ink-900 transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-2">
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
                  className="w-full p-3.5 flex items-center justify-between group hover:bg-surface-elevated border border-surface-border rounded-lg transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <t.icon className="w-4 h-4 text-ink-400 group-hover:text-brand-primary transition-colors" />
                    <span className="text-xs font-semibold text-ink-600 group-hover:text-ink-900 transition-colors">{t.l}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-400 group-hover:text-brand-primary group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-surface-border text-center">
                <p className="text-[11px] text-ink-400 font-medium leading-relaxed italic">
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
