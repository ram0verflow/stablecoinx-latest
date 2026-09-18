import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { paymentApi } from '../lib/api';
import { getStatusTone, type Tone } from '../components/StatusBadge';

interface PipelineStage {
  label: string;
  passed: boolean;
  status: 'pass' | 'fail' | 'running' | 'partial' | 'review' | 'blocked' | 'pending';
  detail: string;
}

interface PaymentDetails {
  id: string;
  status: string;
  pipeline_stages?: Record<string, PipelineStage>;
  compliance_decision?: {
    final_decision?: string;
    ai_decision?: string;
    ai_reasoning?: string;
    ai_confidence?: number;
  } | null;
}

const LAYER_CONFIG = [
  { key: 'layer_1_kyc_kyb', number: 1, icon: '🪪' },
  { key: 'layer_2_kyc_kyb_verified', number: 2, icon: '✅' },
  { key: 'layer_3_sanctions', number: 3, icon: '🛡️' },
  { key: 'layer_4_wallet_risk', number: 4, icon: '📊' },
  { key: 'layer_5_corridor_policy', number: 5, icon: '🌐' },
  { key: 'layer_6_issuer_risk', number: 6, icon: '🔗' },
  { key: 'layer_7_chain_governance', number: 7, icon: '⛓️' },
  { key: 'layer_8_liquidity', number: 8, icon: '💧' },
  { key: 'layer_9_treasury', number: 9, icon: '🏦' },
  { key: 'layer_10_fhe', number: 10, icon: '🔐' },
  { key: 'layer_11_zk_proof', number: 11, icon: '🔑' },
  { key: 'layer_12_ai_decision', number: 12, icon: '🤖' },
  { key: 'layer_13_policy_veto', number: 13, icon: '⚖️' },
  { key: 'layer_14_execution', number: 14, icon: '🚀' },
];

const TERMINAL_STATUSES = ['approved', 'blocked', 'executed', 'under_review', 'failed', 'rejected'];

const toneTextClass: Record<Tone, string> = {
  pass: 'text-status-pass',
  review: 'text-status-review',
  blocked: 'text-status-blocked',
  processing: 'text-status-processing',
  unknown: 'text-status-unknown',
};

function getLayerStatusDisplay(stage: PipelineStage | undefined, isLoading: boolean, isPaymentComplete: boolean) {
  if (isLoading || !stage) {
    if (!stage && isPaymentComplete) {
      return { label: 'PASS', color: toneTextClass.pass, icon: '✓' };
    }
    return { label: 'PROCESSING', color: toneTextClass.processing, icon: <Loader2 className="w-3 h-3 inline animate-spin" /> };
  }
  const tone = getStatusTone(stage.status);
  const iconMap: Record<Tone, string> = { pass: '✓', blocked: '✗', review: '⚠', processing: '○', unknown: '○' };
  const labelMap: Record<Tone, string> = { pass: 'PASS', blocked: 'FAIL', review: 'REVIEW', processing: 'PENDING', unknown: 'UNKNOWN' };
  return { label: labelMap[tone], color: toneTextClass[tone], icon: iconMap[tone] };
}

