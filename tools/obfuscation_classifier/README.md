# Protocol-Aware Obfuscation Classifier

**Status: Phase 3 — general-purpose across multiple real CoinJoin protocols.
Standalone tool; product integration lives in `backend/app/services/obfuscation/`
and the CertaPay frontend (see `docs/OBFUSCATION_INTELLIGENCE_DEMO.md`), but
this tool itself remains self-contained and independently runnable.**

## Purpose

Identify specific transaction-privacy protocol patterns on Bitcoin —
currently legacy Samourai Whirlpool CoinJoin and Wasabi 2.0/WabiSabi
CoinJoin, each independently validated against real mainnet data, plus a
protocol-agnostic fallback for other equal-output CoinJoin-like activity.

**Identification is not unmixing. Obfuscation is not illicit attribution.**

## This tool DOES

- Classify Bitcoin transaction *structure* against **three** independently-
  scored rules, evaluated on every transaction and reported together (see
  "The rules" below) — not just one protocol.
- Explain every classification with explicit, itemized evidence (and
  evidence against, for non-matches) — and expose what *every* rule scored
  via `checked_protocols`, not just the winning one, so a reviewer can see
  the full picture rather than being told to trust the top pick.
- Keep obfuscation confidence completely separate from illicit attribution —
  this classifier does not compute illicit attribution at all (see "Separate
  signals" below).
- Support auditability: every score component is a fixed, documented weight,
  not a hidden or learned one.

## This tool DOES NOT

- Unmix funds.
- Deanonymize users.
- Map inputs to outputs.
- Label privacy as criminal.
- Replace Chainalysis, TRM Labs, Elliptic, or any commercial blockchain
  intelligence provider.
- Make final payment decisions alone.

## The five signals this classifier is designed around

A protocol-aware obfuscation classifier needs to keep these five things
separate, because collapsing them into one score is how compliance tooling
ends up making indefensible claims:

1. **Protocol classification** — *which* privacy protocol (if any) this
   transaction's structure matches.
2. **Obfuscation confidence** — how confident the structural match is.
3. **Illicit attribution** — whether the *counterparty* is sanctioned/illicit
   (a completely different question, answered by different data sources).
4. **Provenance confidence** — how confident we are about *where the funds
   came from before* this transaction.
5. **Final policy recommendation** — what the payment pipeline should
   actually do about it.

**Phase 1 implements only #1 and #2.** Signals #3 and #4 are explicitly
reported as `"NOT_EVALUATED"` in every result (`separate_signals` field) —
not `false`, not `"clean"`, not omitted. `NOT_EVALUATED` means exactly that:
no attempt was made to compute them in this phase, and any caller must not
infer illicit/clean status from their absence. There is no #5 here at all —
this tool never emits a policy decision, only a `policy_note` reminder that
a human/pipeline decision is a separate step.

## Usage

```
python tools/obfuscation_classifier/run_demo.py --txid <bitcoin_txid>
```

No install step — this package is stdlib-only (Python 3.8+): no Pydantic,
no httpx/requests, nothing to `pip install`.

### Example

```
python tools/obfuscation_classifier/run_demo.py \
  --txid 0000000000000000000000000000000000000000000000000000000000000
```

(That's a placeholder txid and will correctly return a
`{"error": true, ...}` payload — see "What still needs real txids" below for
where to get a real one.)

## Data source

[Blockstream Esplora](https://blockstream.info/api/tx/{txid}) first, falling
back to [mempool.space](https://mempool.space/api/tx/{txid}) (same response
shape) only on a connectivity/availability failure — a genuine "not found"
or malformed-txid error is not retried against the fallback.

## The rules

`classify_transaction()` (in `rules.py`) runs all three rules below on
every transaction, most-specific first, and reports whichever produces the
strongest match as the primary result — but every rule's own score is
still returned in `checked_protocols`, so nothing is hidden even when a
lower-priority rule also fired.

### 1. Legacy Samourai Whirlpool

Four independently-weighted structural signals, summing to a 0–100 score:

| Signal | Weight |
|---|---|
| Input count in the 5-8 round-size range | 25 |
| Output count in the 5-8 round-size range | 25 |
| All outputs have equal value | 30 |
| Equal output value matches a known Whirlpool pool denomination | 20 |

The round-size range was **widened from Phase 1/2's "exactly 5" to 5-8**
after real curated-dataset validation found 8-participant rounds are
actually the *most common* real Whirlpool shape (63.8% of a 160-transaction
sample), with exactly-5 only 10.6% — seeVALIDATION_NOTES.md for the full
finding. The original exactly-5 rule structurally missed most real
Whirlpool activity; this widening is a direct, disclosed fix, re-validated
against real txids at sizes 5, 6, 7, and 8 (all four independently
confirmed — see `test_cases.json`).

**TODO — verify before any public claim:** the configured pool denominations
(`rules.py::WHIRLPOOL_POOL_DENOMS_SATS` — 0.001 / 0.01 / 0.05 / 0.5 BTC) are
the commonly-documented legacy Whirlpool pool sizes, but have **not** been
re-verified against Samourai/Whirlpool's own final documentation.

### 2. Wasabi 2.0 / WabiSabi

WabiSabi doesn't use one fixed per-round denomination like Whirlpool —
instead real rounds produce **multiple simultaneous equal-value output
clusters**. Four independently-weighted signals:

| Signal | Weight |
|---|---|
| Output count ≥ 20 | 25 |
| ≥ 3 distinct equal-value output clusters | 25 |
| Largest cluster ≥ 5 outputs | 25 |
| ≥ 2 clusters at a "round" denomination (power of 2, power of 3, or a clean decimal multiple) | 25 |

Validated against 8 real txids independently sampled from the crocs-muni/
coinjoin-analysis dataset's Wasabi 2.0 coordinator-attributed txid list —
all 8 scored 100/100 (see `test_cases.json`, category `positive_wabisabi`).

**TODO — verify before any public claim:** the power-of-2/power-of-3
denomination-ladder pattern is this project's own inference from observing
the 8 real samples, not independently verified against WabiSabi's official
specification. The structural signals (output count, cluster count, cluster
size) are the primary evidence; the denomination-ladder signal is
corroborating, not load-bearing on its own (it's only 25 of 100 points).

### 3. Generic equal-output CoinJoin (protocol-agnostic fallback)

For transactions with a meaningful equal-value output cluster that doesn't
match either specific protocol's parameters — e.g. JoinMarket-style
CoinJoins, or CoinJoin implementations this project hasn't specifically
modeled. Deliberately **capped at `COINJOIN_LIKE`, never a specific
protocol name or `CONFIRMED`/`LIKELY`** — this rule exists to surface real
signal without overclaiming protocol identity.

| Signal | Weight |
|---|---|
| Largest equal-value output cluster ≥ 3 | 40 |
| That cluster is ≥ 30% of all outputs | 30 |
| Multi-party shape (≥2 inputs, ≥3 outputs) | 30 |

### Classification tiers (shared score-to-label mapping)

| Score | Classification | Obfuscation confidence |
|---|---|---|
| 90–100 | `CONFIRMED_<PROTOCOL>_COINJOIN` | `HIGH` |
| 70–89 | `LIKELY_<PROTOCOL>_COINJOIN` | `MEDIUM` |
| 40–69 | `COINJOIN_LIKE` | `LOW` |
| 0–39 | `NOT_COINJOIN` | `NONE` |

`confidence` is simply `score / 100`. `protocol` is `WHIRLPOOL_LEGACY`,
`WABISABI_LIKE`, `GENERIC_EQUAL_OUTPUT_COINJOIN`, or `UNKNOWN`.

## Negative classification hints

For non-CoinJoin transactions, a `classification_hint` gives a plain
structural label — never an illicit/mixer claim:

| Condition | Hint |
|---|---|
| 1 input, ≤2 outputs | `ORDINARY_PAYMENT_LIKE` |
| ≥20 outputs, not all equal | `BATCHING_LIKE` |
| ≥10 inputs, ≤3 outputs | `CONSOLIDATION_LIKE` |
| >1 input, >1 output, no other hint matched | `GENERIC_MULTI_PARTY_OR_BATCH_TRANSACTION` |

**PayJoin caveat** (included in every result's `limits` list): some
collaborative transactions such as PayJoin can break ownership heuristics
and should not be treated as illicit or mixer activity without additional
evidence. This classifier does not attempt to detect PayJoin — a PayJoin
transaction will most likely just fall out as `NOT_COINJOIN` /
`GENERIC_MULTI_PARTY_OR_BATCH_TRANSACTION`, which is the correct (non-)claim
to make about it right now.

## Test cases and benchmark

`test_cases.json` holds 35 real, sourced entries (no fabricated txids): 2
seed Whirlpool positives from the original task spec, 19 more Whirlpool
positives independently curated from a real academic mainnet dataset
([crocs-muni/coinjoin-analysis](https://github.com/crocs-muni/coinjoin-analysis)) —
covering round sizes 5, 6, 7, and 8 — 8 real Wasabi 2.0/WabiSabi positives
from the same dataset, 3 real negatives (ordinary payment / batching /
consolidation) sampled from recent mainnet blocks, and 2 honest `TODO`
placeholders (`hard_negative`, `payjoin_caveat`) where no defensible real
example has been curated yet — see `VALIDATION_NOTES.md` for exactly why.
Current benchmark: **33/33 runnable cases correct, precision 1.0, recall
1.0** (see `benchmark_report.md`).

Run the curation helper (fetches + summarizes every non-`TODO` case):

```
python tools/obfuscation_classifier/curate_cases.py
python tools/obfuscation_classifier/curate_cases.py --write-enriched
python tools/obfuscation_classifier/curate_cases.py --suggest-negatives
```

Run the benchmark (writes `benchmark_report.json` and `benchmark_report.md`):

```
python tools/obfuscation_classifier/benchmark.py
```

**Full validation context, the honest round-size finding, and every known
limitation are in [`VALIDATION_NOTES.md`](VALIDATION_NOTES.md) — read that
before quoting any number from this phase.**

## Next steps

1. ~~Curate verified Whirlpool txids.~~ Done — 21 real positives across
   round sizes 5-8.
2. ~~Curate hard negatives.~~ Partially done — ordinary/batching/
   consolidation done; coincidental-5x5 and PayJoin still `TODO`.
3. Verify pool denominations (Whirlpool) and the denomination-ladder
   heuristic (WabiSabi) against primary documentation (still open).
4. ~~Add a benchmark report.~~ Done — see `benchmark_report.{json,md}`.
5. ~~Widen the round-size rule~~ (5/6/7/8-input-output, not just 5x5). Done —
   directly fixed the disclosed recall gap; see `VALIDATION_NOTES.md`.
6. ~~Generalize beyond Whirlpool-only.~~ Done — added Wasabi 2.0/WabiSabi
   (real-dataset-validated) and a protocol-agnostic generic fallback.
7. Implement lineage-aware recursive detection (checking whether an input
   traces back to a prior identified CoinJoin) — not yet attempted.
8. Add a Beeceptor external-attribution mock — **done** at the product
   layer (`backend/app/services/obfuscation/provider_attribution.py`,
   live against real Beeceptor rules); this standalone tool itself still
   deliberately has no illicit-attribution signal (see "Separate signals").
9. Integrate into StableCoinX/CertaPay's product UI — **done**, see
   `docs/OBFUSCATION_INTELLIGENCE_DEMO.md`.

## Files

| File | Purpose |
|---|---|
| `schemas.py` | Normalized transaction/result data model (stdlib dataclasses) |
| `fetchers.py` | Blockstream/mempool.space HTTP fetch + error handling |
| `features.py` | Deterministic feature extraction |
| `rules.py` | The three scored rules (Whirlpool, WabiSabi, generic) + negative hints |
| `classifier.py` | `analyze_txid(txid)` — the one function callers should use |
| `run_demo.py` | CLI entry point |
| `test_cases.json` | Curated fixture list (35 entries, 33 real + 2 `TODO`) |
| `test_cases.enriched.json` | Generated by `curate_cases.py --write-enriched` (not hand-authored) |
| `curate_cases.py` | Fetch/summarize test cases; suggest real negative candidates from recent blocks |
| `benchmark.py` | Runs `test_cases.json` through the classifier, scores it, writes the reports below |
| `benchmark_report.json` / `.md` | Generated by `benchmark.py` — reproducible, not hand-authored |
| `VALIDATION_NOTES.md` | Claim, non-claims, data sources, the round-size finding, and every known limitation |
