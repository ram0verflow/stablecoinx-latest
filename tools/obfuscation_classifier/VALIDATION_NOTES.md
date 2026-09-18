# StableCoinX Obfuscation Classifier Validation Notes

Phase 3 seed validation — general-purpose across multiple real CoinJoin
protocols. This is a curated sample (33 real runnable cases) — treat every
number in this document and in `benchmark_report.{json,md}` as a seed
validation result, not a statistically robust accuracy claim.

## Claim

StableCoinX identifies CoinJoin transaction structure — legacy Samourai
Whirlpool and Wasabi 2.0/WabiSabi specifically (both real-dataset
validated), plus a protocol-agnostic fallback for other equal-output
CoinJoin-like activity it doesn't specifically model.

## Non-Claims

- does not unmix
- does not map inputs to outputs
- does not identify users
- does not imply illicit activity
- does not replace commercial blockchain intelligence

## Current Rules (three, evaluated independently — see `rules.py`)

**1. Legacy Whirlpool:**
- input count in {5,6,7,8} (widened from "exactly 5" — see finding below)
- output count in {5,6,7,8}
- equal outputs
- Whirlpool pool denomination

**2. Wasabi 2.0 / WabiSabi:**
- output count ≥ 20
- ≥3 distinct equal-value output clusters
- largest cluster ≥ 5 outputs
- ≥2 clusters at a round (power-of-2/3 or decimal) denomination

**3. Generic equal-output CoinJoin (fallback, capped at `COINJOIN_LIKE`):**
- meaningful equal-value output cluster (≥3, ≥30% of outputs)
- multi-party shape (≥2 inputs, ≥3 outputs)

All three are scored on every transaction; the strongest match is reported
as the primary result, but every rule's score is returned in
`checked_protocols` so nothing is hidden.

## Stronger Future Rule

- same as above, per protocol
- plus lineage check: at least one input spends from a previously identified
  CoinJoin of the same protocol

**Phase 4 TODO:** implement lineage-aware recursive detection. Not yet
attempted — see "Known Limitations" below for exactly why this matters more
than it might first appear.

## Data Sources

- MIT DCI / Whirlpool usage analysis describes 5 inputs, 5 outputs, equal
  output denominations, pool sizes, and lineage-aware iterative detection.
