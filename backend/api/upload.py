"""Upload API — config file upload and device management endpoints."""

import json
import shutil
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models.device import Device, ConfigFile
from schemas.device import DeviceRead, ConfigFileRead, UploadResponse, DeviceDetailRead
from services import extract_device_info
from services.normalizer import normalize_config, apply_verified_mappings
from services.ai_engine import parse_config_with_ai
from models.training import TrainingMapping
from config import settings

router = APIRouter(prefix="/api/v1", tags=["Upload & Devices"])


@router.post("/upload", response_model=UploadResponse)
async def upload_config(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """Upload a single network device configuration file.

    Accepts .txt, .conf, .cfg, .json files. Automatically detects the vendor,
    extracts device metadata, and normalizes the config.
    """
    # Validate file extension
    allowed_extensions = {".txt", ".conf", ".cfg", ".json"}
    suffix = Path(file.filename).suffix.lower()
    if suffix not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(allowed_extensions)}",
        )

    # Read file content
    raw_content = (await file.read()).decode("utf-8", errors="replace")

    # Save the file to disk
    settings.ensure_dirs()
    save_path = settings.UPLOAD_DIR / file.filename
    with open(save_path, "w", encoding="utf-8") as f:
        f.write(raw_content)

    # Extract device info
    device_info = extract_device_info(raw_content)

    # Create Device record
    device = Device(
        hostname=device_info["hostname"],
        vendor=device_info["vendor"],
        model=device_info["model"],
        os_version=device_info["os_version"],
        serial_number=device_info["serial_number"],
        device_type=device_info["device_type"],
    )
    session.add(device)
    session.commit()
    session.refresh(device)

    # Normalize config
    normalized, parse_status = normalize_config(
        raw_content, device_info["vendor"], device_info
    )

    queued_items = 0

    # If the vendor is unknown or needs AI, try AI parsing / unknown command detection
    if parse_status == "needs_ai":
        # Get existing verified mappings for few-shot prompt
        verified_stmt = select(TrainingMapping).where(
            TrainingMapping.vendor == device_info["vendor"],
            TrainingMapping.is_verified == True,
        )
        verified_mappings = [
            m.model_dump() for m in session.exec(verified_stmt).all()
        ]

        ai_result, uncertain = await parse_config_with_ai(
            raw_content, device_info["vendor"], verified_mappings
        )
        if ai_result:
            for section_key, section_val in ai_result.items():
                if isinstance(section_val, dict) and section_key in normalized:
                    for k, v in section_val.items():
                        if v is not None:
                            normalized[section_key][k] = v
                elif section_key not in ("uncertain", "device"):
                    normalized[section_key] = section_val

        # Handle uncertain / unrecognized lines
        if uncertain:
            for item in uncertain:
                raw_cmd = item.get("raw_line", "").strip()
                if not raw_cmd:
                    continue

                # Check if this command is already verified
                existing_verified = session.exec(
                    select(TrainingMapping).where(
                        TrainingMapping.vendor == device_info["vendor"],
                        TrainingMapping.raw_command == raw_cmd,
                        TrainingMapping.is_verified == True,
                    )
                ).first()

                if existing_verified:
                    continue  # Already learned, no need to queue

                # Check if it is already in pending queue
                existing_pending = session.exec(
                    select(TrainingMapping).where(
                        TrainingMapping.vendor == device_info["vendor"],
                        TrainingMapping.raw_command == raw_cmd,
                        TrainingMapping.is_verified == False,
                    )
                ).first()

                if not existing_pending:
                    mapping = TrainingMapping(
                        vendor=device_info["vendor"],
                        config_id=None,  # Will update after saving config
                        raw_command=raw_cmd,
                        context_lines=item.get("context", ""),
                        security_category=item.get("category"),
                        normalized_key=item.get("best_guess_key"),
                        normalized_value=str(item.get("best_guess_value", "")) if item.get("best_guess_value") is not None else None,
                        ai_suggestion=json.dumps(item),
                        is_verified=False,
                    )
                    session.add(mapping)
                    queued_items += 1
                else:
                    queued_items += 1

    # Overlay any verified mappings onto normalized config
    normalized = apply_verified_mappings(normalized, device_info["vendor"], session)

    parse_status = "needs_training" if queued_items > 0 else "parsed"

    # Create ConfigFile record
    config_file = ConfigFile(
        device_id=device.id,
        filename=file.filename,
        file_path=str(save_path),
        raw_content=raw_content,
        normalized_config=json.dumps(normalized),
        parse_status=parse_status,
    )
    session.add(config_file)
    session.commit()
    session.refresh(config_file)

    # Associate unassigned pending training items with this config_id
    if queued_items > 0:
        stmt = select(TrainingMapping).where(
            TrainingMapping.config_id == None,
            TrainingMapping.vendor == device_info["vendor"],
        )
        for mapping in session.exec(stmt):
            mapping.config_id = config_file.id
        session.commit()

    return UploadResponse(
        message=f"Config uploaded successfully. Vendor: {device_info['vendor']}, Status: {parse_status}",
        device=DeviceRead.model_validate(device),
        config_file=ConfigFileRead.model_validate(config_file),
    )


