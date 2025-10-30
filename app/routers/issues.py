from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session, joinedload
from decimal import Decimal, ROUND_HALF_UP
from typing import List
from ..db import get_db
from ..models import Issue, IssueItem, StockCurrent, StockLedger, StockMovementType
from ..schemas import IssueCreate, IssueResponse, IssueUpdate
from ..auth import require_role, get_current_user
from ..utils import to_decimal

router = APIRouter(prefix="/api/issues", tags=["Issues"])


@router.get("", response_model=List[IssueResponse])
def list_issues(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Отримати список видач"""
    issues = db.query(Issue).offset(skip).limit(limit).all()
    return issues


@router.post("", response_model=IssueResponse, status_code=201)
def create_issue(
    data: IssueCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
    _: dict = Depends(require_role("storekeeper"))
):
    """Створити видачу товару (storekeeper)"""
    if not data.items:
        raise HTTPException(status_code=400, detail="No items provided")

    try:
        for item_data in data.items:
            stock = db.query(StockCurrent).filter_by(
                warehouse_id=item_data.warehouse_id,
                material_id=item_data.material_id
            ).first()
            
            if not stock:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Material {item_data.material_id} not available in warehouse {item_data.warehouse_id}"
                )
            
            available = stock.quantity - stock.reserved_quantity
            if available < item_data.qty:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for material {item_data.material_id}. Available: {available}, Requested: {item_data.qty}"
                )

        issue = Issue(
            document_number=data.document_number,
            client_id=data.client_id,
            currency=data.currency,
            notes=data.notes,
            total_amount=Decimal("0.00")
        )
        db.add(issue)
        db.flush()

        total_amount = Decimal("0.00")

        for item_data in data.items:
            qty = to_decimal(item_data.qty, "0.0001")
            unit_price = to_decimal(item_data.unit_price, "0.01")
            line_total = (qty * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            item = IssueItem(
                issue_id=issue.id,
                material_id=item_data.material_id,
                warehouse_id=item_data.warehouse_id,
                qty=qty,
                unit_price=unit_price,
                currency=item_data.currency,
                total_price=line_total,
                weight=item_data.weight,
                notes=item_data.notes
            )
            db.add(item)
            total_amount += line_total

            # Stock ledger entry (negative qty_change for issue)
            ledger = StockLedger(
                warehouse_id=item_data.warehouse_id,
                material_id=item_data.material_id,
                movement_type=StockMovementType.issue,
                qty_change=-qty,
                unit_price=unit_price,
                currency=item_data.currency,
                total_price=line_total,
                reference_doc_type="Issue",
                reference_doc_id=issue.id,
                remarks=f"Issue {issue.document_number}"
            )
            db.add(ledger)

            # Update stock_current (decrease)
            stock = db.query(StockCurrent).filter_by(
                warehouse_id=item_data.warehouse_id,
                material_id=item_data.material_id
            ).with_for_update().first()

            stock.quantity = (stock.quantity - qty).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        issue.total_amount = total_amount
        db.commit()
        db.refresh(issue)
        return issue

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{id}", response_model=IssueResponse)
def get_issue(id: int, db: Session = Depends(get_db)):
    """Отримати видачу за ID (з items)"""
    issue = (
        db.query(Issue)
        .options(joinedload(Issue.items))   # <-- важливо
        .filter(Issue.id == id)
        .first()
    )
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue

@router.put("/{id}", response_model=IssueResponse)
def update_issue_full(
    id: int,
    data: IssueUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
    _: dict = Depends(require_role("storekeeper"))
):
    """
    Повне оновлення видачі:
    - оновлює заголовок (document_number, client_id, currency, notes)
    - ПОВНІСТЮ перестворює items:
        * компенсує склад та ledger за старими позиціями
        * застосовує нові позиції (як у create)
    """
    issue = db.query(Issue).filter(Issue.id == id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    old_items = db.query(IssueItem).filter(IssueItem.issue_id == issue.id).all()
    try:
      for it in old_items:
          stock = db.query(StockCurrent).filter_by(
              warehouse_id=it.warehouse_id,
              material_id=it.material_id
          ).with_for_update().first()
          if stock:
              stock.quantity = (stock.quantity + it.qty).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

          db.add(StockLedger(
              warehouse_id=it.warehouse_id,
              material_id=it.material_id,
              movement_type=StockMovementType.release_reservation if it.qty >= 0 else StockMovementType.adjustment,
              qty_change=abs(it.qty),  
              unit_price=it.unit_price,
              currency=it.currency,
              total_price=(abs(it.qty) * it.unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
              reference_doc_type="Issue(undo)",
              reference_doc_id=issue.id,
              remarks=f"Undo Issue item #{it.id}"
          ))
      db.query(IssueItem).filter(IssueItem.issue_id == issue.id).delete()
      db.flush()

      # 2) Оновлюємо заголовок
      patch = data.model_dump(exclude_unset=True)
      # items обробимо окремо
      patch.pop("items", None)
      for k, v in patch.items():
          setattr(issue, k, v)

      # 3) Якщо прийшли нові items — застосовуємо, перевіряємо склад, пишемо ledger
      total_amount = Decimal("0.00")
      new_items = (data.items or [])
      for item_data in new_items:
          # перевірка наявності на складі
          stock = db.query(StockCurrent).filter_by(
              warehouse_id=item_data.warehouse_id,
              material_id=item_data.material_id
          ).with_for_update().first()

          if not stock:
              raise HTTPException(
                  status_code=400,
                  detail=f"Material {item_data.material_id} not available in warehouse {item_data.warehouse_id}"
              )
          available = stock.quantity - stock.reserved_quantity
          if available < item_data.qty:
              raise HTTPException(
                  status_code=400,
                  detail=f"Insufficient stock for material {item_data.material_id}. Available: {available}, Requested: {item_data.qty}"
              )

          qty = to_decimal(item_data.qty, "0.0001")
          unit_price = to_decimal(item_data.unit_price, "0.01")
          line_total = (qty * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

          db.add(IssueItem(
              issue_id=issue.id,
              material_id=item_data.material_id,
              warehouse_id=item_data.warehouse_id,
              qty=qty,
              unit_price=unit_price,
              currency=item_data.currency or issue.currency,
              total_price=line_total,
              weight=item_data.weight,
              notes=item_data.notes
          ))
          total_amount += line_total

          db.add(StockLedger(
              warehouse_id=item_data.warehouse_id,
              material_id=item_data.material_id,
              movement_type=StockMovementType.issue,
              qty_change=-qty,
              unit_price=unit_price,
              currency=item_data.currency or issue.currency,
              total_price=line_total,
              reference_doc_type="Issue",
              reference_doc_id=issue.id,
              remarks=f"Update Issue {issue.document_number or issue.id}"
          ))

          stock.quantity = (stock.quantity - qty).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

      issue.total_amount = total_amount
      db.commit()
      db.refresh(issue)
      return issue

    except HTTPException:
      db.rollback()
      raise
    except Exception as e:
      db.rollback()
      raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{id}", status_code=204)
def delete_issue(
    id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Видалити видачу (тільки admin)"""
    issue = db.query(Issue).filter(Issue.id == id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    db.delete(issue)
    db.commit()
    return None