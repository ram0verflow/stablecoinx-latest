import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  ClipboardCheck,
  FileText,
  Bell,
  Settings,
  ShieldCheck,
  LogOut,
  User,
  Search,
  History,
  Compass
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { getRoleTone, formatRoleLabel } from './StatusBadge';

type NavLink = { to: string; icon: React.ComponentType<{ className?: string }>; label: string };
type NavGroup = { section: string; links: NavLink[] };

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleKey = useAuthStore.getState().role || 'viewer';

  const alertsAndSettings: NavLink[] = [
    { to: '/alerts', icon: Bell, label: 'Alerts' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const getGroups = (): NavGroup[] => {
    switch (roleKey) {
      case 'admin':
        return [
          { section: 'Overview', links: [{ to: '/dashboard/admin', icon: LayoutDashboard, label: 'Global Telemetry' }] },
          { section: 'Compliance', links: [{ to: '/revalidation', icon: ShieldCheck, label: 'Policy Engine' }] },
          { section: 'Audit & Proofs', links: [{ to: '/audit-reports', icon: FileText, label: 'Audit Archive' }] },
          { section: 'Operations', links: alertsAndSettings },
        ];
      case 'treasury_officer':
        return [
          { section: 'Overview', links: [{ to: '/dashboard/treasury', icon: LayoutDashboard, label: 'Operational Hub' }] },
          { section: 'Payments', links: [{ to: '/create-payment', icon: Plus, label: 'New Settlement' }] },
          { section: 'Approvals', links: [{ to: '/approval-queue', icon: ClipboardCheck, label: 'Execution Queue' }] },
          { section: 'Operations', links: alertsAndSettings },
        ];
      case 'compliance_officer':
        return [
          { section: 'Overview', links: [{ to: '/dashboard/compliance', icon: LayoutDashboard, label: 'Risk Monitor' }] },
          { section: 'Compliance', links: [
            { to: '/audit-reports', icon: Search, label: 'Flagged Queue' },
            { to: '/revalidation', icon: ShieldCheck, label: 'Sanctions List' },
          ] },
          { section: 'Operations', links: alertsAndSettings },
        ];
      case 'reviewer':
        return [
          { section: 'Overview', links: [{ to: '/dashboard/reviewer', icon: LayoutDashboard, label: 'Review Queue' }] },
          { section: 'Audit & Proofs', links: [{ to: '/audit-reports', icon: History, label: 'Past Decisions' }] },
          { section: 'Operations', links: alertsAndSettings },
        ];
      case 'auditor':
        return [
          { section: 'Overview', links: [{ to: '/dashboard/auditor', icon: LayoutDashboard, label: 'Auditor View' }] },
          { section: 'Audit & Proofs', links: [
            { to: '/audit-reports', icon: FileText, label: 'Historical Logs' },
            { to: '/revalidation', icon: History, label: 'Rescan Events' },
          ] },
          { section: 'Operations', links: alertsAndSettings },
        ];
      default:
        return [
          { section: 'Overview', links: [{ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }] },
          { section: 'Operations', links: alertsAndSettings },
        ];
    }
  };

  const groups = getGroups();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-navy-950 border-r border-navy-800 flex flex-col z-50">
      {/* Brand Identity */}
      <div className="px-6 py-7 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-primary flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">ALTARIA</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-status-pass" />
              <p className="text-[10px] text-navy-200 font-semibold tracking-wide uppercase">Protocol v2.4</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto custom-scrollbar">
        {groups.map((group) => (
          <div key={group.section}>
            <p className="px-3 mb-2 text-[10px] font-bold text-navy-400 uppercase tracking-[0.15em]">{group.section}</p>
            <div className="space-y-0.5">
              {group.links.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 text-sm font-medium ${
                      isActive
                        ? 'text-white bg-brand-primary'
                        : 'text-navy-200 hover:text-white hover:bg-navy-800'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: user + logout */}
      <div className="p-4 border-t border-navy-800 space-y-3">
        <div className="p-3 rounded-lg bg-navy-900 border border-navy-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-navy-800 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-navy-200" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name || 'Authorized member'}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-block mt-0.5 ${getRoleTone(roleKey)}`}>
              {formatRoleLabel(roleKey)}
            </span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full h-10 flex items-center justify-center gap-2 rounded-lg text-xs font-semibold text-navy-200 hover:text-white hover:bg-navy-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};