- CRoCS/Masaryk `coinjoin-analysis` repository
  (https://github.com/crocs-muni/coinjoin-analysis) processes real mainnet
  CoinJoins detected by Dumplings and supports Samourai Whirlpool as
  `--cjtype sw`. Phase 2 used its test fixture
  `tests/fixtures/dumplings__sw_202403.zip` → `Scanner/SamouraiCoinJoins.txt`
  — a real list of 1,403 dataset-identified Samourai Whirlpool CoinJoin
  txids — as the source for 19 of the 21 curated Whirlpool positive examples
  (the other 2 are the seed txids below; covers round sizes 5, 6, 7, and 8).
  Every txid pulled from this list was independently re-fetched from
  Blockstream and re-classified with this project's own `analyze_txid()`
  before being trusted — the dataset's label was a starting point, not the
  final word.
- The same repository's `data/wasabi2/txid_coord.json` — a real list of 989
  dataset-attributed Wasabi 2.0/WabiSabi coordinator txids — is the source
  for all 8 `positive_wabisabi` examples. Same independent-reverification
  discipline: each was re-fetched from Blockstream and re-classified before
  being trusted, not taken on the dataset's word.
- Public seed Whirlpool txids (given directly in the Phase 2 task, source
  citations as described there — exact source URLs not independently
  located/verified by the assistant, but both txids were independently
  re-verified live against Blockstream and both score
  `CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN`):
  - `5553386e94b07112fb7b6789cae2f89f380ca20a28935812c51f0f3387bd5243`
    (cited as a Bitcoin StackExchange example; 0.001 BTC pool)
  - `b8593dad70162185d070f86e00a208d334411114f749629869a8d6ffe9162087`
    (cited as a Samourai/KYCP example; 0.05 BTC pool)

## A real finding from curating this sample: round size distribution

While sampling the `coinjoin-analysis` dataset for 5x5 examples, a random
160-transaction sample of real, dataset-confirmed Samourai Whirlpool
CoinJoins broke down by input/output count as:

| Round shape | Count | Share |
|---|---|---|
| 8-in / 8-out | 102 | 63.8% |
| 6-in / 6-out | 27 | 16.9% |
| 5-in / 5-out | 17 | 10.6% |
| 7-in / 7-out | 14 | 8.8% |

**The exact-5x5 shape the original rule targeted covered only about 1 in 10
of the real Whirlpool activity sampled here.** 8-participant rounds are by
far the most common. This directly motivated Phase 3's fix: the rule was
widened to the 5-8 round-size range, and the same 8-in/8-out txid
(`66b21ea5d1d8a1f4ec026cd5e3d6efa6abf513560d3a5a6068a50c35d1a1c66f`) that
`test_cases.json` deliberately kept as a documented limitation now correctly
scores `CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN` — the benchmark's recall went
from 0.94 (Phase 2) to 1.0 (Phase 3) on this fix alone, re-validated against
real txids at all four sizes (5, 6, 7, 8), not just the two endpoints.

## Known Limitations

- Small curated sample (33 real runnable cases; see `benchmark_report.md`
  for the exact count and the `SMALL_SAMPLE_WARNING` flag, which does not
  currently trigger but would below 10).
- Pool-denomination rule alone may catch coincidental perfect
  CoinJoin-like transactions that are not actually Whirlpool — a search of
  350 random recent mainnet transactions found *zero* with even the
  5-in/5-out shape at all, suggesting this is rare in practice, but the
  sample is too small to bound the false-positive rate precisely (see the
  `hard_negative` `TODO` in `test_cases.json`).
- **The WabiSabi denomination-ladder heuristic (power-of-2/3, round
  decimals) is this project's own inference from 8 real samples, not
  independently verified against WabiSabi's official specification.** It's
  only 25 of 100 scoring points, not load-bearing alone, but should not be
  treated as an authoritative claim about WabiSabi's actual design until
  checked against primary documentation.
- **The generic equal-output fallback (protocol `GENERIC_EQUAL_OUTPUT_COINJOIN`)
  has no real curated positive examples** — it exists as a deliberately
  conservative catch-all (capped at `COINJOIN_LIKE`, never a confirmed
  protocol claim) for JoinMarket-style or unmodeled CoinJoin activity, but
  has not been validated against a real JoinMarket txid. Treat its output
  as lower-confidence than the two protocol-specific rules.
- Only two protocols get a specific-identity claim (Whirlpool, WabiSabi).
  Other real CoinJoin implementations (JoinMarket, legacy Wasabi 1.x) will
  at best register as the generic fallback, at worst `NOT_COINJOIN` if
  their structure doesn't happen to produce a large-enough equal-value
  cluster (JoinMarket in particular often has small anonymity sets and only
  ONE equal-value output per participant among several outputs — may not
  clear the generic rule's thresholds; not verified either way).
- Lineage-aware detection not yet implemented.
- No illicit attribution (see product-layer integration in
  `docs/OBFUSCATION_INTELLIGENCE_DEMO.md` for where that lives instead).
- No PayJoin-specific detection (the `payjoin_caveat` test case is a `TODO`
  placeholder — no verified public PayJoin txid has been curated).
- No exchange/entity attribution.
- **Network API dependency, confirmed to actually bite in practice during
  Phase 2**: after the curation scanning in this phase, a direct repeat
  `run_demo.py` call against one of the seed txids hit
  `"Rate limited by the block explorer API"` from Blockstream, and the
  mempool.space fallback failed too (`Could not reach block explorer API:
  timed out` — this sandbox's network cannot reach mempool.space at all,
  observed in both Phase 1 and Phase 2). The error surfaced cleanly as the
  documented `{"error": true, ...}` shape with both failure reasons named,
  not a traceback — but it is a real illustration of why this classifier
  should not be treated as always-available without a caching/retry layer
  in front of it before any production use. **Fixed in `benchmark.py`**
  (not in `run_demo.py`/`classifier.py`, which stay simple and single-shot
  per their Phase 1 design): a 1.5s delay between requests plus one retry
  after an 8s backoff specifically on rate-limit errors. This took a full
  benchmark run from 7/23 runnable (first attempt, no pacing) → 13/23
  (after waiting for the initial rate-limit window to clear, still no
  pacing) → 20/23 (with pacing). The remaining 3/23 still hit rate limits
  even after the retry — Blockstream's actual limit window is apparently
  longer than 8s under sustained load. A production integration would need
  longer backoff and/or a local cache of already-classified txids, not
  attempted here as it's outside Phase 2 scope.

## Judge-Safe Wording

"StableCoinX performs protocol-aware identification of CoinJoin transaction
structure — legacy Whirlpool and Wasabi 2.0/WabiSabi specifically, both
validated against real mainnet data — from explainable evidence.
Identification is separate from unmixing and separate from illicit
attribution."

(The original Whirlpool-only wording — "StableCoinX performs protocol-aware
identification of legacy Whirlpool-style CoinJoin transactions..." — is
still accurate as a narrower claim if only Whirlpool detection is being
discussed; use whichever matches what's actually being demonstrated.)

## How to reproduce this validation

```
python tools/obfuscation_classifier/curate_cases.py
python tools/obfuscation_classifier/benchmark.py
```

`benchmark_report.json` and `benchmark_report.md` are generated files —
committed here as the Phase 2 snapshot, but they are reproducible outputs of
`benchmark.py`, not hand-authored. Re-run `benchmark.py` to refresh them
(numbers may shift slightly over time only if a cited txid becomes
unreachable from a given network — the classification logic itself is
deterministic).
