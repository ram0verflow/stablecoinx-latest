"""treasury_policy_issuer_cols

Revision ID: 4da2aae34291
Revises: 78ce42e7e48a
Create Date: 2026-05-01 06:04:08.518174

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4da2aae34291"
down_revision: Union[str, Sequence[str], None] = "78ce42e7e48a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("issuer_profiles", sa.Column("issuer_id", sa.String(length=64), nullable=True))
    op.add_column(
        "issuer_profiles",
        sa.Column("jurisdiction", sa.String(length=128), nullable=False, server_default=""),
    )
    op.add_column(
        "issuer_profiles",
        sa.Column("is_sanctioned", sa.Boolean(), nullable=False, server_default=sa.text("0")),
    )
    op.create_index(op.f("ix_issuer_profiles_issuer_id"), "issuer_profiles", ["issuer_id"], unique=True)

    op.create_table(
        "treasury_policies",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("department", sa.String(length=255), nullable=False),
        sa.Column("budget_limit", sa.Numeric(precision=24, scale=6), nullable=False),
        sa.Column("currency", sa.String(length=16), nullable=False),
        sa.Column("vendor_allowlist", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_treasury_policies_department"), "treasury_policies", ["department"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_treasury_policies_department"), table_name="treasury_policies")
    op.drop_table("treasury_policies")
    op.drop_index(op.f("ix_issuer_profiles_issuer_id"), table_name="issuer_profiles")
    op.drop_column("issuer_profiles", "is_sanctioned")
    op.drop_column("issuer_profiles", "jurisdiction")
    op.drop_column("issuer_profiles", "issuer_id")
