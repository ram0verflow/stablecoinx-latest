"""
"Deploy" a team's policy to n8n.

Honesty constraint, same posture as services/mixer_signals/evm_provider.py:
n8n's own REST API (which could programmatically create one workflow per
team) requires an API key generated from inside the n8n UI (Settings ->
n8n API), which isn't configured here — so this does NOT fabricate a
"workflow created" result. What it does instead is genuinely real: fires
a live webhook POST to the same N8N_WEBHOOK_URL already used for payment
lifecycle alerts (see services/notifications/n8n_service.py), with a new
event type carrying the compiled ruleset. A real n8n workflow with a
webhook trigger node on that URL receives this exact payload and can act
on it (e.g. log it, store it, or fan it out) — this is a genuine
integration, not a simulated one, just narrower than "n8n creates and
manages the workflow itself" until an n8n API key is supplied.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def deploy_policy_to_n8n(team_name: str, team_slug: str, rules: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not settings.N8N_WEBHOOK_URL:
        return {
            "status": "not_configured",
            "detail": "N8N_WEBHOOK_URL is not configured — the policy was saved but not pushed to n8n.",
        }

    body = {
        "event": "policy.deployed",
        "team": team_name,
        "team_slug": team_slug,
        "rule_count": len(rules),
        "rules": [
            {"name": r["name"], "action": r["action"], "priority": r["priority"], "when": r["when"]}
            for r in rules
        ],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        resp = httpx.post(settings.N8N_WEBHOOK_URL, json=body, timeout=settings.N8N_WEBHOOK_TIMEOUT_SECONDS)
        if resp.status_code >= 300:
            logger.warning(f"n8n policy deploy webhook returned {resp.status_code} for team {team_slug}")
            return {"status": "failed", "detail": f"n8n webhook returned HTTP {resp.status_code}"}
        logger.info(f"Policy deployed to n8n for team {team_slug} ({len(rules)} rules)")
        return {"status": "sent", "detail": f"Delivered {len(rules)} rule(s) to {settings.N8N_WEBHOOK_URL}"}
    except Exception as exc:
        logger.warning(f"n8n policy deploy webhook failed for team {team_slug}: {exc}")
        return {"status": "failed", "detail": f"n8n webhook unreachable: {exc}"}
