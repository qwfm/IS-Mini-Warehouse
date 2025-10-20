from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from decimal import Decimal, ROUND_HALF_UP, getcontext
from .db import get_db
from .models import Receipt, ReceiptItem, StockCurrent, StockLedger, StockMovementType
from .auth import require_role, get_current_user

getcontext().prec = 28  

def to_decimal(value, quant_str=None):
    d = Decimal(str(value))
    if quant_str:
        return d.quantize(Decimal(quant_str), rounding=ROUND_HALF_UP)
    return d

app = FastAPI()

@app.post("/api/receipts", dependencies=[Depends(require_role("storekeeper"))])
def create_receipt(payload: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if "items" not in payload or not payload["items"]:
        raise HTTPException(status_code=400, detail="No items provided")

    try:
        receipt = Receipt(document_number=payload.get("document_number"), total_amount=Decimal("0.00"))
        db.add(receipt)
        db.flush()  # отримати id

        total_amount = Decimal("0.00")

        for it in payload["items"]:
            qty = to_decimal(it["qty"], "0.0001")
            unit_price = to_decimal(it["unit_price"], "0.01")
            line_total = (qty * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            ri = ReceiptItem(
                receipt_id=receipt.id,
                material_id=it["material_id"],
                warehouse_id=it.get("warehouse_id"),
                qty=qty,
                unit_price=unit_price,
                total_price=line_total
            )
            db.add(ri)

            total_amount += line_total

            # ledger entry — використовуємо Enum
            sl = StockLedger(
                warehouse_id=it.get("warehouse_id"),
                material_id=it["material_id"],
                movement_type=StockMovementType.receipt,  # <--- enum об’єкт
                qty_change=qty,
                unit_price=unit_price,
                currency=payload.get("currency"),
                total_price=line_total,
                reference_doc_type="Receipt",
                reference_doc_id=receipt.id,
                remarks=f"Auto: {receipt.document_number}"
            )
            db.add(sl)

            # stock_current
            sc = db.query(StockCurrent).filter_by(
                warehouse_id=it.get("warehouse_id"),
                material_id=it["material_id"]
            ).with_for_update().first()

            if sc:
                sc.quantity = (sc.quantity + qty).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            else:
                sc = StockCurrent(
                    warehouse_id=it.get("warehouse_id"),
                    material_id=it["material_id"],
                    quantity=qty,
                    reserved_quantity=Decimal("0.0000")
                )
                db.add(sc)

        receipt.total_amount = total_amount
        db.commit()
        db.refresh(receipt)
        return {"id": receipt.id, "total_amount": float(total_amount)}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
