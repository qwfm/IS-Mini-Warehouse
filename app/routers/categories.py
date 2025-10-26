from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from ..db import get_db
from ..models import Category
from ..schemas import CategoryCreate, CategoryUpdate, CategoryResponse
from ..auth import require_role

router = APIRouter(prefix="/api/categories", tags=["Categories"])


@router.get("", response_model=List[CategoryResponse])
def list_categories(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Отримати список категорій"""
    categories = db.query(Category).offset(skip).limit(limit).all()
    return categories


@router.post("", response_model=CategoryResponse, status_code=201)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Створити нову категорію (тільки admin)"""
    category = Category(**data.model_dump())
    db.add(category)
    try:
        db.commit()
        db.refresh(category)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create category: {str(e)}")
    return category


@router.get("/{id}", response_model=CategoryResponse)
def get_category(id: int, db: Session = Depends(get_db)):
    """Отримати категорію за ID"""
    category = db.query(Category).filter(Category.id == id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.put("/{id}", response_model=CategoryResponse)
def update_category(
    id: int,
    data: CategoryUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Оновити категорію (тільки admin)"""
    category = db.query(Category).filter(Category.id == id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    
    try:
        db.commit()
        db.refresh(category)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return category


@router.delete("/{id}", status_code=204)
def delete_category(
    id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Видалити категорію (тільки admin)"""
    category = db.query(Category).filter(Category.id == id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(category)
    db.commit()
    return None