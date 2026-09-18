import React, { useEffect, useMemo, useState } from 'react';
import { revalidationApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import type { RevalidationRecord } from '../types';
import { IcChevronLeft } from '../components/scx/icons';

const sevFor = (r: RevalidationRecord) => (!r.decision_changed ? { cls: 'sev-low', label: 'Low' } : /block/i.test(r.new_decision) ? { cls: 'sev-high', label: 'High' } : { cls: 'sev-med', label: 'Medium' });
const statusColor = (decision: string) => (/block/i.test(decision) ? 'var(--red)' : /approve|valid/i.test(decision) ? 'var(--green)' : 'var(--amber)');

export const Revalidation: React.FC = () => {
  const { showToast } = useToast();
  const [records, setRecords] = useState<RevalidationRecord[]>([]);
  const [mode, setMode] = useState<'table' | 'cascade' | 'compare'>('table');
  const [compareRecord, setCompareRecord] = useState<RevalidationRecord | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerOpen, setTriggerOpen] = useState(false);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    try {
      const { data } = await revalidationApi.list();
      setRecords(Array.isArray(data) ? data : (data as any)?.records || []);
    } catch {
      showToast('error', 'Failed to load revalidations', 'Could not fetch records');
    }
  };

  const handleTrigger = async (type: string) => {
    try {
      setTriggering(true);
      let result;
      if (type === 'sanctions') result = await revalidationApi.triggerSanctions();
      else if (type === 'policy') result = await revalidationApi.triggerPolicy();
      else if (type === 'wallet') result = await revalidationApi.triggerWallet();
      else if (type === 'issuer') result = await revalidationApi.triggerIssuer();
      else result = await revalidationApi.trigger({ trigger_type: 'all' });
      showToast('success', 'Revalidation Triggered', `${result.data?.flagged_count ?? 0} payments flagged, ${result.data?.triggered_count ?? 0} re-queued`);
      setTriggerOpen(false);
      setTimeout(loadRecords, 1000);
    } catch {
      showToast('error', 'Trigger Failed', 'Could not start revalidation process');
    } finally {
      setTriggering(false);
    }
  };

  const cascades = useMemo(() => {
    const groups = new Map<string, RevalidationRecord[]>();
    records.forEach((r) => {
      const key = r.trigger_reason || 'Unspecified trigger';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });
    return Array.from(groups.entries()).map(([trigger, recs]) => ({
      trigger,
      valid: recs.filter((r) => !r.decision_changed).length,
      review: recs.filter((r) => r.decision_changed && !/block/i.test(r.new_decision)).length,
      blocked: recs.filter((r) => r.decision_changed && /block/i.test(r.new_decision)).length,
      recs,
    }));
  }, [records]);

  return (
    <>
      <div className="topbar">
        <div><h1>Revalidation</h1><p>Historical payments re-evaluated after a policy or evidence change.</p></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="seg">
            <button className={`seg-btn${mode === 'table' ? ' on' : ''}`} onClick={() => setMode('table')}>Table</button>
            <button className={`seg-btn${mode === 'cascade' ? ' on' : ''}`} onClick={() => setMode('cascade')}>Cascade View</button>
          </div>
          <button className="btn btn-primary" onClick={() => setTriggerOpen(true)}>Start Global Rescan</button>
        </div>
      </div>

      {mode === 'table' && (
        <div className="content pad-t">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Payment</th><th>Original Decision</th><th>Trigger</th><th>New Result</th><th>Severity</th><th></th></tr></thead>
              <tbody>
                {records.map((r: any) => {
                  const sev = sevFor(r);
                  return (
                    <tr key={r.id} onClick={() => { setCompareRecord(r); setMode('compare'); }}>
                      <td><span className="pid mono">#{r.payment_id?.slice(0, 8)}</span></td>
                      <td style={{ color: 'var(--ink-soft)' }}>{r.original_decision}</td>
                      <td style={{ color: 'var(--ink-muted)' }}>{r.trigger_reason}</td>
                      <td><span className="status" style={{ color: statusColor(r.new_decision) }}><span className="d" style={{ background: 'currentColor' }} />{r.new_decision}</span></td>
                      <td><span className={`sev ${sev.cls}`}>{sev.label}</span></td>
                      <td><span className="actlink">Compare →</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {records.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12.5 }}>No revalidation records identified.</div>
            )}
          </div>
        </div>
      )}

      {mode === 'cascade' && (
        <div className="content pad-t">
          {cascades.map((c) => (
            <div className="casc-panel" key={c.trigger} style={{ marginBottom: 16 }}>
              <div className="casc-trunk">
                <div className="imp-node hi">{c.trigger}</div>
                <div className="imp-line" />
                <div className="imp-count">{c.recs.length} historical payment{c.recs.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="branch-row">
                <div className="bcol"><div className="bnode"><div className="n" style={{ color: 'var(--green)' }}>{c.valid}</div><div className="l">Still valid</div><div className="chips">{c.recs.filter((r) => !r.decision_changed).slice(0, 2).map((r) => <span className="chip" key={r.id}>#{r.payment_id.slice(0, 8)}</span>)}</div></div></div>
                <div className="bcol"><div className="bnode"><div className="n" style={{ color: 'var(--amber)' }}>{c.review}</div><div className="l">Review</div><div className="chips">{c.recs.filter((r) => r.decision_changed && !/block/i.test(r.new_decision)).slice(0, 2).map((r) => <span className="chip" key={r.id}>#{r.payment_id.slice(0, 8)}</span>)}</div></div></div>
                <div className="bcol"><div className="bnode"><div className="n" style={{ color: 'var(--red)' }}>{c.blocked}</div><div className="l">Blocked</div><div className="chips">{c.recs.filter((r) => r.decision_changed && /block/i.test(r.new_decision)).slice(0, 2).map((r) => <span className="chip" key={r.id}>#{r.payment_id.slice(0, 8)}</span>)}</div></div></div>
              </div>
            </div>
          ))}
          {cascades.length === 0 && (
            <div className="casc-panel" style={{ textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12.5 }}>No revalidation cascades identified.</div>
          )}
        </div>
      )}

      {mode === 'compare' && compareRecord && (
        <div className="content pad-t">
          <button className="back" onClick={() => setMode('table')}><IcChevronLeft />Back to Revalidation</button>
          <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 14 }}>#{compareRecord.payment_id.slice(0, 8)} · Risk delta {compareRecord.new_risk_score ?? '—'}</div>
          <div className="cmp-grid">
            <div className="cmp-card">
              <div className="cmp-head orig">Original</div>
              <div className="cmp-row"><span className="l">Decision</span><span className="v" style={{ color: statusColor(compareRecord.original_decision) }}>{compareRecord.original_decision}</span></div>
              <div className="cmp-row"><span className="l">Status</span><span className="v">{compareRecord.status}</span></div>
            </div>
            <div className="cmp-card">
              <div className="cmp-head cur">Current</div>
              <div className="cmp-row"><span className="l">Decision</span><span className="v" style={{ color: statusColor(compareRecord.new_decision) }}>{compareRecord.new_decision}</span></div>
              <div className="cmp-row"><span className="l">Trigger</span><span className="v">{compareRecord.trigger_reason}</span></div>
            </div>
          </div>
        </div>
      )}

      {triggerOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(19,20,23,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }} onClick={() => setTriggerOpen(false)}>
          <div className="card" style={{ maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <div className="chead"><div className="ctitle">Trigger revalidation scan</div></div>
            <div className="cbody" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['sanctions', 'Sanctions List Update'],
                ['policy', 'Policy Engine Version Change'],
                ['wallet', 'Graph Database Re-indexing'],
                ['issuer', 'Stablecoin Asset Audit'],
              ].map(([id, label]) => (
                <button key={id} className="btn" style={{ justifyContent: 'space-between' }} disabled={triggering} onClick={() => handleTrigger(id)}>{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
