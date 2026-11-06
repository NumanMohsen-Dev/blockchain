"""evidence and custody tables

Revision ID: 002_evidence_and_custody
Revises: 001_initial_users
Create Date: 2026-11-06 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_evidence_and_custody"
down_revision: Union[str, None] = "001_initial_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. evidence table
    op.create_table(
        "evidence",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("evidence_id", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("case_number", sa.String(length=100), nullable=False),
        sa.Column("collection_location", sa.String(length=255), nullable=False),
        sa.Column("collection_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("original_sha256", sa.String(length=66), nullable=False),
        sa.Column("initial_custodian_id", sa.Integer(), nullable=False),
        sa.Column("current_custodian_id", sa.Integer(), nullable=False),
        sa.Column("registration_status", sa.String(length=50), nullable=False),
        sa.Column("blockchain_transaction_hash", sa.String(length=66), nullable=True),
        sa.Column("blockchain_block_number", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["initial_custodian_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["current_custodian_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_filename"),
    )
    op.create_index(op.f("ix_evidence_id"), "evidence", ["id"], unique=False)
    op.create_index(op.f("ix_evidence_evidence_id"), "evidence", ["evidence_id"], unique=True)
    op.create_index(op.f("ix_evidence_category"), "evidence", ["category"], unique=False)
    op.create_index(op.f("ix_evidence_case_number"), "evidence", ["case_number"], unique=False)
    op.create_index(op.f("ix_evidence_original_sha256"), "evidence", ["original_sha256"], unique=False)
    op.create_index(op.f("ix_evidence_registration_status"), "evidence", ["registration_status"], unique=False)
    op.create_index(op.f("ix_evidence_blockchain_transaction_hash"), "evidence", ["blockchain_transaction_hash"], unique=False)

    # 2. transactions table
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("evidence_id", sa.String(length=64), nullable=False),
        sa.Column("transaction_hash", sa.String(length=66), nullable=False),
        sa.Column("transaction_type", sa.String(length=50), nullable=False),
        sa.Column("block_number", sa.Integer(), nullable=True),
        sa.Column("from_address", sa.String(length=42), nullable=True),
        sa.Column("to_address", sa.String(length=42), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["evidence_id"], ["evidence.evidence_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_transactions_id"), "transactions", ["id"], unique=False)
    op.create_index(op.f("ix_transactions_evidence_id"), "transactions", ["evidence_id"], unique=False)
    op.create_index(op.f("ix_transactions_transaction_hash"), "transactions", ["transaction_hash"], unique=True)
    op.create_index(op.f("ix_transactions_transaction_type"), "transactions", ["transaction_type"], unique=False)
    op.create_index(op.f("ix_transactions_block_number"), "transactions", ["block_number"], unique=False)

    # 3. integrity_checks table
    op.create_table(
        "integrity_checks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("evidence_id", sa.String(length=64), nullable=False),
        sa.Column("performed_by", sa.Integer(), nullable=False),
        sa.Column("calculated_hash", sa.String(length=66), nullable=False),
        sa.Column("blockchain_hash", sa.String(length=66), nullable=False),
        sa.Column("result", sa.String(length=50), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["evidence_id"], ["evidence.evidence_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["performed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_integrity_checks_id"), "integrity_checks", ["id"], unique=False)
    op.create_index(op.f("ix_integrity_checks_evidence_id"), "integrity_checks", ["evidence_id"], unique=False)
    op.create_index(op.f("ix_integrity_checks_result"), "integrity_checks", ["result"], unique=False)

    # 4. audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("resource_type", sa.String(length=64), nullable=False),
        sa.Column("resource_id", sa.String(length=64), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_id"), "audit_logs", ["id"], unique=False)
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_resource_type"), "audit_logs", ["resource_type"], unique=False)
    op.create_index(op.f("ix_audit_logs_resource_id"), "audit_logs", ["resource_id"], unique=False)


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("integrity_checks")
    op.drop_table("transactions")
    op.drop_table("evidence")

