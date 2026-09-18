"""add_missing_decision_fields

Revision ID: 78ce42e7e48a
Revises: 3817d8d5448b
Create Date: 2026-05-01 05:34:03.570604

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '78ce42e7e48a'
down_revision: Union[str, Sequence[str], None] = '3817d8d5448b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # FIXED: C4
    op.create_table('approved_vendors',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('vendor_name', sa.String(length=255), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_approved_vendors_vendor_name'), 'approved_vendors', ['vendor_name'], unique=True)
    op.create_table('issuer_profiles',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('token', sa.String(length=16), nullable=False),
    sa.Column('issuer', sa.String(length=255), nullable=False),
    sa.Column('issuer_freeze_risk', sa.String(length=32), nullable=False),
    sa.Column('depeg_risk_score', sa.Float(), nullable=False),
    sa.Column('redemption_trust', sa.String(length=32), nullable=False),
    sa.Column('liquidity_depth', sa.String(length=32), nullable=False),
    sa.Column('regulatory_comfort', sa.String(length=32), nullable=False),
    sa.Column('recommendation', sa.String(length=32), nullable=False),
    sa.Column('score', sa.Float(), nullable=False),
    sa.Column('risk_level', sa.String(length=32), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_issuer_profiles_token'), 'issuer_profiles', ['token'], unique=True)
    op.create_table('treasury_department_budgets',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('purpose_key', sa.String(length=64), nullable=False),
    sa.Column('budget_limit', sa.Float(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_treasury_department_budgets_purpose_key'), 'treasury_department_budgets', ['purpose_key'], unique=True)
    op.add_column('compliance_decisions', sa.Column('treasury_controls_result', postgresql.JSON(astext_type=sa.Text()), nullable=True))
    op.add_column('compliance_decisions', sa.Column('compliance_result', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # FIXED: C4
    op.drop_column('compliance_decisions', 'compliance_result')
    op.drop_column('compliance_decisions', 'treasury_controls_result')
    op.drop_index(op.f('ix_treasury_department_budgets_purpose_key'), table_name='treasury_department_budgets')
    op.drop_table('treasury_department_budgets')
    op.drop_index(op.f('ix_issuer_profiles_token'), table_name='issuer_profiles')
    op.drop_table('issuer_profiles')
    op.drop_index(op.f('ix_approved_vendors_vendor_name'), table_name='approved_vendors')
    op.drop_table('approved_vendors')
