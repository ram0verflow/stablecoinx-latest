import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Filter, ThumbsUp, ThumbsDown, ArrowUpRight,
  X, Eye, Clock,
} from 'lucide-react';
import { usePaymentStore } from '../store/paymentStore';
import { useAuthStore } from '../store/authStore';
import { paymentApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import { StatusBadge, RiskBadge } from '../components/StatusBadge';
import type { Payment } from '../types';

export const ApprovalQueue: React.FC = () => {
  const { payments, updateStatus, setPayments } = usePaymentStore();
  const { canApprove } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [corridorFilter, setCorridorFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isRejectShake, setIsRejectShake] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        // Fetch ALL payments (not just pending) so the queue shows real data
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
          riskScore: 45,
          aiDecision: 'PENDING',
          createdAt: p.created_at ?? p.createdAt ?? new Date().toISOString(),
          updatedAt: p.updated_at ?? p.updatedAt ?? new Date().toISOString(),
        }));
        if (mapped.length) setPayments(mapped);
      } catch {
        // ignore in demo mode
      }
    };
    fetchPending();
    const timer = setInterval(fetchPending, 15_000);
    return () => clearInterval(timer);
  }, [setPayments]);

  const pendingPayments = payments.filter((p) => {
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
    } catch { /* demo */ }
    const statusMap = { approve: 'approved' as const, reject: 'blocked' as const, escalate: 'under_review' as const };
    updateStatus(id, statusMap[action]);
    setSelectedPayment(null);
    if (action === 'approve') {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1200);
    }
    if (action === 'reject') {
      setIsRejectShake(true);
      setTimeout(() => setIsRejectShake(false), 500);
    }
    const labels = { approve: 'Approved', reject: 'Rejected', escalate: 'Escalated' };
    showToast(action === 'reject' ? 'error' : 'success', `Payment ${labels[action]}`, `${id} has been ${labels[action].toLowerCase()}`);
  };

  const timeSince = (ts: string) => {
    const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Approval Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            {pendingPayments.length} payments in queue
            <span className="ml-2 px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs">{pendingPayments.length}</span>
          </p>
        </div>
      </div>
      {showConfetti && <div className="text-center text-emerald-300 text-xs">🎉 Payment approved successfully</div>}

      {/* Filters */}
      <div className="glass-card p-4 mb-4 flex items-center gap-4">
        <Filter className="w-4 h-4 text-slate-500" />
        <div className="relative">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select-field !py-2 text-xs !w-40">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Review</option>
            <option value="approved">Approved</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        <div className="relative">
          <select value={corridorFilter} onChange={(e) => setCorridorFilter(e.target.value)} className="select-field !py-2 text-xs !w-40">
            <option value="all">All Corridors</option>
            {corridors.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="relative">
          <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)} className="select-field !py-2 text-xs !w-40">
            <option value="all">All Urgencies</option>
            {['Low', 'Medium', 'High', 'Critical'].map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Table */}
        <div className={`glass-card overflow-hidden flex-1 transition-all duration-300 ${selectedPayment ? 'w-3/5' : 'w-full'} ${isRejectShake ? 'animate-pulse' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-800/50">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Sender</th>
                  <th className="px-4 py-3 font-medium">Receiver</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Token</th>
                  <th className="px-4 py-3 font-medium">Corridor</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                  <th className="px-4 py-3 font-medium">AI</th>
                  <th className="px-4 py-3 font-medium">Waiting</th>
                  {canApprove() && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((p) => (
                  <tr
                    key={p.id}
                    className={`table-row cursor-pointer ${selectedPayment?.id === p.id ? 'bg-indigo-500/5' : ''}`}
                    onClick={() => setSelectedPayment(p)}
                  >
                    <td className="px-4 py-3 font-mono text-indigo-400 text-xs">{p.id}</td>
                    <td className="px-4 py-3 text-slate-300">{p.senderCompany}</td>
                    <td className="px-4 py-3 text-slate-300">{p.receiverCompany}</td>
                    <td className="px-4 py-3 font-semibold text-white">${p.amount.toLocaleString()}</td>
                    <td className="px-4 py-3"><span className="badge bg-slate-800 text-slate-300 border border-slate-700">{p.token}</span></td>
                    <td className="px-4 py-3 text-slate-400">{p.corridor}</td>
                    <td className="px-4 py-3"><RiskBadge score={p.riskScore} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{p.aiDecision}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{timeSince(p.createdAt)}</td>
                    {canApprove() && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleAction(p.id, 'approve')} className="p-1.5 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Approve"><ThumbsUp className="w-3.5 h-3.5 text-emerald-400" /></button>
                          <button onClick={() => handleAction(p.id, 'reject')} className="p-1.5 hover:bg-rose-500/10 rounded-lg transition-colors" title="Reject"><ThumbsDown className="w-3.5 h-3.5 text-rose-400" /></button>
                          <button onClick={() => handleAction(p.id, 'escalate')} className="p-1.5 hover:bg-amber-500/10 rounded-lg transition-colors" title="Escalate"><ArrowUpRight className="w-3.5 h-3.5 text-amber-400" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {pendingPayments.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-500">No payments match the current filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Panel */}
        {selectedPayment && (
          <div className="w-2/5 glass-card p-5 animate-slide-right max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Payment Details</h3>
              <button onClick={() => setSelectedPayment(null)} className="p-1 hover:bg-slate-800 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-3">
              {[
                ['Payment ID', selectedPayment.id],
                ['Sender', selectedPayment.senderCompany],
                ['Receiver', selectedPayment.receiverCompany],
                ['Amount', `$${selectedPayment.amount.toLocaleString()} ${selectedPayment.token}`],
                ['Corridor', selectedPayment.corridor],
                ['Source Chain', selectedPayment.sourceChain],
                ['Dest Chain', selectedPayment.destinationChain],
                ['Purpose', selectedPayment.purpose],
                ['Urgency', selectedPayment.urgency],
                ['Risk Score', String(selectedPayment.riskScore)],
                ['AI Decision', selectedPayment.aiDecision],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-2 border-b border-slate-800/30">
                  <span className="text-xs text-slate-500">{l}</span>
                  <span className="text-sm text-slate-200 font-medium">{v}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-slate-500">Status</span>
                <StatusBadge status={selectedPayment.status} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => navigate(`/route-analysis/${selectedPayment.id}`)} className="btn-secondary text-xs flex items-center gap-1.5 flex-1 justify-center">
                <Eye className="w-3.5 h-3.5" /> Full Analysis
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
