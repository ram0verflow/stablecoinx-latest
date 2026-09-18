"""
n8n operations-automation webhook.

Fires a single POST to N8N_WEBHOOK_URL for each payment lifecycle event that
already triggers a Telegram alert (see alert_service.py). The n8n workflow on
the receiving end (`n8n-nodes-base.webhook`) routes the event to the right
recipient and sends an email through its own Send Email node — this service
only needs to deliver the event payload, not know anything about email.

Same fail-safe posture as the rest of the notification stack: a webhook
failure (timeout, non-2xx, n8n down) is logged and swallowed, never raised —
a notification outage must never affect the payment pipeline itself.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# alert_service.py's alert_type -> the event name the n8n workflow's
# "Build Email" Code node switches on.
EVENT_MAP = {
    "payment_blocked": "payment.blocked",
    "review_needed": "manual_review_required",
    "settlement_executed": "settlement.executed",
}


def send_event(
    alert_type: str,
    payment_data: Dict[str, Any],
    extra_data: Optional[Dict[str, Any]] = None,
) -> bool:
    """Fire the n8n webhook for a payment event. Returns True only on a 2xx."""
    event = EVENT_MAP.get(alert_type)
    if event is None:
        return False

    if not settings.N8N_WEBHOOK_URL:
        logger.debug(f"N8N_WEBHOOK_URL not configured, skipping n8n event: {event}")
        return False

    extra_data = extra_data or {}
    source = payment_data.get("source_country", "")
    dest = payment_data.get("destination_country", "")

    body = {
        "event": event,
        "payment_id": str(payment_data.get("id", "unknown")),
        "sender_company": payment_data.get("sender_company", source),
        "receiver_company": payment_data.get("receiver_company", dest),
        "amount": payment_data.get("amount"),
        "currency": payment_data.get("token", "USDC"),
        "corridor": f"{source} -> {dest}" if source or dest else "",
        "reason": (
            extra_data.get("block_reason")
            or extra_data.get("review_reason")
            or extra_data.get("trigger_reason")
            or ""
        ),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        resp = httpx.post(settings.N8N_WEBHOOK_URL, json=body, timeout=settings.N8N_WEBHOOK_TIMEOUT_SECONDS)
        if resp.status_code >= 300:
            logger.warning(f"n8n webhook returned {resp.status_code} for event {event}")
            return False
        logger.info(f"n8n event sent: {event} ({body['payment_id']})")
        return True
    except Exception as exc:
        logger.warning(f"n8n webhook failed for event {event}: {exc}")
        return False
