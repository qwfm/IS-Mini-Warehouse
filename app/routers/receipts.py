from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from decimal import Decimal, ROUND_HALF_UP
from typing import List

from ..db import get_db
from ..models import Receipt, ReceiptItem, StockCurrent, StockLedger, StockMovementType
from ..schemas import ReceiptCreate, ReceiptResponse
from ..auth import require_role, get_current_user
from ..utils import to_decimal

router = APIRouter(prefix="/api/receipts", tags=["Receipts"])


@router.get("", response_model=List[ReceiptResponse])
def list_receipts(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    """Отримати список надходжень"""
    receipts = db.query(Receipt).offset(skip).limit(limit).all()
    return receipts


@router.post("", response_model=ReceiptResponse, status_code=201)
def create_receipt(
    data: ReceiptCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
    _: dict = Depends(require_role("storekeeper"))
):
    """Створити надходження товару (storekeeper+)"""
    if not data.items:
        raise HTTPException(status_code=400, detail="No items provided")

    try:
        receipt = Receipt(
            document_number=data.document_number,
            supplier_id=data.supplier_id,
            currency=data.currency,
            notes=data.notes,
            total_amount=Decimal("0.00")
        )
        db.add(receipt)
        db.flush()

        total_amount = Decimal("0.00")

        for item_data in data.items:
            qty = to_decimal(item_data.qty, "0.0001")
            unit_price = to_decimal(item_data.unit_price, "0.01")
            line_total = (qty * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            item = ReceiptItem(
                receipt_id=receipt.id,
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

            # Stock ledger entry
            ledger = StockLedger(
                warehouse_id=item_data.warehouse_id,
                material_id=item_data.material_id,
                movement_type=StockMovementType.receipt,
                qty_change=qty,
                unit_price=unit_price,
                currency=item_data.currency,
                total_price=line_total,
                reference_doc_type="Receipt",
                reference_doc_id=receipt.id,
                remarks=f"Receipt {receipt.document_number}"
            )
            db.add(ledger)

            # Update stock_current
            stock = db.query(StockCurrent).filter_by(
                warehouse_id=item_data.warehouse_id,
                material_id=item_data.material_id
            ).with_for_update().first()

            if stock:
                stock.quantity = (stock.quantity + qty).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            else:
                stock = StockCurrent(
                    warehouse_id=item_data.warehouse_id,
                    material_id=item_data.material_id,
                    quantity=qty,
                    reserved_quantity=Decimal("0.0000")
                )
                db.add(stock)

        receipt.total_amount = total_amount
        db.commit()
        db.refresh(receipt)
        return receipt

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{id}", response_model=ReceiptResponse)
def get_receipt(id: int, db: Session = Depends(get_db)):
    """Отримати надходження за ID"""
    receipt = db.query(Receipt).filter(Receipt.id == id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@router.delete("/{id}", status_code=204)
def delete_receipt(
    id: int,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin"))
):
    """Видалити надходження (тільки admin)"""
    receipt = db.query(Receipt).filter(Receipt.id == id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    db.delete(receipt)
    db.commit()
    return None