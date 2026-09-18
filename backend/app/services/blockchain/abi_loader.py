"""Shared Foundry / committed ABI loading for Web3 contracts."""  # FIXED: C1
from __future__ import annotations  # FIXED: C1

import json  # FIXED: C1
import logging  # FIXED: C1
import os  # FIXED: C1
from typing import Any, Dict, List  # FIXED: C1

from app.core.config import settings  # FIXED: C1

logger = logging.getLogger(__name__)  # FIXED: C1


def load_contract_abi(contract_artifact_name: str) -> List[Dict[str, Any]]:  # FIXED: C1
    """Load ABI for a Foundry artifact name (e.g. settings-driven map value)."""  # FIXED: C1
    current_dir = os.path.dirname(os.path.abspath(__file__))  # FIXED: C1
    project_root = os.path.abspath(os.path.join(current_dir, "..", "..", "..", ".."))  # FIXED: C1
    forge_path = os.path.join(  # FIXED: C1
        project_root,  # FIXED: C1
        settings.CONTRACT_ABI_PATH,  # FIXED: C1
        f"{contract_artifact_name}.sol",  # FIXED: C1
        f"{contract_artifact_name}.json",  # FIXED: C1
    )  # FIXED: C1
    committed_path = os.path.join(project_root, "contracts", "abis", f"{contract_artifact_name}.json")  # FIXED: C1
    for resolved in (forge_path, committed_path):  # FIXED: C1
        if os.path.isfile(resolved):  # FIXED: C1
            with open(resolved, "r", encoding="utf-8") as fh:  # FIXED: C1
                data = json.load(fh)  # FIXED: C1
            if "abi" not in data:  # FIXED: C1
                raise ValueError(f"ABI key missing in artifact: {resolved}")  # FIXED: C1
            logger.info("ABI loaded from %s", resolved)  # FIXED: C1
            return data["abi"]  # FIXED: C1
    raise FileNotFoundError(  # FIXED: C1
        f"No ABI for artifact {contract_artifact_name!r}. Tried forge path and contracts/abis fallback."  # FIXED: C1
    )  # FIXED: C1
