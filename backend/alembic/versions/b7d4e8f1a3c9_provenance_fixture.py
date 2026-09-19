"""provenance_fixture

Revision ID: b7d4e8f1a3c9
Revises: a1f3c9d2b6e4
Create Date: 2026-09-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b7d4e8f1a3c9'
down_revision: Union[str, Sequence[str], None] = 'a1f3c9d2b6e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('payment_intents', sa.Column('provenance_fixture', sa.String(length=32), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('payment_intents', 'provenance_fixture')
