import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { paymentApi, policyApi, walletApi } from '../lib/api';
import { usePaymentStore, transformPayment } from '../store/paymentStore';
import { useToast } from '../components/ToastProvider';
import { useWallet } from '../hooks/useWallet';
import { useAuthStore } from '../store/authStore';
import { IcSelectChevron } from '../components/scx/icons';
import type { Country, Chain, Token, Purpose, Urgency } from '../types';

const COUNTRIES: Country[] = ['Singapore', 'USA', 'UK', 'UAE', 'India', 'Germany', 'Japan', 'Switzerland', 'Canada', 'Australia', 'Hong Kong', 'Egypt', 'South Korea', 'Russia', 'Iran', 'North Korea'];
const CHAINS: Chain[] = ['Base Sepolia', 'Polygon Amoy', 'Ethereum Mainnet', 'Arbitrum', 'Optimism'];
const TOKENS: Token[] = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD'];
const PURPOSES: Purpose[] = ['Payroll', 'Supplier Payment', 'Treasury Transfer', 'Cross-border Settlement', 'Invoice Payment', 'Refund', 'Dividend Payment'];
const URGENCIES: Urgency[] = ['Low', 'Medium', 'High', 'Critical'];

type PreflightState =
  | { state: 'unknown' }
  | { state: 'allowed'; requiresKyc: boolean; threshold: number }
  | { state: 'blocked'; reason: string }
  | { state: 'no_rule' };

