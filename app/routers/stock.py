from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..db import get_db
from ..models import StockCurrent
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