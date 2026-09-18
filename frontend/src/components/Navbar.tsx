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
    <header className="h-20 border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex items-center gap-8 flex-1">
          {/* Global Search Bar (Visual Only) */}
          <div className="max-w-md w-full relative group hidden md:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-brand-primary transition-colors" />
              <input 
                  type="text" 
                  placeholder="Search protocol IDs, wallets, or reports..." 
                  className="w-full h-10 bg-slate-900/50 border border-white/5 rounded-xl pl-12 pr-4 text-xs text-slate-300 focus:outline-none focus:border-brand-primary/30 focus:bg-slate-900 transition-all"
              />
          </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 border-r border-white/5 pr-6">
            <WalletConnect />
            
            <button
              onClick={() => navigate('/alerts')}
              className="relative p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-950" />
              )}
            </button>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
                <span className="text-xs font-black text-white tracking-tight">{user?.name || 'Authorized User'}</span>
                <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest">{user?.role?.replace('_', ' ') || 'Protocol Member'}</span>
            </div>
            
            <div className="relative group">
                <button 
                    onClick={() => navigate('/settings')}
                    className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:border-brand-primary/30 transition-all"
                >
                    <UserIcon className="w-5 h-5" />
                </button>
                
                <button
                  onClick={handleLogout}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-slate-800 border border-white/10 rounded-full flex items-center justify-center text-slate-500 hover:text-rose-400 hover:border-rose-500/30 transition-all"
                  title="Secure Logout"
                >
                  <LogOut className="w-3 h-3" />
                </button>
            </div>
        </div>
      </div>
    </header>
  );
};
