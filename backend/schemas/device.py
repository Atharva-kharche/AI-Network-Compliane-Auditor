"""Pydantic schemas for device & config endpoints."""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class DeviceRead(BaseModel):
    """Response schema when returning device info."""
    id: int
    hostname: str
    vendor: str
    model: str
    os_version: str
    serial_number: str
    device_type: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ConfigFileRead(BaseModel):
    """Response schema for a config file record."""
    id: int
    device_id: int
    filename: str
    file_path: str
    raw_content: str
    normalized_config: Optional[Any] = None  # Will be parsed JSON when available
    parse_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceDetailRead(BaseModel):
    """Device with its associated config files."""
    id: int
    hostname: str
    vendor: str
    model: str
    os_version: str
    serial_number: str
    device_type: str
    uploaded_at: datetime
    config_files: list[ConfigFileRead] = []

    class Config:
        from_attributes = True


class UploadResponse(BaseModel):
    """Response after a successful file upload."""
    message: str
    device: DeviceRead
    config_file: ConfigFileRead
