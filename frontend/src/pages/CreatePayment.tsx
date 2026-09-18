import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Globe, Link2, Coins, Target, Zap,
  ChevronDown, ArrowRight, ShieldCheck, Info, RefreshCw
} from 'lucide-react';
import { paymentApi, walletApi } from '../lib/api';
import { usePaymentStore, transformPayment } from '../store/paymentStore';
import { useToast } from '../components/ToastProvider';
import { useWallet } from '../hooks/useWallet';
import { useAuthStore } from '../store/authStore';
import type { Country, Chain, Token, Purpose, Urgency } from '../types';

const COUNTRIES: Country[] = ['Singapore', 'USA', 'UK', 'UAE', 'India', 'Germany', 'Japan', 'Switzerland', 'Canada', 'Australia', 'Hong Kong', 'Egypt', 'South Korea', 'Russia', 'Iran', 'North Korea'];
const CHAINS: Chain[] = ['Base Sepolia', 'Polygon Amoy', 'Ethereum Mainnet', 'Arbitrum', 'Optimism'];
const TOKENS: Token[] = ['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD'];
const PURPOSES: Purpose[] = ['Payroll', 'Supplier Payment', 'Treasury Transfer', 'Cross-border Settlement', 'Invoice Payment', 'Refund', 'Dividend Payment'];
const URGENCIES: Urgency[] = ['Low', 'Medium', 'High', 'Critical'];

const urgencyBadge: Record<Urgency, string> = {
  Low: 'badge-pass',
  Medium: 'badge-pending',
  High: 'badge-review',
  Critical: 'badge-fail',
};

