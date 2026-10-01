"""Add document upload idempotency metadata and owner indexes.

Revision ID: 20261001_0003
Revises: 20261001_0002
"""

import sqlalchemy as sa

from alembic import op

revision = "20261001_0003"
down_revision = "20261001_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("idempotency_key", sa.String(length=255), nullable=True))
    op.create_index(
        "ix_documents_user_created_at", "documents", ["user_id", "created_at"], unique=False
    )
    op.create_index(
        "ix_documents_user_status", "documents", ["user_id", "status"], unique=False
    )
    op.create_unique_constraint(
        "uq_documents_user_idempotency_key", "documents", ["user_id", "idempotency_key"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_documents_user_idempotency_key", "documents", type_="unique")
    op.drop_index("ix_documents_user_status", table_name="documents")
    op.drop_index("ix_documents_user_created_at", table_name="documents")
    op.drop_column("documents", "idempotency_key")
