import React, { useState, useEffect } from 'react';
import { FileText, Download, Filter, Calendar, Loader } from 'lucide-react';
import { reportApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import { StatusBadge } from '../components/StatusBadge';
import type { AuditReport } from '../types';

export const AuditReports: React.FC = () => {
  const { showToast } = useToast();
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [corridorFilter, setCorridorFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await reportApi.list();
      const reportsData = response.data.reports || [];
      setReports(reportsData.map((r: any) => ({
        id: `RPT-${r.payment_id.substring(0, 8)}`,
        paymentId: r.payment_id,
        corridor: r.corridor,
        amount: parseFloat(r.amount),
        token: r.token,
        status: r.status,
        aiDecision: 'APPROVE',
        zkProof: '0x...',
        timestamp: r.created_at,
      })));
      showToast('success', 'Reports loaded', `${reportsData.length} reports found`);
    } catch (error) {
      showToast('error', 'Failed to load reports');
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = reports.filter((r) => {
    const s = statusFilter === 'all' || r.status === statusFilter;
    const c = corridorFilter === 'all' || r.corridor === corridorFilter;
    return s && c;
  });

  const corridors = [...new Set(reports.map((r) => r.corridor))];

  const handleDownload = async (paymentId: string) => {
    try {
      const response = await reportApi.downloadPayment(paymentId);
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_report_${paymentId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'PDF downloaded successfully');
    } catch (error) {
      showToast('error', 'Failed to download PDF');
    }
  };

  const handleDownloadAll = async () => {
    try {
      setGenerating(true);
      const response = await reportApi.generateAll();
      showToast('success', `Generated ${response.data.generated} reports`);
      await loadReports();
    } catch (error) {
      showToast('error', 'Failed to generate batch reports');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Audit Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Compliance audit trail for all processed payments</p>
        </div>
        <button
          onClick={handleDownloadAll}
          disabled={generating}
          className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader className="w-4 h-4 animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" /> Download All
            </>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 mb-4 flex items-center gap-4">
        <Filter className="w-4 h-4 text-slate-500" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !py-2 text-xs !w-40">
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="executed">Executed</option>
          <option value="blocked">Blocked</option>
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
              <th className="px-5 py-3 font-medium">Timestamp</th>
              <th className="px-5 py-3 font-medium">PDF</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-slate-500">
                  No audit reports available
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.paymentId} className="table-row">
                  <td className="px-5 py-3 font-mono text-indigo-400 text-xs">{r.id}</td>
                  <td className="px-5 py-3 font-mono text-slate-400 text-xs">{r.paymentId.substring(0, 8)}</td>
                  <td className="px-5 py-3 text-slate-300">{r.corridor}</td>
                  <td className="px-5 py-3 font-semibold text-white">${r.amount.toLocaleString()}</td>
                  <td className="px-5 py-3"><span className="badge bg-slate-800 text-slate-300 border border-slate-700">{r.token}</span></td>
                  <td className="px-5 py-3"><StatusBadge status={r.status as any} /></td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-semibold text-emerald-400">
                      {r.aiDecision}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500">{new Date(r.timestamp).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleDownload(r.paymentId)}
                      className="p-1.5 hover:bg-indigo-500/10 rounded-lg transition-colors"
                      title="Download PDF"
                    >
                      <FileText className="w-4 h-4 text-indigo-400" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
