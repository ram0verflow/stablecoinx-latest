import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/ToastProvider';
import { authApi, monitoringApi } from '../lib/api';
import { PolicyEngineSettings } from '../components/PolicyEngineSettings';

interface UserRow { id: string; email: string; role: string; is_active: boolean }

const ROLE_BADGE: Record<string, string> = {
  admin: 'rb-admin', treasury_officer: 'rb-treasury', compliance_officer: 'rb-compliance',
  reviewer: 'rb-reviewer', auditor: 'rb-auditor',
};
const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', treasury_officer: 'Treasury', compliance_officer: 'Compliance', reviewer: 'Reviewer', auditor: 'Auditor',
};

const NAV_ITEMS = ['Organization', 'Users & Roles', 'Policy Engine', 'Approval Controls', 'Security', 'Environment', 'Notifications'];

export const Settings: React.FC = () => {
  const { user, role, setWallet, updatePreference, token: authToken } = useAuthStore();
  const { showToast } = useToast();
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL;

  const [nav, setNav] = useState('Users & Roles');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersRestricted, setUsersRestricted] = useState(false);
  const [aiEngine, setAiEngine] = useState(user?.aiPreference || 'ollama');
  const [health, setHealth] = useState({ ai: false, base: false, polygon: false, neo4j: false, redis: false });

  useEffect(() => {
    if (role !== 'admin' || !apiBaseUrl) { setUsersRestricted(true); return; }
    fetch(`${apiBaseUrl}/api/v1/auth/users`, { headers: { Authorization: `Bearer ${authToken || ''}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsersRestricted(true));
  }, [role, authToken, apiBaseUrl]);

  useEffect(() => {
    monitoringApi.stats().then(({ data }) => setHealth({
      ai: data.ai_engine_status !== 'down', base: !!data.rpc_status?.base_sepolia,
      polygon: !!data.rpc_status?.polygon_amoy, neo4j: !!data.neo4j_status, redis: !!data.redis_status,
    })).catch(() => {});
  }, []);

  const handleSavePreference = async () => {
    try {
      await authApi.updatePreference(aiEngine);
      updatePreference(aiEngine);
      showToast('success', 'Settings Saved', 'Your preferences have been updated');
    } catch {
      showToast('error', 'Update Failed', 'Could not save your preferences');
    }
  };

  return (
    <>
      <div className="topbar"><h1>Settings</h1></div>
      <div className="settings-body">
        <div className="snav">
          {NAV_ITEMS.map((item) => (
            <button key={item} className={`snav-item${nav === item ? ' on' : ''}`} onClick={() => setNav(item)}>{item}</button>
          ))}
        </div>

        <div className="scontent">
          {nav === 'Users & Roles' && (
            <>
              <div className="sctitle">Users &amp; Roles</div>
              <div className="scsub">Manage who can view, act on and authorize payments in this organization.</div>
              <div className="table-wrap">
                {usersRestricted ? (
                  <table>
                    <thead><tr><th>User</th><th>Role</th><th>Email</th><th>Status</th></tr></thead>
                    <tbody>
                      <tr>
                        <td><div className="uname"><span className="uav">{(user?.name || 'U').charAt(0)}</span>{user?.name}</div></td>
                        <td><span className={`rolebadge ${ROLE_BADGE[role || ''] || 'rb-auditor'}`}>{ROLE_LABEL[role || ''] || role}</span></td>
                        <td className="mono">{user?.email}</td>
                        <td className="stat on">Active</td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <table>
                    <thead><tr><th>User</th><th>Role</th><th>Email</th><th>Status</th></tr></thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td><div className="uname"><span className="uav">{u.email.charAt(0).toUpperCase()}</span>{u.email.split('@')[0]}</div></td>
                          <td><span className={`rolebadge ${ROLE_BADGE[u.role] || 'rb-auditor'}`}>{ROLE_LABEL[u.role] || u.role}</span></td>
                          <td className="mono">{u.email}</td>
                          <td className={`stat${u.is_active ? ' on' : ''}`}>{u.is_active ? 'Active' : 'Inactive'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {usersRestricted && <p style={{ fontSize: 11.5, color: 'var(--ink-muted)', marginTop: 10 }}>Full user roster is admin-only in this environment. Showing your own account.</p>}

              <div className="legend">
                <div className="legend-title">Role permissions</div>
                <div className="legend-row"><b>Admin</b>Full access — users, policies, environment and security settings.</div>
                <div className="legend-row"><b>Treasury</b>Create and submit payments; cannot self-approve above threshold.</div>
                <div className="legend-row"><b>Compliance</b>Reviews risk exceptions and manages compliance-linked policies.</div>
                <div className="legend-row"><b>Reviewer</b>Approves or rejects payments queued for dual authorization.</div>
                <div className="legend-row"><b>Auditor</b>Read-only access to audit trail, proofs and policy history.</div>
              </div>
            </>
          )}

          {nav === 'Policy Engine' && <PolicyEngineSettings />}

          {nav === 'Security' && (
            <>
              <div className="sctitle">Profile &amp; Security</div>
              <div className="scsub">Your identity and wallet connection.</div>
              <div className="table-wrap" style={{ maxWidth: 480 }}>
                <table>
                  <tbody>
                    <tr><td style={{ color: 'var(--ink-muted)' }}>Name</td><td style={{ fontWeight: 600 }}>{user?.name}</td></tr>
                    <tr><td style={{ color: 'var(--ink-muted)' }}>Email</td><td className="mono">{user?.email}</td></tr>
                    <tr><td style={{ color: 'var(--ink-muted)' }}>Role</td><td><span className={`rolebadge ${ROLE_BADGE[role || ''] || 'rb-auditor'}`}>{ROLE_LABEL[role || ''] || role}</span></td></tr>
                    <tr><td style={{ color: 'var(--ink-muted)' }}>Wallet</td><td className="mono">{user?.walletAddress || 'Not connected'}</td></tr>
                  </tbody>
                </table>
              </div>
              {user?.walletAddress && (
                <button className="btn" style={{ marginTop: 14, color: 'var(--red)' }} onClick={() => { setWallet(''); showToast('info', 'Wallet Disconnected', 'Your wallet has been disconnected'); }}>Revoke Wallet Access</button>
              )}
            </>
          )}

          {nav === 'Approval Controls' && (
            <>
              <div className="sctitle">Pipeline Orchestration</div>
              <div className="scsub">AI advisory is informational only — deterministic policy always has final say.</div>
              <div className="field" style={{ maxWidth: 360 }}>
                <label>AI decision engine</label>
                <select className="finput" value={aiEngine} onChange={(e) => setAiEngine(e.target.value)}>
                  <option value="ollama">Ollama — local, high privacy</option>
                  <option value="groq">Groq — cloud, low latency</option>
                </select>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={handleSavePreference}>Save Preference</button>
            </>
          )}

          {nav === 'Environment' && (
            <>
              <div className="sctitle">Infrastructure Health</div>
              <div className="scsub">Live status from the running backend — nothing here is simulated.</div>
              <div className="sgrid" style={{ maxWidth: 700 }}>
                {[
                  ['Inference', health.ai], ['Base L2', health.base], ['Polygon', health.polygon],
                  ['Graph DB', health.neo4j], ['Cache', health.redis],
                ].map(([label, ok]) => (
                  <div className="scard" key={label as string}>
                    <div className="sname">{label}</div>
                    <div className={`sstatus ${ok ? 'sst-h' : 'sst-d'}`}>{ok ? 'Healthy' : 'Offline'}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {(nav === 'Organization' || nav === 'Notifications') && (
            <>
              <div className="sctitle">{nav}</div>
              <div className="scsub">Not configurable in this environment yet.</div>
            </>
          )}
        </div>
      </div>
    </>
  );
};
