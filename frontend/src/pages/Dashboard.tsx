import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  DollarSign, ShieldOff, Clock, CheckCircle2, Plus, ClipboardCheck, Download,
  ArrowUpRight, ArrowDownRight, TrendingUp,
} from 'lucide-react';
import { usePaymentStore } from '../store/paymentStore';
import { StatusBadge } from '../components/StatusBadge';

const volumeData = [
  { day: 'Mon', volume: 420000, count: 12 },
  { day: 'Tue', volume: 680000, count: 18 },
  { day: 'Wed', volume: 510000, count: 14 },
  { day: 'Thu', volume: 890000, count: 24 },
  { day: 'Fri', volume: 720000, count: 20 },
  { day: 'Sat', volume: 340000, count: 9 },
  { day: 'Sun', volume: 560000, count: 15 },
];

const corridorData = [
  { corridor: 'SG→UK', approved: 14, blocked: 2 },
  { corridor: 'US→DE', approved: 8, blocked: 5 },
  { corridor: 'AE→IN', approved: 6, blocked: 4 },
  { corridor: 'SG→US', approved: 18, blocked: 1 },
  { corridor: 'UK→DE', approved: 10, blocked: 3 },
  { corridor: 'IN→SG', approved: 12, blocked: 2 },
];

const stats = [
  { label: 'Total Payments', value: '$2.42M', change: '+12.5%', up: true, icon: DollarSign, color: 'from-indigo-500 to-violet-500', shadow: 'shadow-indigo-500/20' },
  { label: 'Blocked Payments', value: '17', change: '-3.2%', up: false, icon: ShieldOff, color: 'from-rose-500 to-pink-500', shadow: 'shadow-rose-500/20' },
  { label: 'Pending Approvals', value: '8', change: '+2', up: true, icon: Clock, color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/20' },
  { label: 'Settled Today', value: '34', change: '+8.1%', up: true, icon: CheckCircle2, color: 'from-emerald-500 to-green-500', shadow: 'shadow-emerald-500/20' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="glass-card px-4 py-3 border border-slate-700/50">
      <p className="text-xs font-semibold text-slate-300 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.value > 1000
            ? `$${(p.value / 1000).toFixed(0)}K`
            : p.value}
        </p>
      ))}
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { payments } = usePaymentStore();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time settlement monitoring & compliance overview</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate('/create-payment')} className="btn-primary text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> Create Payment
          </button>
          <button onClick={() => navigate('/approval-queue')} className="btn-secondary text-sm flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" /> View Queue
          </button>
          <button className="btn-secondary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Report
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass-card-hover p-5">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg ${s.shadow}`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <span className={`flex items-center gap-1 text-xs font-semibold ${s.up ? 'text-emerald-400' : 'text-rose-400'}`}>
                {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {s.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h3 className="section-title">Payment Volume — Last 7 Days</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v / 1000}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="volume" stroke="#818cf8" strokeWidth={2.5} dot={{ fill: '#818cf8', r: 4 }} activeDot={{ r: 6 }} name="Volume" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldOff className="w-4 h-4 text-rose-400" />
            <h3 className="section-title">Approved vs Blocked by Corridor</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={corridorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="corridor" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="approved" fill="#34d399" radius={[4, 4, 0, 0]} name="Approved" />
              <Bar dataKey="blocked" fill="#fb7185" radius={[4, 4, 0, 0]} name="Blocked" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Payments Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/50">
          <h3 className="section-title">Recent Payments</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800/50">
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Sender</th>
                <th className="px-5 py-3 font-medium">Receiver</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Token</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Corridor</th>
                <th className="px-5 py-3 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="table-row cursor-pointer"
                  onClick={() => navigate(`/route-analysis/${p.id}`)}
                >
                  <td className="px-5 py-3 font-mono text-indigo-400 text-xs">{p.id}</td>
                  <td className="px-5 py-3 text-slate-300">{p.senderCompany}</td>
                  <td className="px-5 py-3 text-slate-300">{p.receiverCompany}</td>
                  <td className="px-5 py-3 font-semibold text-white">${p.amount.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className="badge bg-slate-800 text-slate-300 border border-slate-700">{p.token}</span>
                  </td>
                  <td className="px-5 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3 text-slate-400">{p.corridor}</td>
                  <td className="px-5 py-3 text-slate-500 text-xs">{new Date(p.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
