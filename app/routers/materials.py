from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..db import get_db
from ..models import Material
from ..schemas import MaterialCreate, MaterialUpdate, MaterialResponse
from ..auth import require_role

router = APIRouter(prefix="/api/materials", tags=["Materials"])


@router.get("", response_model=List[MaterialResponse])
def list_materials(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    is_active: Optional[bool] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Отримати список матеріалів з фільтрацією"""
    query = db.query(Material)
    
    if is_active is not None:
        query = query.filter(Material.is_active == is_active)
    if category_id is not None:
        query = query.filter(Material.category_id == category_id)
    
    materials = query.offset(skip).limit(limit).all()
    return materials


@router.post("", response_model=MaterialResponse, status_code=201)
def create_material(
    data: MaterialCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("storekeeper"))
):
    """Створити новий матеріал (storekeeper)"""
    material = Material(**data.model_dump())
    db.add(material)
    try:
        db.commit()
        db.refresh(material)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return material


@router.get("/{id}", response_model=MaterialResponse)
def get_material(id: int, db: Session = Depends(get_db)):
    """Отримати матеріал за ID"""
    material = db.query(Material).filter(Material.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return material


@router.put("/{id}", response_model=MaterialResponse)
def update_material(
    id: int,
    data: MaterialUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("storekeeper"))
):
    """Оновити матеріал (storekeeper+)"""
    material = db.query(Material).filter(Material.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(material, key, value)
    
    try:
        db.commit()
        db.refresh(material)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return material


@router.delete("/{id}", status_code=204)
def delete_material(
    id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Видалити матеріал (тільки admin)"""
    material = db.query(Material).filter(Material.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(material)
    db.commit()
    return None