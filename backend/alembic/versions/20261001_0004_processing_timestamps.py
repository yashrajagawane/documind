"""Add processing lifecycle timestamps and safe error codes.

Revision ID: 20261001_0004
Revises: 20261001_0003
"""

import sqlalchemy as sa

from alembic import op

revision = "20261001_0004"
down_revision = "20261001_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("processing_started_at", sa.DateTime(timezone=True)))
    op.add_column("documents", sa.Column("processing_completed_at", sa.DateTime(timezone=True)))
    op.add_column("processing_jobs", sa.Column("last_error", sa.String(length=64)))
    op.add_column("processing_jobs", sa.Column("started_at", sa.DateTime(timezone=True)))
    op.add_column("processing_jobs", sa.Column("completed_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("processing_jobs", "completed_at")
    op.drop_column("processing_jobs", "started_at")
    op.drop_column("processing_jobs", "last_error")
    op.drop_column("documents", "processing_completed_at")
    op.drop_column("documents", "processing_started_at")
