import React, { useState, useEffect } from 'react';
import { RotateCcw, ChevronDown, AlertCircle, CheckCircle } from 'lucide-react';
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
      // API returns array directly
      const recordList = Array.isArray(data) ? data : (data.records || []);
      setRecords(recordList);
      
      const flaggedCount = recordList.filter((r: any) => r.decision_changed).length || 0;
      const completedCount = recordList.filter((r: any) => r.status === 'completed').length || 0;
      const pendingCount = recordList.filter((r: any) => r.status === 'pending').length || 0;
      setStats({ flagged: flaggedCount, completed: completedCount, pending: pendingCount });
    } catch (error) {
      showToast('error', 'Failed to load revalidations', 'Could not fetch revalidation records');
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = async (type: string) => {
    try {
      setTriggering(true);
      let result;
      switch (type) {
        case 'sanctions':
          result = await revalidationApi.triggerSanctions();
          break;
        case 'policy':
          result = await revalidationApi.triggerPolicy();
          break;
        case 'wallet':
          result = await revalidationApi.triggerWallet();
          break;
        case 'issuer':
          result = await revalidationApi.triggerIssuer();
          break;
        default:
          result = await revalidationApi.trigger();
      }
      showToast('success', 'Revalidation Triggered', `${result.data?.flagged_count || 0} payments flagged for review`);
      setTriggerModal(false);
      setTimeout(() => loadRecords(), 1000);
    } catch (error) {
      showToast('error', 'Trigger Failed', 'Could not start revalidation process');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Historical Revalidation</h1>
          <p className="text-sm text-slate-500 mt-1">Retroactive compliance evaluation against updated rulesets</p>
        </div>
        <button onClick={() => setTriggerModal(true)} className="btn-primary text-sm flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Trigger Revalidation
        </button>
      </div>

      {/* Stats Badges */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 mb-1">Flagged</p>
          <p className="text-2xl font-bold text-rose-400">{stats.flagged}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 mb-1">Completed</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.completed}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-slate-400 mb-1">Pending</p>
          <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
        </div>
      </div>

      {/* Trigger Modal */}
      {triggerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="glass-card p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold mb-4">Trigger Revalidation</h2>
            <div className="space-y-2">
              <button
                onClick={() => handleTrigger('sanctions')}
                disabled={triggering}
                className="w-full p-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                🚫 Sanctions List Update
              </button>
              <button
                onClick={() => handleTrigger('policy')}
                disabled={triggering}
                className="w-full p-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                📋 Policy Rules Change
              </button>
              <button
                onClick={() => handleTrigger('wallet')}
                disabled={triggering}
                className="w-full p-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                💼 Wallet Intelligence Update
              </button>
              <button
                onClick={() => handleTrigger('issuer')}
                disabled={triggering}
                className="w-full p-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                💵 Issuer Risk Downgrade
              </button>
            </div>
            <button
              onClick={() => setTriggerModal(false)}
              className="w-full mt-4 p-2 bg-slate-500/10 hover:bg-slate-500/20 rounded-lg text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Records Table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading revalidation records...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No revalidation records found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800/50">
                <th className="px-5 py-3 font-medium">Payment ID</th>
                <th className="px-5 py-3 font-medium">Trigger Reason</th>
                <th className="px-5 py-3 font-medium">Original Decision</th>
                <th className="px-5 py-3 font-medium">New Decision</th>
                <th className="px-5 py-3 font-medium">Risk Delta</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: any) => (
                <React.Fragment key={r.id}>
                  <tr className="table-row">
                    <td className="px-5 py-3 font-mono text-indigo-400 text-xs">{r.payment_id?.slice(0, 8)}...</td>
                    <td className="px-5 py-3 text-slate-300 text-xs">{r.trigger_reason}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold ${
                        r.original_decision === 'APPROVE' ? 'text-emerald-400' :
                        r.original_decision === 'REJECT' ? 'text-rose-400' :
                        'text-amber-400'
                      }`}>
                        {r.original_decision}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold ${
                        r.decision_changed ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {r.new_decision}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      {r.new_risk_score ? `${r.new_risk_score}%` : 'N/A'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge border text-xs ${
                        r.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                        r.status === 'pending' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                        'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setSelectedRecord(selectedRecord === r.id ? null : r.id)}
                        className="p-1.5 hover:bg-indigo-500/10 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <ChevronDown className={`w-4 h-4 text-indigo-400 transition-transform ${selectedRecord === r.id ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>
                  
                  {/* Detail Row */}
                  {selectedRecord === r.id && (
                    <tr className="bg-slate-900/20">
                      <td colSpan={8} className="px-5 py-4">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-slate-400 mb-1">Decision Changed</p>
                              <p className="text-sm font-semibold flex items-center gap-2">
                                {r.decision_changed ? (
                                  <>
                                    <AlertCircle className="w-4 h-4 text-rose-400" />
                                    <span className="text-rose-400">Yes</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                    <span className="text-emerald-400">No</span>
                                  </>
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-400 mb-1">Risk Score Delta</p>
                              <p className="text-sm font-semibold text-amber-400">{r.new_risk_score ? `${r.new_risk_score}%` : '0%'}</p>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-slate-800/50">
                            <p className="text-xs text-slate-400 mb-2">Original vs New Decision</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-2">
                                <p className="text-emerald-400 font-mono">{r.original_decision}</p>
                              </div>
                              <div className={`${r.decision_changed ? 'bg-rose-500/10 border-rose-500/30' : 'bg-emerald-500/10 border-emerald-500/30'} border rounded p-2`}>
                                <p className={`font-mono ${r.decision_changed ? 'text-rose-400' : 'text-emerald-400'}`}>{r.new_decision}</p>
                              </div>
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
        )}
      </div>
    </div>
  );
};
