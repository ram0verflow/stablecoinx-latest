import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { paymentApi, revalidationApi } from '../../lib/api';
import {
  IcOverview, IcPayments, IcCheck, IcPolicies, IcShield, IcRevalidation,
  IcDoc, IcIntegrations, IcInfrastructure, IcSettings, IcSearch,
} from './icons';

type NavItem = {
  to: string;
  icon: React.FC<{ className?: string }>;
  label: string;
  roles?: string[];
  countKey?: 'approvals' | 'revalidation';
};
type NavGroup = { section: string; links: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Operations',
    links: [
      { to: '/dashboard', icon: IcOverview, label: 'Overview' },
      { to: '/payments', icon: IcPayments, label: 'Payments' },
      { to: '/approval-queue', icon: IcCheck, label: 'Approvals', roles: ['treasury_officer', 'reviewer', 'admin'], countKey: 'approvals' },
    ],
  },
  {
    section: 'Controls',
    links: [
      { to: '/policies', icon: IcPolicies, label: 'Policies' },
      { to: '/compliance', icon: IcShield, label: 'Risk & Compliance' },
      { to: '/mixer-signals', icon: IcSearch, label: 'Mixer Signals' },
      { to: '/revalidation', icon: IcRevalidation, label: 'Revalidation', roles: ['compliance_officer', 'admin', 'auditor'], countKey: 'revalidation' },
    ],
  },
  {
    section: 'Evidence',
    links: [
      { to: '/audit-reports', icon: IcDoc, label: 'Audit & Proofs', roles: ['auditor', 'admin', 'compliance_officer'] },
    ],
  },
  {
    section: 'Platform',
    links: [
      { to: '/integrations', icon: IcIntegrations, label: 'Integrations' },
      { to: '/infrastructure', icon: IcInfrastructure, label: 'Infrastructure' },
    ],
  },
  {
    section: 'Administration',
    links: [
      { to: '/settings', icon: IcSettings, label: 'Settings' },
    ],
  },
];

export const Rail: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const roleKey = useAuthStore.getState().role || 'viewer';
  const [counts, setCounts] = useState({ approvals: 0, revalidation: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const [pending, reval] = await Promise.allSettled([
          paymentApi.getPendingApprovals(),
          revalidationApi.list(),
        ]);
        const approvals = pending.status === 'fulfilled' ? (pending.value.data || []).length : 0;
        const revalList = reval.status === 'fulfilled' ? (Array.isArray(reval.value.data) ? reval.value.data : (reval.value.data as any)?.records || []) : [];
        const revalidation = revalList.filter((r: any) => r.status === 'pending').length;
        setCounts({ approvals, revalidation });
      } catch {
        // best effort
      }
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = (user?.name || 'U')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="rail">
      <div className="rail-logo"><div className="mark" /><div className="word">CERTAPAY</div></div>
      {NAV_GROUPS.map((group) => {
        const visible = group.links.filter((l) => !l.roles || l.roles.includes(roleKey));
        if (visible.length === 0) return null;
        return (
          <div className="rail-group" key={group.section}>
            <div className="rail-label">{group.section}</div>
            {visible.map(({ to, icon: Icon, label, countKey }) => {
              const count = countKey ? counts[countKey] : 0;
              return (
                <NavLink key={to} to={to} className={({ isActive }) => `rail-item${isActive ? ' active' : ''}`}>
                  <Icon />
                  <span>{label}</span>
                  {countKey && count > 0 && <span className="badge">{count}</span>}
                </NavLink>
              );
            })}
          </div>
        );
      })}
      <div className="rail-foot">
        <div className="avatar">{initials || 'U'}</div>
        <div>
          <div className="name">{user?.name || 'Authorized member'}</div>
          <div className="role">{user?.role || 'Member'}</div>
        </div>
        <button className="rail-signout" onClick={handleLogout} title="Sign out">
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
};
