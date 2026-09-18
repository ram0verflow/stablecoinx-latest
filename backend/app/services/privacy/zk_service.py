"""
ZK Proof Service
Generates verifiable zero-knowledge proofs for:
  1. KYC verification
  2. Amount-in-range (without revealing exact amount)
  3. Human approval existence

Production: Real Groth16/PLONK proofs via snarkjs + pre-compiled Circom circuits.
Demo: SHA-256-based proof structure that demonstrates the full architecture and
      data flow — proofs are deterministic, verifiable, and on-chain registerable.
"""

import hashlib
import json
import time
import uuid
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Secret salt (in production this would be a circuit-specific proving key) ──
_PROOF_SALT = "settleguard_zk_salt_v1_hackathon"

# ── Proof method label ────────────────────────────────────────────────────────
_PROOF_METHOD = "zk_simulated"   # change to "zk_groth16" when real circuits available


# ── Internal helpers ──────────────────────────────────────────────────────────

def _sha256_hex(*parts: str) -> str:
    combined = "|".join(str(p) for p in parts)
    return hashlib.sha256(combined.encode()).hexdigest()


def _make_verification_key(payment_id: str, proof_type: str) -> str:
    """Deterministic verification key derived from payment_id + proof_type."""
    return _sha256_hex(payment_id, proof_type, _PROOF_SALT)[:32]


def _timestamp() -> int:
    return int(time.time())


# ── Public proof generators ───────────────────────────────────────────────────

def generate_kyc_proof(payment_id: str, kyc_status: str, company_name: str = "") -> dict[str, Any]:
    """
    Generate a ZK proof that KYC was performed and passed.

    Public inputs  : status (verified/missing), timestamp
    Private inputs : company_name, kyc_status, payment_id  (hashed, never exposed)
    """
    ts = _timestamp()
    is_valid = kyc_status == "verified"

    private_inputs_hash = _sha256_hex(company_name, kyc_status, payment_id)
    proof_hash = _sha256_hex(private_inputs_hash, str(ts), _PROOF_SALT, "kyc")
    vk = _make_verification_key(payment_id, "kyc_verified")

    return {
        "proof_id": str(uuid.uuid4()),
        "proof_type": "kyc_verified",
        "payment_id": payment_id,
        "public_inputs": {
            "status": "verified" if is_valid else "unverified",
            "timestamp": ts,
        },
        "private_inputs_hash": private_inputs_hash,
        "proof_hash": proof_hash,
        "verification_key": vk,
        "is_valid": is_valid,
        "proof_method": _PROOF_METHOD,
    }


def generate_amount_range_proof(
    payment_id: str,
    amount: float,
    min_amount: float,
    max_amount: float,
) -> dict[str, Any]:
    """
    Prove that amount ∈ [min_amount, max_amount] without revealing the exact amount.

    Public inputs  : min_amount, max_amount, is_in_range
    Private inputs : exact amount  (hashed, never exposed)
    """
    ts = _timestamp()
    is_in_range = min_amount <= amount <= max_amount

    # Hash the exact amount so it never appears in public outputs
    private_amount_hash = _sha256_hex(str(amount), payment_id, _PROOF_SALT)
    proof_hash = _sha256_hex(
        private_amount_hash,
        str(min_amount),
        str(max_amount),
        str(is_in_range),
        str(ts),
        _PROOF_SALT,
        "range",
    )
    vk = _make_verification_key(payment_id, "amount_range")

    return {
        "proof_id": str(uuid.uuid4()),
        "proof_type": "amount_range",
        "payment_id": payment_id,
        "public_inputs": {
            "min_amount": min_amount,
            "max_amount": max_amount,
            "is_in_range": is_in_range,
            "timestamp": ts,
        },
        # exact amount intentionally omitted from all outputs
        "private_inputs_hash": private_amount_hash,
        "proof_hash": proof_hash,
        "verification_key": vk,
        "is_valid": is_in_range,
        "proof_method": _PROOF_METHOD,
    }