export const RouteAnalysis: React.FC = () => {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [pollCount, setPollCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;
    let count = 0;
    const MAX_POLLS = 300; // 10 minutes total @ 2s interval
    let timer: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        count += 1;
        setPollCount(count);
        const { data } = await paymentApi.getById(paymentId);
        setPayment(data as PaymentDetails);

        const hasRealStages = (data as any).pipeline_stages &&
                            Object.keys((data as any).pipeline_stages).some(k => k.startsWith('layer_'));

        if (
          TERMINAL_STATUSES.includes(String((data as any).status || '').toLowerCase()) ||
          count >= MAX_POLLS
        ) {
          setIsPolling(false);
          clearInterval(timer);
        }
      } catch (err) {
        if (count >= MAX_POLLS) {
          setIsPolling(false);
          setError('Failed to fetch payment status. Please refresh.');
          clearInterval(timer);
        }
      }
    };

    setIsPolling(true);
    setError(null);
    setPollCount(0);
    poll();
    timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [paymentId]);

  const isPaymentComplete = useMemo(
    () => TERMINAL_STATUSES.includes(String(payment?.status || '').toLowerCase()),
    [payment?.status]
  );

  const isLayerLoading = (layerKey: string) => {
    if (isPaymentComplete) {
      return false;
    }
    return !(payment?.pipeline_stages?.[layerKey]);
  };

  const passFactors = useMemo(() => {
    if (!payment?.pipeline_stages) return [];
    return LAYER_CONFIG
      .filter(({ key }) => payment.pipeline_stages?.[key]?.passed === true)
      .map(({ key }) => payment.pipeline_stages![key].label);
  }, [payment?.pipeline_stages]);

  const riskFactors = useMemo(() => {
    if (!payment?.pipeline_stages) return [];
    return LAYER_CONFIG
      .filter(({ key }) => payment.pipeline_stages?.[key]?.passed === false)
      .map(({ key }) => ({
        label: payment.pipeline_stages![key].label,
        detail: payment.pipeline_stages![key].detail,
      }));
  }, [payment?.pipeline_stages]);

  const finalDecision = String(payment?.compliance_decision?.final_decision || '').toLowerCase();
  const showVeto = finalDecision === 'blocked';

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Route Analysis</h1>
          <p className="text-ink-600 font-medium">Payment ID: <span className="font-mono text-brand-primary">{paymentId}</span></p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary py-2.5 text-xs">Return Home</button>
      </header>

      {isPolling && (
        <div className="flex flex-col items-center gap-2 py-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary" />
          <p className="text-ink-600">Polling compliance pipeline...</p>
          <p className="text-ink-400 text-sm">Attempt {pollCount}/40 · Checking every 2s</p>
        </div>
      )}

      {!isPolling && !isPaymentComplete && (
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-status-review font-semibold">Pipeline still processing</p>
          <p className="text-ink-600 text-sm">
            {error || 'The pipeline may still be running in the background. Refresh to check latest status.'}
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary py-2 px-4 text-sm">
            Refresh Status
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-3">
          {LAYER_CONFIG.map(({ key, number, icon }) => {
            const stage = payment?.pipeline_stages?.[key];
            const loading = isLayerLoading(key);
            const statusDisplay = getLayerStatusDisplay(stage, loading, isPaymentComplete);
            return (
              <div key={key} className={`glass-card p-4 ${stage?.status === 'fail' || stage?.status === 'blocked' ? 'border-status-blocked/40' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-ink-900">
                    {icon} Layer {number}: {stage?.label || key}
                  </span>
                  <span className={`${statusDisplay.color} text-xs font-bold flex items-center gap-1`}>
                    {statusDisplay.icon} {statusDisplay.label}
                  </span>
                </div>
                {stage?.detail && <div className="text-ink-600 text-sm mt-1">{stage.detail}</div>}
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-4 space-y-5">
          <div className="glass-card p-5">
            <h3 className="text-status-pass text-sm font-bold mb-3">PASS FACTORS</h3>
            {passFactors.length === 0 && <p className="text-ink-400 text-sm">Processing...</p>}
            {passFactors.map((f) => (
              <div key={f} className="text-ink-600 text-sm">✓ {f}</div>
            ))}
          </div>

          <div className="glass-card p-5">
            <h3 className="text-status-blocked text-sm font-bold mb-3">RISK FACTORS</h3>
            {riskFactors.length === 0 && isPaymentComplete && (
              <p className="text-ink-400 text-sm">No risk factors detected</p>
            )}
            {riskFactors.map((f) => (
              <div key={f.label} className="text-ink-600 text-sm mb-2">
                ✗ {f.label}
                <p className="text-ink-400 text-xs">{f.detail}</p>
              </div>
            ))}
          </div>

          {showVeto && (
            <div className="glass-card p-5 border-status-blocked/30 bg-status-blocked/5">
              <h3 className="font-bold text-sm uppercase tracking-wide text-status-blocked mb-2">Pipeline Veto</h3>
              <p className="text-xs text-ink-600">Final decision is blocked by policy veto.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
