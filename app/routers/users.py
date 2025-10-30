from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import re

from app.auth import get_current_user
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/api/users", tags=["users"])


class SyncBody(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None  

def name_from_email(email: Optional[str]) -> Optional[str]:
    if not email:
        return None
    local = email.split("@", 1)[0]
    parts = re.split(r"[._\-]+", local.strip())
    parts = [p for p in parts if p]
    if not parts:
        return None
    return " ".join(s[:1].upper() + s[1:] for s in parts)


@router.post("/sync")
def sync_user(
    payload: SyncBody | None = None,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = user.get("sub")
    if not sub:
        raise HTTPException(400, "missing sub")

    # grabbin name and email from ID-token
    email = (payload.email if payload else None) or user.get("email")
    name = (payload.name if payload else None) or user.get("name")

    # making a name from email
    if not name:
        name = name_from_email(email)

    row = db.query(User).filter(User.auth0_sub == sub).one_or_none()

    if not row:
        row = User(auth0_sub=sub)
        if email:    
            row.email = email
        if name:
            row.full_name = name
        db.add(row)
        db.flush() 
    else:
        if email:
            row.email = email
        if name and not row.full_name:
            row.full_name = name

    db.commit()
    return {"id": row.id, "email": row.email, "full_name": row.full_name}
