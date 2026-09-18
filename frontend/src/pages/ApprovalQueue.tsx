import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Filter,
  X, Search, List,
  ShieldCheck, AlertTriangle, ChevronRight
} from 'lucide-react';
import { usePaymentStore } from '../store/paymentStore';
import { useAuthStore } from '../store/authStore';
import { paymentApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import type { Payment } from '../types';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusDot } from '../components/StatusBadge';

export const ApprovalQueue: React.FC = () => {
  const { payments, updateStatus, setPayments } = usePaymentStore();
  const { canApprove, user } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [corridorFilter, setCorridorFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await paymentApi.list();
        const mapped = (res.data || []).map((p: any) => ({
          id: String(p.id),
          senderCompany: p.sender_company ?? p.senderCompany ?? '',
          receiverCompany: p.receiver_company ?? p.receiverCompany ?? '',
          sourceCountry: p.source_country ?? p.sourceCountry ?? '',
          destinationCountry: p.destination_country ?? p.destinationCountry ?? '',
          sourceChain: p.source_chain ?? p.sourceChain ?? 'Base Sepolia',
          destinationChain: p.destination_chain ?? p.destinationChain ?? 'Base Sepolia',
          amount: Number(p.amount),
          token: p.token ?? 'USDC',
          purpose: p.purpose ?? '',
          urgency: p.urgency ?? 'Medium',
          status: p.status ?? 'pending',
          corridor: `${p.source_country ?? p.sourceCountry ?? ''} → ${p.destination_country ?? p.destinationCountry ?? ''}`,
          riskScore: Number(p.risk_score ?? p.riskScore ?? (p.status === 'blocked' ? 82 : 34)),
          aiDecision: p.ai_decision ?? p.aiDecision ?? (p.status === 'blocked' ? 'manual_review' : 'direct_transfer'),
          createdAt: p.created_at ?? p.createdAt ?? new Date().toISOString(),
          updatedAt: p.updated_at ?? p.updatedAt ?? new Date().toISOString(),
          senderWallet: p.sender_wallet ?? p.senderWallet,
          receiverWallet: p.receiver_wallet ?? p.receiverWallet ?? '',
        }));
        setPayments(mapped);
      } catch {
        // ignore
      }
    };
    fetchPending();
    const timer = setInterval(fetchPending, 15_000);
    return () => clearInterval(timer);
  }, [setPayments]);

  const filteredPayments = payments.filter((p) => {
    const statusMatch = statusFilter === 'all' || p.status === statusFilter;
    const corridorMatch = corridorFilter === 'all' || p.corridor === corridorFilter;
    const urgencyMatch = urgencyFilter === 'all' || p.urgency === urgencyFilter;
    return statusMatch && corridorMatch && urgencyMatch;
  });

  const corridors = [...new Set(payments.map((p) => p.corridor))];

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'escalate') => {
    try {
      if (action === 'approve') await paymentApi.approve(id);
      else if (action === 'reject') await paymentApi.reject(id);
      else await paymentApi.escalate(id);

      const statusMap = { approve: 'approved' as const, reject: 'blocked' as const, escalate: 'under_review' as const };
      updateStatus(id, statusMap[action]);

      if (selectedPayment?.id === id) {
          setSelectedPayment(prev => prev ? { ...prev, status: statusMap[action] } : null);
      }

      const labels = { approve: 'Approved', reject: 'Rejected', escalate: 'Escalated' };
      showToast(action === 'reject' ? 'error' : 'success', `Payment ${labels[action]}`, `${id} has been ${labels[action].toLowerCase()}`);
    } catch {
        showToast('error', 'Action Failed', 'Could not update status');
    }
  };

  const timeSince = (ts: string) => {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <PageHeader
        title="Approval Queue"
        description={<>Monitoring <span className="text-brand-primary font-semibold">{filteredPayments.length}</span> active transactions across all corridors.</>}
        badge={
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-600 bg-surface-elevated border border-surface-border rounded-full px-3 py-1">
            <List className="w-3 h-3 text-brand-primary" /> Settlement Operations
          </span>
        }
        actions={
          <div className="flex items-center gap-2 text-xs font-semibold text-ink-600 bg-surface-elevated border border-surface-border rounded-lg px-3 py-1.5">
            <StatusDot tone="pass" />
            Queue live
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="glass-card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-ink-400 mr-2">
            <Filter className="w-4 h-4" />
            <span className="text-[11px] font-bold uppercase tracking-wide">Filter by</span>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !py-2 !px-4 !w-auto text-xs">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="blocked">Blocked</option>
        </select>
        <select value={corridorFilter} onChange={(e) => setCorridorFilter(e.target.value)} className="select-field !py-2 !px-4 !w-auto text-xs">
            <option value="all">All Corridors</option>
            {corridors.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)} className="select-field !py-2 !px-4 !w-auto text-xs">
            <option value="all">All Urgencies</option>
            {['Low', 'Medium', 'High', 'Critical'].map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Table Main View */}
        <div className={`glass-card overflow-hidden transition-all duration-300 ${selectedPayment ? 'lg:w-2/3' : 'w-full'}`}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-ink-400 border-b border-surface-border bg-surface-elevated">
                            <th className="px-6 py-3">Transaction</th>
                            <th className="px-6 py-3">Counterparty</th>
                            <th className="px-6 py-3">Value</th>
                            <th className="px-6 py-3">Risk</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Age</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPayments.map((p) => (
                            <tr
                                key={p.id}
                                className={`table-row group cursor-pointer ${selectedPayment?.id === p.id ? 'bg-brand-soft' : ''}`}
                                onClick={() => setSelectedPayment(p)}
                            >
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-mono text-xs text-brand-primary font-semibold">#{p.id.slice(0, 8)}</span>
                                        <span className="text-[11px] text-ink-400 mt-0.5">{p.corridor}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-ink-900">{p.receiverCompany}</span>
                                        <span className="text-[11px] text-ink-400 mt-0.5">via {p.sourceChain}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="font-semibold text-ink-900">${p.amount.toLocaleString()} <span className="text-ink-400 text-xs">{p.token}</span></span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-1.5 bg-surface-border rounded-full overflow-hidden">
                                            <div className={`h-full ${p.riskScore > 70 ? 'bg-status-blocked' : p.riskScore > 40 ? 'bg-status-review' : 'bg-status-pass'}`} style={{ width: `${p.riskScore}%` }} />
                                        </div>
                                        <span className="text-[11px] font-semibold text-ink-600">{p.riskScore}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`badge ${
                                        p.status === 'executed' || p.status === 'approved' ? 'badge-pass' :
                                        p.status === 'blocked' ? 'badge-fail' :
                                        'badge-pending'
                                    }`}>
                                        {p.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs text-ink-600 font-medium">{timeSince(p.createdAt)}</span>
                                        <ChevronRight className={`w-4 h-4 text-ink-400 group-hover:text-brand-primary transition-all ${selectedPayment?.id === p.id ? 'translate-x-1 text-brand-primary' : ''}`} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {filteredPayments.length === 0 && (
                <EmptyState icon={Search} title="No matching settlements found" description="Adjust the filters above to see more transactions." />
            )}
        </div>

        {/* Side Detail Panel */}
        {selectedPayment && (
            <div className="lg:w-1/3 animate-slide-right">
                <div className="glass-card p-6 sticky top-24">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900">Settlement Details</h3>
                        <button onClick={() => setSelectedPayment(null)} className="p-2 hover:bg-surface-elevated rounded-full text-ink-400">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="p-4 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-bold text-ink-400 uppercase tracking-wide mb-1">Current Risk Score</p>
                                <p className={`text-2xl font-bold ${selectedPayment.riskScore > 70 ? 'text-status-blocked' : 'text-status-pass'}`}>{selectedPayment.riskScore}/100</p>
                            </div>
                            <div className={`p-3 rounded-full ${selectedPayment.riskScore > 70 ? 'bg-status-blocked/10' : 'bg-status-pass/10'}`}>
                                {selectedPayment.riskScore > 70 ? <AlertTriangle className="w-6 h-6 text-status-blocked" /> : <ShieldCheck className="w-6 h-6 text-status-pass" />}
                            </div>
                        </div>

                        <div className="space-y-3">
                            {[
                                { l: 'Sender Organization', v: selectedPayment.senderCompany },
                                { l: 'Receiver Organization', v: selectedPayment.receiverCompany },
                                { l: 'Settlement Amount', v: `$${selectedPayment.amount.toLocaleString()} ${selectedPayment.token}` },
                                { l: 'Compliance Route', v: selectedPayment.corridor },
                                { l: 'Urgency Level', v: selectedPayment.urgency },
                                { l: 'AI Intelligence', v: selectedPayment.aiDecision.replace(/_/g, ' ') },
                            ].map(item => (
                                <div key={item.l} className="flex justify-between items-center py-1">
                                    <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">{item.l}</span>
                                    <span className="text-xs font-semibold text-ink-900">{item.v}</span>
                                </div>
                            ))}
                        </div>

                        <div className="pt-5 border-t border-surface-border flex flex-col gap-3">
                            <button onClick={() => navigate(`/route-analysis/${selectedPayment.id}`)} className="w-full btn-secondary py-2.5 text-xs flex items-center justify-center gap-2">
                                <Search className="w-4 h-4" /> Full Layer Analysis
                            </button>

                            {canApprove() && selectedPayment.status === 'pending' && (
                                <div className="grid grid-cols-2 gap-3 mt-1">
                                    <button onClick={() => handleAction(selectedPayment.id, 'approve')} className="py-2.5 text-xs font-semibold rounded-lg text-white bg-status-pass hover:bg-green-700 transition-colors">Authorize</button>
                                    <button onClick={() => handleAction(selectedPayment.id, 'reject')} className="py-2.5 text-xs font-semibold rounded-lg text-white bg-status-blocked hover:bg-red-700 transition-colors">Veto</button>
                                </div>
                            )}

                            {canApprove() && selectedPayment.status !== 'pending' && (
                                <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-ink-400 mt-1">Transaction Finalized</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
