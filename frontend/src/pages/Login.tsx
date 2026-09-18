import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Shield, Mail, Lock, ArrowRight, EyeOff, Wallet, Scale, Eye as EyeIcon, FileText, Loader2, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import { InlineSpinner } from '../components/LoadingSpinner';
import { getRoleTone } from '../components/StatusBadge';
import type { UserRole } from '../types';

const DEMO_CREDENTIALS: Record<string, { email: string; password: string }> = {
  admin: {
    email: import.meta.env.VITE_DEMO_ADMIN_EMAIL || 'admin@settleguard.com',
    password: import.meta.env.VITE_DEMO_PASSWORD || 'hackathon123',
  },
  treasury_officer: {
    email: import.meta.env.VITE_DEMO_TREASURY_EMAIL || 'treasury@settleguard.com',
    password: import.meta.env.VITE_DEMO_PASSWORD || 'hackathon123',
  },
  compliance_officer: {
    email: import.meta.env.VITE_DEMO_COMPLIANCE_EMAIL || 'compliance@settleguard.com',
    password: import.meta.env.VITE_DEMO_PASSWORD || 'hackathon123',
  },
  reviewer: {
    email: import.meta.env.VITE_DEMO_REVIEWER_EMAIL || 'reviewer@settleguard.com',
    password: import.meta.env.VITE_DEMO_PASSWORD || 'hackathon123',
  },
  auditor: {
    email: import.meta.env.VITE_DEMO_AUDITOR_EMAIL || 'auditor@settleguard.com',
    password: import.meta.env.VITE_DEMO_PASSWORD || 'hackathon123',
  },
};

const ROLE_ICONS: Record<string, any> = {
  admin: Shield,
  treasury_officer: Wallet,
  compliance_officer: Scale,
  reviewer: EyeIcon,
  auditor: FileText,
};

const ROLE_ROUTES: Record<string, string> = {
  admin: '/dashboard/admin',
  treasury_officer: '/dashboard/treasury',
  compliance_officer: '/dashboard/compliance',
  reviewer: '/dashboard/reviewer',
  auditor: '/dashboard/auditor',
};

function mapBackendRole(r: string): UserRole {
  switch (r) {
    case 'admin': return 'Admin';
    case 'treasury_officer': return 'Treasury Officer';
    case 'compliance_officer': return 'Compliance Officer';
    case 'auditor': return 'Auditor';
    case 'reviewer': return 'Reviewer';
    case 'viewer': return 'Viewer';
    default:    return 'Viewer';
  }
}

