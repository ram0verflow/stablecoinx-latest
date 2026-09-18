import React, { useState } from 'react';
import { FileText, Download, Filter, Calendar, Fingerprint } from 'lucide-react';
import { reportApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import { StatusBadge } from '../components/StatusBadge';
import type { AuditReport } from '../types';

const MOCK_REPORTS: AuditReport[] = [
  { id: 'RPT-001', paymentId: 'PAY-001', corridor: 'SG → UK', amount: 250000, token: 'USDC', status: 'settled', aiDecision: 'APPROVE', zkProof: '0x7a3f...b92e', timestamp: '2025-04-27T09:05:00Z' },
  { id: 'RPT-002', paymentId: 'PAY-004', corridor: 'SG → US', amount: 75000, token: 'USDC', status: 'approved', aiDecision: 'APPROVE', zkProof: '0x9c2d...a41f', timestamp: '2025-04-27T13:02:00Z' },
  { id: 'RPT-003', paymentId: 'PAY-005', corridor: 'UK → DE', amount: 320000, token: 'USDT', status: 'blocked', aiDecision: 'REJECT', zkProof: 'N/A', timestamp: '2025-04-27T14:46:00Z' },
  { id: 'RPT-004', paymentId: 'PAY-006', corridor: 'IN → SG', amount: 92000, token: 'USDC', status: 'settled', aiDecision: 'APPROVE', zkProof: '0x3e8b...d5c7', timestamp: '2025-04-26T08:04:00Z' },
  { id: 'RPT-005', paymentId: 'PAY-003', corridor: 'AE → IN', amount: 500000, token: 'USDC', status: 'review', aiDecision: 'ESCALATE', zkProof: '0x1f4a...e9b2', timestamp: '2025-04-27T11:20:00Z' },
];

export const AuditReports: React.FC = () => {
  const { showToast } = useToast();
  const [reports] = useState<AuditReport[]>(MOCK_REPORTS);
  const [statusFilter, setStatusFilter] = useState('all');
  const [corridorFilter, setCorridorFilter] = useState('all');

  const filtered = reports.filter((r) => {
    const s = statusFilter === 'all' || r.status === statusFilter;
    const c = corridorFilter === 'all' || r.corridor === corridorFilter;
    return s && c;
  });

  const corridors = [...new Set(reports.map((r) => r.corridor))];

  const handleDownload = async (id: string) => {
    try {
      const { data } = await reportApi.download(id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = `audit_${id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('info', 'Demo Mode', `PDF download for ${id} would trigger in production`);
    }
  };

  const handleDownloadAll = async () => {
    try {
      await reportApi.downloadAll();
    } catch {
      showToast('info', 'Demo Mode', 'Bulk PDF export would trigger in production');
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Audit Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Compliance audit trail for all processed payments</p>
        </div>
        <button onClick={handleDownloadAll} className="btn-primary text-sm flex items-center gap-2">
          <Download className="w-4 h-4" /> Download All
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-4 flex items-center gap-4">
        <Filter className="w-4 h-4 text-slate-500" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !py-2 text-xs !w-40">
          <option value="all">All Statuses</option>
          <option value="settled">Settled</option>
          <option value="approved">Approved</option>
          <option value="blocked">Blocked</option>
          <option value="review">Review</option>
        </select>
        <select value={corridorFilter} onChange={(e) => setCorridorFilter(e.target.value)} className="select-field !py-2 text-xs !w-40">
          <option value="all">All Corridors</option>
          {corridors.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-2 ml-auto text-xs text-slate-500">
          <Calendar className="w-3.5 h-3.5" />
          <span>{filtered.length} reports</span>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-800/50">
              <th className="px-5 py-3 font-medium">Report ID</th>
              <th className="px-5 py-3 font-medium">Payment</th>
              <th className="px-5 py-3 font-medium">Corridor</th>
              <th className="px-5 py-3 font-medium">Amount</th>
              <th className="px-5 py-3 font-medium">Token</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">AI Decision</th>
              <th className="px-5 py-3 font-medium">ZK Proof</th>
              <th className="px-5 py-3 font-medium">Timestamp</th>
              <th className="px-5 py-3 font-medium">PDF</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="px-5 py-3 font-mono text-indigo-400 text-xs">{r.id}</td>
                <td className="px-5 py-3 font-mono text-slate-400 text-xs">{r.paymentId}</td>
                <td className="px-5 py-3 text-slate-300">{r.corridor}</td>
                <td className="px-5 py-3 font-semibold text-white">${r.amount.toLocaleString()}</td>
                <td className="px-5 py-3"><span className="badge bg-slate-800 text-slate-300 border border-slate-700">{r.token}</span></td>
                <td className="px-5 py-3"><StatusBadge status={r.status as any} /></td>
                <td className="px-5 py-3">
                  <span className={`text-xs font-semibold ${r.aiDecision === 'APPROVE' ? 'text-emerald-400' : r.aiDecision === 'REJECT' ? 'text-rose-400' : 'text-amber-400'}`}>
                    {r.aiDecision}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-xs font-mono text-slate-500">{r.zkProof}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-xs text-slate-500">{new Date(r.timestamp).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <button onClick={() => handleDownload(r.id)} className="p-1.5 hover:bg-indigo-500/10 rounded-lg transition-colors" title="Download PDF">
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
