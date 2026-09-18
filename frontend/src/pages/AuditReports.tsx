import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportApi } from '../lib/api';
import { useToast } from '../components/ToastProvider';
import type { AuditReport } from '../types';

const statusColor = (status: string) => (/block/i.test(status) ? 'var(--red)' : /approve|execute/i.test(status) ? 'var(--green)' : 'var(--amber)');

export const AuditReports: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [tab, setTab] = useState<'fin' | 'set' | 'proof'>('fin');
  const [generating, setGenerating] = useState(false);

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    try {
      const response = await reportApi.list();
      const reportsData = response.data.reports || [];
      setReports(reportsData.map((r: any) => ({
        id: `RPT-${r.payment_id.substring(0, 8).toUpperCase()}`,
        paymentId: r.payment_id, corridor: r.corridor, amount: parseFloat(r.amount), token: r.token,
        status: r.status, aiDecision: r.ai_decision || 'APPROVE', zkProof: r.zk_proof || 'Not Generated', timestamp: r.created_at,
      })));
    } catch {
      showToast('error', 'Failed to load reports');
    }
  };

  const settled = useMemo(() => reports.filter((r) => ['executed', 'approved'].includes(r.status)), [reports]);
  const mostRecentSettled = settled[0];

  const handleDownload = async (paymentId: string) => {
    try {
      const response = await reportApi.downloadPayment(paymentId);
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url; a.download = `audit_report_${paymentId}.pdf`; a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'PDF downloaded', 'Audit trail exported successfully');
    } catch {
      showToast('error', 'Export Failed', 'Could not generate PDF report');
    }
  };

  const handleDownloadAll = async () => {
    try {
      setGenerating(true);
      const response = await reportApi.generateAll();
      showToast('success', 'Batch Generated', `Processed ${response.data.generated} compliance reports`);
      await loadReports();
    } catch {
      showToast('error', 'Batch Failed', 'Could not generate batch reports');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-row">
          <div><h1>Audit &amp; Proofs</h1><p>Immutable record of every financial decision and settlement.</p></div>
          <button className="btn" disabled={generating} onClick={handleDownloadAll}>{generating ? 'Compiling…' : 'Generate Batch Report'}</button>
        </div>
      </div>
      <div className="tabs">
        <button className={`tab${tab === 'fin' ? ' on' : ''}`} onClick={() => setTab('fin')}>Financial Decisions</button>
        <button className={`tab${tab === 'set' ? ' on' : ''}`} onClick={() => setTab('set')}>Settlements</button>
        <button className={`tab${tab === 'proof' ? ' on' : ''}`} onClick={() => setTab('proof')}>Proofs</button>
      </div>

      {tab === 'fin' && (
        <div className="content pad-t">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Payment</th><th>Decision</th><th>Corridor</th><th>Proof Reference</th><th>Time</th><th></th></tr></thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.paymentId} onClick={() => navigate(`/route-analysis/${r.paymentId}`)}>
                    <td className="mono">{r.id}</td>
                    <td><span className="status" style={{ color: statusColor(r.status) }}><span className="d" style={{ background: 'currentColor' }} />{r.status}</span></td>
                    <td>{r.corridor}</td>
                    <td className="hash mono">{r.zkProof.length > 18 ? `${r.zkProof.slice(0, 18)}…` : r.zkProof}</td>
                    <td>{new Date(r.timestamp).toLocaleTimeString()}</td>
                    <td><button className="impbtn" onClick={(e) => { e.stopPropagation(); handleDownload(r.paymentId); }}>Export</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {reports.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12.5 }}>No records yet.</div>}
          </div>
        </div>
      )}

      {tab === 'set' && (
        <div className="content pad-t">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Payment</th><th style={{ textAlign: 'right' }}>Amount</th><th>Corridor</th><th>Finality</th><th></th></tr></thead>
              <tbody>
                {settled.map((r) => (
                  <tr key={r.paymentId} onClick={() => navigate(`/route-analysis/${r.paymentId}`)}>
                    <td className="mono">{r.id}</td>
                    <td style={{ textAlign: 'right' }} className="num">${r.amount.toLocaleString()}</td>
                    <td>{r.corridor}</td>
                    <td><span className="status" style={{ color: 'var(--green)' }}><span className="d" style={{ background: 'currentColor' }} />Confirmed</span></td>
                    <td><button className="impbtn" onClick={(e) => { e.stopPropagation(); handleDownload(r.paymentId); }}>Export</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {settled.length === 0 && <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12.5 }}>No settlements yet.</div>}
          </div>
        </div>
      )}

      {tab === 'proof' && (
        <div className="content pad-t">
          {mostRecentSettled ? (
            <div className="lifecycle">
              <div className="lc-title">{mostRecentSettled.id} · Proof lifecycle</div>
              <div className="lc-sub">{mostRecentSettled.corridor} · ${mostRecentSettled.amount.toLocaleString()} {mostRecentSettled.token}</div>
              <div className="lc-row">
                <div className="lc-node"><div className="b">✓</div><div className="t">Authorization</div><div className="s">Confirmed</div></div>
                <div className="lc-node"><div className="b">✓</div><div className="t">Settlement</div><div className="s">Confirmed</div></div>
                <div className="lc-node"><div className="b">✓</div><div className="t">Confirmation</div><div className="s">On-chain</div></div>
                <div className="lc-node"><div className="b">✓</div><div className="t">Proof Registration</div><div className="h mono">{mostRecentSettled.zkProof.slice(0, 14)}…</div></div>
              </div>
            </div>
          ) : (
            <div className="table-wrap"><div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-muted)', fontSize: 12.5 }}>No settled payment with a proof yet.</div></div>
          )}
        </div>
      )}
    </>
  );
};