export const Login: React.FC = () => {
  const { isAuthenticated, setAuth } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [roles, setRoles] = useState<{ value: string; label: string }[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // Use stable local roles for maximum reliability
    setRoles([
      { value: 'admin', label: 'Admin' },
      { value: 'treasury_officer', label: 'Treasury Officer' },
      { value: 'compliance_officer', label: 'Compliance Officer' },
      { value: 'reviewer', label: 'Reviewer' },
      { value: 'auditor', label: 'Auditor' },
    ]);
    setRolesLoading(false);
  }, []);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const handleLogin = async (e?: React.FormEvent, directEmail?: string, directPassword?: string) => {
    if (e) e.preventDefault();
    const loginEmail = directEmail || email;
    const loginPassword = directPassword || password;

    if (!loginEmail || !loginPassword) return;

    setLoading(true);
    try {
      // Primary login
      const { data } = await authApi.login({ email: loginEmail, password: loginPassword });

      // Supabase as secondary (non-blocking)
      supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      }).then(({ error: sbError }) => {
        if (sbError) console.warn('Supabase auth warning:', sbError.message);
      }).catch(err => console.warn('Supabase auth error:', err));

      const br = String((data.user as any).role || 'viewer');
      const displayRole = mapBackendRole(br);
      const user = {
        id: (data.user as any).id,
        email: (data.user as any).email,
        name: (data.user as any).full_name || loginEmail.split('@')[0],
        role: displayRole,
        walletAddress: (data.user as any).wallet_address || undefined,
        aiPreference: (data.user as any).ai_preference || 'ollama',
      };

      setAuth(data.access_token, user, br);
      showToast('success', 'Welcome back!', `Logged in as ${user.name}`);
      navigate(ROLE_ROUTES[br] || '/dashboard');
    } catch (error: any) {
      console.error('Auth error:', error);
      const detail = error?.response?.data?.detail || error.message || 'Authentication failed';
      showToast('error', 'Login Failed', detail);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (roleValue: string) => {
    const creds = DEMO_CREDENTIALS[roleValue];
    setSelectedRole(roleValue);
    if (creds && creds.email) {
      setEmail(creds.email);
      setPassword(creds.password);
      handleLogin(undefined, creds.email, creds.password);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex text-ink-900 overflow-hidden font-inter">
      {/* Left Panel — dark navy hero band */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden items-center justify-center border-r border-navy-800">
        <div className="absolute inset-0 opacity-[0.15]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.5) 1px, transparent 0)',
          backgroundSize: '40px 40px',
        }} />

        <div className="relative z-10 w-full max-w-2xl px-16">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-14 h-14 rounded-2xl bg-brand-primary flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">SettleGuard</h1>
              <p className="text-navy-200 font-medium text-sm tracking-widest uppercase">Compliance Orchestration</p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-white">
              Institutional Stablecoin<br />
              Settlement Engine
            </h2>
            <p className="text-navy-200 text-xl leading-relaxed max-w-lg">
              Compliance-aware policy enforcement with automated on-chain execution and privacy-preserving verification.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel — light form */}
      <div className="flex-1 flex items-center justify-center bg-surface-base px-6 relative overflow-y-auto">
        <div className="w-full max-w-md py-12 relative z-10 animate-slide-up">
          <div className="glass-card p-8 shadow-lg">
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-ink-900 mb-2">Quick Demo Login</h3>
              <p className="text-ink-600 text-sm">Select a role to explore that dashboard instantly.</p>
            </div>

            <div className="grid grid-cols-5 gap-2 mb-8">
              {rolesLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-surface-elevated animate-pulse border border-surface-border" />
                ))
              ) : (
                roles.map((role) => {
                  const Icon = ROLE_ICONS[role.value] || UserIcon;
                  const isSelected = selectedRole === role.value;
                  const colors = getRoleTone(role.value);

                  return (
                    <button
                      key={role.value}
                      onClick={() => handleRoleSelect(role.value)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all hover:scale-105 active:scale-95 group ${
                        isSelected ? colors + ' ring-1 ring-inset' : 'border-surface-border bg-surface-elevated text-ink-400 hover:border-brand-primary/40'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mb-1.5 transition-colors ${isSelected ? '' : 'group-hover:text-ink-600'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-tighter text-center leading-tight">
                        {role.label.split(' ')[0]}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {selectedRole && (
              <div className="mb-6 flex items-center justify-center gap-2 text-brand-primary text-xs font-bold">
                <Loader2 className="w-3 h-3 animate-spin" />
                Logging in as {roles.find(r => r.value === selectedRole)?.label}...
              </div>
            )}

            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surface-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-surface-card px-4 text-ink-400 font-bold tracking-widest">or sign in manually</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Select Role</label>
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-primary transition-colors" />
                  <select
                    className="select-field pl-11"
                    value={selectedRole || ''}
                    onChange={(e) => {
                      const roleValue = e.target.value;
                      setSelectedRole(roleValue);
                      const creds = DEMO_CREDENTIALS[roleValue];
                      if (creds && creds.email) {
                        setEmail(creds.email);
                        setPassword(creds.password);
                      }
                    }}
                  >
                    <option value="" disabled>Choose a role</option>
                    {roles.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-primary transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field pl-11"
                    placeholder="name@settleguard.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-ink-400 uppercase tracking-widest ml-1">Secure Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-primary transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-11 pr-11"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                  >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full h-12 text-sm flex items-center justify-center gap-2 mt-6"
              >
                {loading ? <InlineSpinner /> : <ArrowRight className="w-4 h-4" />}
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
