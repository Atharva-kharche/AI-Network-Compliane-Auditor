"""Training mapping ORM model for the human-in-the-loop AI feedback system."""

from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field, Column
import sqlalchemy as sa


class TrainingMapping(SQLModel, table=True):
    """Maps unrecognized config commands to normalized schema keys.

    When the AI parser encounters an unknown or low-confidence line,
    it gets queued here for an admin to manually map. Verified mappings
    are later injected as few-shot examples in future LLM prompts.
    """

    __tablename__ = "training_mappings"

    id: Optional[int] = Field(default=None, primary_key=True)
    vendor: str                            # e.g. sonic, arista, unknown
    config_id: Optional[int] = Field(default=None, foreign_key="config_files.id")
    raw_command: str = Field(sa_column=Column(sa.Text))  # the unrecognized CLI line
    context_lines: Optional[str] = Field(
        default=None, sa_column=Column(sa.Text)
    )  # surrounding lines for context
    security_category: Optional[str] = None  # admin-assigned: authentication, encryption, etc.
    normalized_key: Optional[str] = None     # e.g. ssh_version, password_min_length
    normalized_value: Optional[str] = None   # the extracted value
    ai_suggestion: Optional[str] = Field(
        default=None, sa_column=Column(sa.Text)
    )  # Gemini's best guess (JSON string)
    is_verified: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(sa.DateTime, default=sa.func.now()),
    )
