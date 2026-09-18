import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, XCircle, ExternalLink, Shield, Brain, Lock, Zap, RefreshCw } from 'lucide-react';
import { routeApi } from '../lib/api';
import { usePaymentStore } from '../store/paymentStore';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import type { RouteAnalysis as RouteAnalysisType } from '../types';

type StageState = 'pending' | 'running' | 'pass' | 'fail';

interface Stage {
  id: number;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

const STAGES: Stage[] = [
  { id: 1, label: 'Payment Intent', sublabel: 'Created & validated', icon: <Zap className="w-4 h-4" /> },
  { id: 2, label: 'Country Policy Governance', sublabel: 'Corridor check', icon: <Shield className="w-4 h-4" /> },
  { id: 3, label: 'Corporate Treasury Controls', sublabel: 'Spend limits & dual approval', icon: <Shield className="w-4 h-4" /> },
  { id: 4, label: 'Compliance Engine', sublabel: 'KYC / KYB / Sanctions', icon: <Shield className="w-4 h-4" /> },
  { id: 5, label: 'Wallet Graph Intelligence', sublabel: 'Risk score & links', icon: <Brain className="w-4 h-4" /> },
  { id: 6, label: 'Stablecoin Issuer Risk', sublabel: 'USDC vs USDT', icon: <Shield className="w-4 h-4" /> },
  { id: 7, label: 'Cross-Chain Governance', sublabel: 'Bridge trust score', icon: <Zap className="w-4 h-4" /> },
  { id: 8, label: 'Liquidity + Cost Engine', sublabel: 'Best route & cost', icon: <Zap className="w-4 h-4" /> },
  { id: 9, label: 'AI Decision Engine', sublabel: 'Recommendation & confidence', icon: <Brain className="w-4 h-4" /> },
  { id: 10, label: 'Policy Final Veto', sublabel: 'Deterministic override', icon: <Shield className="w-4 h-4" /> },
  { id: 11, label: 'FHE Private Checks', sublabel: 'Encrypted threshold checks', icon: <Lock className="w-4 h-4" /> },
  { id: 12, label: 'ZK Proof Generator', sublabel: 'Proof hash & verification', icon: <Lock className="w-4 h-4" /> },
  { id: 13, label: 'Human Approval', sublabel: 'Review queue', icon: <Shield className="w-4 h-4" /> },
  { id: 14, label: 'Execution / Settlement', sublabel: 'On-chain proof stored', icon: <Zap className="w-4 h-4" /> },
];

const stateColor: Record<StageState, string> = {
  pending: 'border-slate-700 bg-slate-900/30',
  running: 'border-blue-500/60 bg-blue-500/10',
  pass: 'border-emerald-500/60 bg-emerald-500/10',
  fail: 'border-rose-500/60 bg-rose-500/10',
};

const stateIcon = (s: StageState) => {
  if (s === 'running') return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
  if (s === 'pass') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (s === 'fail') return <XCircle className="w-4 h-4 text-rose-400" />;
  return <span className="h-2 w-2 rounded-full bg-slate-600 mt-1" />;
};

function stageDetail(id: number, a: RouteAnalysisType): string {
  if (!a) return '';
  switch (id) {
    case 1: return `Payment created`;
    case 2: return a.countryPolicy?.[0] ? `${a.countryPolicy[0].status} — ${a.countryPolicy[0].details}` : '';
    case 3: return `Treasury controls evaluated`;
    case 4: return a.countryPolicy?.[0]?.status === 'FAIL' ? 'Compliance FAIL' : 'KYC/KYB verified, no sanctions';
    case 5: return `Risk: ${a.walletRisk?.level} (${a.walletRisk?.score}/100)`;
    case 6: return `USDC: ${a.issuerRisk?.usdc?.rating} | USDT: ${a.issuerRisk?.usdt?.rating}`;
    case 7: return `Bridge trust: ${a.chainGovernance?.bridgeTrustScore}% | Gas: ${a.chainGovernance?.gasEstimate}`;
    case 8: return `Route: ${a.liquidityAnalysis?.cheapestRoute} | Cost: ${a.liquidityAnalysis?.totalCost} | ETA: ${a.liquidityAnalysis?.eta}`;
    case 9: return `${a.aiDecision?.action} — Confidence: ${a.aiDecision?.confidence?.toFixed(0)}%`;
    case 10: return `Final: ${a.aiDecision?.action}`;
    case 11: return a.fheCheck?.status === 'PASS' ? 'All thresholds passed (FHE Protected)' : a.fheCheck?.details || '';
    case 12: return a.zkProof?.generated ? `Hash: 0x${String(a.zkProof.proofHash).slice(0, 12)}...` : 'Not generated';
    case 13: return `Status: ${a.aiDecision?.action === 'MANUAL_REVIEW' ? 'Required' : 'Not required'}`;
    case 14: return a.zkProof?.on_chain_tx ? `TX: ${a.zkProof.on_chain_tx.slice(0, 14)}...` : 'Pending execution';
    default: return '';
  }
}

function isStageFail(id: number, a: RouteAnalysisType): boolean {
  if (!a) return false;
  if (id === 2 && a.countryPolicy?.some(c => c.status === 'FAIL')) return true;
  if (id === 5 && a.walletRisk?.score >= 80) return true;
  if (id === 11 && a.fheCheck?.status === 'FAIL') return true;
  if (id === 12 && !a.zkProof?.generated) return true;
  return false;
}

export const RouteAnalysis: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const { payments } = usePaymentStore();
  const payment = payments.find(p => p.id === paymentId);

