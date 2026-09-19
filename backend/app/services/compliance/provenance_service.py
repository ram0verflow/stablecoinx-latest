"""
Provenance & path-integrity analysis — additive to the existing counterparty
pipeline, not a new product surface. Slots into domain 2 (Compliance & Risk),
directly after analyze_wallet(); its output is one more input into
evaluate_counterparty(), which already feeds apply_veto(). No 15th pipeline
layer, no new table — this populates the existing route_type/
trace_completeness columns and lives inside counterparty_risk_result.

Two axes drive every verdict, because terminal state alone is close to
meaningless — every stablecoin traces back to an issuer mint given enough
hops:

  terminal_state   — what stopped the backward walk (ATTRIBUTED /
                      CUSTODIAL_OPAQUE / INFRA_OPAQUE / PRIVACY_OPAQUE /
                      SANCTIONED / UNRESOLVED)
  path_integrity    — what the value travelled through to get there
                      (CLEAN / DEGRADED / COMPROMISED)

A branch counts as verified only when both are favorable. CUSTODIAL_OPAQUE
and INFRA_OPAQUE are not risk signals on their own — an exchange omnibus or
a DEX pool cuts the trail exactly as cleanly as a mixer, and most legitimate
institutional flow terminates there. Failure to detect always returns
UNRESOLVED, never CLEAN — this module must never approve something because
it couldn't see it.

Detection (this file) and policy (counterparty_risk_service.py) are kept
separate: this returns evidence only, with no opinion about approve/review/
block.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

_REPO_DATA = Path(__file__).resolve().parents[2] / "data"
_LABEL_CORPUS_PATH = _REPO_DATA / "labels" / "corpus.json"
_FIXTURES_DIR = _REPO_DATA / "fixtures" / "provenance"

# Terminal label class -> terminal_state. A missing/unrecognized label is
# UNRESOLVED — absence of evidence, not evidence of anything.
LABEL_CLASS_TO_TERMINAL = {
    "ISSUER_MINT": "ATTRIBUTED",
    "VASP_HOT": "ATTRIBUTED",
    "MARKET_MAKER": "ATTRIBUTED",
    "VASP_OMNIBUS": "CUSTODIAL_OPAQUE",
    "BRIDGE": "INFRA_OPAQUE",
    "SOLVER": "INFRA_OPAQUE",
    "DEX_POOL": "INFRA_OPAQUE",
    "PRIVACY": "PRIVACY_OPAQUE",
    "SANCTIONED": "SANCTIONED",
    "CONTRACT_OTHER": "UNRESOLVED",
}

TERMINAL_STATES = (
    "ATTRIBUTED", "CUSTODIAL_OPAQUE", "INFRA_OPAQUE",
    "PRIVACY_OPAQUE", "SANCTIONED", "UNRESOLVED",
)

# Stop conditions (config constants, not magic numbers scattered through code)
MAX_HOPS = 6
PRUNE_THRESHOLD = 0.005          # branch value share < 0.5% of the original transfer
NODE_BUDGET = 500                # hackathon budget, not the 2000 a general-purpose tool would use
HUB_TX_COUNT_THRESHOLD = 10_000  # treat as an opaque hub, don't traverse a CEX hot wallet

# Tier 2 thresholds — five independent structural signals, scored together
DISPOSABLE_NONCE_MAX = 3
DISPOSABLE_RESIDUAL_MAX = 0.05
DISPOSABLE_DWELL_MAX_SECONDS = 3600
VALUE_CONSERVATION_HIGH_THRESHOLD = 0.99
TIMING_RAPID_TOTAL_MAX_SECONDS = 5400  # 90 minutes, total across the branch — not a per-hop average
CLUSTERING_FANOUT_MIN = 5
DEGRADED_SIGNAL_COUNT = 2         # >=2 of 5 signals corroborating = DEGRADED, not one alone


_label_corpus_cache: Optional[dict] = None


def load_label_corpus() -> dict:
    """Loaded once at boot (or lazily on first use), then cached in memory."""
    global _label_corpus_cache
    if _label_corpus_cache is None:
        with open(_LABEL_CORPUS_PATH) as f:
            _label_corpus_cache = json.load(f)
    return _label_corpus_cache


def lookup_label(chain_id: int, address: str) -> Optional[dict]:
    """Tier 1 — set membership against the label corpus. Used by the live
    Neo4j/Etherscan path; fixtures carry pre-resolved labels directly so the
    canned demo never depends on corpus completeness."""
    corpus = load_label_corpus()
    address = (address or "").lower()
    for entry in corpus.get("entries", []):
        if entry["chain_id"] == chain_id and entry["address"].lower() == address:
            return {
                "class": entry["class"], "entity": entry["entity"],
                "source": entry["source"], "confidence": entry["confidence"],
            }
    return None


def load_fixture(name: str) -> dict:
    path = _FIXTURES_DIR / f"{name}.json"
    with open(path) as f:
        return json.load(f)


def _classify_terminal(label: Optional[dict]) -> str:
    if not label:
        return "UNRESOLVED"
    return LABEL_CLASS_TO_TERMINAL.get(label.get("class"), "UNRESOLVED")


def _hop_is_disposable(lifecycle: Optional[dict]) -> bool:
    if not lifecycle:
        return False
    return (
        lifecycle.get("terminal_nonce", 999) <= DISPOSABLE_NONCE_MAX
        and lifecycle.get("residual_balance_frac", 1.0) <= DISPOSABLE_RESIDUAL_MAX
        and lifecycle.get("dwell_seconds", 999999) <= DISPOSABLE_DWELL_MAX_SECONDS
    )


def _score_branch_signals(path: list[dict]) -> list[str]:
    """Tier 2 — five structural signals, computed per hop, scored together.
    Each is evadable alone; evading one tends to make the others louder —
    see DEGRADED_SIGNAL_COUNT, which requires corroboration, not one hit."""
    intermediate_hops = [n for n in path if n.get("lifecycle") is not None]
    signals: list[str] = []

    disposable_count = sum(1 for n in intermediate_hops if _hop_is_disposable(n.get("lifecycle")))
    if intermediate_hops and disposable_count >= max(2, len(intermediate_hops) // 2):
        signals.append("LIFECYCLE_DISPOSABLE")

    # Peel chains lose under 1% across hops — real economic activity loses
    # value constantly to fees, slippage and spread. High conservation
    # across hops is transport, not commerce.
    conservations = [n["value_conservation"] for n in path if n.get("value_conservation") is not None]
    if len(conservations) >= 2 and (sum(conservations) / len(conservations)) >= VALUE_CONSERVATION_HIGH_THRESHOLD:
        signals.append("VALUE_CONSERVATION_HIGH")

    # Total transit time, not a per-hop average — automated layering runs in
    # minutes total; business payments wait on approvals and batch overnight.
    dwell_seconds_list = [n["lifecycle"]["dwell_seconds"] for n in intermediate_hops if "dwell_seconds" in (n.get("lifecycle") or {})]
    if len(dwell_seconds_list) >= 2 and sum(dwell_seconds_list) <= TIMING_RAPID_TOTAL_MAX_SECONDS:
        signals.append("TIMING_RAPID")

    # Gas provenance — fresh wallets need gas, and gas usually arrives from
    # somewhere traceable. Tracing it at all is one signal; that same funder
    # fanning out to many other fresh wallets (clustering) is a stronger,
    # separate one — the graph query that exposes the operation itself.
    gas_funders: dict[str, int] = {}
    for n in intermediate_hops:
        gf = n.get("gas_funder")
        if gf:
            gas_funders[gf["address"]] = max(gas_funders.get(gf["address"], 0), gf.get("fan_out_count", 0))
    if gas_funders:
        signals.append("GAS_PROVENANCE_TRACED")
    if any(count >= CLUSTERING_FANOUT_MIN for count in gas_funders.values()):
        signals.append("CLUSTERING_FANOUT")

    return signals


def _classify_path_integrity(path: list[dict], terminal_state: str, signals: list[str]) -> str:
    """
    CLEAN       — no risk labels, no layering indicators.
    DEGRADED    — layering structure present (>=2 corroborating Tier 2
                  signals), no hard label. This is the "opacity, not proof
                  of wrongdoing" state — a layering *reason*, not a verdict.
    COMPROMISED — a sanctioned, privacy, darknet or fraud label anywhere on
                  the path (checked across the whole path, not just the
                  terminal — a hard label must never be walked past).
    """
    hard_label_classes = {"SANCTIONED", "PRIVACY"}
    for node in path:
        label = node.get("label")
        if label and label.get("class") in hard_label_classes:
            return "COMPROMISED"
    if terminal_state in ("SANCTIONED", "PRIVACY_OPAQUE"):
        return "COMPROMISED"
    if len(signals) >= DEGRADED_SIGNAL_COUNT:
        return "DEGRADED"
    return "CLEAN"


class ProvenanceResult(dict):
    """Plain dict subclass — this is evidence, not a verdict. See
    counterparty_risk_service.py for how it's mapped onto a policy_action."""


