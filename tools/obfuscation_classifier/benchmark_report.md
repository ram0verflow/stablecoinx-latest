# Obfuscation Classifier — Benchmark Report

_Generated: 2026-09-18T18:31:18.289826+00:00_

**Claim:** StableCoinX performs protocol-aware Whirlpool-style CoinJoin identification from transaction structure. This is identification, not unmixing, not user attribution, and not illicit attribution.

This report is a seed validation over a small, curated sample — see VALIDATION_NOTES.md for full context and known limitations. It is not a statistically robust accuracy claim.

## Summary

- Total cases in file: 25
- Skipped (`TODO` placeholders): 2
- Runnable cases: 20
- Fetch/classify errors: 3
- Correct (predicted classification == expected): 20
- Incorrect: 0

## Whirlpool positive detection (structure-based, 5x5-legacy-rule scope only)

- True positives: 16
- False positives: 0
- False negatives: 1
- True negatives: 3
- Precision: 1.0
- Recall: 0.9412

## Confusion: expected_family vs predicted_protocol

| expected_family | predicted_protocol | count |
|---|---|---|
| WHIRLPOOL_LEGACY | WHIRLPOOL_LEGACY | 16 |
| WHIRLPOOL_LEGACY | UNKNOWN | 1 |
| UNKNOWN | UNKNOWN | 3 |

## Per-case results

| txid | category | expected | predicted | confidence | outcome |
|---|---|---|---|---|---|
| `5553386e94b07112...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `b8593dad70162185...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `a2ab708ed6fffdb0...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `60772fe32eb6dd9f...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `afd18a401a3613e9...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `c03cf94b84557351...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `f3307ae7ac761ed5...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `779ac4a120049d10...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `298f304165a1003b...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `cb6a88ec22250054...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `21908e0267eaa7ce...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `49d812bf11f93467...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `1058aa5b89b9100c...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `aba29cbb64aa0e95...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `1ea843fd94c1436c...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `51658d54e8a77412...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `66b21ea5d1d8a1f4...` | positive_whirlpool | COINJOIN_LIKE | COINJOIN_LIKE | 0.5 | FN |
| `dfe57d33a81720a0...` | ordinary_payment_negative | NOT_WHIRLPOOL | NOT_WHIRLPOOL | 0.0 | TN |
| `4e624682a5b69dbd...` | batching_negative | NOT_WHIRLPOOL | NOT_WHIRLPOOL | 0.0 | TN |
| `2759143d93dc0bc2...` | consolidation_negative | NOT_WHIRLPOOL | NOT_WHIRLPOOL | 0.0 | TN |

## Errors (not hidden)

- `da9dffbda2b3158565667bca071ab4f438be84e7f313ba71a426fe6de4281cc5` (positive_whirlpool): Both block explorer APIs failed. Blockstream: Rate limited by the block explorer API — try again shortly. mempool.space: Could not reach block explorer API: timed out.
- `240fbc0a1f225e4266b86d351a099ae4fd28bbb2d628960fae11e5481a9d43d0` (positive_whirlpool): Both block explorer APIs failed. Blockstream: Rate limited by the block explorer API — try again shortly. mempool.space: Could not reach block explorer API: timed out.
- `8adc6ae3258c018036cc447230cc549097313ea4c9a1ec0ff22b97f0bbfd0fe5` (positive_whirlpool): Both block explorer APIs failed. Blockstream: Rate limited by the block explorer API — try again shortly. mempool.space: Could not reach block explorer API: timed out.
