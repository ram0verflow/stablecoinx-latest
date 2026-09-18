from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.services.compliance import wallet_graph_service


@pytest.fixture(autouse=True)
def _default_to_local_provider(monkeypatch):
    """These tests exercise the local Neo4j-backed path specifically — pin
    it explicitly rather than relying on whatever COMPLIANCE_PROVIDER
    happens to be set to in the ambient .env (see test_compliance_engine.py
    for the same fix and why it's needed)."""
    monkeypatch.setattr(settings, "COMPLIANCE_PROVIDER", "local")


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
        def session(self, database=None):
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
        def session(self, database=None):
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
        def session(self, database=None):
            return _Session()

    monkeypatch.setattr(wallet_graph_service, "get_neo4j_driver", lambda: _Driver())
    out = wallet_graph_service.analyze_wallet("0x333")
    assert out["overall_risk"] in {"low", "medium"}


def test_neo4j_connection_failure_graceful(monkeypatch):
    monkeypatch.setattr(wallet_graph_service, "get_neo4j_driver", lambda: None)
    out = wallet_graph_service.analyze_wallet("0x444")
    assert out["overall_risk"] == "medium"
    assert out["neo4j_degraded"] is True
