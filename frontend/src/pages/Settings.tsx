import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/ToastProvider';
import { Shield, User, Wallet, Bell, Database, Lock } from 'lucide-react';
import { RoleBadge } from '../components/StatusBadge';

export const Settings: React.FC = () => {
  const { user, setWallet } = useAuthStore();
  const { showToast } = useToast();

  const [aiEngine, setAiEngine] = useState('ollama');
  const [telegramAlerts, setTelegramAlerts] = useState(true);

  const handleDisconnect = () => {
    setWallet('');
    showToast('info', 'Wallet Disconnected', 'Your wallet has been disconnected from the session');
  };

  const handleSave = () => {
    showToast('success', 'Settings Saved', 'Your preferences have been updated');
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-10">
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage profile, wallet, and system preferences</p>
      </div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-indigo-400" />
            <h3 className="section-title">User Profile</h3>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Name</label>
              <p className="text-slate-200 font-medium">{user?.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Email</label>
              <p className="text-slate-200">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Role</label>
              <div className="mt-1">
                {user?.role && <RoleBadge role={user.role} />}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Session</label>
              <p className="text-emerald-400 text-sm font-medium flex items-center gap-1">
                <Shield className="w-4 h-4" /> Authenticated
              </p>
            </div>
          </div>
        </div>

        {/* Wallet */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-violet-400" />
            <h3 className="section-title">Connected Wallet</h3>
          </div>
          {user?.walletAddress ? (
            <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Custodial Signing Wallet</p>
                  <p className="text-xs font-mono text-slate-400">{user.walletAddress}</p>
                </div>
              </div>
              <button onClick={handleDisconnect} className="btn-secondary text-sm">Disconnect</button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No wallet connected. Connect from the top navigation bar.</p>
          )}
        </div>

        {/* Preferences */}
        <div className="grid grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-5 h-5 text-amber-400" />
              <h3 className="section-title">System Configuration</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">AI Decision Engine</label>
                <select
                  value={aiEngine}
                  onChange={(e) => setAiEngine(e.target.value)}
                  className="select-field"
                >
                  <option value="ollama">Ollama (gemma:2b) - Local</option>
                  <option value="groq">Groq (llama3-8b) - Cloud</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Policy Version</label>
                <div className="input-field font-mono text-xs text-slate-500 cursor-not-allowed bg-slate-900/50">
                  v2.4.1 (Hash: 0x8f2a...19cb)
                </div>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-sky-400" />
              <h3 className="section-title">Notifications</h3>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">Telegram Alerts</p>
                  <p className="text-xs text-slate-500">Receive critical workflow alerts via bot</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={telegramAlerts} onChange={(e) => setTelegramAlerts(e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Lock className="w-4 h-4" /> Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