export const CreatePayment: React.FC = () => {
  const navigate = useNavigate();
  const { addPayment } = usePaymentStore();
  const { showToast } = useToast();
  const { address } = useWallet();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<{ ether: number } | null>(null);
  const [rules, setRules] = useState<any[]>([]);

  const connectedWallet = address || (user as any)?.walletAddress || (user as any)?.wallet_address || '';

  const [form, setForm] = useState({
    senderCompany: '', receiverCompany: '',
    sourceCountry: 'Singapore' as Country, destinationCountry: 'USA' as Country,
    sourceChain: 'Base Sepolia' as Chain, destinationChain: 'Base Sepolia' as Chain,
    amount: '', token: 'USDC' as Token, purpose: 'Treasury Transfer' as Purpose, urgency: 'Medium' as Urgency,
    senderWallet: '', receiverWallet: '',
  });

  useEffect(() => {
    if (connectedWallet && !form.senderWallet) setForm((p) => ({ ...p, senderWallet: connectedWallet }));
  }, [connectedWallet]);

  useEffect(() => {
    const wallet = form.senderWallet.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) { setWalletBalance(null); return; }
    walletApi.balance(wallet).then(({ data }) => setWalletBalance(data.balance as any)).catch(() => setWalletBalance(null));
  }, [form.senderWallet]);

  useEffect(() => {
    policyApi.rules().then(({ data }) => setRules(Array.isArray(data) ? data : [])).catch(() => setRules([]));
  }, []);

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const preflight: PreflightState = useMemo(() => {
    const rule = rules.find((r) => r.source_country === form.sourceCountry && r.destination_country === form.destinationCountry);
    if (!rule) return { state: 'no_rule' };
    if (!rule.is_allowed) return { state: 'blocked', reason: rule.notes || 'Corridor not permitted by active policy' };
    return { state: 'allowed', requiresKyc: !!rule.requires_kyc, threshold: Number(rule.reporting_threshold ?? 0) };
  }, [rules, form.sourceCountry, form.destinationCountry]);

  const amountNum = parseFloat(form.amount) || 0;
  const aboveThreshold = preflight.state === 'allowed' && preflight.threshold > 0 && amountNum > preflight.threshold;
  const senderWalletValid = /^0x[a-fA-F0-9]{40}$/.test(form.senderWallet.trim());
  const receiverWalletValid = /^0x[a-fA-F0-9]{40}$/.test(form.receiverWallet.trim());
  const canSubmit = !!form.senderCompany && !!form.receiverCompany && senderWalletValid && receiverWalletValid && amountNum > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) {
      showToast('warning', 'Missing fields', 'Complete counterparties and a valid amount first.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await paymentApi.create({ ...form, amount: amountNum } as any);
      addPayment(transformPayment(data));
      showToast('success', 'Payment Created', `Payment ${data.id} submitted to the compliance pipeline`);
      navigate(`/route-analysis/${data.id}`);
    } catch (err: any) {
      showToast('error', 'Submission Failed', err?.response?.data?.detail || 'Failed to create payment');
    } finally {
      setLoading(false);
    }
  };

  const Select = ({ field, options }: { field: string; options: string[] }) => (
    <div style={{ position: 'relative' }}>
      <select className="finput" value={(form as any)[field]} onChange={(e) => set(field, e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--ink-faint)', width: 12, height: 12 }}><IcSelectChevron /></span>
    </div>
  );

  return (
    <div className="scx-page">
      <div className="crumb">Payments &nbsp;/&nbsp; <b>Create Payment</b></div>
      <h1 className="ptitle">Create Payment</h1>
      <p className="psub">Guided institutional transfer — every field is evaluated against corridor policy, treasury limits and compliance before it can be created.</p>

      <div className="grid2">
        <div className="col">
          <div className="card">
            <div className="chead"><div className="cnum">1</div><div className="ctitle">Counterparties</div></div>
            <div className="cbody">
              <div className="parties-row">
                <div>
                  <div className="subhead">Sender</div>
                  <div className="field"><label>Entity</label><input className="finput" value={form.senderCompany} onChange={(e) => set('senderCompany', e.target.value)} placeholder="Acme Global Inc" /></div>
                  <div className="field"><label>Country</label><Select field="sourceCountry" options={COUNTRIES} /></div>
                  <div className="field"><label>Wallet</label><input className="finput wal" value={form.senderWallet} onChange={(e) => set('senderWallet', e.target.value)} placeholder="0x…" /></div>
                </div>
                <div>
                  <div className="subhead">Recipient</div>
                  <div className="field"><label>Entity</label><input className="finput" value={form.receiverCompany} onChange={(e) => set('receiverCompany', e.target.value)} placeholder="Zenith Trading" /></div>
                  <div className="field"><label>Country</label><Select field="destinationCountry" options={COUNTRIES} /></div>
                  <div className="field"><label>Wallet</label><input className="finput wal" value={form.receiverWallet} onChange={(e) => set('receiverWallet', e.target.value)} placeholder="0x…" /></div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="chead"><div className="cnum">2</div><div className="ctitle">Payment</div></div>
            <div className="cbody">
              <div className="grid2b">
                <div className="field amt-input"><label>Amount</label><input className="finput" type="number" min="1" step="0.01" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="150,000.00" /></div>
                <div className="field"><label>Stablecoin</label><Select field="token" options={TOKENS} /></div>
              </div>
              <div className="grid2b">
                <div className="field"><label>Purpose</label><Select field="purpose" options={PURPOSES} /></div>
                <div className="field"><label>Urgency</label><Select field="urgency" options={URGENCIES} /></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="chead"><div className="cnum">3</div><div className="ctitle">Settlement</div><div className="csub">Auto-selected by routing intelligence</div></div>
            <div className="cbody">
              <div className="grid2b" style={{ marginBottom: 14 }}>
                <div className="field"><label>Origin Network</label><Select field="sourceChain" options={CHAINS} /></div>
                <div className="field"><label>Target Network</label><Select field="destinationChain" options={CHAINS} /></div>
              </div>
              <div className="route-card">
                <div className="route-l">
                  <div className="route-badge">{form.destinationChain[0]}</div>
                  <div><div className="route-name">{form.destinationChain}</div><div className="route-meta">Route confirmed on submission</div></div>
                </div>
                <div className="route-r"><div style={{ fontWeight: 650, color: 'var(--ink)' }}>Fee computed at submission</div></div>
              </div>
            </div>
          </div>
        </div>

        <div className="col">
          <div className="sticky">
            <div className="pf-card">
              <div className="pf-head"><span className="dot" /><b>Preflight</b><span>Live evaluation</span></div>
              <div className="pf-summary">
                <div className="pf-amt num">{form.amount ? `$${amountNum.toLocaleString()}` : '—'} <span style={{ fontSize: 14, color: 'var(--ink-muted)', fontWeight: 600 }}>{form.token}</span></div>
                <div className="pf-route">{form.sourceCountry} → {form.destinationCountry} · via {form.sourceChain}</div>
              </div>
              <div className="pf-rows">
                <div className="pf-row">
                  <div className="l">Corridor policy</div>
                  <div className="r">
                    <div className={`t ${preflight.state === 'allowed' ? 'ok-tag' : preflight.state === 'blocked' ? 'bad-tag' : 'warn-tag'}`}>
                      {preflight.state === 'allowed' ? 'Allowed' : preflight.state === 'blocked' ? 'Blocked' : preflight.state === 'no_rule' ? 'No rule on file' : 'Checking…'}
                    </div>
                    <div className="s">{form.sourceCountry} → {form.destinationCountry}</div>
                  </div>
                </div>
                <div className="pf-row">
                  <div className="l">Compliance</div>
                  <div className="r">
                    <div className={`t ${preflight.state === 'allowed' ? (preflight.requiresKyc ? 'warn-tag' : 'ok-tag') : 'warn-tag'}`}>
                      {preflight.state === 'allowed' ? (preflight.requiresKyc ? 'KYC required' : 'Standard') : 'Pending policy match'}
                    </div>
                    <div className="s">Screened at submission</div>
                  </div>
                </div>
                <div className="pf-row">
                  <div className="l">Approval requirement</div>
                  <div className="r">
                    <div className={`t ${aboveThreshold ? 'warn-tag' : 'ok-tag'}`}>{aboveThreshold ? '2 approvals' : 'Standard'}</div>
                    <div className="s">{preflight.state === 'allowed' && preflight.threshold > 0 ? `Threshold $${preflight.threshold.toLocaleString()}` : 'Treasury policy'}</div>
                  </div>
                </div>
                <div className="pf-row">
                  <div className="l">Wallet format</div>
                  <div className="r">
                    <div className={`t ${form.senderWallet && form.receiverWallet ? (senderWalletValid && receiverWalletValid ? 'ok-tag' : 'bad-tag') : 'warn-tag'}`}>
                      {form.senderWallet && form.receiverWallet ? (senderWalletValid && receiverWalletValid ? 'Valid' : 'Invalid address') : 'Not entered'}
                    </div>
                    <div className="s">0x + 40 hex characters</div>
                  </div>
                </div>
                <div className="pf-row">
                  <div className="l">Route</div>
                  <div className="r"><div className="t">{form.sourceChain === form.destinationChain ? form.sourceChain : `${form.sourceChain} → ${form.destinationChain}`}</div><div className="s">{walletBalance ? `Balance: ${walletBalance.ether} ETH` : 'Confirmed on submission'}</div></div>
                </div>
              </div>
              <div className="pf-cta">
                <button className="btn-run" disabled={!canSubmit} onClick={handleSubmit}>{loading ? 'Submitting…' : 'Run Preflight & Create Payment'}</button>
                <div className="btn-run-sub">Routes to dual approval before settlement unlocks</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
