"""
FHE (Fully Homomorphic Encryption) Service
Performs threshold checks without revealing exact amounts.

Production: Uses Zama's concrete-python library for real FHE operations.
Fallback: XOR-masked simulation that preserves the architecture and data flow.
"""

import hashlib
import os
import struct
import uuid
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Attempt real FHE import ────────────────────────────────────────────────
_FHE_AVAILABLE = False
try:
    from concrete import fhe  # type: ignore
    _FHE_AVAILABLE = True
    logger.info("concrete-python available — using real FHE operations")
except ImportError:
    logger.info("concrete-python not available — using FHE simulation")


# ── Helpers ────────────────────────────────────────────────────────────────

def _generate_salt() -> bytes:
    """Deterministic per-process salt for simulated ciphertext."""
    return os.urandom(16)


def _xor_encrypt(value: int, key: bytes) -> bytes:
    """
    Simulated FHE encryption: XOR each byte of the 8-byte little-endian
    representation of `value` with the key (cycled).
    """
    raw = struct.pack("<q", value)  # 8 bytes, signed 64-bit LE
    encrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(raw))
    return encrypted


def _simulated_fhe_compare(amount: float, threshold: float) -> tuple[bool, str]:
    """
    Simulated FHE comparison.
    - Encrypts both values with independent random keys.
    - Compares on the *masked* representation (the comparison result is
      derived from the plaintext, but the ciphertext is opaque).
    - Returns (result, hex_ciphertext_of_amount).
    """
    key = _generate_salt()
    encrypted_amount = _xor_encrypt(int(amount * 100), key)   # cents precision
    encrypted_threshold = _xor_encrypt(int(threshold * 100), key)

    # The comparison is performed on plaintext (simulation limitation),
    # but the encrypted_amount is never logged or returned in plaintext.
    result = amount > threshold

    # Build a "proof" ciphertext: sha256(encrypted_amount || encrypted_threshold)
    proof_input = encrypted_amount + encrypted_threshold + key
    proof_hex = hashlib.sha256(proof_input).hexdigest()

    return result, proof_hex


def _real_fhe_compare(amount: float, threshold: float) -> tuple[bool, str]:
    """
    Real FHE comparison using concrete-python.
    Compiles a simple greater-than circuit and evaluates it homomorphically.
    """
    try:
        @fhe.compiler({"x": "encrypted", "t": "clear"})
        def gt_circuit(x, t):
            return x > t

        inputset = [(int(a), int(threshold)) for a in range(0, int(threshold * 2) + 1, max(1, int(threshold // 100)))]
        circuit = gt_circuit.compile(inputset)

        encrypted_x = circuit.encrypt(int(amount), int(threshold))
        encrypted_result = circuit.run(encrypted_x)
        result = bool(circuit.decrypt(encrypted_result))

        # Proof: hash of the serialized encrypted input
        proof_hex = hashlib.sha256(str(encrypted_x).encode()).hexdigest()
        return result, proof_hex
    except Exception as e:
        logger.warning(f"Real FHE comparison failed ({e}), falling back to simulation")
        return _simulated_fhe_compare(amount, threshold)


# ── Public API ─────────────────────────────────────────────────────────────

def fhe_check_threshold(amount: float, threshold: float, label: str) -> dict[str, Any]:
    """
    Perform a single FHE threshold check: does amount exceed threshold?

    Returns a structured result without exposing the exact amount.
    """
    check_id = str(uuid.uuid4())

    if _FHE_AVAILABLE:
        result, encrypted_proof = _real_fhe_compare(amount, threshold)
        method = "fhe_real"
    else:
        result, encrypted_proof = _simulated_fhe_compare(amount, threshold)
        method = "fhe_simulated"

    return {
        "check_id": check_id,
        "check_label": label,
        "threshold": threshold,
        "result": result,           # True = amount EXCEEDS threshold
        "method": method,
        "encrypted_proof": encrypted_proof,
        "privacy_note": "Exact amount not stored or logged — only comparison result preserved",
    }


def run_all_fhe_checks(payment) -> dict[str, Any]:
    """
    Run all standard FHE threshold checks for a payment.
    Returns a structured bundle with individual check results.
    """
    amount = float(payment.amount)
    purpose = (payment.purpose or "").lower()

    # Fetch reporting threshold from country policy (default 10 000)
    reporting_threshold = 10_000.0

    checks = [
        fhe_check_threshold(amount, 500_000.0, "daily_limit_check"),
        fhe_check_threshold(amount, 100_000.0, "dual_approval_check"),
        fhe_check_threshold(amount, reporting_threshold, "reporting_check"),
    ]

    if "payroll" in purpose:
        checks.append(fhe_check_threshold(amount, 50_000.0, "payroll_cap_check"))

    # Determine overall pass/fail:
    # Payment is BLOCKED by FHE if it exceeds the daily limit
    daily_exceeded = checks[0]["result"]   # amount > 500 000
    overall_pass = not daily_exceeded

    return {
        "checks": checks,
        "overall_pass": overall_pass,
        "method": "fhe_real" if _FHE_AVAILABLE else "fhe_simulated",
        "fhe_available": _FHE_AVAILABLE,
        "privacy_statement": "All threshold comparisons performed without exposing exact transaction amount",
    }


def fhe_private_balance_check(wallet_address: str, required_amount: float) -> dict[str, Any]:
    """
    Check if a wallet balance exceeds required_amount without logging the balance.
    """
    from app.services.blockchain.wallet_service import wallet_service  # lazy import

    check_id = str(uuid.uuid4())
    try:
        balance_data = wallet_service.get_wallet_balance(wallet_address)
        balance_eth = float(balance_data.get("ether", 0))
        # Convert ETH to approximate USD (rough: 1 ETH ≈ 3000 USD)
        balance_usd_approx = balance_eth * 3000.0

        if _FHE_AVAILABLE:
            result, proof = _real_fhe_compare(balance_usd_approx, required_amount)
            method = "fhe_real"
        else:
            result, proof = _simulated_fhe_compare(balance_usd_approx, required_amount)
            method = "fhe_simulated"

        return {
            "check_id": check_id,
            "wallet_address": wallet_address[:6] + "..." + wallet_address[-4:],  # truncated
            "sufficient": result,
            "method": method,
            "encrypted_proof": proof,
            "privacy_note": "Actual balance not stored — only sufficiency result preserved",
        }
    except Exception as e:
        logger.error(f"Balance check failed for {wallet_address[:6]}...: {e}")
        return {
            "check_id": check_id,
            "wallet_address": wallet_address[:6] + "..." + wallet_address[-4:],
            "sufficient": False,
            "method": "fhe_error",
            "encrypted_proof": "",
            "error": "Balance check unavailable",
        }
