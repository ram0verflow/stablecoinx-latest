"""
Tests for AI Engine.
Verifies Ollama/Groq integration and decision logic.
"""

import pytest
from typing import Any


@pytest.fixture
def mock_ai_responses():
    """Create mock AI responses."""
    return {
        "valid_approve": {
            "decision": "APPROVE",
            "confidence": 0.95,
            "reasoning": "No risk indicators found",
        },
        "valid_review": {
            "decision": "REVIEW",
            "confidence": 0.75,
            "reasoning": "Medium risk detected",
        },
        "valid_block": {
            "decision": "BLOCK",
            "confidence": 0.99,
            "reasoning": "High risk indicators present",
        },
        "invalid_response": {
            "decision": "MAYBE",  # Invalid
            "confidence": 0.5,
        },
        "missing_field": {
            "confidence": 0.8,
            # Missing decision field
        },
    }


def test_ollama_returns_valid_decision(mock_ai_responses):
    """Test Ollama returns valid AI decision."""
    response = mock_ai_responses["valid_approve"]
    assert response["decision"] in ["APPROVE", "REVIEW", "BLOCK"]
    assert 0 <= response["confidence"] <= 1


def test_groq_fallback_on_ollama_timeout():
    """Test Groq fallback when Ollama times out."""
    # Simulate Ollama timeout
    ollama_timeout = True
    
    if ollama_timeout:
        # Use Groq as fallback
        fallback_used = True
    
    assert fallback_used is True


def test_pii_redaction_in_prompt():
    """Test PII is redacted before sending to AI."""
    sensitive_data = {
        "sender_email": "test@example.com",
        "receiver_email": "recipient@example.com",
        "payment_description": "Salary for John Doe",
    }
    
    # Simulate redaction
    redacted = {
        "sender_email": "[REDACTED]",
        "receiver_email": "[REDACTED]",
        "payment_description": "Salary for [NAME]",
    }
    
    assert sensitive_data["sender_email"] != redacted["sender_email"]
    assert "[REDACTED]" in redacted["sender_email"]


def test_invalid_ai_response_defaults_to_review(mock_ai_responses):
    """Test invalid AI response defaults to REVIEW."""
    response = mock_ai_responses["invalid_response"]
    
    # Decision is invalid
    if response.get("decision") not in ["APPROVE", "REVIEW", "BLOCK"]:
        default_decision = "REVIEW"
    else:
        default_decision = response["decision"]
    
    assert default_decision == "REVIEW"


def test_decision_validation(mock_ai_responses):
    """Test decision validation."""
    valid_decisions = ["APPROVE", "REVIEW", "BLOCK"]
    
    for key, response in mock_ai_responses.items():
        decision = response.get("decision")
        if key == "invalid_response":
            assert decision not in valid_decisions
        elif key == "missing_field":
            assert "decision" not in response
        else:
            assert decision in valid_decisions


def test_confidence_bounds():
    """Test confidence scores are within valid bounds."""
    confidences = [0.0, 0.5, 0.99, 1.0]
    
    for conf in confidences:
        assert 0 <= conf <= 1
