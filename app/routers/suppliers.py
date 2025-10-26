from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from ..db import get_db
from ..models import Supplier
from ..schemas import SupplierCreate, SupplierUpdate, SupplierResponse
from ..auth import require_role

router = APIRouter(prefix="/api/suppliers", tags=["Suppliers"])

@router.get("", response_model=List[SupplierResponse])
def list_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Отримати список постачальників"""
    suppliers = db.query(Supplier).offset(skip).limit(limit).all()
    return suppliers


@router.post("", response_model=SupplierResponse, status_code=201)
def create_supplier(
    data: SupplierCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Створити нового постачальника (тільки admin)"""
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    try:
        db.commit()
        db.refresh(supplier)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return supplier


@router.get("/{id}", response_model=SupplierResponse)
def get_supplier(id: int, db: Session = Depends(get_db)):
    """Отримати постачальника за ID"""
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier


@router.put("/{id}", response_model=SupplierResponse)
def update_supplier(
    id: int,
    data: SupplierUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Оновити постачальника (тільки admin)"""
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    
    try:
        db.commit()
        db.refresh(supplier)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return supplier


@router.delete("/{id}", status_code=204)
def delete_supplier(
    id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Видалити постачальника (тільки admin)"""
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(supplier)
    db.commit()
    return None