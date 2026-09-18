import React, { useEffect, useState } from 'react';
import { policyApi } from '../lib/api';
import { IcChevronLeft } from '../components/scx/icons';

interface PolicyRule {
  id: string; source_country: string; destination_country: string; is_allowed: boolean;
  requires_kyc: boolean; requires_travel_rule: boolean; reporting_threshold: number;
  kyc_expiry_days: number; notes?: string; version_hash?: string; created_at: string;
}

const CATS = [
  { id: 'corridor', label: 'Corridor' },
  { id: 'treasury', label: 'Treasury' },
  { id: 'asset', label: 'Asset' },
  { id: 'approval', label: 'Approval' },
  { id: 'risk', label: 'Risk' },
];

export const Policies: React.FC = () => {
  const [rules, setRules] = useState<PolicyRule[]>([]);
  const [cat, setCat] = useState('corridor');
  const [selected, setSelected] = useState<PolicyRule | null>(null);

  useEffect(() => {
    policyApi.rules().then(({ data }) => setRules(Array.isArray(data) ? data : [])).catch(() => setRules([]));
  }, []);

  return (
    <>
      <div className="topbar">
        <div className="topbar-row">
          <div><h1>Policies</h1><p>Corridor, treasury, asset, approval and risk rules governing every payment.</p></div>
        </div>
      </div>
      <div className="tabs">
        {CATS.map((c) => (
          <button key={c.id} className={`tab${cat === c.id ? ' on' : ''}`} onClick={() => { setCat(c.id); setSelected(null); }}>{c.label}</button>
        ))}
      </div>

      {!selected ? (
        <div className="content pad-t">
          {cat === 'corridor' ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Policy</th><th>Scope</th><th>Version</th><th>Status</th><th>Reporting Threshold</th><th></th></tr></thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} onClick={() => setSelected(r)}>
                      <td><div className="pname">{r.source_country} → {r.destination_country} Corridor Policy</div></td>
                      <td style={{ color: 'var(--ink-soft)' }}>{r.source_country} → {r.destination_country}</td>
                      <td className="mono">{r.version_hash ? r.version_hash.slice(0, 8) : '—'}</td>
                      <td><span className={`status ${r.is_allowed ? 'st-green' : 'st-red'}`}><span className="d" style={{ background: 'currentColor' }} />{r.is_allowed ? 'Active' : 'Blocked'}</span></td>
                      <td>${Number(r.reporting_threshold).toLocaleString()}</td>
                      <td><button className="impbtn" onClick={(e) => { e.stopPropagation(); setSelected(r); }}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rules.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12.5 }}>No corridor policy rules configured.</div>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12.5 }}>
                No {CATS.find((c) => c.id === cat)?.label.toLowerCase()} policies configured in this environment yet.
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="content pad-t">
          <button className="back" onClick={() => setSelected(null)}><IcChevronLeft />Back to Policies</button>
          <div className="dtl-head">
            <div>
              <div className="dtl-name">{selected.source_country} → {selected.destination_country} Corridor Policy</div>
              <div className="dtl-meta">Scope: {selected.source_country} → {selected.destination_country} · Version {selected.version_hash ? selected.version_hash.slice(0, 10) : 'n/a'} · Created {new Date(selected.created_at).toLocaleDateString()}</div>
            </div>
          </div>
          <div className="dtl-grid">
            <div className="rule-card">
              <div className="rule-row"><span className="l">Status</span><span className="v" style={{ color: selected.is_allowed ? 'var(--green)' : 'var(--red)' }}>{selected.is_allowed ? 'Allowed' : 'Blocked'}</span></div>
              <div className="rule-row"><span className="l">Reporting threshold</span><span className="v">${Number(selected.reporting_threshold).toLocaleString()}</span></div>
              <div className="rule-row"><span className="l">KYC requirement</span><span className="v">{selected.requires_kyc ? `Required · expires ${selected.kyc_expiry_days}d` : 'Not required'}</span></div>
              <div className="rule-row"><span className="l">Travel rule</span><span className="v">{selected.requires_travel_rule ? 'Enforced' : 'N/A'}</span></div>
              <div className="rule-row"><span className="l">Notes</span><span className="v">{selected.notes || '—'}</span></div>
            </div>
            <div className="hist-card">
              <div className="hist-head">Version</div>
              <div className="hist-row cur">
                <div className="hist-v">{selected.version_hash ? selected.version_hash.slice(0, 3).toUpperCase() : 'V1'}</div>
                <div><div className="hist-t">Current active version</div><div className="hist-s">{new Date(selected.created_at).toLocaleDateString()} · current</div></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
