from app.services.ai import ai_decision_engine


class _Payment:
    sender_company = "Sender"
    receiver_company = "Receiver"
    source_country = "SG"
    destination_country = "UAE"
    amount = 1000
    token = "USDC"
    purpose = "Payroll"
    urgency = "medium"
    source_chain = "Base Sepolia"


def test_ollama_returns_valid_decision(monkeypatch):
    monkeypatch.setattr(
        ai_decision_engine,
        "call_ollama",
        lambda _prompt: ('{"decision":"direct_transfer","confidence":0.95,"reasoning":"ok"}', {"engine": "ollama"}),
    )
    out = ai_decision_engine.get_ai_decision(_Payment(), {}, preferred_engine="ollama")
    assert out["decision"] == "direct_transfer"


def test_groq_fallback_on_ollama_timeout(monkeypatch):
    def _timeout(_prompt):
        raise ai_decision_engine.AITimeoutError("Ollama timed out (>30s)")

    monkeypatch.setattr(ai_decision_engine, "call_ollama", _timeout)
    monkeypatch.setattr(
        ai_decision_engine,
        "call_groq",
        lambda _prompt: ('{"decision":"manual_review","confidence":0.8,"reasoning":"fallback"}', {"engine": "groq"}),
    )
    out = ai_decision_engine.get_ai_decision(_Payment(), {}, preferred_engine="ollama")
    assert out["meta"]["engine"] == "groq"


def test_pii_redaction_in_prompt():
    text = "send to 0x1234567890123456789012345678901234567890 now"
    redacted = ai_decision_engine.redact_pii(text)
    assert "0x1234567890123456789012345678901234567890" not in redacted
    assert "REDACTED" in redacted


def test_invalid_ai_response_defaults_to_review(monkeypatch):
    monkeypatch.setattr(
        ai_decision_engine,
        "call_ollama",
        lambda _prompt: ('{"decision":"MAYBE","confidence":0.5}', {"engine": "ollama"}),
    )
    monkeypatch.setattr(
        ai_decision_engine,
        "call_groq",
        lambda _prompt: ('{"decision":"MAYBE","confidence":0.5}', {"engine": "groq"}),
    )
    out = ai_decision_engine.get_ai_decision(_Payment(), {}, preferred_engine="ollama")
    assert out["decision"] == "manual_review"


def test_decision_validation():
    assert ai_decision_engine.validate_decision(
        {"decision": "direct_transfer", "confidence": 0.9, "reasoning": "ok"}
    )
    assert not ai_decision_engine.validate_decision(
        {"decision": "INVALID", "confidence": 0.9, "reasoning": "ok"}
    )