@router.post("/upload/bulk", response_model=list[UploadResponse])
async def upload_bulk(
    files: list[UploadFile] = File(...),
    session: Session = Depends(get_session),
):
    """Upload multiple config files at once.

    Processes each file through the same pipeline as single upload.
    Returns a list of results for each file.
    """
    results = []
    allowed_extensions = {".txt", ".conf", ".cfg", ".json"}

    for file in files:
        suffix = Path(file.filename).suffix.lower()
        if suffix not in allowed_extensions:
            continue  # Skip unsupported files silently in bulk mode

        raw_content = (await file.read()).decode("utf-8", errors="replace")

        settings.ensure_dirs()
        save_path = settings.UPLOAD_DIR / file.filename
        with open(save_path, "w", encoding="utf-8") as f:
            f.write(raw_content)

        device_info = extract_device_info(raw_content)

        device = Device(
            hostname=device_info["hostname"],
            vendor=device_info["vendor"],
            model=device_info["model"],
            os_version=device_info["os_version"],
            serial_number=device_info["serial_number"],
            device_type=device_info["device_type"],
        )
        session.add(device)
        session.commit()
        session.refresh(device)

        normalized, parse_status = normalize_config(
            raw_content, device_info["vendor"], device_info
        )

        queued_items = 0

        if parse_status == "needs_ai":
            verified_stmt = select(TrainingMapping).where(
                TrainingMapping.vendor == device_info["vendor"],
                TrainingMapping.is_verified == True,
            )
            verified_mappings = [
                m.model_dump() for m in session.exec(verified_stmt).all()
            ]

            ai_result, uncertain = await parse_config_with_ai(
                raw_content, device_info["vendor"], verified_mappings
            )
            if ai_result:
                for section_key, section_val in ai_result.items():
                    if isinstance(section_val, dict) and section_key in normalized:
                        for k, v in section_val.items():
                            if v is not None:
                                normalized[section_key][k] = v
                    elif section_key not in ("uncertain", "device"):
                        normalized[section_key] = section_val

            if uncertain:
                for item in uncertain:
                    raw_cmd = item.get("raw_line", "").strip()
                    if not raw_cmd:
                        continue

                    existing_verified = session.exec(
                        select(TrainingMapping).where(
                            TrainingMapping.vendor == device_info["vendor"],
                            TrainingMapping.raw_command == raw_cmd,
                            TrainingMapping.is_verified == True,
                        )
                    ).first()

                    if existing_verified:
                        continue

                    existing_pending = session.exec(
                        select(TrainingMapping).where(
                            TrainingMapping.vendor == device_info["vendor"],
                            TrainingMapping.raw_command == raw_cmd,
                            TrainingMapping.is_verified == False,
                        )
                    ).first()

                    if not existing_pending:
                        mapping = TrainingMapping(
                            vendor=device_info["vendor"],
                            config_id=None,
                            raw_command=raw_cmd,
                            context_lines=item.get("context", ""),
                            security_category=item.get("category"),
                            normalized_key=item.get("best_guess_key"),
                            normalized_value=str(item.get("best_guess_value", "")) if item.get("best_guess_value") is not None else None,
                            ai_suggestion=json.dumps(item),
                            is_verified=False,
                        )
                        session.add(mapping)
                        queued_items += 1
                    else:
                        queued_items += 1

        normalized = apply_verified_mappings(normalized, device_info["vendor"], session)
        parse_status = "needs_training" if queued_items > 0 else "parsed"

        config_file = ConfigFile(
            device_id=device.id,
            filename=file.filename,
            file_path=str(save_path),
            raw_content=raw_content,
            normalized_config=json.dumps(normalized),
            parse_status=parse_status,
        )
        session.add(config_file)
        session.commit()
        session.refresh(config_file)

        if queued_items > 0:
            stmt = select(TrainingMapping).where(
                TrainingMapping.config_id == None,
                TrainingMapping.vendor == device_info["vendor"],
            )
            for mapping in session.exec(stmt):
                mapping.config_id = config_file.id
            session.commit()

        results.append(UploadResponse(
            message=f"Uploaded {file.filename}: {device_info['vendor']}, {parse_status}",
            device=DeviceRead.model_validate(device),
            config_file=ConfigFileRead.model_validate(config_file),
        ))

    return results


@router.get("/devices", response_model=list[DeviceRead])
def list_devices(session: Session = Depends(get_session)):
    """List all ingested devices."""
    devices = session.exec(select(Device).order_by(Device.uploaded_at.desc())).all()
    return devices


@router.get("/devices/{device_id}", response_model=DeviceDetailRead)
def get_device(device_id: int, session: Session = Depends(get_session)):
    """Get device details including its config files."""
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    configs = session.exec(
        select(ConfigFile).where(ConfigFile.device_id == device_id)
    ).all()

    return DeviceDetailRead(
        **device.model_dump(),
        config_files=[ConfigFileRead.model_validate(c) for c in configs],
    )


@router.delete("/devices/{device_id}")
def delete_device(device_id: int, session: Session = Depends(get_session)):
    """Delete a device and all its associated data."""
    device = session.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Delete config files
    configs = session.exec(
        select(ConfigFile).where(ConfigFile.device_id == device_id)
    ).all()
    for cfg in configs:
        # Delete compliance results
        from models.compliance import ComplianceResult
        results = session.exec(
            select(ComplianceResult).where(ComplianceResult.config_id == cfg.id)
        ).all()
        for r in results:
            session.delete(r)
        session.delete(cfg)

    # Delete audit reports
    from models.compliance import AuditReport
    reports = session.exec(
        select(AuditReport).where(AuditReport.device_id == device_id)
    ).all()
    for r in reports:
        session.delete(r)

    session.delete(device)
    session.commit()

    return {"message": f"Device {device_id} and all associated data deleted."}
