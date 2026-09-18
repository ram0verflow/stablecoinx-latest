import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Wallet, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAlertStore } from '../store/alertStore';
import { RoleBadge } from './StatusBadge';
import { useToast } from './ToastProvider';

export const Navbar: React.FC = () => {
  const { user, logout, setWallet } = useAuthStore();
  const { unreadCount } = useAlertStore();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleWalletConnect = () => {
    const mockAddr = '0x' + Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    setWallet(mockAddr);
    showToast('success', 'Wallet Connected', `${mockAddr.slice(0, 6)}...${mockAddr.slice(-4)}`);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <h2 className="text-sm font-medium text-slate-400">
          Welcome back, <span className="text-slate-200">{user?.name || 'User'}</span>
        </h2>
        {user?.role && <RoleBadge role={user.role} />}
      </div>

      <div className="flex items-center gap-3">
        {/* Wallet */}
        {user?.walletAddress ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/60 border border-slate-700/50 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-mono text-slate-300">
              {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
            </span>
          </div>
        ) : (
          <button onClick={handleWalletConnect} className="btn-secondary text-xs flex items-center gap-2 !py-1.5 !px-3">
            <Wallet className="w-3.5 h-3.5" />
            Connect Wallet
          </button>
        )}

        {/* Alerts */}
        <button
          onClick={() => navigate('/alerts')}
          className="relative p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 rounded-lg transition-colors"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
