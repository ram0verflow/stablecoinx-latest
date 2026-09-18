import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  ClipboardCheck,
  FileText,
  Bell,
  RotateCcw,
  Settings,
  Shield,
  Zap,
} from 'lucide-react';

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/create-payment', icon: Plus, label: 'Create Payment' },
  { to: '/approval-queue', icon: ClipboardCheck, label: 'Approval Queue' },
  { to: '/audit-reports', icon: FileText, label: 'Audit Reports' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/revalidation', icon: RotateCcw, label: 'Revalidation' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export const Sidebar: React.FC = () => (
  <aside className="fixed left-0 top-0 bottom-0 w-64 bg-slate-950 border-r border-slate-800/60 flex flex-col z-40">
    {/* Logo */}
    <div className="px-6 py-6 border-b border-slate-800/60">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">SettleGuard</h1>
          <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">Compliance Engine</p>
        </div>
      </div>
    </div>

    {/* Navigation */}
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            isActive ? 'sidebar-link-active' : 'sidebar-link'
          }
        >
          <Icon className="w-[18px] h-[18px]" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>

    {/* Footer */}
    <div className="px-4 py-4 border-t border-slate-800/60">
      <div className="glass-card px-3 py-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" />
        <div>
          <p className="text-xs font-semibold text-slate-300">24-Layer Pipeline</p>
          <p className="text-[10px] text-slate-500">All systems operational</p>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
      </div>
    </div>
  </aside>
);
