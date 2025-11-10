from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
from decimal import Decimal, ROUND_HALF_UP
from ..models import StockCurrent, StockLedger, StockMovementType, Warehouse, Material
from ..utils import to_decimal
from ..auth import require_role
from ..db import get_db

router = APIRouter(prefix="/api/stock", tags=["Stock & Reports"])


@router.get("/current")
def get_current_stock(
    warehouse_id: Optional[int] = None,
    material_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Поточні залишки на складах з іменами"""
    query = db.query(
        StockCurrent.id,
        StockCurrent.warehouse_id,
        StockCurrent.material_id,
        StockCurrent.quantity,
        StockCurrent.reserved_quantity,
        StockCurrent.last_updated,
        Warehouse.name.label("warehouse_name"),
        Material.code.label("material_code"),
        Material.name.label("material_name"),
    ).join(Warehouse, StockCurrent.warehouse_id == Warehouse.id, isouter=True)\
     .join(Material, StockCurrent.material_id == Material.id, isouter=True)
    
    if warehouse_id:
        query = query.filter(StockCurrent.warehouse_id == warehouse_id)
    if material_id:
        query = query.filter(StockCurrent.material_id == material_id)
    
    rows = query.offset(skip).limit(limit).all()
    
    return [
        {
            "id": r.id,
            "warehouse_id": r.warehouse_id,
            "material_id": r.material_id,
            "quantity": str(r.quantity),
            "reserved_quantity": str(r.reserved_quantity),
            "last_updated": r.last_updated,
            "warehouse_name": r.warehouse_name,
            "material_code": r.material_code,
            "material_name": r.material_name,
        }
        for r in rows
    ]


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
            w.name as warehouse_name,
            sc.quantity,
            (sc.quantity - sc.reserved_quantity) as available
        FROM materials m
        JOIN stock_current sc ON m.id = sc.material_id
        LEFT JOIN warehouses w ON sc.warehouse_id = w.id
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
            "warehouse_name": row[5],
            "quantity": float(row[6]),
            "available": float(row[7])
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


@router.get("/available-materials")
def get_available_materials(
    warehouse_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Отримати матеріали доступні на складі (з qty > 0)"""
    query = db.query(
        Material.id,
        Material.code,
        Material.name,
        Material.unit,
        StockCurrent.warehouse_id,
        StockCurrent.quantity,
        StockCurrent.reserved_quantity,
    ).join(StockCurrent, Material.id == StockCurrent.material_id)\
     .filter(StockCurrent.quantity > 0)
    
    if warehouse_id:
        query = query.filter(StockCurrent.warehouse_id == warehouse_id)
    
    rows = query.all()
    
    return [
        {
            "material_id": r.id,
            "material_code": r.code,
            "material_name": r.name,
            "unit": r.unit,
            "warehouse_id": r.warehouse_id,
            "quantity": str(r.quantity),
            "reserved_quantity": str(r.reserved_quantity),
            "available": str(r.quantity - r.reserved_quantity),
        }
        for r in rows
    ]