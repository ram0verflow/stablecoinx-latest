# 5-Minute Judge Demo Script

## 1. Opening (30s)
Say:  
"Altaria is a compliance-aware stablecoin settlement orchestrator. Every payment passes a 24-layer policy and risk pipeline before on-chain execution."

Open:
1. Frontend dashboard (`http://localhost:5173`)
2. Monitoring API docs (`http://localhost:8000/docs`)

## 2. Show system health and seeded realism (45s)
1. On Dashboard, point to live cards: total payments, approved, blocked, pending, AI latency, transaction success rate.
2. Show health indicators (AI, Base RPC, Polygon RPC, Neo4j, Redis) all green.
3. Mention seeded scenarios: approved, blocked, under review, alternate-chain, split-payment recommendation, and sanctions-driven revalidation.

Say:  
"The seeded data simulates real treasury corridors and outcomes, including sanctions blocks and historical revalidation."

## 3. One-click scenario: clean payment (60s)
1. Click **Run Clean Payment (SG→UAE)**.
2. Narrate animated progress through policy, AI, and proof stages.
3. Open Approval Queue / payment detail to show approved path.

Say:  
"For low-risk compliant payments, the system fast-tracks approval and execution readiness."

## 4. One-click scenario: blocked payment (60s)
1. Click **Run Blocked Payment (USA→Iran)**.
2. Show immediate block reason in UI.
3. Highlight alert trail / monitoring impact.

Say:  
"Hard policy veto overrides AI and blocks prohibited corridors instantly."

## 5. Route analysis deep dive (75s)
1. Open a payment Route Analysis page.
2. Show 500ms engine-by-engine animation.
3. Show AI reasoning typewriter output.
4. Show ZK sequence: generating proof → proof verified.

Say:  
"We preserve explainability for humans while proving compliance artifacts with privacy-preserving cryptography."

## 6. Execution + audit closeout (60s)
1. Trigger approval on a pending eligible payment.
2. Open monitoring/execution status and highlight tx hash + proof registration + audit record.
3. Mention Base Sepolia primary with Polygon fallback resilience.

Say:  
"Execution orchestrator verifies approvals, policy version integrity, authorization, transfer success, proof registry, and immutable audit logging."

## Common Judge Questions (Quick Answers)

**Q: What happens if AI is down?**  
A: Automatic fallback from Ollama to Groq; monitoring reports engine status.

**Q: How do you prevent abuse?**  
A: JWT expiry enforcement, RBAC, per-IP Redis rate limit (10/min), strict amount validation, and no plaintext wallet logging.

**Q: What if infrastructure fails?**  
A: RPC health checks with chain fallback, Neo4j graceful degradation, and alerting for failed settlements/reverts.

**Q: Is this only simulation?**  
A: Demo mode includes realistic seeded records and supports real contract interaction paths on Base Sepolia.

## Fallback Flow if a Service is Down
1. Run `scripts/reset_demo.sh`.
2. If AI local is down, switch to Groq and continue.
3. If Base RPC is degraded, demonstrate Polygon fallback path.
4. Use seeded executed records to show tx/audit/proof evidence even if live execution is unavailable.
