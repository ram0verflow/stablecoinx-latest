"""counterparty_intelligence

Revision ID: a1f3c9d2b6e4
Revises: 4da2aae34291
Create Date: 2026-09-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1f3c9d2b6e4'
down_revision: Union[str, Sequence[str], None] = '4da2aae34291'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('payment_intents', sa.Column('counterparty_name', sa.String(length=255), nullable=True))
    op.add_column('payment_intents', sa.Column('counterparty_type', sa.String(length=32), nullable=True))
    op.add_column('payment_intents', sa.Column('counterparty_wallet_address', sa.String(length=64), nullable=True))
    op.add_column('payment_intents', sa.Column('counterparty_chain', sa.String(length=100), nullable=True))
    op.add_column('payment_intents', sa.Column('counterparty_kyb_status', sa.String(length=16), nullable=True))
    op.add_column('payment_intents', sa.Column('counterparty_kyb_provider', sa.String(length=32), nullable=True))
    op.add_column('payment_intents', sa.Column('counterparty_attestation_id', sa.String(length=128), nullable=True))
    op.add_column('payment_intents', sa.Column('route_type', sa.String(length=32), nullable=True))
    op.add_column('payment_intents', sa.Column('route_provider', sa.String(length=64), nullable=True))
    op.add_column('payment_intents', sa.Column('source_wallet_visibility', sa.String(length=16), nullable=True))
    op.add_column('payment_intents', sa.Column('destination_tx_visibility', sa.String(length=16), nullable=True))
    op.add_column('payment_intents', sa.Column('origin_tx_visibility', sa.String(length=16), nullable=True))
    op.add_column('payment_intents', sa.Column('route_trace_completeness', sa.String(length=16), nullable=True))
    op.add_column('payment_intents', sa.Column('route_provenance_confidence', sa.String(length=16), nullable=True))
    op.add_column('payment_intents', sa.Column('route_evidence_notes', sa.Text(), nullable=True))
    op.add_column('compliance_decisions', sa.Column('counterparty_risk_result', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('compliance_decisions', 'counterparty_risk_result')
    op.drop_column('payment_intents', 'route_evidence_notes')
    op.drop_column('payment_intents', 'route_provenance_confidence')
    op.drop_column('payment_intents', 'route_trace_completeness')
    op.drop_column('payment_intents', 'origin_tx_visibility')
    op.drop_column('payment_intents', 'destination_tx_visibility')
    op.drop_column('payment_intents', 'source_wallet_visibility')
    op.drop_column('payment_intents', 'route_provider')
    op.drop_column('payment_intents', 'route_type')
    op.drop_column('payment_intents', 'counterparty_attestation_id')
    op.drop_column('payment_intents', 'counterparty_kyb_provider')
    op.drop_column('payment_intents', 'counterparty_kyb_status')
    op.drop_column('payment_intents', 'counterparty_chain')
    op.drop_column('payment_intents', 'counterparty_wallet_address')
    op.drop_column('payment_intents', 'counterparty_type')
    op.drop_column('payment_intents', 'counterparty_name')
