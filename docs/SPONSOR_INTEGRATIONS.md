# Sponsor integrations

Tracks the plan doc's sponsor integration priority order (Beeceptor → n8n →
Render → Trace Commons → .xyz → CodeCrafters). Status as of 2026-09-18:

| Sponsor | Status |
|---|---|
| Beeceptor | **Live** — see below |
| n8n | Not started |
| Render | Not started |
| Trace Commons | Not started |
| .xyz | Not started |
| CodeCrafters | Not started (lowest priority; only if bandwidth allows) |

## Beeceptor — compliance provider

The backend's KYC/sanctions screening now runs through a `ComplianceProvider`
abstraction (`backend/app/services/compliance/`):

- `compliance_engine.py` — dispatches on `COMPLIANCE_PROVIDER` (`local` |
  `beeceptor`). `local` is the original deterministic fixture logic, kept
  byte-for-byte so existing tests still exercise it via monkeypatch.
- `beeceptor_provider.py` — calls the configured Beeceptor mock and normalizes
  its response. **Any failure (timeout, non-2xx, malformed JSON) returns
  `provider_status: "degraded"` — never a silent pass.**
- `policy_veto_service.py` forces `pending_review` whenever
  `compliance.provider_status == "degraded"`, so a Beeceptor outage routes to
  manual review instead of quietly approving — this is the fail-safe behavior
  the plan doc calls for ("provider outage is UNKNOWN/DEGRADED, never clean").

Wallet risk also goes through Beeceptor when `COMPLIANCE_PROVIDER=beeceptor`
(`wallet_graph_service.analyze_wallet()` dispatches the same way). Local
Neo4j-backed wallet risk was fixed at the same time: an unreachable Neo4j
used to silently return `overall_risk: "low"` (a real fail-open bug the plan
doc calls out) — it now returns `medium` + `neo4j_degraded: true` regardless
of which provider is active.

### The contract

```
POST {BEECEPTOR_BASE_URL}/compliance/screen
Request:  {"sender_company", "receiver_company", "sender_wallet", "receiver_wallet"}
Response: {"kyc_status": "verified"|"missing"|"expired", "sanctions_hit": bool,
           "internal_blacklist_hit": bool, "matched_entity": string|null}

POST {BEECEPTOR_BASE_URL}/compliance/wallet-risk
Request:  {"identifier"}
Response: {"risk_score": float, "overall_risk": "low"|"medium"|"high"|"critical",
           "mixer_adjacent": bool, "laundering_cluster": bool}
```

### Live mock server

Endpoint: `https://certapay.proxy.beeceptor.com`. Rules configured via
Beeceptor's Rule Management API (`POST /v2/endpoints/{endpoint}/rules`),
evaluated in this order (first match wins per path):

**`/compliance/screen`:**
1. *(pre-existing, not created by this work — has a bug: leading-space path
   `" /compliance/screen"` means it never actually matches, and its response
   body is truncated/malformed JSON. Left alone since it wasn't ours to
   delete; consider cleaning it up in the dashboard.)*
2. Sanctions hit — body contains `"Tehran Trade Co"`
3. Sanctions hit — body contains `"Iran Counterparty"`
4. Internal blacklist hit — body contains `"Blacklisted Test Co"`
5. KYC missing — body contains `"Unverified"`
6. Failure injection (HTTP 503, 2s delay) — body contains `"Beeceptor Outage Test"`
7. Sanctions hit — body contains wallet `"0xdead111111111111111111111111111111111111"`
   (mirrors an entry in the local `SANCTIONED_WALLETS` fixture list)
8. **Stateful** — body contains `"Beta Traders"` AND state `entity_beta_traders`
   equals `"sanctioned"` → sanctions hit. State currently set to `"clear"`
   (the default/normal state). Flip it to demo historical revalidation
   catching a real, previously-clean seeded counterparty:
   ```
   PUT https://api.beeceptor.com/api/v2/endpoints/certapay/state
   Authorization: <rule-management API key>
   {"items": [{"type": "string", "key": "entity_beta_traders", "value": "sanctioned"}]}
   ```
   then trigger a revalidation scan — any historical "Beta Traders" payment
   (several exist in the seeded demo data) should flip to flagged. Flip the
   value back to `"clear"` afterward so the environment isn't left in a
   surprising state.
9. Default — clean pass (catch-all, evaluated last)

