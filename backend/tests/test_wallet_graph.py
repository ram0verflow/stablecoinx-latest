from types import SimpleNamespace

from app.services.compliance import wallet_graph_service


def test_suspicious_wallet_high_risk(monkeypatch):
    class _Session:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def run(self, query, **kwargs):
            if "RETURN w" in query:
                return SimpleNamespace(single=lambda: {"w": {"mixer_adjacent": True, "laundering_cluster": True}})
            return [{"sus_addr": "0xSUS"}]

    class _Driver:
        def session(self):
            return _Session()

    monkeypatch.setattr(wallet_graph_service, "get_neo4j_driver", lambda: _Driver())
    out = wallet_graph_service.analyze_wallet("0x111")
    assert out["risk_score"] > 0.7


def test_mixer_adjacent_flagged(monkeypatch):
    class _Session:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def run(self, query, **kwargs):
            if "RETURN w" in query:
                return SimpleNamespace(single=lambda: {"w": {"mixer_adjacent": True}})
            return []

    class _Driver:
        def session(self):
            return _Session()

    monkeypatch.setattr(wallet_graph_service, "get_neo4j_driver", lambda: _Driver())
    out = wallet_graph_service.analyze_wallet("0x222")
    assert out["mixer_adjacent"] is True


def test_clean_wallet_low_risk(monkeypatch):
    class _Session:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def run(self, query, **kwargs):
            if "RETURN w" in query:
                return SimpleNamespace(single=lambda: None)
            return []

    class _Driver:
        def session(self):
            return _Session()

    monkeypatch.setattr(wallet_graph_service, "get_neo4j_driver", lambda: _Driver())
    out = wallet_graph_service.analyze_wallet("0x333")
    assert out["overall_risk"] in {"low", "medium"}


def test_neo4j_connection_failure_graceful(monkeypatch):
    monkeypatch.setattr(wallet_graph_service, "get_neo4j_driver", lambda: None)
    out = wallet_graph_service.analyze_wallet("0x444")
    assert out["overall_risk"] == "medium"
    assert out["neo4j_degraded"] is True
