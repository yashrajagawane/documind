"""Add a fencing token to processing job leases."""

import sqlalchemy as sa

from alembic import op

revision = "20261009_0005"
down_revision = "20261001_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("processing_jobs", sa.Column("lease_token", sa.Uuid(), nullable=True))
    op.create_index(
        "ix_processing_jobs_lease_token", "processing_jobs", ["lease_token"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_processing_jobs_lease_token", table_name="processing_jobs")
    op.drop_column("processing_jobs", "lease_token")