**`/compliance/wallet-risk`:**
1. High risk — body contains `"0xba00000000000000000000000000000000000001"`
   (mirrors another local `SANCTIONED_WALLETS` entry) → `risk_score: 0.85`,
   `overall_risk: "high"`, `mixer_adjacent: true`
2. Default — clean, low risk (catch-all, evaluated last)

Rules 2–3 above intentionally reuse two of the seeded demo dataset's
counterparty names (`Tehran Trade Co`, `Iran Counterparty`) so the existing
sanctions-block demo scenario still blocks correctly under the live
provider. Rule 6 is a dedicated demo beat for Beeceptor's failure/latency
-injection capability — create a payment with `"Beeceptor Outage Test"` as
the sender or receiver company to see it fail safe to manual review live.

**Note on the Rule Management API key:** it was pasted into chat by the user
during this work, used directly via `curl` to create/reorder rules and set
state, and was never written to any file — verified with a repo-wide grep
before moving on each time. It is not saved anywhere; if rules need to be
managed programmatically again, get a fresh key from the user or use the
Beeceptor dashboard directly.

### Local `.env`

```
COMPLIANCE_PROVIDER=beeceptor
BEECEPTOR_BASE_URL=https://certapay.proxy.beeceptor.com
BEECEPTOR_TIMEOUT_SECONDS=5
```

Unset `COMPLIANCE_PROVIDER` (or set it to `local`) to fall back to the
built-in deterministic fixtures with no network dependency.

### Verified end-to-end (2026-09-18)

Ran real payments through the live backend against the live Beeceptor
endpoint (not mocked in tests):
- Clean counterparty → compliance clears, `provider_status: live`
- `Tehran Trade Co` counterparty → `sanctions_hit: true`, payment blocked
- `Beeceptor Outage Test` sender (rule 5, HTTP 503) → `provider_status:
  degraded`, payment routed to `pending_review` — confirmed the fail-safe
  path actually fires against a real HTTP failure, not just a unit-mocked one

- High-risk test wallet (`0xba0...0001`) as sender wallet on a real payment
  → wallet risk `overall_risk: "high"`, `provider_status: "live"`, payment
  routed to `pending_review` by the existing wallet-risk veto rule
  (`risk_score > 0.8`) — confirmed inside the real pipeline, not standalone
- Stateful "Beta Traders" flip: verified `sanctions_hit` flips from `false`
  to `true` on the live endpoint after a state PUT, then reset to `false`

The frontend's Integrations and Risk & Compliance pages now read real
provider status from `GET /api/v1/monitoring/stats` → `compliance_provider:
{name, configured}` and `wallet_intelligence: {provider, status}` instead of
a hardcoded "not connected" placeholder or a raw Neo4j ping that would've
gone stale the moment Beeceptor became the active wallet-risk source.

### Tests

`backend/tests/test_beeceptor_provider.py` (13 tests: the original 7 for
`/compliance/screen` plus 5 more for `check_wallet_risk` — unconfigured,
live clean, live high-risk, timeout, invalid `overall_risk` value — all via
`monkeypatch` on `httpx.post`, no real network calls), plus tests added to
`test_compliance_engine.py`, `test_policy_veto.py`, and
`test_wallet_graph.py` covering the dispatchers and fail-safe paths.

Fixing the wallet-risk Beeceptor dispatch also exposed and fixed a latent
test-seam bug: `analyze_wallet()` checked `self.driver` directly while the
tests monkeypatched the module-level `get_neo4j_driver()` function — two
different things, so the tests' mocks were silently never actually being
exercised. Switched `analyze_wallet()` to call `get_neo4j_driver()` (matching
the pattern already used in `compliance_engine.py`), which made 3 previously
-failing tests start actually testing what they claim to test — and now
pass. Full suite: **42 passed, 6 failed** (down from 9; the remaining 6 are
pre-existing failures documented in `docs/HACKATHON_BASELINE.md`, unrelated
to this work).

## Not yet started

- **n8n** — next up per plan doc priority: dual-approval orchestration +
  operations event automation (`payment.blocked` / `settlement.executed` /
  `manual_review_required` webhooks).
- **Render** — infra-as-code only (a `render.yaml` blueprint); nothing to run
  live without a connected Render account.
- **Trace Commons** — requires capturing real agent work sessions and
  submitting them through their own tooling; not a code change.
- **.xyz** — DNS/domain wiring once a domain is available; no code dependency.
- **CodeCrafters** — explicitly lowest priority in the plan doc; dev-only
  test-infrastructure value, kept out of the production trust path.
