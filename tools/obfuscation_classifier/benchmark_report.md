# Obfuscation Classifier — Benchmark Report

_Generated: 2026-09-18T20:05:58.808476+00:00_

**Claim:** StableCoinX performs protocol-aware CoinJoin identification (legacy Samourai Whirlpool and Wasabi 2.0/WabiSabi) from transaction structure, plus a protocol-agnostic fallback for other equal-output CoinJoin-like activity. This is identification, not unmixing, not user attribution, and not illicit attribution.

This report is a seed validation over a small, curated sample — see VALIDATION_NOTES.md for full context and known limitations. It is not a statistically robust accuracy claim.

## Summary

- Total cases in file: 35
- Skipped (`TODO` placeholders): 2
- Runnable cases: 33
- Fetch/classify errors: 0
- Correct (predicted classification == expected): 33
- Incorrect: 0

## CoinJoin positive detection (Whirlpool + WabiSabi, structure-based)

- True positives: 30
- False positives: 0
- False negatives: 0
- True negatives: 3
- Precision: 1.0
- Recall: 1.0

## Confusion: expected_family vs predicted_protocol

| expected_family | predicted_protocol | count |
|---|---|---|
| WHIRLPOOL_LEGACY | WHIRLPOOL_LEGACY | 22 |
| UNKNOWN | UNKNOWN | 3 |
| WABISABI_LIKE | WABISABI_LIKE | 8 |

## Per-case results

| txid | category | expected | predicted | confidence | outcome |
|---|---|---|---|---|---|
| `5553386e94b07112...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `b8593dad70162185...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `da9dffbda2b31585...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `a2ab708ed6fffdb0...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `60772fe32eb6dd9f...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `afd18a401a3613e9...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `240fbc0a1f225e42...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `c03cf94b84557351...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `f3307ae7ac761ed5...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `779ac4a120049d10...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `8adc6ae3258c0180...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `298f304165a1003b...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `cb6a88ec22250054...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `21908e0267eaa7ce...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `49d812bf11f93467...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `1058aa5b89b9100c...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `aba29cbb64aa0e95...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `1ea843fd94c1436c...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `51658d54e8a77412...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `66b21ea5d1d8a1f4...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `dfe57d33a81720a0...` | ordinary_payment_negative | NOT_COINJOIN | NOT_COINJOIN | 0.3 | TN |
| `4e624682a5b69dbd...` | batching_negative | NOT_COINJOIN | NOT_COINJOIN | 0.25 | TN |
| `2759143d93dc0bc2...` | consolidation_negative | NOT_COINJOIN | NOT_COINJOIN | 0.3 | TN |
| `567e9c3d9b45a5d3...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `91ec98c83462518e...` | positive_whirlpool | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | CONFIRMED_WHIRLPOOL_LEGACY_COINJOIN | 1.0 | TP |
| `28a30c19a996c349...` | positive_wabisabi | CONFIRMED_WABISABI_COINJOIN | CONFIRMED_WABISABI_COINJOIN | 1.0 | TP |
| `c88725b7a5403f2e...` | positive_wabisabi | CONFIRMED_WABISABI_COINJOIN | CONFIRMED_WABISABI_COINJOIN | 1.0 | TP |
| `21621eddc8974581...` | positive_wabisabi | CONFIRMED_WABISABI_COINJOIN | CONFIRMED_WABISABI_COINJOIN | 1.0 | TP |
| `dfa8849a1b17a818...` | positive_wabisabi | CONFIRMED_WABISABI_COINJOIN | CONFIRMED_WABISABI_COINJOIN | 1.0 | TP |
| `b06740910bc3134b...` | positive_wabisabi | CONFIRMED_WABISABI_COINJOIN | CONFIRMED_WABISABI_COINJOIN | 1.0 | TP |
| `2a83a803d40c275d...` | positive_wabisabi | CONFIRMED_WABISABI_COINJOIN | CONFIRMED_WABISABI_COINJOIN | 1.0 | TP |
| `7a12a4f2db72c2c1...` | positive_wabisabi | CONFIRMED_WABISABI_COINJOIN | CONFIRMED_WABISABI_COINJOIN | 1.0 | TP |
| `b02b3dbc07d1e8dd...` | positive_wabisabi | CONFIRMED_WABISABI_COINJOIN | CONFIRMED_WABISABI_COINJOIN | 1.0 | TP |
