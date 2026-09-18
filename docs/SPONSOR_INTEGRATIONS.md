# Sponsor integrations

Tracks the plan doc's sponsor integration priority order (Beeceptor → n8n →
Render → Trace Commons → .xyz → CodeCrafters). Status as of 2026-09-18:

| Sponsor | Status |
|---|---|
| Beeceptor | **Live** — see below |
| n8n | **Live (local)** — see below |
| Render | **Infra-as-code done** — see below (not deployed live) |
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

### Round 3 — extensive mock data + traffic (2026-09-18)

Goal: make the live Beeceptor endpoint look and behave like a genuinely
populated production mock server rather than a handful of demo rules.

**What was actually used, precisely:** Beeceptor's real Rule Management API
(the same one from rounds 1–2) to create 43 new rules, plus real HTTP traffic
against the live proxy endpoint. **Not used:** Beeceptor's "Intelligent
mocking (AI-generated)" feature — that's real, but it's an OpenAPI-spec
upload processed through the Beeceptor *dashboard UI* (paid-plan gated),
not something callable via the Rule Management API. There is no
"generate mock data" API endpoint in Beeceptor's v2 API — confirmed against
their published OpenAPI spec before building anything on that assumption.
If genuine AI-generated intelligent mocking is wanted later, it requires a
human to upload a spec through the dashboard and enable it there.

