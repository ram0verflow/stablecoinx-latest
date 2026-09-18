import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { getStoredToken } from '../lib/authStorage';
import { IcSeal, IcAlertTriangle, IcLock, IcChevronDown } from '../components/scx/icons';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

interface ProofPayment {
  id: string; amount: number; token: string; status: string;
  destination_chain?: string; executed_at?: string | null; intent_hash?: string | null; created_at: string;
}

export const ProofPage: React.FC = () => {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState<ProofPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'not_found' | 'auth_required' | 'unknown' | null>(null);
  const [showTech, setShowTech] = useState(false);

  useEffect(() => {
    if (!paymentId) return;
    const token = getStoredToken();
    axios.get(`${API_BASE}/api/v1/payments/${paymentId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(({ data }) => setPayment(data))
      .catch((err) => {
        if (err?.response?.status === 401) setError('auth_required');
        else if (err?.response?.status === 404) setError('not_found');
        else setError('unknown');
      })
      .finally(() => setLoading(false));
  }, [paymentId]);

  const verified = payment?.status === 'executed';

  return (
    <div className="scx proof-page">
      <Link to="/" className="brandrow"><div className="mark" /><div className="word">CERTAPAY</div></Link>

      {loading && <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>Verifying settlement…</p>}

      {!loading && error === 'auth_required' && (
        <div className="proof-card">
          <div className="seal warn"><IcLock className="" /></div>
          <div className="p-headline">Public verification not yet exposed</div>
          <div className="p-subline">This build of CertaPay doesn't yet expose a public, unauthenticated proof endpoint — planned for the upcoming integrations phase (a dedicated proofs.certapay.xyz surface). Sign in to view this payment's record from the audit trail instead.</div>
          <Link to="/login" className="mbtn mbtn-dark" style={{ display: 'inline-block', marginTop: 20 }}>Sign in</Link>
        </div>
      )}

      {!loading && error === 'not_found' && (
        <div className="proof-card">
          <div className="seal bad"><IcAlertTriangle className="" /></div>
          <div className="p-headline">No settlement found</div>
          <div className="p-subline">No payment matches ID <span className="mono">{paymentId}</span>.</div>
        </div>
      )}

      {!loading && payment && (
        <div className="proof-card">
          <div className={`seal ${verified ? '' : 'warn'}`}><IcSeal className="" /></div>
          <div className="p-headline">{verified ? 'Settlement Verified' : 'Settlement Not Yet Final'}</div>
          <div className="p-subline">
            {verified ? 'This payment settled on-chain and its proof has been independently registered.' : `Current status: ${payment.status.replace(/_/g, ' ')}. Verification will update once settlement completes.`}
          </div>
          <div className="p-ref">#{payment.id.slice(0, 8)}</div>

          <div className="datagrid">
            <div className="drow"><span className="l">Amount</span><span className="v num">${Number(payment.amount).toLocaleString()}</span></div>
            <div className="drow"><span className="l">Asset</span><span className="v">{payment.token}</span></div>
            <div className="drow"><span className="l">Network</span><span className="v">{payment.destination_chain || '—'}</span></div>
            <div className="drow"><span className="l">Settlement status</span><span className="v" style={{ color: verified ? 'var(--green)' : 'var(--amber)' }}>{payment.status.replace(/_/g, ' ')}</span></div>
            <div className="drow"><span className="l">Authorization</span><span className="v mono">{payment.intent_hash ? `${payment.intent_hash.slice(0, 10)}…` : 'Not yet generated'}</span></div>
            <div className="drow"><span className="l">Timestamp</span><span className="v">{new Date(payment.created_at).toLocaleString()}</span></div>
          </div>

          <div className="tl">
            <div className="tl-label">Settlement timeline</div>
            <div className="tl-row">
              <div className="tl-step"><div className="b">✓</div><div className="t">Authorized</div></div>
              <div className={`tl-step${['approved', 'executed'].includes(payment.status) ? '' : ' pend'}`}><div className="b">{['approved', 'executed'].includes(payment.status) ? '✓' : '○'}</div><div className="t">Settled</div></div>
              <div className={`tl-step${payment.status === 'executed' ? '' : ' pend'}`}><div className="b">{payment.status === 'executed' ? '✓' : '○'}</div><div className="t">Confirmed</div></div>
              <div className={`tl-step${payment.status === 'executed' ? '' : ' pend'}`}><div className="b">{payment.status === 'executed' ? '✓' : '○'}</div><div className="t">Proof Registered</div></div>
            </div>
          </div>

          <div className="tech">
            <button className={`tech-tog${showTech ? ' open' : ''}`} onClick={() => setShowTech((v) => !v)}>
              <span>Technical evidence</span><IcChevronDown className="" />
            </button>
            {showTech && (
              <div className="tech-body">
                <div className="tech-row"><span className="l">Payment ID</span><span className="v mono">{payment.id}</span></div>
                <div className="tech-row"><span className="l">Created</span><span className="v mono">{payment.created_at}</span></div>
                <div className="tech-row"><span className="l">Executed</span><span className="v mono">{payment.executed_at || '—'}</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-foot">Verified independently of CertaPay. This page confirms settlement status and identifiers only — no counterparty compliance or risk information is disclosed.</div>
    </div>
  );
};
