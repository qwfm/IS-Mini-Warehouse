from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from ..db import get_db
from ..models import Warehouse
from ..schemas import WarehouseCreate, WarehouseUpdate, WarehouseResponse
from ..auth import require_role

router = APIRouter(prefix="/api/warehouses", tags=["Warehouses"])


@router.get("", response_model=List[WarehouseResponse])
def list_warehouses(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Отримати список складів"""
    warehouses = db.query(Warehouse).offset(skip).limit(limit).all()
    return warehouses


@router.post("", response_model=WarehouseResponse, status_code=201)
def create_warehouse(
    data: WarehouseCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Створити новий склад (тільки admin)"""
    warehouse = Warehouse(**data.model_dump())
    db.add(warehouse)
    try:
        db.commit()
        db.refresh(warehouse)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return warehouse


@router.get("/{id}", response_model=WarehouseResponse)
def get_warehouse(id: int, db: Session = Depends(get_db)):
    """Отримати склад за ID"""
    warehouse = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return warehouse


@router.put("/{id}", response_model=WarehouseResponse)
def update_warehouse(
    id: int,
    data: WarehouseUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Оновити склад (тільки admin)"""
    warehouse = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(warehouse, key, value)
    
    try:
        db.commit()
        db.refresh(warehouse)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return warehouse


@router.delete("/{id}", status_code=204)
def delete_warehouse(
    id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Видалити склад (тільки admin)"""
    warehouse = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    db.delete(warehouse)
    db.commit()
    return None