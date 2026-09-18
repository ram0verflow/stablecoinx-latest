"""
Telegram notification service for SettleGuard.
Sends formatted alerts for payment decisions and events.
"""

import logging
from typing import Optional, Any, Dict
from datetime import datetime, timezone
from telegram import Bot
from telegram.error import TelegramError

from app.core.config import settings

logger = logging.getLogger(__name__)


class TelegramNotificationService:
    """Service for sending Telegram notifications."""

    def __init__(self):
        """Initialize Telegram bot."""
        if not settings.TELEGRAM_BOT_TOKEN:
            logger.warning("TELEGRAM_BOT_TOKEN not configured")
            self.bot = None
        else:
            self.bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
        
        self.chat_id = settings.TELEGRAM_CHAT_ID or None

    async def send_notification(
        self,
        alert_type: str,
        payment_data: Dict[str, Any],
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Send formatted notification based on alert type.
        
        Args:
            alert_type: Type of alert (payment_approved, payment_blocked, etc)
            payment_data: Payment intent details
            extra_data: Additional data for specific alert types
            
        Returns:
            True if sent successfully, False otherwise
        """
        if not self.bot or not self.chat_id:
            logger.warning(
                f"Telegram not configured. Skipping notification: {alert_type}"
            )
            return False

        try:
            message = self._format_message(alert_type, payment_data, extra_data or {})
            
            if not message:
                logger.warning(f"Could not format message for alert type: {alert_type}")
                return False

            await self.bot.send_message(
                chat_id=self.chat_id,
                text=message,
                parse_mode="HTML"
            )
            logger.info(f"Telegram notification sent: {alert_type}")
            return True
            
        except TelegramError as e:
            logger.error(f"Telegram error sending {alert_type}: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending Telegram notification: {str(e)}")
            return False

    def _format_message(
        self,
        alert_type: str,
        payment_data: Dict[str, Any],
        extra_data: Dict[str, Any],
    ) -> Optional[str]:
        """
        Format notification message based on alert type.
        
        Args:
            alert_type: Type of alert
            payment_data: Payment details
            extra_data: Additional data
            
        Returns:
            Formatted message string or None
        """
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        
        if alert_type == "payment_approved":
            return self._format_approved_message(payment_data, timestamp)
        elif alert_type == "payment_blocked":
            return self._format_blocked_message(payment_data, extra_data, timestamp)
        elif alert_type == "review_needed":
            return self._format_review_message(payment_data, extra_data, timestamp)
        elif alert_type == "revalidation_triggered":
            return self._format_revalidation_message(extra_data, timestamp)
        elif alert_type == "settlement_executed":
            return self._format_settlement_message(payment_data, extra_data, timestamp)
        elif alert_type == "settlement_failed":
            return self._format_blocked_message(payment_data, extra_data, timestamp)
        else:
            logger.warning(f"Unknown alert type: {alert_type}")
            return None

    @staticmethod
    def _format_approved_message(
        payment_data: Dict[str, Any],
        timestamp: str,
    ) -> str:
        """Format payment approved message."""
        payment_id = str(payment_data.get("id", "unknown"))[:8]
        source = payment_data.get("source_country", "unknown")
        dest = payment_data.get("destination_country", "unknown")
        amount = payment_data.get("amount", "0")
        token = payment_data.get("token", "unknown")
        purpose = payment_data.get("purpose", "unknown")
        
        ai_decision = payment_data.get("ai_decision", "unknown")
        chain = payment_data.get("recommended_chain", payment_data.get("destination_chain", "unknown"))
        confidence = payment_data.get("confidence", "unknown")
        tx_hash = payment_data.get("tx_hash", "pending")
        if tx_hash and tx_hash != "pending":
            tx_hash = tx_hash[:12]

        return (
            f"✅ <b>PAYMENT APPROVED</b>\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"<b>Payment ID:</b> {payment_id}...\n"
            f"<b>Corridor:</b> {source} → {dest}\n"
            f"<b>Amount:</b> {amount} {token}\n"
            f"<b>Purpose:</b> {purpose}\n"
            f"<b>AI Decision:</b> {ai_decision}\n"
            f"<b>Chain:</b> {chain}\n"
            f"<b>Confidence:</b> {confidence}%\n"
            f"<b>TX Hash:</b> {tx_hash}...\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"<b>Time:</b> {timestamp}"
        )

    @staticmethod
    def _format_blocked_message(
        payment_data: Dict[str, Any],
        extra_data: Dict[str, Any],
        timestamp: str,
    ) -> str:
        """Format payment blocked message."""
        payment_id = str(payment_data.get("id", "unknown"))[:8]
        source = payment_data.get("source_country", "unknown")
        dest = payment_data.get("destination_country", "unknown")
        amount = payment_data.get("amount", "0")
        token = payment_data.get("token", "unknown")
        
        block_reason = extra_data.get("block_reason", "policy violation")
        policy_veto = extra_data.get("policy_veto_applied", "N/A")
        sanctions_hit = extra_data.get("sanctions_hit", "N/A")

        return (
            f"🚫 <b>PAYMENT BLOCKED</b>\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"<b>Payment ID:</b> {payment_id}...\n"
            f"<b>Corridor:</b> {source} → {dest}\n"
            f"<b>Amount:</b> {amount} {token}\n"
            f"<b>Block Reason:</b> {block_reason}\n"
            f"<b>Policy Veto:</b> {policy_veto}\n"
            f"<b>Sanctions Hit:</b> {sanctions_hit}\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"<b>Time:</b> {timestamp}"
        )

    @staticmethod
    def _format_review_message(
        payment_data: Dict[str, Any],
        extra_data: Dict[str, Any],
        timestamp: str,
    ) -> str:
        """Format manual review needed message."""
        payment_id = str(payment_data.get("id", "unknown"))[:8]
        source = payment_data.get("source_country", "unknown")
        dest = payment_data.get("destination_country", "unknown")
        amount = payment_data.get("amount", "0")
        token = payment_data.get("token", "unknown")
        
        review_reason = extra_data.get("review_reason", "compliance check required")
        risk_score = extra_data.get("wallet_risk_score", "unknown")
        ai_decision = payment_data.get("ai_decision", "unknown")

        return (
            f"⚠️ <b>MANUAL REVIEW REQUIRED</b>\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"<b>Payment ID:</b> {payment_id}...\n"
            f"<b>Corridor:</b> {source} → {dest}\n"
            f"<b>Amount:</b> {amount} {token}\n"
            f"<b>Review Reason:</b> {review_reason}\n"
            f"<b>Risk Score:</b> {risk_score}\n"
            f"<b>AI Decision:</b> {ai_decision}\n"
            f"<b>Awaiting:</b> Treasury Officer approval\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"<b>Time:</b> {timestamp}"
        )

    @staticmethod
    def _format_revalidation_message(
        extra_data: Dict[str, Any],
        timestamp: str,
    ) -> str:
        """Format revalidation triggered message."""
        count = extra_data.get("count", "unknown")
        reason = extra_data.get("trigger_reason", "policy change")

        return (
            f"🔁 <b>REVALIDATION TRIGGERED</b>\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"<b>Payments Affected:</b> {count}\n"
            f"<b>Trigger Reason:</b> {reason}\n"
            f"<b>Action Required:</b> Review flagged payments\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"<b>Time:</b> {timestamp}"
        )

    @staticmethod
    def _format_settlement_message(
        payment_data: Dict[str, Any],
        extra_data: Dict[str, Any],
        timestamp: str,
    ) -> str:
        """Format settlement executed message."""
        payment_id = str(payment_data.get("id", "unknown"))[:8]
        tx_hash = payment_data.get("tx_hash", "unknown")
        chain = extra_data.get("chain", payment_data.get("destination_chain", "unknown"))
        amount = payment_data.get("amount", "0")
        token = payment_data.get("token", "unknown")
        explorer_url = extra_data.get("explorer_url", "https://sepolia.basescan.org")

        return (
            f"⛓️ <b>SETTLEMENT EXECUTED ON-CHAIN</b>\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"<b>Payment ID:</b> {payment_id}...\n"
            f"<b>TX Hash:</b> {tx_hash}\n"
            f"<b>Chain:</b> {chain}\n"
            f"<b>Amount:</b> {amount} {token}\n"
            f"<b>Proof Registered:</b> ✅\n"
            f"━━━━━━━━━━━━━━━━\n"
            f"<b>Explorer:</b> <a href='{explorer_url}'>View on {chain}</a>\n"
            f"<b>Time:</b> {timestamp}"
        )


# Singleton instance
_telegram_service: Optional[TelegramNotificationService] = None


def get_telegram_service() -> TelegramNotificationService:
    """Get or create Telegram notification service."""
    global _telegram_service
    if _telegram_service is None:
        _telegram_service = TelegramNotificationService()
    return _telegram_service


async def send_notification(
    alert_type: str,
    payment_data: Dict[str, Any],
    extra_data: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Send a Telegram notification.
    
    Convenience function that uses the singleton service.
    """
    service = get_telegram_service()
    return await service.send_notification(alert_type, payment_data, extra_data)
