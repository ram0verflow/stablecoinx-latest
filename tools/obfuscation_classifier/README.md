# Protocol-Aware Obfuscation Classifier

**Status: Phase 1 standalone proof-of-concept. Not integrated into CertaPay's
payment pipeline, backend, frontend, or smart contracts.**

## Purpose

Identify specific transaction-privacy protocol patterns, starting with
legacy Whirlpool-style CoinJoin.

**Identification is not unmixing. Obfuscation is not illicit attribution.**

## This tool DOES

- Classify Bitcoin transaction *structure* (input/output counts, output
  equality, output denomination) against the legacy Whirlpool CoinJoin
  pattern.
- Explain every classification with explicit, itemized evidence (and
  evidence against, for non-matches).
- Keep obfuscation confidence completely separate from illicit attribution —
  this phase does not compute illicit attribution at all (see "Separate
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

## The Whirlpool legacy rule

Four independently-weighted structural signals, summing to a 0–100 score:

| Signal | Weight |
|---|---|
| Exactly 5 inputs | 25 |
| Exactly 5 outputs | 25 |
| All outputs have equal value | 30 |
| Equal output value matches a known Whirlpool pool denomination | 20 |

| Score | Classification | Protocol | Obfuscation confidence |
|---|---|---|---|
| 90–100 | `CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN` | `WHIRLPOOL_LEGACY` | `HIGH` |
| 70–89 | `LIKELY_WHIRLPOOL_LEGACY_COINJOIN` | `WHIRLPOOL_LEGACY` | `MEDIUM` |
| 40–69 | `COINJOIN_LIKE` | `UNKNOWN` | `LOW` |
| 0–39 | `NOT_WHIRLPOOL` | `UNKNOWN` | `NONE` |

`confidence` is simply `score / 100`.

**TODO — verify before any public claim:** the configured pool denominations
(`rules.py::WHIRLPOOL_POOL_DENOMS_SATS` — 0.001 / 0.01 / 0.05 / 0.5 BTC) are
the commonly-documented legacy Whirlpool pool sizes, but have **not** been
re-verified against Samourai/Whirlpool's own final documentation or a set of
confirmed real Whirlpool txids for this project. Do not claim this list is
exact or complete until that verification happens (see "Next steps").

## Negative classification hints

For non-Whirlpool transactions, a `classification_hint` gives a plain
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
evidence. This classifier does not attempt to detect PayJoin in Phase 1 —
a PayJoin transaction will most likely just fall out as `NOT_WHIRLPOOL` /
`GENERIC_MULTI_PARTY_OR_BATCH_TRANSACTION`, which is the correct (non-)claim
to make about it right now.

## Test cases and benchmark (Phase 2)

`test_cases.json` now holds 25 real, sourced entries (no fabricated txids):
2 seed positives from the Phase 2 task spec, 17 more positives independently
curated from a real academic mainnet dataset
([crocs-muni/coinjoin-analysis](https://github.com/crocs-muni/coinjoin-analysis)),
1 real larger-round Whirlpool example that deliberately documents a known
scope limitation, 3 real negatives (ordinary payment / batching /
consolidation) sampled from recent mainnet blocks, and 2 honest `TODO`
placeholders (`hard_negative`, `payjoin_caveat`) where Phase 2 did not find
a defensible real example — see `VALIDATION_NOTES.md` for exactly why.

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

1. ~~Curate verified Whirlpool txids.~~ Done for Phase 2 (19 real positives).
2. ~~Curate hard negatives.~~ Partially done — ordinary/batching/
   consolidation done; coincidental-5x5 and PayJoin still `TODO`.
3. Verify pool denominations against primary documentation (still open).
4. ~~Add a benchmark report.~~ Done — see `benchmark_report.{json,md}`.
5. **Widen the round-size rule** (5/6/7/8-input-output, not just 5x5) — the
   Phase 2 benchmark found this covers only ~10% of real Whirlpool activity
   in the sampled dataset; see `VALIDATION_NOTES.md`. This is a scope
   decision, deliberately not made unilaterally in Phase 2.
6. Implement lineage-aware recursive detection (Phase 3, per the Phase 2
   task's "stronger future rule").
7. Add a Beeceptor external-attribution mock (this is where illicit
   attribution / signal #3 would eventually plug in — deliberately not part
   of this classifier).
8. Integrate the result into StableCoinX/CertaPay's Risk & Compliance UI —
   deliberately not done in Phase 1 or 2 per scope.

## Files

| File | Purpose |
|---|---|
| `schemas.py` | Normalized transaction/result data model (stdlib dataclasses) |
| `fetchers.py` | Blockstream/mempool.space HTTP fetch + error handling |
| `features.py` | Deterministic feature extraction |
| `rules.py` | The scored Whirlpool rule + negative hints |
| `classifier.py` | `analyze_txid(txid)` — the one function callers should use |
| `run_demo.py` | CLI entry point |
| `test_cases.json` | Curated fixture list (25 entries, 23 real + 2 `TODO`) |
| `test_cases.enriched.json` | Generated by `curate_cases.py --write-enriched` (not hand-authored) |
| `curate_cases.py` | Fetch/summarize test cases; suggest real negative candidates from recent blocks |
| `benchmark.py` | Runs `test_cases.json` through the classifier, scores it, writes the reports below |
| `benchmark_report.json` / `.md` | Generated by `benchmark.py` — Phase 2 snapshot, reproducible, not hand-authored |
| `VALIDATION_NOTES.md` | Claim, non-claims, data sources, the round-size finding, and every known limitation |
