import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, Search, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAlertStore } from '../store/alertStore';
import { WalletConnect } from './WalletConnect';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { unreadCount } = useAlertStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 border-b border-surface-border bg-surface-card flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-8 flex-1">
        {/* Global Search Bar (Visual Only) */}
        <div className="max-w-md w-full relative group hidden md:block">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 group-focus-within:text-brand-primary transition-colors" />
          <input
            type="text"
            placeholder="Search protocol IDs, wallets, or reports..."
            className="w-full h-9 bg-surface-elevated border border-surface-border rounded-lg pl-10 pr-4 text-sm text-ink-900 placeholder-ink-400 focus:outline-none focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/10 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3 border-r border-surface-border pr-5">
          <WalletConnect />

          <button
            onClick={() => navigate('/alerts')}
            className="relative p-2 text-ink-600 hover:text-ink-900 hover:bg-surface-elevated rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-blocked rounded-full border-2 border-surface-card" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-ink-900">{user?.name || 'Authorized User'}</span>
            <span className="text-[11px] font-medium text-brand-primary uppercase tracking-wide">{user?.role?.replace('_', ' ') || 'Protocol Member'}</span>
          </div>

          <div className="relative group">
            <button
              onClick={() => navigate('/settings')}
              className="w-9 h-9 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center text-ink-600 hover:text-ink-900 hover:border-brand-primary/40 transition-colors"
            >
              <UserIcon className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-surface-border rounded-full flex items-center justify-center text-ink-400 hover:text-status-blocked hover:border-status-blocked/40 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
