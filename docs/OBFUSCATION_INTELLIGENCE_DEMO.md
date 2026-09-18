# Obfuscation Intelligence — demo guide

Product integration of the standalone `tools/obfuscation_classifier` (see
that folder's own `README.md` and `VALIDATION_NOTES.md` for the classifier
itself). This doc is about the product surface built on top of it: the
`/api/v1/obfuscation/analyze` endpoint, the Risk & Compliance →
**Obfuscation Intelligence** page, and the small demo hook on the Payment
Detail page.

## 1. What the feature does

- Identifies **legacy Whirlpool-style CoinJoin transaction structure** on
  Bitcoin, from public transaction data (Blockstream Esplora, with a
  precomputed-fixture fallback for demo reliability).
- Reports **evidence**, not a verdict: which structural signals passed or
  failed, and their weights.
- Keeps five signals explicitly separate rather than blending them into one
  score: protocol classification, obfuscation confidence, illicit
  attribution, provenance confidence, and policy recommendation.
- Converts the classifier's output into a **deterministic policy
  recommendation** (`ENHANCED_REVIEW`, `NO_OBFUSCATION_ACTION`,
  `INFORMATIONAL_ONLY`, or an external-attribution-driven override) — see
  `backend/app/services/obfuscation/policy.py`.
- Optionally cross-references a **mock external attribution provider**
  (Beeceptor) for a completely separate "is this known-illicit" signal —
  off by default.

## 2. What it does not do

- **Does not unmix funds.** It never attempts to map a mixing round's
  inputs to its outputs.
- **Does not map inputs to outputs.**
- **Does not identify users.** Structure, not identity.
- **Does not imply illicit activity.** Privacy-seeking transaction
  structure is not evidence of a crime.
- **Does not replace commercial blockchain intelligence** (Chainalysis,
  TRM Labs, Elliptic, etc.) — Beeceptor here is an explicit mock, not a
  real provider, and even a real provider's finding is a separate signal,
  never blended into the classifier's own output.

The literal claim built into the classifier's `limits` field, repeated
everywhere in the UI:

> "Privacy is not guilt. Uncertainty is not clearance."

## 3. How to run the CLI

```
python3 tools/obfuscation_classifier/run_demo.py --txid <bitcoin_txid>
python3 tools/obfuscation_classifier/benchmark.py
```

See `tools/obfuscation_classifier/README.md` and `VALIDATION_NOTES.md` for
full detail — this product layer doesn't duplicate that documentation.

## 4. How to call the API

```
POST /api/v1/obfuscation/analyze
Authorization: Bearer <token>   (any authenticated user)
Content-Type: application/json

{"txid": "5553386e94b07112fb7b6789cae2f89f380ca20a28935812c51f0f3387bd5243", "chain": "bitcoin"}
```

Response shape (trimmed):

```json
{
  "txid": "...",
  "classification": "CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN",
  "protocol": "WHIRLPOOL_LEGACY",
  "confidence": 1.0,
  "obfuscation_confidence": "HIGH",
  "provenance_confidence": "NOT_EVALUATED",
  "illicit_attribution": "NOT_EVALUATED",
  "provider_attribution": {"source": "none", "status": "not_configured"},
  "policy_recommendation": "ENHANCED_REVIEW",
  "policy_message": "High obfuscation confidence triggers enhanced review, not automatic blocking. Privacy structure alone is not illicit attribution.",
  "evidence": [...],
  "evidence_against": [],
  "limits": [...],
  "source": "cached_validation_fixture"
}
```

`chain` currently only accepts `"bitcoin"` — anything else returns `400`.
A malformed txid (not 64 hex characters) also returns `400`. A live-fetch
failure (rate limit, timeout, not found) returns `502` with the underlying
reason in `detail` — never a silent/fabricated result.

Two other read-only endpoints:
- `GET /api/v1/obfuscation/demo-txids` — the fixture txids, for one-click
  demo buttons.
- `GET /api/v1/obfuscation/validation-snapshot` — a trimmed summary of
  `tools/obfuscation_classifier/benchmark_report.json`, read fresh on every
  call (re-running `benchmark.py` updates this without a rebuild).

## 5. How to use the UI

1. Log in, go to **Risk & Compliance → Obfuscation Intelligence** in the
   sidebar.
2. Paste a Bitcoin txid, or click one of the **Demo txids** chips.
3. Click **Analyze**.
4. The result panel shows the six separated signals, the policy
   recommendation with its exact explanatory message, the evidence
   list (passed signals with weights, failed signals with reasons), the
   non-claims banner, and — lower down — a live validation snapshot pulled
   from the actual benchmark report.

There's also a small **Compliance & Risk → Obfuscation Intelligence**
section on the Payment Detail page (`/route-analysis/:paymentId`, Trace
view). It analyzes a fixed demo Bitcoin txid, clearly labeled as a
demonstration unrelated to that specific payment's own (EVM) wallet checks
— that payment's real sanctions/wallet-risk/issuer-risk checks are
untouched and shown separately above it.

## 6. Demo txids

All four are real, live-verified, and frozen into
`backend/app/data/obfuscation_demo_fixtures.json` so the demo never depends
on Blockstream's uptime or rate limits:

| txid | Expected result |
|---|---|
| `5553386e94b07112fb7b6789cae2f89f380ca20a28935812c51f0f3387bd5243` | `CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN`, HIGH, `ENHANCED_REVIEW` |
| `dfe57d33a81720a059ceb5e84d546a05e55791b0eafca50574c9ed4c645ee575` | `NOT_WHIRLPOOL` (ordinary payment), `NO_OBFUSCATION_ACTION` |
| `4e624682a5b69dbd1596628eec644c0f4782ba798f2794f7177715395bca7b91` | `NOT_WHIRLPOOL` (batching), `NO_OBFUSCATION_ACTION` |
| `2759143d93dc0bc29170eae07ad97a9c8931b60a7b673de04ac26d9764324a38` | `NOT_WHIRLPOOL` (consolidation), `NO_OBFUSCATION_ACTION` |