What was done, both programmatically via `curl` against the real API:
- **43 new rules added** to `/compliance/screen` and `/compliance/wallet-risk`
  covering 10 more sanctioned entities, 5 internal-blacklist entries, 6
  KYC missing/expired entities (including a new `"expired"` `kyc_status`
  value the original 7 rules didn't exercise), 10 clean/verified legitimate
  companies, 4 more sanctioned wallet addresses, and 8 wallet-risk tiers
  spanning low → critical with `mixer_adjacent`/`laundering_cluster` flags.
  Endpoint went from 11 rules to **54 total**.
- Rules were reordered (`POST /rules/reorder`) so both path catch-alls stay
  last — verified the new rules resolve correctly and the original 7
  verified demo rules (Tehran Trade Co, etc.) still work unchanged, no
  regressions.
- **165 real requests fired** at the live endpoint with realistic, randomized
  sender/receiver/wallet combinations (mostly clean, some sanctioned/
  blacklisted/KYC-issue, mixed risk-tier wallets) — all returned `200`, all
  visible in Beeceptor's own request history (`GET /v2/endpoints/{endpoint}/
  requests`), confirmed via a live query afterward, not just inferred from
  the sender-side script exiting cleanly.

**Note on the Rule Management API key (third use):** pasted into chat by the
user again for this round, used only transiently via `curl`/inline Python,
never written to any file — verified with a repo-wide grep after use, same
as rounds 1–2. Not saved anywhere; get a fresh key from the user if rules
need to be managed programmatically again.

### Round 4 — Obfuscation Intelligence external attribution (2026-09-19)

Added 4 rules for a new path, `GET /tx-risk/{txid}` — the mock external
attribution provider behind the **Obfuscation Intelligence** product
feature (see `docs/OBFUSCATION_INTELLIGENCE_DEMO.md` §7 for the full demo
matrix and `backend/app/services/obfuscation/provider_attribution.py` for
the client). This is a different concept from the compliance provider
above: `/compliance/*` screens a *payment's* sender/receiver/wallets;
`/tx-risk/{txid}` mocks an attribution lookup on a specific *Bitcoin txid*,
deliberately separate from — never blended into — the Whirlpool structural
classifier's own output.

3 rules keyed to specific demo fixture txids (clean / flagged scam+sanctions
/ simulated 503 outage) plus 1 catch-all (clean, `risk_score: 4`), ordered
specific-before-catch-all as usual. Endpoint now has **58 total rules** (up
from 54).

**Note on the Rule Management API key (fourth use):** pasted into chat by
the user again for this feature, used only transiently, never written to
any file — verified with a repo-wide grep after use, same discipline as
rounds 1–3.

## n8n — operations event automation

A local n8n instance (2026-09-18) automates the email side of the three
payment-lifecycle alerts the backend already tracked (`payment_blocked`,
`review_needed`, `settlement_executed`) — previously these only went to a
(misconfigured, pre-existing) Telegram bot; now they also fire a real n8n
webhook that routes each event to an email, with subject/recipient/body
built from the event data.

### Running it

```
mkdir -p .n8n-local && export N8N_USER_FOLDER="$(pwd)/.n8n-local"
npx n8n start
```

Data lives entirely in `.n8n-local/` (gitignored — never commit it; it holds
the local SQLite DB and the SMTP credential). Editor at
`http://localhost:5678`. The owner account was created headlessly (no
email/password set) purely so the CLI (`import:credentials`,
`import:workflow`, `publish:workflow`) has a `userId` to own the workflow —
there's no login-gated UI flow needed to run or extend this.

### The workflow — "CertaPay Operations Alerts"

`Webhook (POST /webhook/certapay-events)` → `Code (builds subject/to/html
per event type)` → `Send Email (SMTP)` → `Respond to Webhook`. Seed
definitions are in `.n8n-local/seed/{workflow,credentials}.json` (gitignored
— the credentials file holds a live SMTP password, see below).

Event contract (`POST http://localhost:5678/webhook/certapay-events`):

```json
{
  "event": "payment.blocked" | "manual_review_required" | "settlement.executed",
  "payment_id": "...", "sender_company": "...", "receiver_company": "...",
  "amount": 9000, "currency": "USDC", "corridor": "Singapore -> UAE",
  "reason": "...", "timestamp": "2026-09-18T13:45:06Z"
}
```

Routing inside the workflow: `payment.blocked` → compliance@certapay.com,
`manual_review_required` → reviewers@certapay.com, `settlement.executed` →
treasury@certapay.com.

### Backend wiring

`backend/app/services/notifications/n8n_service.py` — a plain `send_event()`
function, called from `AlertService.send_payment_alert()` (same call site as
the existing Telegram notification, `alert_service.py`) right after the
Telegram send. Controlled by `N8N_WEBHOOK_URL` (empty by default = no-op,
same fail-safe-by-default pattern as `BEECEPTOR_BASE_URL`). Any failure
(n8n down, timeout, non-2xx) is logged and swallowed — a notification outage
must never affect the payment pipeline, same posture as everything else in
this notification stack.

### Email delivery — Ethereal (throwaway test SMTP), not real inboxes

The SMTP credential is a disposable [Ethereal](https://ethereal.email)
test account (auto-generated via `https://api.nodemailer.com/user`, no
signup) — real SMTP protocol, real delivery *to a fake mailbox*, not
anyone's actual inbox. This was an explicit choice to avoid needing the
user's real email credentials for a demo. **What this does and doesn't
prove:** it proves the full chain — backend event → real webhook → real n8n
workflow execution → real SMTP handshake → message landed and fetchable —
actually works, using a real (if disposable) mail server. It does not prove
delivery to a real recipient inbox; swapping in real SMTP/SendGrid/Gmail
credentials in `.n8n-local/seed/credentials.json` (re-import via
`import:credentials`) is a credentials change, not an architecture change.

Also checked and *not* used: Beeceptor's own "Intelligent mocking" AI
feature is dashboard-upload-only and unrelated to n8n; there is no
API-driven "generate mock data" capability anywhere in this stack — see the
Round 3 section above for why that distinction mattered here.

### Verified end-to-end (2026-09-18)

Created a real payment via `POST /api/v1/payments/create` against the real
backend (not a unit test) with `receiver_company: "Tehran Trade Co"` →
pipeline ran → payment `status: blocked` → `AlertService.send_payment_alert`
fired twice (`payment_blocked`, `review_needed`) → both reached the n8n
webhook → both emails confirmed **landed** via a live IMAP fetch against the
Ethereal mailbox (not inferred from a 200 response):

```
Payment Blocked - bea8fadd-a10b-4874-9fa3-8db24267062e | compliance@certapay.com
Manual Review Required - bea8fadd-a10b-4874-9fa3-8db24267062e | reviewers@certapay.com
```

Full backend suite still 42 passed / 6 failed — same pre-existing baseline,
no regression from this change.

### Known limitation

Dual-approval *orchestration* (n8n driving the actual approve/reject
workflow, not just notifying about it) was in the original plan doc's scope
for n8n but is **not built** — this integration covers the operations-alert
half only. The approval flow itself is still entirely the existing
`ApprovalQueue`/`policy_veto_service.py` path in the app.

## Render — infra as code

`render.yaml` at the repo root (Blueprint spec, validated as well-formed
YAML but **never deployed against a live Render account** — no account was
connected for this project). Defines:

- `certapay-backend` — Python web service (`uvicorn app.main:app`),
  `rootDir: backend`, health check `/api/v1/health`.
- `certapay-frontend` — static site (`npm ci && npm run build`,
  `./dist`), `rootDir: frontend`, with a SPA catch-all rewrite so client-side
  routes (e.g. `/obfuscation-intelligence`) survive a hard refresh.
- `certapay-db` — managed Postgres (free plan), wired to the backend via
  `fromDatabase`.
- `certapay-redis` — managed Key Value (Redis-compatible), wired via
  `fromService`. Optional — the backend already degrades gracefully without
  Redis (`"Redis unavailable ... Caching disabled"`, observed repeatedly
  during this project's own local development).

Every one of `Settings.validate_config()`'s required env vars (see
`backend/app/core/config.py`) is present with either a safe literal default
(public RPC URLs, `contracts/out`, etc.) or an explicit `sync: false`
placeholder for real secrets (Supabase keys, Groq API key, the backend
wallet private key, the four deployed contract addresses, Neo4j password,
WalletConnect project ID) — those need to be filled in via the Render
dashboard after the first deploy; the blueprint deliberately does not (and
cannot safely) supply them. `COMPLIANCE_PROVIDER`/`OBFUSCATION_PROVIDER_MODE`
default to `beeceptor`, pointed at the real, already-live
`https://certapay.proxy.beeceptor.com` endpoint — that's a public mock-server
URL, not a secret, so a fresh deploy gets a working compliance/attribution
demo without any extra setup.

Neo4j has no native Render service — wallet-graph intelligence needs an
external instance (e.g. a free Neo4j Aura tier); the app degrades
gracefully without one, same fail-safe pattern as everywhere else in this
codebase.

**To actually deploy:** connect a Render account, use "New Blueprint",
point it at this repo, then fill in the `sync: false` values in the
dashboard. Nobody has done this yet — it's untested beyond YAML validity.

## Not yet started

- **Trace Commons** — requires capturing real agent work sessions and
  submitting them through their own tooling; not a code change.
- **.xyz** — DNS/domain wiring once a domain is available; no code dependency.
- **CodeCrafters** — explicitly lowest priority in the plan doc; dev-only
  test-infrastructure value, kept out of the production trust path.
