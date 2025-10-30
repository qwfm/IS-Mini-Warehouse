from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session, joinedload
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
    """Створити надходження товару (storekeeper)"""
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


@router.put("/{id}", response_model=ReceiptResponse)
def update_receipt(id: int, data: ReceiptCreate, db: Session = Depends(get_db), _: dict = Depends(require_role("storekeeper"))):
    """Повне редагування: шапка + items. Перераховуємо total і робимо Δ до складу/журналу."""
    rec = db.query(Receipt).options(joinedload(Receipt.items)).filter(Receipt.id == id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if not data.items:
        raise HTTPException(status_code=400, detail="No items provided")

    try:
        # 1) повертаємо старі позиції назад на склад (відкочуємо)
        for old in rec.items:
            stock = db.query(StockCurrent).filter_by(warehouse_id=old.warehouse_id, material_id=old.material_id).with_for_update().first()
            if stock:
                stock.quantity = (stock.quantity - old.qty).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            db.add(StockLedger(
                warehouse_id=old.warehouse_id, material_id=old.material_id,
                movement_type=StockMovementType.adjustment,  # фіксуємо як технічне коригування
                qty_change=-old.qty, unit_price=old.unit_price, currency=old.currency,
                total_price=-(old.total_price), reference_doc_type="ReceiptEdit", reference_doc_id=rec.id,
                remarks="Revert old items before edit"
            ))
        rec.items.clear(); db.flush()

        # 2) заповнюємо новими позиціями і знову додаємо на склад
        rec.document_number = data.document_number
        rec.supplier_id = data.supplier_id
        rec.currency = data.currency
        rec.notes = data.notes
        rec.total_amount = Decimal("0.00")

        for it in data.items:
            qty = to_decimal(it.qty, "0.0001")
            up  = to_decimal(it.unit_price, "0.01")
            line = (qty * up).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            db.add(ReceiptItem(
                receipt_id=rec.id, material_id=it.material_id, warehouse_id=it.warehouse_id,
                qty=qty, unit_price=up, currency=it.currency, total_price=line, weight=it.weight, notes=it.notes
            ))
            rec.total_amount += line

            stock = db.query(StockCurrent).filter_by(warehouse_id=it.warehouse_id, material_id=it.material_id).with_for_update().first()
            if stock: stock.quantity = (stock.quantity + qty).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            else: db.add(StockCurrent(warehouse_id=it.warehouse_id, material_id=it.material_id, quantity=qty, reserved_quantity=Decimal("0.0000")))

            db.add(StockLedger(
                warehouse_id=it.warehouse_id, material_id=it.material_id,
                movement_type=StockMovementType.receipt, qty_change=qty, unit_price=up, currency=it.currency,
                total_price=line, reference_doc_type="ReceiptEdit", reference_doc_id=rec.id,
                remarks="Apply new items after edit"
            ))
        db.commit(); db.refresh(rec)
        return rec
    except:
        db.rollback(); raise

@router.delete("/{id}", status_code=204)
def delete_receipt(id: int, db: Session = Depends(get_db), _: dict = Depends(require_role("admin"))):
    rec = db.query(Receipt).options(joinedload(Receipt.items)).filter(Receipt.id == id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Receipt not found")
    for it in rec.items:
        stock = db.query(StockCurrent).filter_by(warehouse_id=it.warehouse_id, material_id=it.material_id).with_for_update().first()
        if stock:
            stock.quantity = (stock.quantity - it.qty).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        db.add(StockLedger(
            warehouse_id=it.warehouse_id, material_id=it.material_id,
            movement_type=StockMovementType.adjustment, qty_change=-it.qty,
            unit_price=it.unit_price, currency=it.currency, total_price=-(it.total_price),
            reference_doc_type="ReceiptDelete", reference_doc_id=rec.id, remarks="Delete receipt"
        ))
    db.delete(rec); db.commit()
    return None