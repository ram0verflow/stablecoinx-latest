import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ToastProvider';
import type { UserRole } from '../types';

const DEMO_CREDENTIALS: Record<string, { email: string; password: string; label: string }> = {
  admin: { email: import.meta.env.VITE_DEMO_ADMIN_EMAIL || 'admin@settleguard.com', password: import.meta.env.VITE_DEMO_PASSWORD || 'hackathon123', label: 'Admin' },
  treasury_officer: { email: import.meta.env.VITE_DEMO_TREASURY_EMAIL || 'treasury@settleguard.com', password: import.meta.env.VITE_DEMO_PASSWORD || 'hackathon123', label: 'Treasury Officer' },
  compliance_officer: { email: import.meta.env.VITE_DEMO_COMPLIANCE_EMAIL || 'compliance@settleguard.com', password: import.meta.env.VITE_DEMO_PASSWORD || 'hackathon123', label: 'Compliance Officer' },
  reviewer: { email: import.meta.env.VITE_DEMO_REVIEWER_EMAIL || 'reviewer@settleguard.com', password: import.meta.env.VITE_DEMO_PASSWORD || 'hackathon123', label: 'Reviewer' },
  auditor: { email: import.meta.env.VITE_DEMO_AUDITOR_EMAIL || 'auditor@settleguard.com', password: import.meta.env.VITE_DEMO_PASSWORD || 'hackathon123', label: 'Auditor' },
};

function mapBackendRole(r: string): UserRole {
  switch (r) {
    case 'admin': return 'Admin';
    case 'treasury_officer': return 'Treasury Officer';
    case 'compliance_officer': return 'Compliance Officer';
    case 'auditor': return 'Auditor';
    case 'reviewer': return 'Reviewer';
    default: return 'Viewer';
  }
}

export const Login: React.FC = () => {
  const { isAuthenticated, setAuth } = useAuthStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);
  const [demoRole, setDemoRole] = useState('treasury_officer');

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await authApi.login({ email: loginEmail, password: loginPassword });

      // A 2xx response body that isn't the expected shape (e.g. a
      // cold-starting backend on Render's free tier returning something
      // other than real JSON on the very first request after idling) must
      // not crash with a raw "Cannot read properties of undefined" — show
      // a clear, actionable message instead.
      if (!data || typeof data !== 'object' || !data.user || !data.access_token) {
        throw new Error(
          'Login response was incomplete — the server may still be starting up (this can take up to a minute after being idle). Please try again in a few seconds.'
        );
      }

      supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
        .then(({ error: sbError }) => { if (sbError) console.warn('Supabase auth warning:', sbError.message); })
        .catch((err) => console.warn('Supabase auth error:', err));

      const br = String((data.user as any).role || 'viewer');
      const user = {
        id: (data.user as any).id,
        email: (data.user as any).email,
        name: (data.user as any).full_name || loginEmail.split('@')[0],
        role: mapBackendRole(br),
        walletAddress: (data.user as any).wallet_address || undefined,
        aiPreference: (data.user as any).ai_preference || 'ollama',
      };

      setAuth(data.access_token, user, br);
      showToast('success', 'Welcome back!', `Logged in as ${user.name}`);
      navigate('/dashboard');
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err.message || 'Authentication failed';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    doLogin(email, password);
  };

  const handleDemoLogin = () => {
    const creds = DEMO_CREDENTIALS[demoRole];
    if (creds) doLogin(creds.email, creds.password);
  };

  return (
    <div className="scx login-shell">
      <div className="login-brand">
        <span className="eyebrow">Institutional stablecoin infrastructure</span>
        <h1>Move money globally with policy built in, not bolted on</h1>
        <p>Cross-border stablecoin settlement with treasury controls, compliance evidence and dual authorization on every payment — provable end to end.</p>
      </div>

      <div className="login-panel">
        <div className="brand"><div className="mark" /><div className="word">CERTAPAY</div></div>
        <div className="login-title">Sign in</div>
        <div className="login-sub">Enter your credentials to access the settlement workspace.</div>

        <form onSubmit={handleSubmit}>
          <div className="lfield">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" className="linput" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@certapay.com" autoComplete="email" />
          </div>
          <div className="lfield">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" className="linput" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </div>
          {error && <div className="lerror">{error}</div>}
          <button type="submit" className="lsubmit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        </form>

        <div className="ldivider">or</div>

        {!showDemo ? (
          <button type="button" className="ldemo-toggle" onClick={() => setShowDemo(true)}>Use a demo account</button>
        ) : (
          <div className="ldemo-row">
            <select value={demoRole} onChange={(e) => setDemoRole(e.target.value)}>
              {Object.entries(DEMO_CREDENTIALS).map(([key, c]) => (
                <option key={key} value={key}>{c.label}</option>
              ))}
            </select>
            <button type="button" onClick={handleDemoLogin} disabled={loading}>Go</button>
          </div>
        )}
      </div>
    </div>
  );
};
