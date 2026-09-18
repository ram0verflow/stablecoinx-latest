import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Shield, Mail, Lock, ChevronDown, ArrowRight, Layers } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import { InlineSpinner } from '../components/LoadingSpinner';
import type { UserRole } from '../types';

const ROLES: UserRole[] = ['Admin', 'Treasury Officer', 'Compliance Officer', 'Auditor', 'Reviewer'];

const LAYERS = [
  'Country Policy', 'Treasury Controls', 'Compliance Engine', 'Wallet Graph',
  'Issuer Risk', 'Cross-Chain Gov', 'Liquidity Engine', 'AI Decision',
  'Policy Veto', 'FHE Checks', 'ZK Proofs', 'Human Approval',
];

export const Login: React.FC = () => {
  const { isAuthenticated, login } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@test.com');
  const [password, setPassword] = useState('hackathon123');
  const [role, setRole] = useState<UserRole>('Admin');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.login({ email, password, role });
      // Backend returns full_name, map to name for frontend User type
      const user = {
        ...data.user,
        name: (data.user as any).full_name || data.user.name || email.split('@')[0],
      };
      login(user, data.access_token);
      showToast('success', 'Welcome back!', `Logged in as ${user.name}`);
      navigate('/dashboard');
    } catch {
      // Demo mode: create mock user and proceed
      const mockUser = {
        id: crypto.randomUUID(),
        email,
        name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        role,
      };
      login(mockUser, 'demo_token_' + Date.now());
      showToast('info', 'Demo Mode Active', 'Backend unavailable — using local session');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-slate-950 to-violet-600/20" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(99,102,241,0.15) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />

        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">SettleGuard</h1>
              <p className="text-sm text-indigo-300/70">Compliance Settlement Engine</p>
            </div>
          </div>

          <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
            24-Layer Compliance<br />
            <span className="gradient-text">Settlement Pipeline</span>
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-md">
            Enterprise-grade stablecoin settlement with real-time AML screening, 
            AI-powered risk assessment, zero-knowledge proofs, and on-chain attestation.
          </p>

          {/* Animated layers */}
          <div className="grid grid-cols-3 gap-2 max-w-sm">
            {LAYERS.map((layer, i) => (
              <div
                key={layer}
                className="px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/30 text-xs text-slate-400 text-center animate-fade-in"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
              >
                {layer}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Login Form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">SettleGuard</h1>
          </div>

          <div className="glass-card p-8">
            <div className="mb-8">
              <h3 className="text-xl font-bold text-white">Sign in to your account</h3>
              <p className="text-sm text-slate-500 mt-1">Enter credentials to access the compliance dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-10"
                    placeholder="admin@settleguard.io"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-10"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                <div className="relative">
                  <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="select-field pl-10 pr-10"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 !py-3 text-sm"
              >
                {loading ? <InlineSpinner /> : <ArrowRight className="w-4 h-4" />}
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>

            <p className="text-xs text-slate-600 text-center mt-6">
              Demo mode auto-creates session if backend is unavailable
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
