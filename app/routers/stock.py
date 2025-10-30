from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from decimal import Decimal, ROUND_HALF_UP
from ..models import StockCurrent, StockLedger, StockMovementType
from ..utils import to_decimal
from ..auth import require_role
from ..db import get_db
from ..schemas import StockCurrentResponse

router = APIRouter(prefix="/api/stock", tags=["Stock & Reports"])


@router.get("/current", response_model=List[StockCurrentResponse])
def get_current_stock(
    warehouse_id: Optional[int] = None,
    material_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Поточні залишки на складах"""
    query = db.query(StockCurrent)
    
    if warehouse_id:
        query = query.filter(StockCurrent.warehouse_id == warehouse_id)
    if material_id:
        query = query.filter(StockCurrent.material_id == material_id)
    
    stock = query.offset(skip).limit(limit).all()
    return stock


@router.get("/low-stock")
def get_low_stock(db: Session = Depends(get_db)):
    """Матеріали з низькими запасами (нижче min_stock)"""
    query = """
        SELECT 
            m.id as material_id,
            m.code,
            m.name,
            m.min_stock,
            sc.warehouse_id,
            sc.quantity,
            (sc.quantity - sc.reserved_quantity) as available
        FROM materials m
        JOIN stock_current sc ON m.id = sc.material_id
        WHERE (sc.quantity - sc.reserved_quantity) < m.min_stock
        ORDER BY available ASC
    """
    result = db.execute(query).fetchall()
    
    return [
        {
            "material_id": row[0],
            "code": row[1],
            "name": row[2],
            "min_stock": float(row[3]),
            "warehouse_id": row[4],
            "quantity": float(row[5]),
            "available": float(row[6])
        }
        for row in result
    ]

class StockAdjustBody(BaseModel):
    warehouse_id: int
    material_id: int
    qty_delta: Decimal = Field(..., description="Плюс або мінус")
    unit_price: Optional[Decimal] = None
    currency: Optional[str] = "UAH"
    remarks: Optional[str] = None

@router.post("/adjust")
def adjust_stock(
    body: StockAdjustBody,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("storekeeper"))
):
    stock = db.query(StockCurrent).filter_by(
        warehouse_id=body.warehouse_id,
        material_id=body.material_id
    ).with_for_update().first()

    if not stock:
        # створимо запис для матеріалу на складі, якщо треба
        stock = StockCurrent(
            warehouse_id=body.warehouse_id,
            material_id=body.material_id,
            quantity=Decimal("0"),
            reserved_quantity=Decimal("0"),
        )
        db.add(stock)
        db.flush()

    qty_delta = to_decimal(body.qty_delta, "0.0001")
    stock.quantity = (stock.quantity + qty_delta).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    ledger = StockLedger(
        warehouse_id=body.warehouse_id,
        material_id=body.material_id,
        movement_type=StockMovementType.adjustment,
        qty_change=qty_delta,
        unit_price=body.unit_price,
        currency=body.currency,
        total_price=(qty_delta * (body.unit_price or Decimal("0"))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if body.unit_price else None,
        reference_doc_type="Adjustment",
        reference_doc_id=None,
        remarks=body.remarks or "Manual adjustment"
    )
    db.add(ledger)

    db.commit()
    return {"ok": True}
