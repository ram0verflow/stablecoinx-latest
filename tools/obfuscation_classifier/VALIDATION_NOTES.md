# StableCoinX Obfuscation Classifier Validation Notes

Phase 2 seed validation. This is a small, curated sample — treat every
number in this document and in `benchmark_report.{json,md}` as a seed
validation result, not a statistically robust accuracy claim.

## Claim

StableCoinX identifies legacy Whirlpool-style CoinJoin transaction structure.

## Non-Claims

- does not unmix
- does not map inputs to outputs
- does not identify users
- does not imply illicit activity
- does not replace commercial blockchain intelligence

## Current Rule

- 5 inputs
- 5 outputs
- equal outputs
- Whirlpool pool denomination

## Stronger Future Rule

- same as above
- plus lineage check: at least one input spends from a previously identified
  Whirlpool CoinJoin

**Phase 3 TODO:** implement lineage-aware recursive detection. Not attempted
in Phase 2 — see "Known Limitations" below for exactly why this matters more
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
  txids — as the source for 17 of the 19 curated positive examples (the
  other 2 are the seed txids below). Every txid pulled from this list was
  independently re-fetched from Blockstream and re-classified with this
  project's own `analyze_txid()` before being trusted — the dataset's label
  was a starting point, not the final word.
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

**The exact-5x5 shape the current rule targets covers only about 1 in 10 of
the real Whirlpool activity sampled here.** 8-participant rounds are by far
the most common. This is not a bug in the classifier — the rule is
deliberately scoped to the legacy 5x5 shape per the Phase 1/2 spec — but it
means the current rule's *recall* over "any real Whirlpool round" is
structurally low, even though its *precision* on the shape it does target
appears strong in this sample (see benchmark results). `test_cases.json`
deliberately includes one real 8-in/8-out Whirlpool round
(`66b21ea5d1d8a1f4ec026cd5e3d6efa6abf513560d3a5a6068a50c35d1a1c66f`) with
`expected_classification: COINJOIN_LIKE` specifically to make this limitation
show up honestly in the benchmark numbers rather than being hidden by only
testing the easy cases.

## Known Limitations

- Small curated sample (see `benchmark_report.md` for the exact count and
  the `SMALL_SAMPLE_WARNING` flag).
- **The 5x5 rule structurally misses most real Whirlpool rounds** — see the
  round-size finding above. A rule scoped to "5, 6, 7, or 8 inputs/outputs,
  all equal, at a pool denomination" would likely have much higher recall,
  but that widening was not implemented in Phase 2 (it changes the rule's
  claimed scope, which is a Phase 3 decision, not something to slip in here).
- Pool-denomination rule alone may catch coincidental perfect
  CoinJoin-like transactions that are not actually Whirlpool — a search of
  350 random recent mainnet transactions during Phase 2 found *zero* with
  even the 5-in/5-out shape at all, suggesting this is rare in practice, but
  the sample is too small to bound the false-positive rate precisely (see
  the `hard_negative` `TODO` in `test_cases.json`).
- Lineage-aware detection not yet implemented.
- No illicit attribution.
- No PayJoin-specific detection (the `payjoin_caveat` test case is a `TODO`
  placeholder — no verified public PayJoin txid was curated in Phase 2).
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

"StableCoinX performs protocol-aware identification of legacy Whirlpool-style
CoinJoin transactions from explainable transaction-structure evidence.
Identification is separate from unmixing and separate from illicit
attribution."

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