Any other well-formed txid falls through to a live Blockstream fetch (may
fail under rate limiting — this is real, honest behavior, not a bug; see
`tools/obfuscation_classifier/VALIDATION_NOTES.md`'s rate-limit section).

## 7. Beeceptor scenarios (external attribution — LIVE)

**Status: live**, not just unit-tested. `backend/.env` and `.env` are
configured with:

```
OBFUSCATION_PROVIDER_MODE=beeceptor
BEECEPTOR_OBFUSCATION_URL=https://certapay.proxy.beeceptor.com
```

Four real rules exist on the live endpoint for `GET /tx-risk/{txid}`
(added via the Rule Management API, same key/process as the earlier
`/compliance/*` rules — see `docs/SPONSOR_INTEGRATIONS.md`), deliberately
keyed to three of the four demo fixture txids so a single demo run can walk
through all four policy outcomes with real, live HTTP calls end to end:

| Demo txid | Structure | Provider response | `policy_recommendation` |
|---|---|---|---|
| `5553386e94...bd5243` (Whirlpool) | `CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN` | clean | `ENHANCED_REVIEW` (structure-driven) |
| `dfe57d33a8...45ee575` (ordinary payment) | `NOT_WHIRLPOOL` | **scam + sanctions flagged** | `BLOCKED_BY_EXTERNAL_ATTRIBUTION` |
| `2759143d93...4324a38` (consolidation) | `NOT_WHIRLPOOL` | HTTP 503 (simulated outage) | `MANUAL_REVIEW_PROVIDER_UNAVAILABLE` |
| `4e624682a5...395bca7b91` (batching) | `NOT_WHIRLPOOL` | clean (catch-all rule) | `NO_OBFUSCATION_ACTION` |

The second row is the important one to actually say out loud in a demo:
**the ordinary-looking payment is what gets externally blocked, not the
Whirlpool one** — live proof that structure and attribution are genuinely
independent signals here, not two names for the same score. Verified via
real `POST /api/v1/obfuscation/analyze` calls against the real backend
against the real Beeceptor endpoint, not inferred.

Contract the endpoint implements — `GET {BEECEPTOR_OBFUSCATION_URL}/tx-risk/{txid}`:

```json
{
  "known_illicit_attribution": false,
  "known_scam_exposure": false,
  "known_sanctions_exposure": false,
  "risk_score": 12,
  "freshness_seconds": 34,
  "provider_status": "live_mock"
}
```

Policy effect (`backend/app/services/obfuscation/policy.py::apply_provider_override`):
- `known_scam_exposure` or `known_sanctions_exposure` → `policy_recommendation` becomes
  `BLOCKED_BY_EXTERNAL_ATTRIBUTION`, overriding whatever the classifier alone recommended.
- Provider unreachable/timeout/non-2xx → `provider_attribution.status = "degraded"` and
  `policy_recommendation` becomes `MANUAL_REVIEW_PROVIDER_UNAVAILABLE` — same fail-safe
  posture as the rest of this codebase's provider integrations (an outage routes to
  review, never a silent pass).
- Clean provider response → the classifier-based recommendation stands unchanged.

Before going live, the policy-override logic itself was also unit-verified
against a throwaway local stub server exercising all three scenarios (clean,
scam/sanctions hit, unreachable) — that was the code-correctness check;
the table above is the live, real-endpoint confirmation.

**Note on the Rule Management API key (fourth use across this project):**
pasted into chat by the user again for this feature, used only transiently
via `curl`/inline Python to create the 4 rules above, never written to any
file — verified with a repo-wide grep after use, same discipline as every
prior round. Not saved anywhere.

## 8. Judge-safe pitch

> "StableCoinX does not try to unmix funds. It performs protocol-aware
> privacy-transaction classification, separates obfuscation from illicit
> attribution, and routes ambiguous provenance to policy-controlled
> review."

## 9. Known limitations

- **The classifier only targets the legacy 5-input/5-output Whirlpool
  shape.** A real-dataset sample found this covers only ~10% of real
  Whirlpool activity (most real rounds are 6–8 participants) — see
  `tools/obfuscation_classifier/VALIDATION_NOTES.md`'s round-size finding.
  This product layer inherits that limitation unchanged; it does not widen
  the rule.
- **Small curated benchmark sample** (23 real cases, `SMALL_SAMPLE_WARNING`
  triggers below 10 runnable) — see `benchmark_report.md`.
- **Live fetches are rate-limit-prone under sustained use** — Blockstream
  throttled this project's own testing repeatedly during development. The
  four fixture txids above are immune to this; any other txid is not.
- **The 4 Beeceptor `tx-risk` scenarios are demo-fixture-keyed, not a
  general real attribution feed** — any txid outside the 4 demo txids gets
  the clean catch-all response (`risk_score: 4`), not a real risk
  assessment. This is explicitly a mock, per the task's own instruction
  ("Beeceptor is not the classifier and not ground truth") — swapping in a
  real provider (Chainalysis/TRM/etc.) means changing `BEECEPTOR_OBFUSCATION_URL`
  and the response mapping in `provider_attribution.py`, not the policy logic.
- **No lineage-aware detection** (checking whether an input traces back to
  a prior identified CoinJoin) — explicitly out of scope for this phase,
  flagged as a Phase 3 TODO in the classifier's own `rules.py`/README.
- **No PayJoin-specific detection.**
- Bitcoin only — the `chain` field exists for future extension but only
  `"bitcoin"` is accepted today.
