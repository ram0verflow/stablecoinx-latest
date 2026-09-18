import React, { useState, useEffect } from 'react';
import {
  FileText, Download, Filter, Calendar, Loader,
  Search, FileCheck, ExternalLink, RefreshCw
} from 'lucide-react';
import { reportApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import type { AuditReport } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';

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
        id: `RPT-${r.payment_id.substring(0, 8).toUpperCase()}`,
        paymentId: r.payment_id,
        corridor: r.corridor,
        amount: parseFloat(r.amount),
        token: r.token,
        status: r.status,
        aiDecision: r.ai_decision || 'APPROVE',
        zkProof: r.zk_proof || 'Not Generated',
        timestamp: r.created_at,
      })));
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
      showToast('success', 'PDF downloaded', 'Audit trail exported successfully');
    } catch (error) {
      showToast('error', 'Export Failed', 'Could not generate PDF report');
    }
  };

  const handleDownloadAll = async () => {
    try {
      setGenerating(true);
      const response = await reportApi.generateAll();
      showToast('success', `Batch Generated`, `Processed ${response.data.generated} compliance reports`);
      await loadReports();
    } catch (error) {
      showToast('error', 'Batch Failed', 'Could not generate batch reports');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 text-brand-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <PageHeader
        title="Audit Reports"
        description="Verified compliance records with ZK-proof reference IDs."
        badge={
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-600 bg-surface-elevated border border-surface-border rounded-full px-3 py-1">
            <FileCheck className="w-3 h-3 text-brand-primary" /> Immutability Audit Trail
          </span>
        }
        actions={
          <button
            onClick={handleDownloadAll}
            disabled={generating}
            className="btn-primary py-2.5 px-6 text-xs flex items-center gap-2"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generating ? 'Compiling Archive...' : 'Generate Batch Report'}
          </button>
        }
      />

      {/* Filter Toolbar */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-ink-400 mr-2">
            <Filter className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wide">Filter archive</span>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !py-2 !px-4 !w-auto text-xs">
          <option value="all">All Outcomes</option>
          <option value="approved">Approved</option>
          <option value="executed">Executed</option>
          <option value="blocked">Blocked</option>
        </select>
        <select value={corridorFilter} onChange={(e) => setCorridorFilter(e.target.value)} className="select-field !py-2 !px-4 !w-auto text-xs">
          <option value="all">All Corridors</option>
          {corridors.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-elevated border border-surface-border">
            <Calendar className="w-3 h-3 text-ink-400" />
            <span className="text-[11px] font-semibold text-ink-600 uppercase tracking-wide">{filtered.length} Indexed Reports</span>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((r) => (
            <div key={r.paymentId} className="glass-card-hover group overflow-hidden">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-lg bg-brand-soft text-brand-primary">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wide text-ink-900">{r.id}</h4>
                                <p className="text-[11px] font-medium text-ink-400 mt-0.5">{new Date(r.timestamp).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <span className={`badge ${r.status === 'executed' || r.status === 'approved' ? 'badge-pass' : 'badge-fail'}`}>
                            {r.status}
                        </span>
                    </div>

                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Protocol Reference</span>
                            <span className="font-mono text-[11px] text-brand-primary" title={r.zkProof}>
                                {r.zkProof.length > 15 ? `${r.zkProof.substring(0, 15)}...` : r.zkProof}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Asset Value</span>
                            <span className="text-xs font-bold text-ink-900">${r.amount.toLocaleString()} <span className="text-ink-400 text-[11px]">{r.token}</span></span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Corridor</span>
                            <span className="text-[11px] font-semibold text-ink-600">{r.corridor}</span>
                        </div>
                    </div>

                    <div className="pt-5 border-t border-surface-border flex gap-3">
                        <button
                            onClick={() => handleDownload(r.paymentId)}
                            className="flex-1 btn-secondary py-2.5 text-[11px] uppercase font-bold tracking-wide flex items-center justify-center gap-2"
                        >
                            <Download className="w-3.5 h-3.5" /> Export PDF
                        </button>
                        <button className="p-2.5 rounded-lg border border-surface-border hover:border-brand-primary/40 transition-colors">
                            <ExternalLink className="w-4 h-4 text-ink-400 group-hover:text-brand-primary transition-colors" />
                        </button>
                    </div>
                </div>
            </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState icon={Search} title="No audit records identified in current scope" description="Adjust the filters above or generate a batch report." />
      )}
    </div>
  );
};