  const [analysis, setAnalysis] = useState<RouteAnalysisType | null>(null);
  const [loading, setLoading] = useState(true);
  const [stageStates, setStageStates] = useState<Record<number, StageState>>(
    Object.fromEntries(STAGES.map(s => [s.id, 'pending'])) as Record<number, StageState>
  );
  const [expanded, setExpanded] = useState<number | null>(null);
  const [typedReasoning, setTypedReasoning] = useState('');
  const [showRetryModal, setShowRetryModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await routeApi.analyze(paymentId!);
        setAnalysis(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [paymentId]);

  useEffect(() => {
    if (!analysis) return;
    setStageStates(Object.fromEntries(STAGES.map(s => [s.id, 'pending'])) as Record<number, StageState>);
    STAGES.forEach((stage, idx) => {
      setTimeout(() => {
        setStageStates(prev => ({ ...prev, [stage.id]: 'running' }));
        setTimeout(() => {
          const fail = isStageFail(stage.id, analysis);
          setStageStates(prev => ({ ...prev, [stage.id]: fail ? 'fail' : 'pass' }));
        }, 400);
      }, idx * 450);
    });
  }, [analysis]);

  useEffect(() => {
    if (!analysis?.aiDecision?.reasoning) return;
    const full = analysis.aiDecision.reasoning;
    setTypedReasoning('');
    let i = 0;
    const timer = setInterval(() => {
      i += 5;
      setTypedReasoning(full.slice(0, i));
      if (i >= full.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [analysis?.aiDecision?.reasoning]);

  const isBlocked = payment?.status === 'blocked';
  const isApproved = payment?.status === 'approved' || payment?.status === 'executed';

  if (loading) return <LoadingSpinner size="lg" text="Running compliance pipeline…" />;
  if (!analysis) return <div className="text-rose-400 text-sm p-6">Unable to load analysis for payment {paymentId}.</div>;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="page-title">Route Analysis</h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{paymentId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {payment && <StatusBadge status={payment.status} />}
          {isBlocked && (
            <button onClick={() => setShowRetryModal(true)} className="btn-primary text-sm">
              <RefreshCw className="w-4 h-4" /> Fix & Retry
            </button>
          )}
        </div>
      </div>

      {/* BLOCKED banner */}
      {isBlocked && (
        <div className="glass-card p-4 border border-rose-500/40 bg-rose-500/10">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-rose-400 flex-shrink-0" />
            <div>
              <p className="text-rose-300 font-semibold text-sm">❌ PAYMENT BLOCKED</p>
              <p className="text-xs text-rose-400/80 mt-0.5">
                {analysis.countryPolicy?.find(c => c.status === 'FAIL')?.details || 'Blocked by compliance policy or sanctions check.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 14-Stage Pipeline */}
      <div className="glass-card p-5">
        <h3 className="section-title mb-4">Compliance Pipeline — 14 Stages</h3>
        <div className="grid grid-cols-2 gap-2">
          {STAGES.map(stage => {
            const state = stageStates[stage.id] || 'pending';
            const isExp = expanded === stage.id;
            const detail = stageDetail(stage.id, analysis);
            return (
              <div
                key={stage.id}
                className={`rounded-xl border p-3 cursor-pointer transition-all ${stateColor[state]}`}
                onClick={() => setExpanded(isExp ? null : stage.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-xs font-mono w-5">{stage.id}</span>
                    <span className="text-slate-300 text-sm">{stage.label}</span>
                  </div>
                  {stateIcon(state)}
                </div>
                <p className="text-xs text-slate-500 mt-1 ml-7 capitalize">{state === 'pending' ? stage.sublabel : state}</p>
                {isExp && detail && (
                  <div className="mt-2 ml-7 p-2 rounded bg-slate-900/60 border border-slate-700/40">
                    <p className="text-xs text-slate-300">{detail}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-600 mt-3">Click any stage to expand details</p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Decision Intelligence Panel */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="section-title">Decision Intelligence</h3>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${isBlocked ? 'bg-rose-500/20 text-rose-300' : isApproved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
              {analysis.aiDecision?.action}
            </span>
            <span className="text-slate-400 text-xs">via {analysis.aiDecision?.engineUsed}</span>
          </div>

          {/* Confidence bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>AI Confidence</span>
              <span>{analysis.aiDecision?.confidence?.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                style={{ width: `${analysis.aiDecision?.confidence || 0}%` }}
              />
            </div>
          </div>

          {/* Risk score */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Wallet Risk Score</span>
              <span className={analysis.walletRisk?.score >= 70 ? 'text-rose-400' : 'text-emerald-400'}>
                {analysis.walletRisk?.score}/100
              </span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${analysis.walletRisk?.score >= 70 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                style={{ width: `${analysis.walletRisk?.score || 0}%` }}
              />
            </div>
          </div>

          {/* Selected route */}
          <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/40 space-y-1">
            <p className="text-xs text-slate-500">Selected Route</p>
            <p className="text-sm text-slate-200">{analysis.liquidityAnalysis?.cheapestRoute}</p>
            <p className="text-xs text-slate-400">Cost: {analysis.liquidityAnalysis?.totalCost} · ETA: {analysis.liquidityAnalysis?.eta}</p>
          </div>

          {/* Token comparison */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded border border-slate-700/40 bg-slate-900/30">
              <p className="text-xs text-slate-500">USDC</p>
              <p className="text-sm text-emerald-300 font-semibold">{analysis.issuerRisk?.usdc?.rating}</p>
              <p className="text-xs text-slate-500">{analysis.issuerRisk?.usdc?.reserve}</p>
            </div>
            <div className="p-2 rounded border border-slate-700/40 bg-slate-900/30">
              <p className="text-xs text-slate-500">USDT</p>
              <p className="text-sm text-amber-300 font-semibold">{analysis.issuerRisk?.usdt?.rating}</p>
              <p className="text-xs text-slate-500">{analysis.issuerRisk?.usdt?.reserve}</p>
            </div>
          </div>

          {/* WHY flags */}
          {analysis.aiDecision?.flags && Array.isArray(analysis.aiDecision.flags) && analysis.aiDecision.flags.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Risk Flags</p>
              <div className="flex flex-wrap gap-1">
                {(analysis.aiDecision.flags as any[]).map((f: any, i: number) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {typeof f === 'string' ? f : JSON.stringify(f)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Alt options */}
          {analysis.aiDecision?.alternativeOptions && analysis.aiDecision.alternativeOptions.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Rejected Routes</p>
              <div className="flex flex-wrap gap-1">
                {analysis.aiDecision.alternativeOptions.map((opt, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-400">
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Reasoning + FHE + ZK */}
        <div className="space-y-4">
          {/* AI Reasoning typewriter */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-violet-400" />
              <h3 className="section-title">AI Explanation</h3>
              <span className="ml-auto text-xs text-slate-500">{analysis.aiDecision?.latencyMs}ms</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed min-h-[80px] whitespace-pre-wrap">
              {typedReasoning || '…'}
            </p>
          </div>

          {/* FHE checks */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-cyan-400" />
              <h3 className="section-title">FHE Private Checks</h3>
              <span className={`ml-auto px-2 py-0.5 rounded text-xs ${analysis.fheCheck?.fhe_available ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-700 text-slate-400'}`}>
                {analysis.fheCheck?.fhe_available ? 'FHE Protected' : 'Simulated FHE'}
              </span>
            </div>
            {analysis.fheCheck?.checks?.map((chk, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                <span className="text-xs text-slate-400 capitalize">{chk.check_label.replace(/_/g, ' ')}</span>
                <span className={`text-xs flex items-center gap-1 ${chk.result ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {chk.result ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {chk.result ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>

          {/* ZK Proof */}
          <div className="glass-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-emerald-400" />
              <h3 className="section-title">ZK Proof Bundle</h3>
            </div>
            {analysis.zkProof?.generated ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-300">Proof verified</span>
                </div>
                {analysis.zkProof.components?.kyc && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">KYC Proof</span>
                    <span className={analysis.zkProof.components.kyc.is_valid ? 'text-emerald-400' : 'text-rose-400'}>
                      {analysis.zkProof.components.kyc.is_valid ? '✅ Valid' : '❌ Invalid'}
                    </span>
                  </div>
                )}
                {analysis.zkProof.components?.range && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Amount Range</span>
                    <span className={analysis.zkProof.components.range.is_valid ? 'text-emerald-400' : 'text-rose-400'}>
                      {analysis.zkProof.components.range.is_valid ? '✅ In range' : '❌ Out of range'}
                    </span>
                  </div>
                )}
                {analysis.zkProof.components?.approval && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Approval Proof</span>
                    <span className={analysis.zkProof.components.approval.is_valid ? 'text-emerald-400' : 'text-amber-400'}>
                      {analysis.zkProof.components.approval.is_valid ? '✅ Approved' : '⏳ Pending'}
                    </span>
                  </div>
                )}
                <p className="text-[10px] font-mono text-slate-500 break-all mt-1">{analysis.zkProof.proofHash}</p>
                {analysis.zkProof.on_chain_tx && (
                  <a
                    href={analysis.zkProof.basescan_url || `https://sepolia.basescan.org/tx/${analysis.zkProof.on_chain_tx}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-1"
                  >
                    <ExternalLink className="w-3 h-3" /> View on BaseScan
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Proof not yet generated.</p>
            )}
          </div>
        </div>
      </div>

      {/* Blockchain Settlement */}
      {(payment?.status === 'executed' || analysis.zkProof?.on_chain_tx) && (
        <div className="glass-card p-5 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="section-title text-emerald-300">On-Chain Settlement</h3>
            <span className="ml-auto px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Proof Stored On-Chain
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-slate-500">TX Hash</p>
              <p className="font-mono text-slate-300 mt-0.5">{analysis.zkProof?.on_chain_tx ? `${analysis.zkProof.on_chain_tx.slice(0, 18)}…` : 'Pending'}</p>
            </div>
            <div>
              <p className="text-slate-500">Chain</p>
              <p className="text-slate-300 mt-0.5">Base Sepolia</p>
            </div>
            <div>
              <p className="text-slate-500">Proof Registry</p>
              <p className="font-mono text-slate-300 mt-0.5 truncate">{import.meta.env.VITE_SETTLEMENT_REGISTRY || 'SettlementProofRegistry'}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">Immutable audit record stored on Base Sepolia testnet</p>
          {analysis.zkProof?.basescan_url && (
            <a href={analysis.zkProof.basescan_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-2">
              <ExternalLink className="w-3 h-3" /> Open on BaseScan
            </a>
          )}
        </div>
      )}

      {/* Retry Modal */}
      {showRetryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-2">Fix & Retry Payment</h3>
            <p className="text-slate-400 text-sm mb-4">
              This payment was blocked. You may adjust the token, chain, or amount. The corridor and parties cannot be changed.
            </p>
            <div className="space-y-3 mb-5">
              <div className="p-3 rounded border border-rose-500/30 bg-rose-500/10">
                <p className="text-xs text-rose-300 font-medium">Block Reason</p>
                <p className="text-xs text-rose-400 mt-1">
                  {analysis.countryPolicy?.find(c => c.status === 'FAIL')?.details || 'Compliance policy or sanctions check failed.'}
                </p>
              </div>
              <p className="text-xs text-slate-400">
                To retry: create a new payment with adjusted parameters. The original payment record is preserved for audit.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowRetryModal(false)} className="btn-secondary flex-1 justify-center text-sm">Cancel</button>
              <button onClick={() => { setShowRetryModal(false); navigate('/create-payment'); }} className="btn-primary flex-1 justify-center text-sm">
                Create New Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