export const CreatePayment: React.FC = () => {
  const navigate = useNavigate();
  const { addPayment } = usePaymentStore();
  const { showToast } = useToast();
  const { address } = useWallet();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState<{ ether: number } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Determine the effective sender wallet address
  const connectedWallet = address || (user as any)?.walletAddress || (user as any)?.wallet_address || '';

  const [form, setForm] = useState({
    senderCompany: '',
    receiverCompany: '',
    sourceCountry: 'Singapore' as Country,
    destinationCountry: 'USA' as Country,
    sourceChain: 'Base Sepolia' as Chain,
    destinationChain: 'Polygon Amoy' as Chain,
    amount: '',
    token: 'USDC' as Token,
    purpose: 'Treasury Transfer' as Purpose,
    urgency: 'Medium' as Urgency,
    senderWallet: '',
    receiverWallet: '',
  });

  // Auto-fill sender wallet when connected wallet changes
  useEffect(() => {
    if (connectedWallet && !form.senderWallet) {
      setForm(p => ({ ...p, senderWallet: connectedWallet }));
    }
  }, [connectedWallet]);

  // Fetch live ETH balance when sender wallet is set
  useEffect(() => {
    const wallet = form.senderWallet.trim();
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      setWalletBalance(null);
      return;
    }
    setBalanceLoading(true);
    walletApi.balance(wallet)
      .then(({ data }) => setWalletBalance(data.balance as any))
      .catch(() => setWalletBalance(null))
      .finally(() => setBalanceLoading(false));
  }, [form.senderWallet]);

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('CreatePayment form submission started', form);

    if (!form.senderCompany || !form.receiverCompany || !form.amount) {
      showToast('warning', 'Missing Fields', 'Please fill sender company, receiver company, and amount.');
      return;
    }

    if (!form.senderWallet || !form.senderWallet.trim()) {
      showToast('error', 'Sender Wallet Required', 'Sender wallet address is mandatory for settlement execution.');
      return;
    }

    if (!form.receiverWallet || !form.receiverWallet.trim()) {
      showToast('error', 'Receiver Wallet Required', 'Receiver wallet address is mandatory for settlement execution.');
      return;
    }

    const senderAddr = form.senderWallet.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(senderAddr)) {
      showToast('error', 'Invalid Wallet Address', 'Sender wallet must be a valid Ethereum address (0x followed by 40 hex characters).');
      return;
    }

    const walletAddr = form.receiverWallet.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddr)) {
      showToast('error', 'Invalid Wallet Address', 'Receiver wallet must be a valid Ethereum address (0x followed by 40 hex characters).');
      return;
    }

    setLoading(true);
    const payload = {
      ...form,
      amount: parseFloat(form.amount)
    };
    console.log('Sending payment payload:', payload);

    try {
      const { data } = await paymentApi.create(payload as any);
      console.log('Payment created successfully:', data);
      addPayment(transformPayment(data));
      showToast('success', 'Payment Created', `Payment ${data.id} submitted to compliance pipeline`);
      navigate(`/route-analysis/${data.id}`);
    } catch (err: any) {
      console.error('Payment creation failed:', err);
      const detail = err?.response?.data?.detail || 'Failed to create payment';
      showToast('error', 'Submission Failed', detail);
    } finally {
      setLoading(false);
    }
  };

  const SelectField = ({ label, icon: Icon, field, options, desc }: { label: string; icon: any; field: string; options: string[]; desc?: string }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between ml-1">
        <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">{label}</label>
        {desc && <span className="text-[10px] text-ink-400 font-medium">{desc}</span>}
      </div>
      <div className="relative group">
        <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-primary transition-colors" />
        <select
            value={(form as any)[field]}
            onChange={(e) => set(field, e.target.value)}
            className="select-field pl-12 pr-10 hover:border-brand-primary/30 transition-colors"
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto animate-fade-in pb-20">
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-[10px] font-black uppercase tracking-widest mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secure Settlement Pipeline
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-ink-900 mb-2">Create Settlement</h1>
        <p className="text-ink-600 max-w-md mx-auto">Configure your payment parameters. Every transaction undergoes a mandatory compliance scan.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Step 1: Entity Details */}
        <div className="glass-card p-8">
            <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-primary" />
                Entity Verification
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-ink-600 uppercase tracking-widest ml-1">Sender Organization</label>
                    <div className="relative group">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-primary transition-colors" />
                        <input value={form.senderCompany} onChange={(e) => set('senderCompany', e.target.value)} className="input-field pl-12" placeholder="Acme Global Inc" required />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-ink-600 uppercase tracking-widest ml-1">Receiver Organization</label>
                    <div className="relative group">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-primary transition-colors" />
                        <input value={form.receiverCompany} onChange={(e) => set('receiverCompany', e.target.value)} className="input-field pl-12" placeholder="Tech Logistics LLC" required />
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
                <SelectField label="Source Corridor" icon={Globe} field="sourceCountry" options={COUNTRIES} />
                <SelectField label="Destination Corridor" icon={Globe} field="destinationCountry" options={COUNTRIES} />
            </div>
        </div>

        {/* Step 2: Infrastructure Details */}
        <div className="glass-card p-8">
            <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center gap-2">
                <Link2 className="w-5 h-5 text-brand-primary" />
                Network Configuration
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
                <SelectField label="Origin Network" icon={Link2} field="sourceChain" options={CHAINS} desc="RPC Active" />
                <SelectField label="Target Network" icon={Link2} field="destinationChain" options={CHAINS} desc="RPC Active" />
            </div>

            <div className="grid md:grid-cols-2 gap-6 mt-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-ink-600 uppercase tracking-widest ml-1">Settlement Amount</label>
                    <div className="relative group">
                        <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-primary transition-colors" />
                        <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="input-field pl-12" placeholder="250000.00" min="1" step="0.01" required />
                    </div>
                </div>
                <SelectField label="Settlement Token" icon={Coins} field="token" options={TOKENS} />
            </div>
        </div>

        {/* Step 3: Policy Parameters */}
        <div className="glass-card p-8">
            <h3 className="text-lg font-bold text-ink-900 mb-6 flex items-center gap-2">
                <Target className="w-5 h-5 text-status-review" />
                Policy & Priority
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
                <SelectField label="Transfer Purpose" icon={Target} field="purpose" options={PURPOSES} />
                <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                        <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">Urgency Level</label>
                        <span className={`badge ${urgencyBadge[form.urgency]}`}>{form.urgency}</span>
                    </div>
                    <div className="relative group">
                        <Zap className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-primary transition-colors" />
                        <select value={form.urgency} onChange={(e) => set('urgency', e.target.value)} className="select-field pl-12 pr-10">
                            {URGENCIES.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-8 border-t border-surface-border">
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-4 ml-1">
                            <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">Sender Wallet Address</label>
                            <span className="text-[10px] text-status-blocked font-bold px-1.5 py-0.5 rounded bg-status-blocked/10 border border-status-blocked/20 uppercase tracking-tighter">Mandatory</span>
                        </div>
                        <div className="relative group">
                            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-primary transition-colors" />
                            <input
                                value={form.senderWallet}
                                onChange={(e) => set('senderWallet', e.target.value)}
                                className="input-field pl-12 font-mono text-sm tracking-tight"
                                placeholder="0x..."
                                required
                            />
                        </div>
                        <div className="mt-3 flex items-start gap-2 px-1">
                            <Info className="w-3.5 h-3.5 text-ink-400 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-ink-400 font-medium leading-relaxed">
                                A valid wallet address is required for cryptographic verification on the origin network.
                            </p>
                        </div>
                        {balanceLoading && (
                            <p className="mt-2 text-[10px] text-ink-400 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Checking balance...</p>
                        )}
                        {walletBalance && !balanceLoading && (
                            <p className="mt-2 text-[10px] text-status-pass font-semibold">Balance: {walletBalance.ether} ETH</p>
                        )}
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-4 ml-1">
                            <label className="text-xs font-bold text-ink-600 uppercase tracking-widest">Receiver Wallet Address</label>
                            <span className="text-[10px] text-status-blocked font-bold px-1.5 py-0.5 rounded bg-status-blocked/10 border border-status-blocked/20 uppercase tracking-tighter">Mandatory</span>
                        </div>
                        <div className="relative group">
                            <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-primary transition-colors" />
                            <input
                                value={form.receiverWallet}
                                onChange={(e) => set('receiverWallet', e.target.value)}
                                className="input-field pl-12 font-mono text-sm tracking-tight"
                                placeholder="0x..."
                                required
                            />
                        </div>
                        <div className="mt-3 flex items-start gap-2 px-1">
                            <Info className="w-3.5 h-3.5 text-ink-400 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-ink-400 font-medium leading-relaxed">
                                A valid wallet address is required for cryptographic verification and settlement on the target network.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col items-center gap-4 pt-4">
            <button
                type="submit"
                disabled={loading}
                className="w-full h-16 btn-primary flex items-center justify-center gap-3 text-lg"
            >
                {loading ? <RefreshCw className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
                {loading ? 'Analyzing Compliance Pipeline...' : 'Authorize & Start Settlement'}
            </button>
            <p className="text-[10px] text-ink-400 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" />
                Deterministic Policy Enforcement Enabled
            </p>
        </div>
      </form>
    </div>
  );
};
