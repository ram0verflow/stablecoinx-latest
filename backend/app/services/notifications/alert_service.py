"""
Alert service for creating and managing alerts in the system.
Integrates with Telegram notifications and database storage.
"""

import logging
from typing import Optional, Any, Dict, List
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.alerts import Alert, AlertType
from app.models.payment_intents import PaymentIntent
from app.services.notifications.telegram_service import get_telegram_service

logger = logging.getLogger(__name__)

ALERT_TYPE_MAP = {
    "payment_approved": AlertType.approved,
    "payment_blocked": AlertType.blocked,
    "review_needed": AlertType.review_needed,
    "revalidation_triggered": AlertType.revalidation_triggered,
    "settlement_executed": AlertType.settlement_executed,
    "settlement_failed": AlertType.settlement_failed,
}


class AlertService:
    """Service for managing system alerts."""

    @staticmethod
    async def create_alert(
        db: Session,
        payment_id: Optional[UUID],
        alert_type: str,
        message: str,
    ) -> Optional[Alert]:
        """
        Create an alert and optionally send Telegram notification.
        
        Args:
            db: Database session
            payment_id: Associated payment ID (can be None for system alerts)
            alert_type: Type of alert (approved, blocked, review_needed, etc)
            message: Alert message
            
        Returns:
            Created alert or None
        """
        try:
            mapped_type = ALERT_TYPE_MAP.get(
                alert_type,
                AlertType[alert_type] if alert_type in AlertType.__members__ else AlertType.review_needed
            )
            
            # Create alert record
            alert = Alert(
                payment_id=payment_id,
                alert_type=mapped_type,
                message=message,
                is_read=False,
            )
            
            db.add(alert)
            db.commit()
            db.refresh(alert)
            
            logger.info(f"Alert created: {alert.id} ({alert_type})")
            return alert
            
        except ValueError as e:
            logger.error(f"Invalid alert type: {alert_type} - {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Error creating alert: {str(e)}")
            db.rollback()
            return None

    @staticmethod
    async def send_payment_alert(
        db: Session,
        alert_type: str,
        payment_id: UUID,
        payment_data: Dict[str, Any],
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Create alert and send Telegram notification for payment event.
        
        Args:
            db: Database session
            alert_type: Type of alert
            payment_id: Payment intent ID
            payment_data: Payment details
            extra_data: Additional data for notification
            
        Returns:
            True if successful
        """
        try:
            # Prepare alert message for database
            alert_message = AlertService._format_alert_message(
                alert_type, payment_data, extra_data or {}
            )
            
            # Create database alert
            await AlertService.create_alert(
                db=db,
                payment_id=payment_id,
                alert_type=alert_type,
                message=alert_message,
            )
            
            # Send Telegram notification
            telegram_service = get_telegram_service()
            await telegram_service.send_notification(
                alert_type=alert_type,
                payment_data={
                    **payment_data,
                    "id": str(payment_id),
                },
                extra_data=extra_data,
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending payment alert: {str(e)}")
            return False

    @staticmethod
    def mark_as_read(db: Session, alert_id: UUID) -> bool:
        """Mark an alert as read."""
        try:
            alert = db.query(Alert).filter(Alert.id == alert_id).first()
            if alert:
                alert.is_read = True
                db.commit()
                return True
            return False
        except Exception as e:
            logger.error(f"Error marking alert as read: {str(e)}")
            db.rollback()
            return False

    @staticmethod
    def get_unread_alerts(
        db: Session,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Alert]:
        """Get unread alerts."""
        try:
            return (
                db.query(Alert)
                .filter(Alert.is_read == False)
                .order_by(desc(Alert.created_at))
                .limit(limit)
                .offset(offset)
                .all()
            )
        except Exception as e:
            logger.error(f"Error fetching unread alerts: {str(e)}")
            return []

    @staticmethod
    def get_alerts_by_payment(
        db: Session,
        payment_id: UUID,
    ) -> List[Alert]:
        """Get all alerts for a payment."""
        try:
            return (
                db.query(Alert)
                .filter(Alert.payment_id == payment_id)
                .order_by(desc(Alert.created_at))
                .all()
            )
        except Exception as e:
            logger.error(f"Error fetching alerts for payment: {str(e)}")
            return []

    @staticmethod
    def get_alerts_by_type(
        db: Session,
        alert_type: str,
        limit: int = 50,
    ) -> List[Alert]:
        """Get alerts by type."""
        try:
            return (
                db.query(Alert)
                .filter(Alert.alert_type == AlertType(alert_type))
                .order_by(desc(Alert.created_at))
                .limit(limit)
                .all()
            )
        except Exception as e:
            logger.error(f"Error fetching alerts by type: {str(e)}")
            return []

    @staticmethod
    def _format_alert_message(
        alert_type: str,
        payment_data: Dict[str, Any],
        extra_data: Dict[str, Any],
    ) -> str:
        """Format alert message for database storage."""
        source = payment_data.get("source_country", "unknown")
        dest = payment_data.get("destination_country", "unknown")
        amount = payment_data.get("amount", "0")
        token = payment_data.get("token", "unknown")

        if alert_type == "payment_approved":
            ai_decision = extra_data.get("ai_decision", "direct_transfer")
            return (
                f"Payment approved: {source} → {dest}, "
                f"{amount} {token} ({ai_decision})"
            )
        elif alert_type == "payment_blocked":
            reason = extra_data.get("block_reason", "policy violation")
            return (
                f"Payment blocked: {source} → {dest}, "
                f"{amount} {token} - Reason: {reason}"
            )
        elif alert_type == "review_needed":
            return (
                f"Review needed: {source} → {dest}, "
                f"{amount} {token} - Risk score: "
                f"{extra_data.get('wallet_risk_score', 'unknown')}"
            )
        elif alert_type == "revalidation_triggered":
            return (
                f"Revalidation triggered for {extra_data.get('count', 'unknown')} "
                f"payments - Reason: {extra_data.get('trigger_reason', 'policy change')}"
            )
        elif alert_type == "settlement_executed":
            tx_hash = extra_data.get("tx_hash", "N/A")
            return (
                f"Settlement executed: {source} → {dest}, "
                f"{amount} {token} - TX: {tx_hash}"
            )
        elif alert_type == "settlement_failed":
            reason = extra_data.get("block_reason", "execution failure")
            return (
                f"Settlement failed: {source} → {dest}, "
                f"{amount} {token} - Reason: {reason}"
            )
        else:
            return f"Alert: {alert_type}"
