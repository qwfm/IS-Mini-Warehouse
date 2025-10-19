# app/main.py (or app/crud.py — where your create_receipt endpoint is)
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from .db import get_db
from .models import Receipt, ReceiptItem, StockCurrent, StockLedger
from .auth import require_role, get_current_user
from decimal import Decimal, ROUND_HALF_UP, getcontext


getcontext().prec = 28 
app = FastAPI()

@app.post("/api/receipts", dependencies=[Depends(require_role("storekeeper"))])
def create_receipt(payload: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # payload must contain "items" list
    if "items" not in payload or not payload["items"]:
        raise HTTPException(status_code=400, detail="No items provided")

    try:
        receipt = Receipt(document_number=payload.get("document_number"), total_amount=0)
        db.add(receipt)
        db.flush()  # get id

        total_amount = 0
        for it in payload["items"]:
            qty = float(it["qty"])
            unit_price = float(it["unit_price"])
            total = qty * unit_price

            ri = ReceiptItem(
                receipt_id=receipt.id,
                material_id=it["material_id"],
                warehouse_id=it.get("warehouse_id"),
                qty=qty,
                unit_price=unit_price,
                total_price=total
            )
            db.add(ri)
            total_amount += total

            # ledger entry
            sl = StockLedger(
                warehouse_id=it.get("warehouse_id"),
                material_id=it["material_id"],
                movement_type="receipt",
                qty_change=qty,
                unit_price=unit_price,
                currency=payload.get("currency"),
                total_price=total,
                reference_doc_type="Receipt",
                reference_doc_id=receipt.id,
                remarks=f"Auto: {receipt.document_number}"
            )
            db.add(sl)

            # update or insert stock_current (with FOR UPDATE to avoid races)
            sc = db.query(StockCurrent).filter_by(
                warehouse_id=it.get("warehouse_id"),
                material_id=it["material_id"]
            ).with_for_update().first()
            if sc:
                sc.quantity = sc.quantity + qty
            else:
                sc = StockCurrent(
                    warehouse_id=it.get("warehouse_id"),
                    material_id=it["material_id"],
                    quantity=qty,
                    reserved_quantity=0
                )
                db.add(sc)

        receipt.total_amount = total_amount
        db.commit()
        db.refresh(receipt)
        return {"id": receipt.id, "total_amount": float(total_amount)}

    except HTTPException:
        db.rollback()
        raise  # re-raise so client gets proper 4xx

    except Exception as e:
        db.rollback()
        # optionally log the real exception here
        raise HTTPException(status_code=500, detail=str(e))
