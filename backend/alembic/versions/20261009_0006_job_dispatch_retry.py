"""Track queue dispatch and delayed processing retries."""

import sqlalchemy as sa

from alembic import op

revision = "20261009_0006"
down_revision = "20261009_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("processing_jobs", sa.Column("next_attempt_at", sa.DateTime(timezone=True)))
    op.add_column("processing_jobs", sa.Column("dispatched_at", sa.DateTime(timezone=True)))
    op.create_index(
        "ix_processing_jobs_dispatch_scan",
        "processing_jobs",
        ["status", "dispatched_at", "next_attempt_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_processing_jobs_dispatch_scan", table_name="processing_jobs")
    op.drop_column("processing_jobs", "dispatched_at")
    op.drop_column("processing_jobs", "next_attempt_at")
