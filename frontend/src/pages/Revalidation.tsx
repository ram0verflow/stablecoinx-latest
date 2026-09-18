import React, { useState } from 'react';
import { ShieldAlert, RotateCcw, FileText } from 'lucide-react';
import { revalidationApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import { StatusBadge, RiskBadge } from '../components/StatusBadge';
import type { RevalidationRecord } from '../types';

const MOCK_RECORDS: RevalidationRecord[] = [
  { id: 'REV-001', paymentId: 'PAY-006', originalDecision: 'APPROVE', revalidationReason: 'Updated OFAC SDN list', newRiskScore: 85, status: 'completed', timestamp: '2025-04-27T15:00:00Z' },
  { id: 'REV-002', paymentId: 'PAY-002', originalDecision: 'ESCALATE', revalidationReason: 'Wallet graph age > 90 days', newRiskScore: 42, status: 'pending', timestamp: '2025-04-27T12:00:00Z' },
];

export const Revalidation: React.FC = () => {
  const { showToast } = useToast();
  const [records, setRecords] = useState<RevalidationRecord[]>(MOCK_RECORDS);

  const handleTrigger = async () => {
    try {
      await revalidationApi.trigger('ALL');
      showToast('success', 'Revalidation Triggered', 'Background revalidation process started');
    } catch {
      showToast('info', 'Demo Mode', 'Background revalidation triggered locally');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Historical Revalidation</h1>
          <p className="text-sm text-slate-500 mt-1">Retroactive compliance evaluation against updated rulesets</p>
        </div>
        <button onClick={handleTrigger} className="btn-primary text-sm flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Trigger Revalidation
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-800/50">
              <th className="px-5 py-3 font-medium">Reval ID</th>
              <th className="px-5 py-3 font-medium">Payment ID</th>
              <th className="px-5 py-3 font-medium">Original Decision</th>
              <th className="px-5 py-3 font-medium">Reason</th>
              <th className="px-5 py-3 font-medium">New Risk Score</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Timestamp</th>
              <th className="px-5 py-3 font-medium">Report</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="px-5 py-3 font-mono text-indigo-400 text-xs">{r.id}</td>
                <td className="px-5 py-3 font-mono text-slate-400 text-xs">{r.paymentId}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-semibold ${r.originalDecision === 'APPROVE' ? 'text-emerald-400' : r.originalDecision === 'REJECT' ? 'text-rose-400' : 'text-amber-400'}`}>
                    {r.originalDecision}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-300">{r.revalidationReason}</td>
                <td className="px-5 py-3"><RiskBadge score={r.newRiskScore} /></td>
                <td className="px-5 py-3">
                  <span className={`badge border ${r.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : r.status === 'pending' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-slate-500">{new Date(r.timestamp).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <button className="p-1.5 hover:bg-indigo-500/10 rounded-lg transition-colors" title="View Report">
                    <FileText className="w-4 h-4 text-indigo-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
