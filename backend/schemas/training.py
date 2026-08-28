"""Pydantic schemas for AI training interface endpoints."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class PendingTrainingItem(BaseModel):
    """An unrecognized config line awaiting admin mapping."""
    id: int
    vendor: str
    config_id: Optional[int] = None
    raw_command: str
    context_lines: Optional[str] = None
    ai_suggestion: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TrainingMapRequest(BaseModel):
    """Admin submission to map an unrecognized command."""
    mapping_id: int
    security_category: str
    normalized_key: str
    normalized_value: str


class TrainingMappingRead(BaseModel):
    """Full training mapping record."""
    id: int
    vendor: str
    config_id: Optional[int] = None
    raw_command: str
    context_lines: Optional[str] = None
    security_category: Optional[str] = None
    normalized_key: Optional[str] = None
    normalized_value: Optional[str] = None
    ai_suggestion: Optional[str] = None
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True
