import React, { useEffect, useState } from 'react';
import { paymentApi, policyEngineApi } from '../lib/api';
import { useToast } from './ToastProvider';
import type { PolicyEvaluateResult, PolicyTeam, TeamPolicyResponse } from '../types';

const DEPLOY_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  sent: { label: 'Deployed to n8n', tone: 'st-green' },
  not_configured: { label: 'n8n not configured', tone: 'st-gray' },
  failed: { label: 'Deploy failed', tone: 'st-red' },
};

const ACTION_TONE: Record<string, string> = {
  block: 'st-red',
  enhanced_review: 'st-amber',
  require_dual_approval: 'st-amber',
  allow: 'st-green',
};

export const PolicyEngineSettings: React.FC = () => {
  const { showToast } = useToast();
  const [teams, setTeams] = useState<PolicyTeam[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [policy, setPolicy] = useState<TeamPolicyResponse | null>(null);
  const [yamlDraft, setYamlDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamSlug, setNewTeamSlug] = useState('');

  const [payments, setPayments] = useState<{ id: string; label: string }[]>([]);
  const [evalPaymentId, setEvalPaymentId] = useState('');
  const [evalResult, setEvalResult] = useState<PolicyEvaluateResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);

  const loadTeams = () => {
    policyEngineApi.listTeams().then(({ data }) => {
      setTeams(data);
      if (data.length > 0 && !selectedTeamId) setSelectedTeamId(data[0].id);
    }).catch(() => {});
  };

  useEffect(() => { loadTeams(); }, []);

  useEffect(() => {
    paymentApi.list().then(({ data }) => {
      setPayments((data || []).map((p: any) => ({
        id: String(p.id),
        label: `#${String(p.id).slice(0, 8)} — ${p.sender_company || '?'} → ${p.receiver_company || '?'} ($${Number(p.amount || 0).toLocaleString()} ${p.token || ''})`,
      })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTeamId) return;
    setEvalResult(null);
    policyEngineApi.getPolicy(selectedTeamId).then(({ data }) => {
      setPolicy(data);
      setYamlDraft(data.yaml_text);
      setSaveError(null);
    }).catch(() => {});
  }, [selectedTeamId]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !newTeamSlug.trim()) return;
    try {
      const { data } = await policyEngineApi.createTeam(newTeamName.trim(), newTeamSlug.trim());
      showToast('success', 'Team Created', `${data.name} can now define its own policy`);
      setNewTeamName(''); setNewTeamSlug('');
      loadTeams();
      setSelectedTeamId(data.id);
    } catch (err: any) {
      showToast('error', 'Failed', err?.response?.data?.detail || 'Could not create team');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const { data } = await policyEngineApi.savePolicy(selectedTeamId, yamlDraft);
      setPolicy(data);
      showToast('success', 'Policy Saved', `${data.rule_count} rule(s) validated and saved (v${data.version})`);
    } catch (err: any) {
      setSaveError(err?.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const { data } = await policyEngineApi.deployPolicy(selectedTeamId);
      setPolicy(data);
      if (data.n8n_deploy_status === 'sent') {
        showToast('success', 'Deployed', data.n8n_deploy_detail || 'Policy pushed to n8n');
      } else {
        showToast('warning', 'Deploy Not Sent', data.n8n_deploy_detail || 'See status below');
      }
    } catch (err: any) {
      showToast('error', 'Deploy Failed', err?.response?.data?.detail || 'Could not deploy policy');
    } finally {
      setDeploying(false);
    }
  };

  const handleEvaluate = async () => {
    if (!evalPaymentId) return;
    setEvaluating(true);
    try {
      const { data } = await policyEngineApi.evaluate(selectedTeamId, { paymentId: evalPaymentId });
      setEvalResult(data);
    } catch (err: any) {
      showToast('error', 'Evaluate Failed', err?.response?.data?.detail || 'Could not evaluate');
    } finally {
      setEvaluating(false);
    }
  };

  const deployStatus = policy?.n8n_deploy_status ? DEPLOY_STATUS_LABEL[policy.n8n_deploy_status] : null;

  return (
    <>
      <div className="sctitle">Policy Engine</div>
      <div className="scsub">Each team defines its own compliance rules in YAML. Saving validates the schema; deploying pushes the ruleset live to n8n.</div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="finput" style={{ maxWidth: 260 }} value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className="finput" style={{ maxWidth: 180 }} placeholder="New team name" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
        <input className="finput" style={{ maxWidth: 160 }} placeholder="slug-like-this" value={newTeamSlug} onChange={(e) => setNewTeamSlug(e.target.value.toLowerCase())} />
        <button className="btn" onClick={handleCreateTeam} disabled={!newTeamName.trim() || !newTeamSlug.trim()}>+ Add Team</button>
      </div>

      {selectedTeamId && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, color: 'var(--ink-muted)' }}>
              {policy ? `v${policy.version} · ${policy.rule_count} rule(s)` : 'No policy saved yet'}
            </span>
            {deployStatus && (
              <span className={`status ${deployStatus.tone}`}>
                <span className="d" style={{ background: 'currentColor' }} />{deployStatus.label}
              </span>
            )}
            {policy?.n8n_deploy_detail && (
              <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{policy.n8n_deploy_detail}</span>
            )}
          </div>

          <textarea
            value={yamlDraft}
            onChange={(e) => setYamlDraft(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', minHeight: 320, fontFamily: 'var(--mono, monospace)', fontSize: 12.5,
              padding: 14, borderRadius: 'var(--r-s)', border: '1px solid var(--gray-line)',
              background: 'var(--sheet-2)', color: 'var(--ink)', resize: 'vertical', lineHeight: 1.5,
            }}
          />
          {saveError && <div className="lerror" style={{ marginTop: 8 }}>{saveError}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Validating…' : 'Save Policy'}</button>
            <button className="btn" disabled={deploying || !policy} onClick={handleDeploy}>{deploying ? 'Deploying…' : 'Deploy to n8n'}</button>
          </div>

          <div className="legend" style={{ marginTop: 20 }}>
            <div className="legend-title">Supported rule schema</div>
            <div className="legend-row"><b>when</b>source_country, destination_country, token, purpose, urgency, chain_in — string or list; amount_gt/gte/lt/lte — numeric</div>
            <div className="legend-row"><b>action</b>block, enhanced_review, require_dual_approval, allow</div>
            <div className="legend-row"><b>priority</b>higher evaluates first — first match wins, every rule is still reported</div>
          </div>

          <div className="sctitle" style={{ marginTop: 28, fontSize: 14 }}>Test against a real payment</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <select className="finput" style={{ maxWidth: 420 }} value={evalPaymentId} onChange={(e) => setEvalPaymentId(e.target.value)}>
              <option value="">Select a payment…</option>
              {payments.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <button className="btn btn-primary" disabled={!evalPaymentId || evaluating} onClick={handleEvaluate}>{evaluating ? 'Evaluating…' : 'Evaluate'}</button>
          </div>

          {evalResult && (
            <div className="card">
              <div className="cbody">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span className={`status ${ACTION_TONE[evalResult.action] || 'st-gray'}`}>
                    <span className="d" style={{ background: 'currentColor' }} />{evalResult.action.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
                    {evalResult.matched ? `Matched rule: ${evalResult.matched_rule}` : 'No rule matched — default allow'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {evalResult.evaluated_rules.map((r) => (
                    <div key={r.name} style={{ display: 'flex', gap: 10, fontSize: 12 }}>
                      <span style={{
                        flex: '0 0 auto', width: 16, height: 16, borderRadius: 4, marginTop: 1,
                        background: r.matched ? 'var(--violet)' : 'var(--sheet-2)',
                        color: r.matched ? '#fff' : 'var(--ink-faint)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                      }}>{r.matched ? '✓' : '–'}</span>
                      <div>
                        <span style={{ fontWeight: r.matched ? 600 : 400 }}>{r.name}</span>
                        <span style={{ color: 'var(--ink-faint)' }}> (priority {r.priority}, action: {r.action}) — {r.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};