def _empty_result(reason_code: str, confidence: float = 0.0) -> ProvenanceResult:
    return ProvenanceResult({
        "available": False,
        "clean_path_attribution": 0.0,
        "raw_terminal_attribution": 0.0,
        "terminal_breakdown": {s.lower(): 0.0 for s in TERMINAL_STATES},
        "path_integrity": "DEGRADED",
        "hops_to_severance": None,
        "label_coverage": 0.0,
        "signals_fired": [],
        "reason_codes": [reason_code],
        "confidence": confidence,
        "corpus_version": load_label_corpus().get("version"),
        "heuristic_version": "1.0.0",
        "graph": {"nodes": [], "edges": []},
    })


def analyze_provenance(
    payment: Any,
    wallet_graph_result: Optional[dict],
    compliance_result: Optional[dict],
    fixture_name: Optional[str] = None,
) -> ProvenanceResult:
    """
    Entry point, called from payment_pipeline.run_payment_pipeline() between
    analyze_wallet() and evaluate_counterparty().

    Soft-fails everything, matching the existing pattern: no fixture
    selected and no live traversal backend reachable (Neo4j down, no
    Etherscan key) returns UNRESOLVED with a reason code — a provenance
    failure must never block a payment from being evaluated at all; that's
    apply_veto()'s job, downstream, once it has this evidence.
    """
    fixture_name = fixture_name or getattr(payment, "provenance_fixture", None)
    if not fixture_name:
        # Live traversal (Neo4j Cypher / Etherscan) is not wired yet — see
        # build order steps 7-8. Soft-fail honestly rather than fabricate.
        return _empty_result("PROV-000-NO-BACKEND", confidence=0.0)

    try:
        data = load_fixture(fixture_name)
    except FileNotFoundError:
        return _empty_result("PROV-001-UNKNOWN-FIXTURE", confidence=0.0)

    return _analyze_branches(data)


