import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/ToastProvider';
import {
  Shield, User, Wallet, Database, Lock,
  Settings as SettingsIcon, RefreshCw, Activity,
  Globe, Cpu, Server, Key, Network, Brain
} from 'lucide-react';
import { aiApi, authApi, monitoringApi } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusDot } from '../components/StatusBadge';

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
      <PageHeader
        title="System Settings"
        description="Manage your identity, security protocols, and system orchestration parameters."
        badge={
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ink-600 bg-surface-elevated border border-surface-border rounded-full px-3 py-1">
            <SettingsIcon className="w-3 h-3 text-brand-primary" /> Configuration Portal
          </span>
        }
      />

      <div className="space-y-6">
        {/* User Identity Section */}
        <div className="grid md:grid-cols-2 gap-5">
            <div className="glass-card p-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 mb-6 flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-primary" />
                    User Identity
                </h3>
                <div className="space-y-5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-brand-soft border border-surface-border flex items-center justify-center text-xl font-bold text-brand-primary">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-ink-900">{user?.name}</p>
                            <p className="text-xs text-ink-400">{user?.email}</p>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-surface-border space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Access Role</span>
                            <span className="badge badge-pending">{user?.role}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Security Status</span>
                            <span className="text-[11px] font-bold text-status-pass flex items-center gap-1 uppercase">
                                <Shield className="w-3 h-3" /> Verified
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 mb-6 flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-brand-primary" />
                    Web3 Integration
                </h3>
                {user?.walletAddress ? (
                    <div className="space-y-5">
                        <div className="p-4 rounded-lg bg-surface-elevated border border-surface-border">
                            <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-2">Custodial Address</p>
                            <p className="text-xs font-mono text-ink-600 break-all">{user.walletAddress}</p>
                        </div>
                        <button onClick={handleDisconnect} className="w-full btn-secondary py-2.5 text-xs border-status-blocked/30 text-status-blocked">
                            Revoke Wallet Access
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-center">
                        <div className="w-12 h-12 rounded-full bg-surface-elevated border border-dashed border-surface-border flex items-center justify-center mb-4">
                            <Wallet className="w-5 h-5 text-ink-400" />
                        </div>
                        <p className="text-xs text-ink-400 font-medium">No wallet detected.<br/>Connect via navigation bar.</p>
                    </div>
                )}
            </div>
        </div>

        {/* Engine Config */}
        <div className="glass-card p-6">
            <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 mb-6 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-brand-primary" />
                Pipeline Orchestration
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <label className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide block ml-1">AI Decision Engine Model</label>
                    <select
                        value={aiEngine}
                        onChange={(e) => setAiEngine(e.target.value)}
                        className="select-field"
                    >
                        <option value="ollama">{`Ollama (${aiModels.ollama}) - Local High-Privacy`}</option>
                        <option value="groq">{`Groq (${aiModels.groq}) - Cloud Low-Latency`}</option>
                    </select>
                    <p className="text-[11px] text-ink-400 italic ml-1">Local inference is recommended for PII-sensitive compliance processing.</p>
                </div>
                <div className="space-y-3">
                    <label className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide block ml-1">Notifications Protocol</label>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-surface-border bg-surface-elevated">
                        <div>
                            <p className="text-xs font-semibold text-ink-900">Telegram Infrastructure Alerting</p>
                            <p className="text-[11px] text-ink-400">Real-time settlement lifecycle updates</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={telegramAlerts} onChange={(e) => setTelegramAlerts(e.target.checked)} />
                            <div className="w-10 h-5 bg-surface-border rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow peer-checked:bg-brand-primary"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>

        {/* System Health */}
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand-primary" />
                    Infrastructure Health
                </h3>
                <button onClick={refreshHealth} disabled={refreshing} className="p-2 hover:bg-surface-elevated rounded-full text-ink-400 transition-colors">
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
                        <div key={s.key} className="p-4 rounded-lg border border-surface-border bg-surface-elevated text-center group hover:border-brand-primary/30 transition-colors">
                            <div className="flex justify-center mb-2">
                              <StatusDot tone={up ? 'pass' : 'blocked'} />
                            </div>
                            <Icon className="w-5 h-5 mx-auto mb-2 text-ink-400 group-hover:text-ink-600 transition-colors" />
                            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-600 mb-1">{s.label}</p>
                            <p className={`text-[11px] font-bold ${up ? 'text-status-pass' : 'text-status-blocked'}`}>{up ? 'Online' : 'Offline'}</p>
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="flex justify-end pt-2 gap-4">
            <button onClick={handleSave} className="btn-primary py-3 px-8 text-xs flex items-center gap-2">
                <Key className="w-4 h-4" /> Commit Protocol Changes
            </button>
        </div>
      </div>
    </div>
  );
};
