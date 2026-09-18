import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Globe, ShieldAlert, Landmark, Link2, Droplets, Brain, Lock, Fingerprint,
  CheckCircle2, XCircle, AlertTriangle, ArrowLeft, ThumbsUp, ThumbsDown, ArrowUpRight,
} from 'lucide-react';
import { usePaymentStore } from '../store/paymentStore';
import { useAuthStore } from '../store/authStore';
import { routeApi, paymentApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { StatusBadge, DecisionBadge, RiskBadge } from '../components/StatusBadge';
import type { RouteAnalysis as RA } from '../types';

const MOCK_ANALYSIS: Omit<RA, 'paymentId' | 'payment'> = {
  countryPolicy: [
    { layer: 'OFAC Sanctions Check', status: 'PASS', details: 'No matches found in OFAC SDN list' },
    { layer: 'EU Sanctions Screening', status: 'PASS', details: 'Entity not on EU consolidated sanctions list' },
    { layer: 'UN Sanctions Verification', status: 'PASS', details: 'Cleared against UN Security Council lists' },
    { layer: 'Cross-border Transfer Limit', status: 'PASS', details: 'Amount within corridor regulatory limit of $1M' },
    { layer: 'KYC/AML Threshold', status: 'WARNING', details: 'Amount exceeds $100K enhanced due diligence threshold' },
    { layer: 'Currency Control Check', status: 'PASS', details: 'No capital control restrictions on stablecoin transfers' },
  ],
  walletRisk: {
    score: 23,
    level: 'Low',
    warnings: [
      'Sender wallet has 47 prior transactions — established history',
      'No mixer/tumbler interactions detected in 3-hop graph analysis',
      'Receiver wallet first seen 90 days ago — moderate age',
    ],
  },
  issuerRisk: {
    usdc: { rating: 'A+', reserve: '100% US Treasuries + Cash', audited: true, depegEvents: 1 },
    usdt: { rating: 'B+', reserve: '85% Reserves (mixed)', audited: false, depegEvents: 3 },
  },
  chainGovernance: {
    allowedChains: ['Base Sepolia', 'Polygon Amoy'],
    bridgeTrustScore: 87,
    gasEstimate: '0.0034 ETH (~$8.50)',
  },
  liquidityAnalysis: {
    cheapestRoute: 'Direct transfer via Base Sepolia USDC pool',
    slippage: '0.02%',
    eta: '~45 seconds',
    totalCost: '$12.30 (gas + protocol fees)',
  },
  aiDecision: {
    action: 'APPROVE',
    reasoning: 'Based on analysis of all compliance layers, this transaction presents low risk. The sender and receiver entities are verified with clean sanctions records. Wallet graph analysis shows no suspicious patterns — the sender has an established transaction history of 47 prior settlements. The USDC issuer (Circle) maintains full reserve backing with regular third-party audits. Cross-chain governance checks confirm both Base Sepolia and Polygon Amoy are operational with a bridge trust score of 87/100. The only flag is the enhanced due diligence threshold ($100K+), which has been satisfied through existing KYC documentation. Recommendation: APPROVE with standard monitoring.',
    confidence: 94,
  },
  fheCheck: { status: 'PASS', details: 'Encrypted compliance verification completed — all thresholds satisfied without data exposure' },
  zkProof: { generated: true, proofHash: '0x7a3f...b92e1d4c8f0a2e6b3d9c1f5a8e7b4d2c6f0a3e9b5d1c7f4a0e8b2d6c9f3a1e' },
};

const SectionCard: React.FC<{ icon: any; title: string; iconColor: string; children: React.ReactNode }> = ({ icon: Icon, title, iconColor, children }) => (
  <div className="glass-card p-5 animate-slide-up">
    <div className="flex items-center gap-2 mb-4">
      <Icon className={`w-5 h-5 ${iconColor}`} />
      <h3 className="section-title">{title}</h3>
    </div>
    {children}
  </div>
);

export const RouteAnalysis: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { payments, updateStatus } = usePaymentStore();
  const { canApprove } = useAuthStore();
  const { showToast } = useToast();
  const [analysis, setAnalysis] = useState<Omit<RA, 'paymentId' | 'payment'> | null>(null);
  const [loading, setLoading] = useState(true);

  const payment = payments.find((p) => p.id === paymentId);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await routeApi.analyze(paymentId!);
        setAnalysis(data);
      } catch {
        setAnalysis(MOCK_ANALYSIS);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [paymentId]);

  const handleAction = async (action: 'approve' | 'reject' | 'escalate') => {
    try {
      if (action === 'approve') await paymentApi.approve(paymentId!);
      else if (action === 'reject') await paymentApi.reject(paymentId!);
      else await paymentApi.escalate(paymentId!);
    } catch { /* demo mode */ }
    const statusMap = { approve: 'approved' as const, reject: 'blocked' as const, escalate: 'review' as const };
    updateStatus(paymentId!, statusMap[action]);
    const labels = { approve: 'Approved', reject: 'Rejected', escalate: 'Escalated' };
    showToast(action === 'reject' ? 'error' : 'success', `Payment ${labels[action]}`, `${paymentId} has been ${labels[action].toLowerCase()}`);
    navigate('/approval-queue');
  };

  if (loading) return <LoadingSpinner size="lg" text="Running 24-layer compliance analysis..." />;

  const a = analysis!;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="page-title">Route Analysis</h1>
            <p className="text-sm text-slate-500 mt-0.5">Payment {paymentId} — {payment?.corridor || 'N/A'}</p>
          </div>
        </div>
        {payment && <StatusBadge status={payment.status} />}
      </div>

      {/* Payment Summary */}
      {payment && (
        <div className="glass-card p-5 grid grid-cols-5 gap-4">
          {[
            ['Sender', payment.senderCompany],
            ['Receiver', payment.receiverCompany],
            ['Amount', `$${payment.amount.toLocaleString()} ${payment.token}`],
            ['Corridor', payment.corridor],
            ['Urgency', payment.urgency],
          ].map(([l, v]) => (
            <div key={l}>
              <p className="text-xs text-slate-500">{l}</p>
              <p className="text-sm font-semibold text-slate-200 mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* Country Policy */}
        <SectionCard icon={Globe} title="Country Policy Check" iconColor="text-sky-400">
          <div className="space-y-2">
            {a.countryPolicy.map((d) => (
              <div key={d.layer} className="flex items-start gap-3 py-2 border-b border-slate-800/30 last:border-0">
                {d.status === 'PASS' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> :
                 d.status === 'FAIL' ? <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" /> :
                 <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{d.layer}</span>
                    <DecisionBadge status={d.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{d.details}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Wallet Risk */}
        <SectionCard icon={ShieldAlert} title="Wallet Risk Score" iconColor="text-violet-400">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{a.walletRisk.score}</span>
            </div>
            <div>
              <RiskBadge score={a.walletRisk.score} />
              <p className="text-sm text-slate-400 mt-1">Risk Level: <span className="text-slate-200 font-medium">{a.walletRisk.level}</span></p>
            </div>
          </div>
          <div className="space-y-2">
            {a.walletRisk.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="text-slate-600 mt-0.5">•</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Issuer Risk */}
        <SectionCard icon={Landmark} title="Stablecoin Issuer Risk" iconColor="text-amber-400">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-800/50">
                <th className="py-2 text-left">Metric</th>
                <th className="py-2 text-center">USDC</th>
                <th className="py-2 text-center">USDT</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              <tr className="border-b border-slate-800/30">
                <td className="py-2 text-slate-400">Rating</td>
                <td className="py-2 text-center font-semibold text-emerald-400">{a.issuerRisk.usdc.rating}</td>
                <td className="py-2 text-center font-semibold text-amber-400">{a.issuerRisk.usdt.rating}</td>
              </tr>
              <tr className="border-b border-slate-800/30">
                <td className="py-2 text-slate-400">Reserve</td>
                <td className="py-2 text-center text-xs">{a.issuerRisk.usdc.reserve}</td>
                <td className="py-2 text-center text-xs">{a.issuerRisk.usdt.reserve}</td>
              </tr>
              <tr className="border-b border-slate-800/30">
                <td className="py-2 text-slate-400">Audited</td>
                <td className="py-2 text-center">{a.issuerRisk.usdc.audited ? <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" /> : <XCircle className="w-4 h-4 text-rose-400 inline" />}</td>
                <td className="py-2 text-center">{a.issuerRisk.usdt.audited ? <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" /> : <XCircle className="w-4 h-4 text-rose-400 inline" />}</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-400">Depeg Events</td>
                <td className="py-2 text-center">{a.issuerRisk.usdc.depegEvents}</td>
                <td className="py-2 text-center">{a.issuerRisk.usdt.depegEvents}</td>
              </tr>
            </tbody>
          </table>
        </SectionCard>

        {/* Chain Governance */}
        <SectionCard icon={Link2} title="Chain Governance" iconColor="text-cyan-400">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500">Allowed Chains</p>
              <div className="flex gap-2 mt-1">
                {a.chainGovernance.allowedChains.map((c) => (
                  <span key={c} className="badge bg-slate-800 text-slate-300 border border-slate-700">{c}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500">Bridge Trust Score</p>
                <p className="text-xl font-bold text-white mt-1">{a.chainGovernance.bridgeTrustScore}<span className="text-sm text-slate-500">/100</span></p>
              </div>
              <div className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500">Gas Estimate</p>
                <p className="text-sm font-semibold text-white mt-1">{a.chainGovernance.gasEstimate}</p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Liquidity */}
        <SectionCard icon={Droplets} title="Liquidity Analysis" iconColor="text-blue-400">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Cheapest Route', a.liquidityAnalysis.cheapestRoute],
              ['Slippage', a.liquidityAnalysis.slippage],
              ['ETA', a.liquidityAnalysis.eta],
              ['Total Cost', a.liquidityAnalysis.totalCost],
            ].map(([label, val]) => (
              <div key={label} className="p-3 bg-slate-800/50 rounded-xl">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm font-semibold text-slate-200 mt-1">{val}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* AI Decision */}
        <SectionCard icon={Brain} title="AI Decision Engine" iconColor="text-purple-400">
          <div className="flex items-center gap-3 mb-3">
            <span className={`badge border text-sm px-3 py-1.5 ${
              a.aiDecision.action === 'APPROVE' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
              a.aiDecision.action === 'REJECT' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
              'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}>
              {a.aiDecision.action}
            </span>
            <span className="text-sm text-slate-400">Confidence: <span className="text-white font-semibold">{a.aiDecision.confidence}%</span></span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{a.aiDecision.reasoning}</p>
        </SectionCard>
      </div>

      {/* FHE + ZK */}
      <div className="grid grid-cols-2 gap-5">
        <SectionCard icon={Lock} title="FHE Private Check" iconColor="text-teal-400">
          <div className="flex items-center gap-3">
            <DecisionBadge status={a.fheCheck.status} />
            <p className="text-sm text-slate-400">{a.fheCheck.details}</p>
          </div>
        </SectionCard>

        <SectionCard icon={Fingerprint} title="ZK Proof" iconColor="text-green-400">
          <div className="flex items-center gap-3">
            {a.zkProof.generated ? (
              <span className="badge bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Generated</span>
            ) : (
              <span className="badge bg-slate-700 text-slate-400 border border-slate-600">Pending</span>
            )}
            <p className="text-xs font-mono text-slate-500 truncate">{a.zkProof.proofHash}</p>
          </div>
        </SectionCard>
      </div>

      {/* Actions */}
      {canApprove() && payment?.status === 'pending' && (
        <div className="glass-card p-5 flex items-center justify-between">
          <p className="text-sm text-slate-400">Take action on this payment</p>
          <div className="flex gap-3">
            <button onClick={() => handleAction('approve')} className="btn-success flex items-center gap-2 text-sm">
              <ThumbsUp className="w-4 h-4" /> Approve
            </button>
            <button onClick={() => handleAction('reject')} className="btn-danger flex items-center gap-2 text-sm">
              <ThumbsDown className="w-4 h-4" /> Reject
            </button>
            <button onClick={() => handleAction('escalate')} className="btn-secondary flex items-center gap-2 text-sm">
              <ArrowUpRight className="w-4 h-4" /> Escalate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
