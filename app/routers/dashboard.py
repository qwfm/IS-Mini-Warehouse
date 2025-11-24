from datetime import date, datetime, timedelta
from typing import List, Optional, Tuple
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, desc
from sqlalchemy.orm import Session, aliased

from ..db import get_db
from ..models import (
    StockCurrent, StockLedger, StockMovementType,
    Material, Warehouse,
    Receipt, ReceiptItem,
    Issue, IssueItem,
    Client, Supplier,
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


# ---------- helpers ----------
def _parse_date_range(
    dfrom: Optional[str],
    dto: Optional[str],
    fallback_days: int,
) -> Tuple[datetime, datetime]:
    """Parse 'YYYY-MM-DD' into [from, to] inclusive day range."""
    if dfrom and dto:
        try:
            f = datetime.fromisoformat(dfrom)
            t = datetime.fromisoformat(dto)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD")
        f = datetime(f.year, f.month, f.day, 0, 0, 0)
        t = datetime(t.year, t.month, t.day, 23, 59, 59, 999999)
        return f, t
    # fallback by days
    today = datetime.now()
    f = today - timedelta(days=fallback_days - 1)
    f = datetime(f.year, f.month, f.day, 0, 0, 0)
    t = datetime(today.year, today.month, today.day, 23, 59, 59, 999999)
    return f, t


# ---------- summary ----------
@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    """
    Загальна статистика системи.
    total_stock_value рахується у гривні за фіксованими курсами нижче.
    """
    exchange_rates = {
        "UAH": Decimal("1.0"),
        "USD": Decimal("41.5"),
        "EUR": Decimal("44.8"),
        "PLN": Decimal("10.2"),
        "GBP": Decimal("52.3"),
        "CHF": Decimal("47.5"),
        "CZK": Decimal("1.73"),
        "HUF": Decimal("0.11"),
        "RON": Decimal("9.0"),
        "TRY": Decimal("1.2"),
        "SEK": Decimal("3.8"),
        "NOK": Decimal("3.7"),
        "JPY": Decimal("0.27"),
        "CNY": Decimal("5.7"),
        "AUD": Decimal("26.5"),
        "CAD": Decimal("29.8"),
    }

    total_warehouses = db.query(func.count(Warehouse.id)).scalar() or 0
    total_materials = db.query(func.count(Material.id)).filter(Material.is_active.is_(True)).scalar() or 0
    total_suppliers = db.query(func.count(Supplier.id)).scalar() or 0
    total_clients = db.query(func.count(Client.id)).scalar() or 0

    # перерахунок всіх валют у UAH
    stock_items = db.query(
        StockCurrent.quantity,
        Material.price,
        Material.currency
    ).join(Material, StockCurrent.material_id == Material.id
    ).filter(Material.price.isnot(None)).all()

    total_stock_value = Decimal("0")
    for item in stock_items:
        qty = Decimal(str(item.quantity or 0))
        price = Decimal(str(item.price or 0))
        currency = item.currency or "UAH"
        rate = exchange_rates.get(currency, Decimal("1.0"))
        total_stock_value += qty * price * rate

    low_stock_count = db.query(func.count(StockCurrent.id)
    ).join(Material, StockCurrent.material_id == Material.id
    ).filter((func.coalesce(StockCurrent.quantity, 0) - func.coalesce(StockCurrent.reserved_quantity, 0)) < func.coalesce(Material.min_stock, 0)
    ).scalar() or 0

    last_month = datetime.now() - timedelta(days=30)
    receipts_last_month = db.query(func.count(Receipt.id)
    ).filter((Receipt.created_at != None) & (Receipt.created_at >= last_month) | ((Receipt.created_at == None) & (Receipt.date >= last_month))
    ).scalar() or 0
    issues_last_month = db.query(func.count(Issue.id)
    ).filter((Issue.created_at != None) & (Issue.created_at >= last_month) | ((Issue.created_at == None) & (Issue.date >= last_month))
    ).scalar() or 0

    return {
        "warehouses": total_warehouses,
        "materials": total_materials,
        "suppliers": total_suppliers,
        "clients": total_clients,
        "total_stock_value": float(total_stock_value),
        "low_stock_items": low_stock_count,
        "receipts_last_30_days": receipts_last_month,
        "issues_last_30_days": issues_last_month,
    }


# ---------- warehouse stats ----------
@router.get("/warehouse-stats")
def warehouse_stats(db: Session = Depends(get_db)):
    rows = db.query(
        Warehouse.id.label("warehouse_id"),
        Warehouse.name.label("warehouse_name"),
        func.coalesce(func.sum(StockCurrent.quantity), 0).label("available"),
    ).outerjoin(StockCurrent, StockCurrent.warehouse_id == Warehouse.id).group_by(
        Warehouse.id, Warehouse.name
    ).order_by(Warehouse.id).all()

    return [
        {"warehouse_id": r.warehouse_id, "warehouse_name": r.warehouse_name, "available": float(r.available)}
        for r in rows
    ]


# ---------- low stock alert ----------
@router.get("/low-stock-alert")
def low_stock_alert(limit: int = Query(20, ge=1, le=500), db: Session = Depends(get_db)):
    q = db.query(
        StockCurrent.warehouse_id,
        Warehouse.name.label("warehouse_name"),
        StockCurrent.material_id,
        Material.code,
        Material.name,
        Material.min_stock,
        func.coalesce(StockCurrent.quantity, 0).label("available")
    ).join(Warehouse, Warehouse.id == StockCurrent.warehouse_id
    ).join(Material, Material.id == StockCurrent.material_id
    ).filter(
        func.coalesce(StockCurrent.quantity, 0) < func.coalesce(Material.min_stock, 0)
    ).order_by((func.coalesce(StockCurrent.quantity, 0) / func.nullif(Material.min_stock, 0)).asc().nullsfirst()
    ).limit(limit)

    result = []
    for r in q.all():
        min_stock = float(r.min_stock or 0)
        available = float(r.available or 0)
        fill_rate = 0.0 if min_stock <= 0 else max(0.0, min(100.0, available / min_stock * 100))
        result.append({
            "warehouse_id": r.warehouse_id,
            "warehouse_name": r.warehouse_name,
            "material_id": r.material_id,
            "code": r.code,
            "name": r.name,
            "min_stock": min_stock,
            "available": available,
            "fill_rate": fill_rate,
        })
    return result


# ---------- recent activities (simple feed) ----------
@router.get("/recent-activities")
def recent_activities(limit: int = Query(10, ge=1, le=100), db: Session = Depends(get_db)):
    q = db.query(
        StockLedger.date_time,
        StockLedger.movement_type,
        StockLedger.qty_change,
        StockLedger.reference_doc_type,
        StockLedger.reference_doc_id,
        Warehouse.name.label("warehouse"),
        Material.name.label("material"),
    ).join(Warehouse, Warehouse.id == StockLedger.warehouse_id
    ).join(Material, Material.id == StockLedger.material_id
    ).order_by(StockLedger.date_time.desc()
    ).limit(limit)

    out = []
    for r in q.all():
        out.append({
            "timestamp": r.date_time,
            "type": r.movement_type.value,
            "qty_change": float(r.qty_change),
            "reference": f"{r.reference_doc_type} #{r.reference_doc_id}" if r.reference_doc_type and r.reference_doc_id else None,
            "warehouse": r.warehouse,
            "material": r.material,
        })
    return out


# ---------- receipts/issues timeline with from/to ----------
@router.get("/receipts-issues-timeline")
def get_receipts_issues_timeline(
    days: int = Query(30, ge=7, le=365),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    date_from, date_to = _parse_date_range(from_, to, fallback_days=days)

    # Групуємо по днях за полем date; якщо воно порожнє — за created_at.
    # PostgreSQL: можна використати date_trunc('day', ...) або ::date.
    receipts = db.query(
        func.coalesce(func.date(Receipt.date), func.date(Receipt.created_at)).label("d"),
        func.count(Receipt.id).label("count"),
        func.sum(Receipt.total_amount).label("total"),
    ).filter(
        (
            (Receipt.date != None) &
            (Receipt.date >= date_from) & (Receipt.date <= date_to)
        ) | (
            (Receipt.date == None) &
            (Receipt.created_at >= date_from) & (Receipt.created_at <= date_to)
        )
    ).group_by("d").all()

    issues = db.query(
        func.coalesce(func.date(Issue.date), func.date(Issue.created_at)).label("d"),
        func.count(Issue.id).label("count"),
        func.sum(Issue.total_amount).label("total"),
    ).filter(
        (
            (Issue.date != None) &
            (Issue.date >= date_from) & (Issue.date <= date_to)
        ) | (
            (Issue.date == None) &
            (Issue.created_at >= date_from) & (Issue.created_at <= date_to)
        )
    ).group_by("d").all()

    receipts_map = {str(r.d): {"count": int(r.count or 0), "total": float(r.total or 0)} for r in receipts}
    issues_map = {str(i.d): {"count": int(i.count or 0), "total": float(i.total or 0)} for i in issues}

    # Повний щоденний ряд без дірок
    out: List[dict] = []
    cur = date_from.date()
    end = date_to.date()
    while cur <= end:
        d = str(cur)
        out.append({
            "date": d,
            "receipts_count": receipts_map.get(d, {}).get("count", 0),
            "receipts_total": receipts_map.get(d, {}).get("total", 0.0),
            "issues_count": issues_map.get(d, {}).get("count", 0),
            "issues_total": issues_map.get(d, {}).get("total", 0.0),
        })
        cur += timedelta(days=1)

    return out


# ---------- top materials with from/to ----------
@router.get("/top-materials")
def top_materials(
    limit: int = Query(5, ge=1, le=100),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    date_from, date_to = _parse_date_range(from_, to, fallback_days=30)

    # сума відпуску за позиціями IssueItem у діапазоні дат документа Issue
    q = db.query(
        Material.id.label("material_id"),
        Material.code,
        Material.name,
        func.coalesce(func.sum(IssueItem.qty), 0).label("total_issued"),
        func.coalesce(func.sum(IssueItem.total_price), 0).label("total_amount"),
    ).join(IssueItem, IssueItem.material_id == Material.id
    ).join(Issue, Issue.id == IssueItem.issue_id
    ).filter(
        Issue.date >= date_from, Issue.date <= date_to
    ).group_by(Material.id, Material.code, Material.name
    ).order_by(desc("total_issued")
    ).limit(limit)

    return [
        {
            "material_id": r.material_id,
            "code": r.code,
            "name": r.name,
            "total_issued": float(r.total_issued or 0),
            "total_amount": float(r.total_amount or 0),
        } for r in q.all()
    ]


# ---------- counterparty report (clients/suppliers) with from/to ----------
@router.get("/counterparty-report")
def counterparty_report(
    type: str = Query(..., pattern="^(clients|suppliers)$"),
    currency: Optional[str] = Query(None, min_length=3, max_length=3),
    limit: int = Query(10, ge=1, le=500),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    date_from, date_to = _parse_date_range(from_, to, fallback_days=30)

    if type == "clients":
        q = db.query(
            Client.id.label("id"),
            Client.name.label("name"),
            func.count(Issue.id).label("docs_count"),
            func.coalesce(func.sum(IssueItem.qty), 0).label("total_qty"),
            func.coalesce(func.sum(IssueItem.total_price), 0).label("total"),
        ).join(Issue, Issue.client_id == Client.id
        ).join(IssueItem, IssueItem.issue_id == Issue.id
        ).filter(
            Issue.date >= date_from, Issue.date <= date_to
        )

        if currency:
            q = q.filter(IssueItem.currency == currency)

        q = q.group_by(Client.id, Client.name
        ).order_by(desc("total")
        ).limit(limit)

    else:  # suppliers
        q = db.query(
            Supplier.id.label("id"),
            Supplier.name.label("name"),
            func.count(Receipt.id).label("docs_count"),
            func.coalesce(func.sum(ReceiptItem.qty), 0).label("total_qty"),
            func.coalesce(func.sum(ReceiptItem.total_price), 0).label("total"),
        ).join(Receipt, Receipt.supplier_id == Supplier.id
        ).join(ReceiptItem, ReceiptItem.receipt_id == Receipt.id
        ).filter(
            Receipt.date >= date_from, Receipt.date <= date_to
        )

        if currency:
            q = q.filter(ReceiptItem.currency == currency)

        q = q.group_by(Supplier.id, Supplier.name
        ).order_by(desc("total")
        ).limit(limit)

    rows = q.all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "docs_count": int(r.docs_count or 0),
            "total_qty": float(r.total_qty or 0),
            "total": float(r.total or 0),
        } for r in rows
    ]
