from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from ..db import get_db
from ..models import Client
from ..schemas import ClientCreate, ClientUpdate, ClientResponse
from ..auth import require_role

router = APIRouter(prefix="/api/clients", tags=["Clients"])


@router.get("", response_model=List[ClientResponse])
def list_clients(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Отримати список клієнтів"""
    clients = db.query(Client).offset(skip).limit(limit).all()
    return clients


@router.post("", response_model=ClientResponse, status_code=201)
def create_client(
    data: ClientCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Створити нового клієнта (тільки admin)"""
    client = Client(**data.model_dump())
    db.add(client)
    try:
        db.commit()
        db.refresh(client)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return client


@router.get("/{id}", response_model=ClientResponse)
def get_client(id: int, db: Session = Depends(get_db)):
    """Отримати клієнта за ID"""
    client = db.query(Client).filter(Client.id == id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.put("/{id}", response_model=ClientResponse)
def update_client(
    id: int,
    data: ClientUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Оновити клієнта (тільки admin)"""
    client = db.query(Client).filter(Client.id == id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(client, key, value)
    
    try:
        db.commit()
        db.refresh(client)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    return client


@router.delete("/{id}", status_code=204)
def delete_client(
    id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Видалити клієнта (тільки admin)"""
    client = db.query(Client).filter(Client.id == id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    db.delete(client)
    db.commit()
    return None