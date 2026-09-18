"""
Adapter onto the standalone `tools/obfuscation_classifier` package.

That tool is intentionally self-contained (stdlib-only, plain top-level
imports like `from schemas import ...`) so it works as a bare CLI with zero
install step — see tools/obfuscation_classifier/README.md. This adapter is
the ONLY place the backend reaches into it: it puts the tool's own directory
on sys.path (so its internal `from schemas import ...`-style imports keep
resolving exactly as they do when run standalone) and re-exports
`analyze_txid`. The tool's own files are never modified or duplicated here.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, Dict, Union

# backend/app/services/obfuscation/classifier_adapter.py -> repo root
_REPO_ROOT = Path(__file__).resolve().parents[4]
_TOOL_DIR = _REPO_ROOT / "tools" / "obfuscation_classifier"

if not (_TOOL_DIR / "classifier.py").exists():
    raise ImportError(
        f"obfuscation_classifier tool not found at {_TOOL_DIR} — "
        "expected tools/obfuscation_classifier/ at the repo root."
    )

if str(_TOOL_DIR) not in sys.path:
    sys.path.insert(0, str(_TOOL_DIR))

import classifier as _tool_classifier  # noqa: E402  (must follow sys.path bootstrap above)


def analyze_txid(txid: str) -> Union[Any, Dict[str, Any]]:
    """Thin passthrough to the standalone tool's analyze_txid()."""
    return _tool_classifier.analyze_txid(txid)


def analyze_txid_dict(txid: str) -> Dict[str, Any]:
    """Same as analyze_txid(), but always returns a plain dict — a
    ClassificationResult.to_dict() on success, or the tool's own
    {"error": true, ...} shape on failure. Convenient for API layers that
    just want JSON either way."""
    result = analyze_txid(txid)
    return result.to_dict() if hasattr(result, "to_dict") else result
