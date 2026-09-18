import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  ClipboardCheck,
  FileText,
  Bell,
  Settings,
  Shield,
  Zap,
  LogOut,
  User,
  ShieldCheck,
  CreditCard,
  Search,
  Activity,
  History,
  Layers,
  Compass
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleKey = useAuthStore.getState().role || 'viewer';


  const getLinks = () => {
    const common = [
      { to: '/alerts', icon: Bell, label: 'Alerts' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ];

    switch (roleKey) {
      case 'admin':
        return [
          { to: '/dashboard/admin', icon: LayoutDashboard, label: 'Global Telemetry' },
          { to: '/revalidation', icon: ShieldCheck, label: 'Policy Engine' },
          { to: '/audit-reports', icon: FileText, label: 'Audit Archive' },
          ...common
        ];
      case 'treasury_officer':
        return [
          { to: '/dashboard/treasury', icon: LayoutDashboard, label: 'Operational Hub' },
          { to: '/create-payment', icon: Plus, label: 'New Settlement' },
          { to: '/approval-queue', icon: ClipboardCheck, label: 'Execution Queue' },
          ...common
        ];
      case 'compliance_officer':
        return [
          { to: '/dashboard/compliance', icon: LayoutDashboard, label: 'Risk Monitor' },
          { to: '/audit-reports', icon: Search, label: 'Flagged Queue' },
          { to: '/revalidation', icon: ShieldCheck, label: 'Sanctions List' },
          ...common
        ];
      case 'reviewer':
        return [
          { to: '/dashboard/reviewer', icon: LayoutDashboard, label: 'Review Queue' },
          { to: '/audit-reports', icon: History, label: 'Past Decisions' },
          ...common
        ];
      case 'auditor':
        return [
          { to: '/dashboard/auditor', icon: LayoutDashboard, label: 'Auditor View' },
          { to: '/audit-reports', icon: FileText, label: 'Historical Logs' },
          { to: '/revalidation', icon: History, label: 'Rescan Events' },
          ...common
        ];
      default:
        return [
          { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          ...common
        ];
    }
  };

  const links = getLinks();

  const getRoleColor = () => {
    switch (roleKey) {
      case 'admin': return 'text-purple-400 border-purple-500/20 bg-purple-500/5';
      case 'treasury_officer': return 'text-brand-primary border-brand-primary/20 bg-brand-primary/5';
      case 'compliance_officer': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
      case 'reviewer': return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
      case 'auditor': return 'text-cyan-400 border-cyan-500/20 bg-cyan-500/5';
      default: return 'text-slate-400 border-slate-500/20 bg-slate-500/5';
    }
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-950/80 backdrop-blur-3xl border-r border-white/5 flex flex-col z-50">
      {/* Brand Identity */}
      <div className="px-8 py-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center shadow-lg shadow-brand-primary/20 rotate-3 group-hover:rotate-0 transition-transform">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tighter">ALTARIA</h1>
            <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">Protocol v2.4</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Matrix */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar pt-4">
        <p className="px-4 mb-4 text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Management Matrix</p>
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3.5 rounded-xl transition-all duration-300 font-bold text-xs uppercase tracking-widest group relative overflow-hidden ${
                isActive 
                  ? 'text-brand-primary bg-brand-primary/5 border border-brand-primary/10' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
              }`
            }
          >
            <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110`} />
            <span>{label}</span>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-brand-primary rounded-r-full opacity-0 scale-y-0 transition-all group-[.active]:opacity-100 group-[.active]:scale-y-100" />
          </NavLink>
        ))}
      </nav>

      {/* Infrastructure Footer */}
      <div className="p-6 border-t border-white/5 space-y-6">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
           <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-900 flex items-center justify-center border border-white/5 shadow-inner">
                 <User className="w-4 h-4 text-brand-primary" />
              </div>
              <div className="min-w-0">
                 <p className="text-[11px] font-black text-white truncate uppercase tracking-tighter">{user?.name || 'Authorized member'}</p>
                 <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border inline-block mt-1 ${getRoleColor()}`}>
                    {user?.role?.replace('_', ' ') || 'Guest'}
                 </span>
              </div>
           </div>
           
           <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500 bg-black/40 p-2.5 rounded-lg border border-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="truncate">{user?.walletAddress || 'Disconnected'}</span>
           </div>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-[10px] font-black text-slate-500 hover:text-rose-400 hover:bg-rose-400/5 border border-transparent hover:border-rose-500/10 transition-all uppercase tracking-[0.2em]"
        >
          <LogOut className="w-4 h-4" />
          <span>Terminate Session</span>
        </button>
      </div>
    </aside>
  );
};
