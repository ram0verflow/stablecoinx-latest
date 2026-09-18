"""
Normalized data model for the Protocol-Aware Obfuscation Classifier.

Deliberately plain stdlib dataclasses (no Pydantic, no third-party deps) so
this tool has zero install friction — `python run_demo.py --txid ...` works
with a bare Python 3.8+ interpreter, independent of the backend's venv.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class TxInput:
    prev_txid: Optional[str] = None
    prev_vout: Optional[int] = None
    value_sats: Optional[int] = None
    address: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "prev_txid": self.prev_txid,
            "prev_vout": self.prev_vout,
            "value_sats": self.value_sats,
            "address": self.address,
        }


@dataclass
class TxOutput:
    value_sats: Optional[int] = None
    address: Optional[str] = None
    scriptpubkey_type: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "value_sats": self.value_sats,
            "address": self.address,
            "scriptpubkey_type": self.scriptpubkey_type,
        }


def normalize_transaction(raw: Dict[str, Any]) -> "NormalizedTransaction":
    """
    Build a NormalizedTransaction from a raw Esplora-shaped API response
    (Blockstream or mempool.space — both use the same schema). Missing
    prevout/value/address fields are tolerated and become None rather than
    raising, since Esplora can omit `prevout` for old/pruned inputs.
    """
    vin = raw.get("vin") or []
    vout = raw.get("vout") or []

    inputs: List[TxInput] = []
    for v in vin:
        prevout = v.get("prevout") or {}
        inputs.append(
            TxInput(
                prev_txid=v.get("txid"),
                prev_vout=v.get("vout"),
                value_sats=prevout.get("value"),
                address=prevout.get("scriptpubkey_address"),
            )
        )

    outputs: List[TxOutput] = []
    for o in vout:
        outputs.append(
            TxOutput(
                value_sats=o.get("value"),
                address=o.get("scriptpubkey_address"),
                scriptpubkey_type=o.get("scriptpubkey_type"),
            )
        )

    status = raw.get("status") or {}

    return NormalizedTransaction(
        txid=raw.get("txid", ""),
        input_count=len(inputs),
        output_count=len(outputs),
        inputs=inputs,
        outputs=outputs,
        fee_sats=raw.get("fee"),
        block_height=status.get("block_height"),
        block_time=status.get("block_time"),
    )


@dataclass
class NormalizedTransaction:
    txid: str
    input_count: int
    output_count: int
    inputs: List[TxInput] = field(default_factory=list)
    outputs: List[TxOutput] = field(default_factory=list)
    fee_sats: Optional[int] = None
    block_height: Optional[int] = None
    block_time: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "txid": self.txid,
            "input_count": self.input_count,
            "output_count": self.output_count,
            "inputs": [i.to_dict() for i in self.inputs],
            "outputs": [o.to_dict() for o in self.outputs],
            "fee_sats": self.fee_sats,
            "block_height": self.block_height,
            "block_time": self.block_time,
        }


@dataclass
class ClassificationSignal:
    name: str
    passed: bool
    weight: int
    detail: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "passed": self.passed,
            "weight": self.weight,
            "detail": self.detail,
        }


# Always-present, non-negotiable scope limits. Every result carries these —
# see README's "This tool DOES NOT" section, which these mirror verbatim.
DEFAULT_LIMITS: List[str] = [
    "This identifies transaction structure, not user identity.",
    "This does not map inputs to outputs.",
    "This does not unmix funds.",
    "This does not imply illicit activity.",
    "This does not replace commercial blockchain intelligence.",
    (
        "Some collaborative transactions such as PayJoin can break ownership "
        "heuristics and should not be treated as illicit or mixer activity "
        "without additional evidence."
    ),
]

DEFAULT_POLICY_NOTE = (
    "High obfuscation confidence should trigger enhanced review, not "
    "automatic criminal labeling."
)


@dataclass
class ClassificationResult:
    txid: str
    classification: str
    protocol: str
    confidence: float
    obfuscation_confidence: str
    evidence: List[ClassificationSignal] = field(default_factory=list)
    evidence_against: List[str] = field(default_factory=list)
    classification_hint: Optional[str] = None
    checked_protocols: List[Dict[str, Any]] = field(default_factory=list)
    chart_data: Optional[Dict[str, Any]] = None
    separate_signals: Dict[str, str] = field(
        default_factory=lambda: {
            "illicit_attribution": "NOT_EVALUATED",
            "provenance_confidence": "NOT_EVALUATED",
        }
    )
    limits: List[str] = field(default_factory=lambda: list(DEFAULT_LIMITS))
    policy_note: str = DEFAULT_POLICY_NOTE

    def to_dict(self) -> Dict[str, Any]:
        out: Dict[str, Any] = {
            "txid": self.txid,
            "classification": self.classification,
            "protocol": self.protocol,
            "confidence": self.confidence,
            "obfuscation_confidence": self.obfuscation_confidence,
            "evidence": [e.to_dict() for e in self.evidence],
            "evidence_against": self.evidence_against,
        }
        # Only surface classification_hint when it's actually set (positive
        # Whirlpool matches don't need a fallback hint) — keeps the output
        # shape matching the two documented sample shapes exactly.
        if self.classification_hint is not None:
            out["classification_hint"] = self.classification_hint
        out["checked_protocols"] = self.checked_protocols
        out["chart_data"] = self.chart_data
        out["separate_signals"] = self.separate_signals
        out["limits"] = self.limits
        out["policy_note"] = self.policy_note
        return out
