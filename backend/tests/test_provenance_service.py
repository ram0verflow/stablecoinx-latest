from app.services.compliance.provenance_service import analyze_provenance


def _analyze(fixture_name):
    return analyze_provenance(payment=None, wallet_graph_result=None, compliance_result=None, fixture_name=fixture_name)


def test_good_fixture_is_fully_clean_and_attributed():
    result = _analyze("good")
    assert result["path_integrity"] == "CLEAN"
    assert result["clean_path_attribution"] == 1.0
    assert result["raw_terminal_attribution"] == 1.0
    assert result["terminal_breakdown"]["sanctioned"] == 0.0
    assert result["terminal_breakdown"]["privacy_opaque"] == 0.0
    assert result["hops_to_severance"] is None
    assert result["reason_codes"] == []


def test_medium_fixture_is_opaque_but_clean_not_a_risk_signal():
    """Custodial/infra opacity must never itself count as a risk signal —
    this fixture proves the tool knows opacity != wrongdoing."""
    result = _analyze("medium")
    assert result["path_integrity"] == "CLEAN"
    assert result["clean_path_attribution"] == 0.38
    assert result["terminal_breakdown"]["custodial_opaque"] == 0.44
    assert result["terminal_breakdown"]["infra_opaque"] == 0.14
    assert result["terminal_breakdown"]["privacy_opaque"] == 0.0
    assert result["terminal_breakdown"]["sanctioned"] == 0.0
    assert result["reason_codes"] == []


def test_bad_fixture_hits_privacy_pool_and_is_compromised():
    result = _analyze("bad")
    assert result["path_integrity"] == "COMPROMISED"
    assert result["terminal_breakdown"]["privacy_opaque"] == 1.0
    assert result["clean_path_attribution"] == 0.0
    assert result["hops_to_severance"] == 3
    assert "PRIV-001" in result["reason_codes"]
    assert set(result["signals_fired"]) == {
        "LIFECYCLE_DISPOSABLE", "VALUE_CONSERVATION_HIGH", "TIMING_RAPID",
        "CLUSTERING_FANOUT", "GAS_PROVENANCE_TRACED",
    }


def test_deceptive_fixture_is_the_acceptance_test():
    """The one that matters: raw terminal is a clean Circle mint at depth 8,
    but the path is a disposable-wallet layering chain. If this comes back
    CLEAN, the classifier is reading terminals only and the two-axis model
    is not wired."""
    result = _analyze("deceptive")
    assert result["raw_terminal_attribution"] == 1.0
    assert result["clean_path_attribution"] == 0.0
    assert result["path_integrity"] == "DEGRADED"
    assert result["hops_to_severance"] == 8
    assert "LAYER-001" in result["reason_codes"]
    assert result["path_integrity"] != "CLEAN"


def test_missing_backend_soft_fails_to_unresolved_not_a_crash():
    result = analyze_provenance(payment=None, wallet_graph_result=None, compliance_result=None, fixture_name=None)
    assert result["reason_codes"] == ["PROV-000-NO-BACKEND"]
    assert result["clean_path_attribution"] == 0.0
    assert result["path_integrity"] != "CLEAN"


def test_unknown_fixture_soft_fails_not_a_crash():
    result = _analyze("does-not-exist")
    assert result["reason_codes"] == ["PROV-001-UNKNOWN-FIXTURE"]


def test_root_node_value_share_is_always_100_percent():
    """Regression: the root/counterparty node is shared across every
    branch — it must show 100% value share, not whichever single branch's
    share happened to be processed last when building the node dict."""
    for name in ("good", "medium", "bad", "deceptive"):
        result = _analyze(name)
        root = next(n for n in result["graph"]["nodes"] if n["depth"] == 0)
        assert root["value_share"] == 1.0, f"{name}: root value_share was {root['value_share']}"


def test_every_edge_endpoint_is_a_registered_node():
    """Regression: gas-funder addresses are edge sources but aren't part of
    any branch's path — they must still be registered as graph nodes, or a
    graph renderer (Cytoscape) crashes on an edge with no matching node."""
    for name in ("good", "medium", "bad", "deceptive"):
        result = _analyze(name)
        node_ids = {n["address"] for n in result["graph"]["nodes"]}
        for edge in result["graph"]["edges"]:
            assert edge["from"] in node_ids, f"{name}: edge from {edge['from']} has no matching node"
            assert edge["to"] in node_ids, f"{name}: edge to {edge['to']} has no matching node"