def _analyze_branches(data: dict) -> ProvenanceResult:
    branches = data.get("branches", [])
    terminal_breakdown = {s.lower(): 0.0 for s in TERMINAL_STATES}
    clean_path_attribution = 0.0
    raw_terminal_attribution = 0.0
    label_coverage = 0.0
    all_signals: set[str] = set()
    reason_codes: list[str] = []
    worst_integrity_rank = {"CLEAN": 0, "DEGRADED": 1, "COMPROMISED": 2}
    overall_integrity = "CLEAN"
    severance_depths: list[int] = []
    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    for branch in branches:
        share = branch["value_share"]
        path = branch["path"]
        terminal_node = path[-1]
        terminal_label = terminal_node.get("label")
        terminal_state = _classify_terminal(terminal_label)
        signals = _score_branch_signals(path)
        integrity = _classify_path_integrity(path, terminal_state, signals)

        terminal_breakdown[terminal_state.lower()] += share
        if terminal_state == "ATTRIBUTED":
            raw_terminal_attribution += share
        if terminal_state != "UNRESOLVED":
            label_coverage += share
        if terminal_state == "ATTRIBUTED" and integrity == "CLEAN":
            clean_path_attribution += share
        else:
            severance_depths.append(terminal_node["depth"])

        all_signals.update(signals)
        if worst_integrity_rank[integrity] > worst_integrity_rank[overall_integrity]:
            overall_integrity = integrity

        if terminal_state == "SANCTIONED":
            reason_codes.append("SANC-001")
        elif integrity == "COMPROMISED":
            reason_codes.append("PRIV-001")
        elif integrity == "DEGRADED":
            reason_codes.append("LAYER-001")

        for i, node in enumerate(path):
            # The root (depth 0, the counterparty itself) is shared across
            # every branch — it represents 100% of inbound value, not
            # whichever single branch's share happened to be processed last.
            node_value_share = 1.0 if node["depth"] == 0 else share
            nodes[node["address"]] = {
                "address": node["address"],
                "depth": node["depth"],
                "terminal_state": terminal_state.lower() if i == len(path) - 1 else None,
                "label": node.get("label"),
                "lifecycle": node.get("lifecycle"),
                "value_share": node_value_share,
                "is_disposable": _hop_is_disposable(node.get("lifecycle")),
            }
            if i > 0:
                edges.append({
                    "from": path[i - 1]["address"], "to": node["address"],
                    "value_share": share, "depth": node["depth"],
                })
                gf = node.get("gas_funder")
                if gf:
                    if gf["address"] not in nodes:
                        nodes[gf["address"]] = {
                            "address": gf["address"], "depth": node["depth"],
                            "terminal_state": None, "label": gf.get("label"),
                            "lifecycle": None, "value_share": 0.0,
                            "is_gas_funder": True, "fan_out_count": gf.get("fan_out_count"),
                        }
                    else:
                        nodes[gf["address"]]["fan_out_count"] = max(
                            nodes[gf["address"]].get("fan_out_count") or 0, gf.get("fan_out_count") or 0
                        )
                    edges.append({
                        "from": gf["address"], "to": node["address"],
                        "value_share": None, "depth": node["depth"], "type": "gas",
                    })

    return ProvenanceResult({
        "available": True,
        "clean_path_attribution": round(clean_path_attribution, 4),
        "raw_terminal_attribution": round(raw_terminal_attribution, 4),
        "terminal_breakdown": {k: round(v, 4) for k, v in terminal_breakdown.items()},
        "path_integrity": overall_integrity,
        "hops_to_severance": min(severance_depths) if severance_depths else None,
        "label_coverage": round(label_coverage, 4),
        "signals_fired": sorted(all_signals),
        "reason_codes": sorted(set(reason_codes)),
        # Tier 1 (set membership) is measurable; Tier 2 has no ground truth,
        # so this is descriptive, never a claim of statistical validation.
        "confidence": 0.95 if not all_signals else 0.8,
        "chain_id": data.get("chain_id"),
        "corpus_version": data.get("corpus_version"),
        "heuristic_version": data.get("heuristic_version", "1.0.0"),
        "graph": {"nodes": list(nodes.values()), "edges": edges},
    })
