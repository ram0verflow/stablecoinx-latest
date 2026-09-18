import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Filter, Calendar, Loader, 
  Search, ShieldCheck, FileCheck, CheckCircle2, ChevronRight,
  ExternalLink
} from 'lucide-react';
import { reportApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
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
    <div className="space-y-8 animate-fade-in pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
           <div className="flex items-center gap-2 text-brand-primary text-[10px] font-black uppercase tracking-widest mb-2">
              <FileCheck className="w-3 h-3" />
              Immutability Audit Trail
           </div>
           <h1 className="text-3xl font-extrabold text-white">Audit Reports</h1>
           <p className="text-slate-500 font-medium">Verified compliance records with ZK-proof reference IDs.</p>
        </div>
        <button
          onClick={handleDownloadAll}
          disabled={generating}
          className="btn-primary py-3 px-8 text-xs flex items-center gap-2 shadow-brand-primary/10"
        >
          {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? 'Compiling Archive...' : 'Generate Batch Report'}
        </button>
      </header>

      {/* Filter Toolbar */}
      <div className="glass-card p-4 border-white/5 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-slate-500 mr-2">
            <Filter className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Filter Archive</span>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !py-2 !px-4 !w-auto text-xs bg-slate-900/50">
          <option value="all">All Outcomes</option>
          <option value="approved">Approved</option>
          <option value="executed">Executed</option>
          <option value="blocked">Blocked</option>
        </select>
        <select value={corridorFilter} onChange={(e) => setCorridorFilter(e.target.value)} className="select-field !py-2 !px-4 !w-auto text-xs bg-slate-900/50">
          <option value="all">All Corridors</option>
          {corridors.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/50 border border-white/5">
            <Calendar className="w-3 h-3 text-slate-600" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{filtered.length} Indexed Reports</span>
        </div>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((r) => (
            <div key={r.paymentId} className="glass-card group hover:border-brand-primary/30 transition-all duration-500 overflow-hidden">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-widest text-white">{r.id}</h4>
                                <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{new Date(r.timestamp).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <span className={`badge ${r.status === 'executed' || r.status === 'approved' ? 'badge-pass' : 'badge-fail'}`}>
                            {r.status}
                        </span>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Protocol Reference</span>
                            <span className="font-mono text-[10px] text-brand-primary" title={r.zkProof}>
                                {r.zkProof.length > 15 ? `${r.zkProof.substring(0, 15)}...` : r.zkProof}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asset Value</span>
                            <span className="text-xs font-black text-white">${r.amount.toLocaleString()} <span className="text-slate-500 text-[10px]">{r.token}</span></span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Corridor</span>
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{r.corridor}</span>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-white/5 flex gap-3">
                        <button 
                            onClick={() => handleDownload(r.paymentId)}
                            className="flex-1 btn-secondary py-3 text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2 group-hover:bg-brand-primary group-hover:text-white transition-all"
                        >
                            <Download className="w-3.5 h-3.5" /> Export PDF
                        </button>
                        <button className="p-3 rounded-xl border border-white/5 hover:border-brand-primary/30 transition-colors">
                            <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-brand-primary transition-colors" />
                        </button>
                    </div>
                </div>
                <div className="h-1 bg-gradient-to-r from-brand-primary to-brand-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-32 flex flex-col items-center justify-center text-center opacity-40 border-dashed border-white/10 bg-transparent rounded-3xl">
            <Search className="w-16 h-16 text-slate-700 mb-6" />
            <p className="text-sm font-black uppercase tracking-widest text-slate-500">No audit records identified in current scope</p>
        </div>
      )}
    </div>
  );
};

const RefreshCw = (props: any) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);
