import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/ToastProvider';
import { 
  Shield, User, Wallet, Bell, Database, Lock, 
  Settings as SettingsIcon, RefreshCw, Activity,
  Globe, Cpu, Server, Key, Network, Brain
} from 'lucide-react';
import { aiApi, authApi, monitoringApi } from '../lib/api';

export const Settings: React.FC = () => {
  const { user, setWallet, updatePreference } = useAuthStore();
  const { showToast } = useToast();

  const [aiEngine, setAiEngine] = useState(user?.aiPreference || 'ollama');
  const [telegramAlerts, setTelegramAlerts] = useState(true);
  const [serviceHealth, setServiceHealth] = useState({
    ai: false,
    base: false,
    polygon: false,
    neo4j: false,
    redis: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [aiModels, setAiModels] = useState({ ollama: 'ollama', groq: 'groq' });

  const refreshHealth = async () => {
    setRefreshing(true);
    try {
      const { data } = await monitoringApi.stats();
      const aiUp = data.ai_engine_status !== 'down';
      setServiceHealth({
        ai: aiUp,
        base: !!data.rpc_status?.base_sepolia,
        polygon: !!data.rpc_status?.polygon_amoy,
        neo4j: !!data.neo4j_status,
        redis: !!data.redis_status,
      });
      const health = await aiApi.getHealth();
      setAiModels({
        ollama: health.data?.ollama_model || 'ollama',
        groq: health.data?.groq_model || 'groq',
      });
    } catch {
      setServiceHealth({ ai: false, base: false, polygon: false, neo4j: false, redis: false });
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  useEffect(() => {
    refreshHealth();
    const timer = setInterval(refreshHealth, 30_000);
    return () => clearInterval(timer);
  }, []);

  const handleDisconnect = () => {
    setWallet('');
    showToast('info', 'Wallet Disconnected', 'Your wallet has been disconnected from the session');
  };

  const handleSave = async () => {
    try {
      await authApi.updatePreference(aiEngine);
      updatePreference(aiEngine);
      showToast('success', 'Settings Saved', 'Your preferences have been updated');
    } catch (error) {
      showToast('error', 'Update Failed', 'Could not save your preferences');
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20">
      <header className="mb-10">
        <div className="flex items-center gap-2 text-brand-primary text-[10px] font-black uppercase tracking-widest mb-2">
            <SettingsIcon className="w-3 h-3" />
            Configuration Portal
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">System Settings</h1>
        <p className="text-slate-500 font-medium">Manage your identity, security protocols, and system orchestration parameters.</p>
      </header>

      <div className="space-y-8">
        {/* User Identity Section */}
        <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-card p-8 border-white/5 bg-white/[0.02]">
                <h3 className="text-sm font-black uppercase tracking-widest text-white mb-8 flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-primary" />
                    User Identity
                </h3>
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xl font-bold text-brand-primary shadow-inner">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">{user?.name}</p>
                            <p className="text-xs text-slate-500">{user?.email}</p>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-white/5 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Access Role</span>
                            <span className="badge badge-pending">{user?.role}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Security Status</span>
                            <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1 uppercase tracking-tighter">
                                <Shield className="w-3 h-3" /> VERIFIED
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card p-8 border-white/5 bg-white/[0.02]">
                <h3 className="text-sm font-black uppercase tracking-widest text-white mb-8 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-brand-secondary" />
                    Web3 Integration
                </h3>
                {user?.walletAddress ? (
                    <div className="space-y-6">
                        <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Custodial Address</p>
                            <p className="text-xs font-mono text-slate-300 break-all">{user.walletAddress}</p>
                        </div>
                        <button onClick={handleDisconnect} className="w-full btn-secondary py-3 text-xs border-rose-500/20 text-rose-400">
                            Revoke Wallet Access
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-900 border border-dashed border-slate-700 flex items-center justify-center mb-4">
                            <Wallet className="w-5 h-5 text-slate-700" />
                        </div>
                        <p className="text-xs text-slate-500 font-medium">No wallet detected.<br/>Connect via navigation bar.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Engine Config */}
        <div className="glass-card p-8 border-white/5 bg-white/[0.02]">
            <h3 className="text-sm font-black uppercase tracking-widest text-white mb-8 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-violet-400" />
                Pipeline Orchestration
            </h3>
            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block ml-1">AI Decision Engine Model</label>
                    <select
                        value={aiEngine}
                        onChange={(e) => setAiEngine(e.target.value)}
                        className="select-field bg-slate-900/50"
                    >
                        <option value="ollama" className="bg-slate-900">{`Ollama (${aiModels.ollama}) - Local High-Privacy`}</option>
                        <option value="groq" className="bg-slate-900">{`Groq (${aiModels.groq}) - Cloud Low-Latency`}</option>
                    </select>
                    <p className="text-[10px] text-slate-500 italic ml-1">Local inference is recommended for PII-sensitive compliance processing.</p>
                </div>
                <div className="space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block ml-1">Notifications Protocol</label>
                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-slate-950/50">
                        <div>
                            <p className="text-xs font-bold text-slate-300">Telegram Infrastructure Alerting</p>
                            <p className="text-[10px] text-slate-500">Real-time settlement lifecycle updates</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={telegramAlerts} onChange={(e) => setTelegramAlerts(e.target.checked)} />
                            <div className="w-10 h-5 bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary peer-checked:after:bg-white"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        {/* System Health */}
        <div className="glass-card p-8 border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Infrastructure Health
                </h3>
                <button onClick={refreshHealth} disabled={refreshing} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                    { key: 'ai', label: 'Inference', icon: Brain },
                    { key: 'base', label: 'Base L2', icon: Globe },
                    { key: 'polygon', label: 'Polygon', icon: Network },
                    { key: 'neo4j', label: 'Graph DB', icon: Database },
                    { key: 'redis', label: 'Cache', icon: Server },
                ].map((s) => {
                    const up = serviceHealth[s.key as keyof typeof serviceHealth];
                    const Icon = s.icon;
                    return (
                        <div key={s.key} className="p-4 rounded-2xl border border-white/5 bg-slate-950/50 text-center group hover:border-white/10 transition-colors">
                            <div className={`w-2 h-2 rounded-full mx-auto mb-3 ${up ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                            <Icon className="w-5 h-5 mx-auto mb-2 text-slate-600 group-hover:text-slate-400 transition-colors" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
                            <p className={`text-[10px] font-bold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>{up ? 'ONLINE' : 'OFFLINE'}</p>
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="flex justify-end pt-4 gap-4">
            <button onClick={handleSave} className="btn-primary py-4 px-10 text-xs flex items-center gap-2 shadow-brand-primary/10">
                <Key className="w-4 h-4" /> Commit Protocol Changes
            </button>
        </div>
      </div>
    </div>
  );
};
