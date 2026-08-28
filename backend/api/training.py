"""Training API — AI training interface endpoints for human-in-the-loop feedback."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from models.training import TrainingMapping
from schemas.training import TrainingMappingRead, TrainingMapRequest, PendingTrainingItem

router = APIRouter(prefix="/api/v1", tags=["AI Training"])


@router.get("/training/pending", response_model=list[PendingTrainingItem])
def get_pending_training(session: Session = Depends(get_session)):
    """Get unrecognized config lines that need admin mapping."""
    stmt = (
        select(TrainingMapping)
        .where(TrainingMapping.is_verified == False)
        .order_by(TrainingMapping.created_at.desc())
    )
    pending = session.exec(stmt).all()
    return pending


@router.post("/training/map", response_model=TrainingMappingRead)
def submit_mapping(request: TrainingMapRequest, session: Session = Depends(get_session)):
    """Submit an admin mapping for an unrecognized config command."""
    mapping = session.get(TrainingMapping, request.mapping_id)
    if not mapping:
        raise HTTPException(status_code=404, detail="Training mapping not found")

    mapping.security_category = request.security_category
    mapping.normalized_key = request.normalized_key
    mapping.normalized_value = request.normalized_value
    mapping.is_verified = True

    session.add(mapping)
    session.commit()
    session.refresh(mapping)

    return mapping


@router.get("/training/mappings", response_model=list[TrainingMappingRead])
def get_all_mappings(
    vendor: str = None,
    verified_only: bool = False,
    session: Session = Depends(get_session),
):
    """View all training mappings, optionally filtered by vendor or verification status."""
    stmt = select(TrainingMapping)
    if vendor:
        stmt = stmt.where(TrainingMapping.vendor == vendor)
    if verified_only:
        stmt = stmt.where(TrainingMapping.is_verified == True)
    stmt = stmt.order_by(TrainingMapping.created_at.desc())

    mappings = session.exec(stmt).all()
    return mappings


@router.delete("/training/mappings/{mapping_id}")
def delete_mapping(mapping_id: int, session: Session = Depends(get_session)):
    """Delete a faulty training mapping."""
    mapping = session.get(TrainingMapping, mapping_id)
    if not mapping:
        raise HTTPException(status_code=404, detail="Training mapping not found")

    session.delete(mapping)
    session.commit()

    return {"message": f"Training mapping {mapping_id} deleted."}
