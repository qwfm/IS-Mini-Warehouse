from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.db import get_db
from app.models import StockLedger, StockMovementType

router = APIRouter(prefix="/api/stock-ledger", tags=["Stock Ledger"])

@router.get("")
def list_ledger(
    warehouse_id: Optional[int] = None,
    material_id: Optional[int] = None,
    movement_type: Optional[StockMovementType] = None,
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    q = db.query(StockLedger)
    if warehouse_id:
        q = q.filter(StockLedger.warehouse_id == warehouse_id)
    if material_id:
        q = q.filter(StockLedger.material_id == material_id)
    if movement_type:
        q = q.filter(StockLedger.movement_type == movement_type)
    if date_from:
        q = q.filter(StockLedger.date_time >= date_from)
    if date_to:
        q = q.filter(StockLedger.date_time <= date_to)

    q = q.order_by(StockLedger.date_time.desc())
    rows = q.offset(skip).limit(limit).all()
    return [
        {
            "id": r.id,
            "date_time": r.date_time,
            "warehouse_id": r.warehouse_id,
            "material_id": r.material_id,
            "movement_type": r.movement_type.value,
            "qty_change": str(r.qty_change),
            "unit_price": str(r.unit_price) if r.unit_price is not None else None,
            "currency": r.currency,
            "total_price": str(r.total_price) if r.total_price is not None else None,
            "reference_doc_type": r.reference_doc_type,
            "reference_doc_id": r.reference_doc_id,
            "remarks": r.remarks,
        } for r in rows
    ]