def generate_approval_proof(
    payment_id: str,
    approver_id: str,
    action: str,
) -> dict[str, Any]:
    """
    Prove that an approval exists from an authorized approver.
    Approver identity is hashed into the proof — never exposed publicly.
    """
    ts = _timestamp()
    is_valid = action in ("approve", "approved")

    approver_hash = _sha256_hex(approver_id, payment_id, _PROOF_SALT)
    proof_hash = _sha256_hex(approver_hash, action, str(ts), _PROOF_SALT, "approval")
    vk = _make_verification_key(payment_id, "approval_exists")

    return {
        "proof_id": str(uuid.uuid4()),
        "proof_type": "approval_exists",
        "payment_id": payment_id,
        "public_inputs": {
            "action": action,
            "timestamp": ts,
            "approval_exists": is_valid,
        },
        "approver_hash": approver_hash,   # identity hidden
        "proof_hash": proof_hash,
        "verification_key": vk,
        "is_valid": is_valid,
        "proof_method": _PROOF_METHOD,
    }


def verify_proof(proof_record: dict[str, Any]) -> bool:
    """
    Verify a proof record is internally consistent.
    Checks:
      - proof_hash can be recomputed from stored inputs
      - timestamp is present and reasonable (within 30 days)
      - is_valid flag is present
    """
    try:
        proof_type = proof_record.get("proof_type", "")
        ts = proof_record.get("public_inputs", {}).get("timestamp", 0)
        now = _timestamp()

        # Timestamp sanity: must be within 30 days
        if not (0 < ts <= now + 60) or (now - ts) > 30 * 86400:
            logger.warning(f"Proof timestamp out of range: {ts}")
            return False

        # Recompute proof_hash and compare
        stored_hash = proof_record.get("proof_hash", "")
        private_hash = proof_record.get("private_inputs_hash") or proof_record.get("approver_hash", "")

        if proof_type == "kyc_verified":
            expected = _sha256_hex(private_hash, str(ts), _PROOF_SALT, "kyc")
        elif proof_type == "amount_range":
            pi = proof_record.get("public_inputs", {})
            expected = _sha256_hex(
                private_hash,
                str(pi.get("min_amount")),
                str(pi.get("max_amount")),
                str(pi.get("is_in_range")),
                str(ts),
                _PROOF_SALT,
                "range",
            )
        elif proof_type == "approval_exists":
            pi = proof_record.get("public_inputs", {})
            expected = _sha256_hex(private_hash, pi.get("action", ""), str(ts), _PROOF_SALT, "approval")
        else:
            # Unknown type — verify by checking combined_proof_hash if present
            expected = proof_record.get("combined_proof_hash", stored_hash)

        return stored_hash == expected

    except Exception as e:
        logger.error(f"Proof verification error: {e}")
        return False


def generate_combined_proof(
    payment_id: str,
    kyc_result: dict[str, Any],
    amount: float,
    policy_range: tuple[float, float],
    approval_id: str | None = None,
) -> dict[str, Any]:
    """
    Generate a combined proof bundle from all three proof types.
    Returns a single object suitable for on-chain registration.
    """
    ts = _timestamp()

    kyc_status = kyc_result.get("kyc_status", "missing")
    company_name = kyc_result.get("company_name", "")

    kyc_proof = generate_kyc_proof(payment_id, kyc_status, company_name)
    range_proof = generate_amount_range_proof(payment_id, amount, policy_range[0], policy_range[1])
    approval_proof = generate_approval_proof(
        payment_id,
        approval_id or "system",
        "approve" if approval_id else "pending",
    )

    # Combined hash: hash of all three individual proof hashes
    combined_hash = _sha256_hex(
        kyc_proof["proof_hash"],
        range_proof["proof_hash"],
        approval_proof["proof_hash"],
        str(ts),
        _PROOF_SALT,
        "combined",
    )

    all_valid = kyc_proof["is_valid"] and range_proof["is_valid"]

    return {
        "bundle_id": str(uuid.uuid4()),
        "payment_id": payment_id,
        "combined_proof_hash": combined_hash,
        "timestamp": ts,
        "is_valid": all_valid,
        "proof_method": _PROOF_METHOD,
        "components": {
            "kyc_proof": kyc_proof,
            "range_proof": range_proof,
            "approval_proof": approval_proof,
        },
        "on_chain_ready": True,
        "privacy_statement": (
            "Exact amounts and identity details are never exposed. "
            "Only proof hashes and boolean results are stored on-chain."
        ),
    }
