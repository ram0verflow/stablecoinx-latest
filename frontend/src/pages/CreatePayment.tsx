import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Building2, Globe, Link2, Coins, Target, Zap, ChevronDown } from 'lucide-react';
import { paymentApi } from '../lib/api';
import { usePaymentStore } from '../store/paymentStore';
import { useToast } from '../components/ToastProvider';
import { InlineSpinner } from '../components/LoadingSpinner';
import type { Country, Chain, Token, Purpose, Urgency } from '../types';

const COUNTRIES: Country[] = ['Singapore', 'USA', 'UK', 'UAE', 'India', 'Germany'];
const CHAINS: Chain[] = ['Base Sepolia', 'Polygon Amoy'];
const TOKENS: Token[] = ['USDC', 'USDT'];
const PURPOSES: Purpose[] = ['Payroll', 'Supplier Payment', 'Treasury Transfer', 'Cross-border Settlement'];
const URGENCIES: Urgency[] = ['Low', 'Medium', 'High', 'Critical'];

const urgencyColor: Record<Urgency, string> = {
  Low: 'text-slate-400', Medium: 'text-amber-400', High: 'text-orange-400', Critical: 'text-rose-400',
};

export const CreatePayment: React.FC = () => {
  const navigate = useNavigate();
  const { addPayment } = usePaymentStore();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

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
  });

  const set = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.senderCompany || !form.receiverCompany || !form.amount) {
      showToast('warning', 'Missing Fields', 'Please fill all required fields');
      return;
    }
    setLoading(true);
    const payload = { ...form, amount: parseFloat(form.amount) };
    try {
      const { data } = await paymentApi.create(payload);
      addPayment(data);
      showToast('success', 'Payment Created', `Payment ${data.id} submitted to compliance pipeline`);
      navigate(`/route-analysis/${data.id}`);
    } catch {
      const mockId = 'PAY-' + String(Math.floor(Math.random() * 900) + 100);
      const mock = {
        ...payload,
        id: mockId,
        status: 'pending' as const,
        corridor: `${form.sourceCountry.slice(0, 2).toUpperCase()} → ${form.destinationCountry.slice(0, 2).toUpperCase()}`,
        riskScore: Math.floor(Math.random() * 60) + 10,
        aiDecision: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addPayment(mock);
      showToast('info', 'Demo Mode', `Payment ${mockId} created locally`);
      navigate(`/route-analysis/${mockId}`);
    } finally {
      setLoading(false);
    }
  };

  const SelectField = ({ label, icon: Icon, field, options }: { label: string; icon: any; field: string; options: string[] }) => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <select value={(form as any)[field]} onChange={(e) => set(field, e.target.value)} className="select-field pl-10 pr-10">
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="page-title">Create Payment</h1>
        <p className="text-sm text-slate-500 mt-1">Submit a new stablecoin settlement through the 24-layer compliance pipeline</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
        {/* Companies */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Sender Company</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={form.senderCompany} onChange={(e) => set('senderCompany', e.target.value)} className="input-field pl-10" placeholder="e.g. TechCorp SG" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Receiver Company</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input value={form.receiverCompany} onChange={(e) => set('receiverCompany', e.target.value)} className="input-field pl-10" placeholder="e.g. FinServ UK" required />
            </div>
          </div>
        </div>

        {/* Countries */}
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Source Country" icon={Globe} field="sourceCountry" options={COUNTRIES} />
          <SelectField label="Destination Country" icon={Globe} field="destinationCountry" options={COUNTRIES} />
        </div>

        {/* Chains */}
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Source Chain" icon={Link2} field="sourceChain" options={CHAINS} />
          <SelectField label="Destination Chain" icon={Link2} field="destinationChain" options={CHAINS} />
        </div>

        {/* Amount & Token */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Amount</label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="input-field pl-10" placeholder="250000" min="1" step="0.01" required />
            </div>
          </div>
          <SelectField label="Token" icon={Coins} field="token" options={TOKENS} />
        </div>

        {/* Purpose & Urgency */}
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Purpose" icon={Target} field="purpose" options={PURPOSES} />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Urgency <span className={`ml-2 text-xs ${urgencyColor[form.urgency]}`}>● {form.urgency}</span>
            </label>
            <div className="relative">
              <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <select value={form.urgency} onChange={(e) => set('urgency', e.target.value)} className="select-field pl-10 pr-10">
                {URGENCIES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
            {loading ? <InlineSpinner /> : <Send className="w-4 h-4" />}
            {loading ? 'Submitting to Pipeline...' : 'Submit Payment'}
          </button>
        </div>
      </form>
    </div>
  );
};
