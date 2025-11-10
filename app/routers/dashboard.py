from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from typing import Optional
from decimal import Decimal

from ..db import get_db
from ..models import (
    StockCurrent, Material, Warehouse, Receipt, Issue, 
    ReceiptItem, IssueItem, StockLedger, StockMovementType
)

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_summary(db: Session = Depends(get_db)):
    """Загальна статистика системи"""
    
    # Кількість складів, матеріалів, постачальників, клієнтів
    from ..models import Supplier, Client
    
    total_warehouses = db.query(func.count(Warehouse.id)).scalar()
    total_materials = db.query(func.count(Material.id)).filter(Material.is_active == True).scalar()
    total_suppliers = db.query(func.count(Supplier.id)).scalar()
    total_clients = db.query(func.count(Client.id)).scalar()
    
    # Загальна вартість запасів (по UAH для простоти)
    total_stock_value = db.query(
        func.sum(StockCurrent.quantity * Material.price)
    ).join(Material, StockCurrent.material_id == Material.id)\
     .filter(Material.currency == "UAH")\
     .scalar() or 0
    
    # Кількість матеріалів з низькими запасами
    low_stock_count = db.query(func.count(StockCurrent.id))\
        .join(Material, StockCurrent.material_id == Material.id)\
        .filter((StockCurrent.quantity - StockCurrent.reserved_quantity) < Material.min_stock)\
        .scalar()
    
    # Надходження за останній місяць
    last_month = datetime.now() - timedelta(days=30)
    receipts_last_month = db.query(func.count(Receipt.id))\
        .filter(Receipt.created_at >= last_month)\
        .scalar()
    
    # Видачі за останній місяць
    issues_last_month = db.query(func.count(Issue.id))\
        .filter(Issue.created_at >= last_month)\
        .scalar()
    
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


@router.get("/top-materials")
def get_top_materials(
    limit: int = Query(10, ge=1, le=50),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """Top матеріалів по обороту (кількість видач)"""
    since = datetime.now() - timedelta(days=days)
    
    top_materials = db.query(
        Material.id,
        Material.code,
        Material.name,
        Material.unit,
        func.sum(IssueItem.qty).label("total_issued"),
        func.count(IssueItem.id).label("issue_count")
    ).join(IssueItem, Material.id == IssueItem.material_id)\
     .join(Issue, IssueItem.issue_id == Issue.id)\
     .filter(Issue.created_at >= since)\
     .group_by(Material.id, Material.code, Material.name, Material.unit)\
     .order_by(desc("total_issued"))\
     .limit(limit)\
     .all()
    
    return [
        {
            "material_id": m.id,
            "code": m.code,
            "name": m.name,
            "unit": m.unit,
            "total_issued": float(m.total_issued or 0),
            "issue_count": m.issue_count,
        }
        for m in top_materials
    ]


@router.get("/warehouse-stats")
def get_warehouse_stats(db: Session = Depends(get_db)):
    """Статистика по складах"""
    
    stats = db.query(
        Warehouse.id,
        Warehouse.name,
        func.count(StockCurrent.id).label("material_count"),
        func.sum(StockCurrent.quantity).label("total_quantity"),
        func.sum(StockCurrent.reserved_quantity).label("total_reserved")
    ).join(StockCurrent, Warehouse.id == StockCurrent.warehouse_id, isouter=True)\
     .group_by(Warehouse.id, Warehouse.name)\
     .all()
    
    return [
        {
            "warehouse_id": s.id,
            "warehouse_name": s.name,
            "material_count": s.material_count or 0,
            "total_quantity": float(s.total_quantity or 0),
            "total_reserved": float(s.total_reserved or 0),
            "available": float((s.total_quantity or 0) - (s.total_reserved or 0)),
        }
        for s in stats
    ]


@router.get("/receipts-issues-timeline")
def get_receipts_issues_timeline(
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db)
):
    """Графік надходжень та видач за період (по днях)"""
    since = datetime.now() - timedelta(days=days)
    
    # Надходження по днях
    receipts = db.query(
        func.date(Receipt.created_at).label("date"),
        func.count(Receipt.id).label("count"),
        func.sum(Receipt.total_amount).label("total")
    ).filter(Receipt.created_at >= since)\
     .group_by(func.date(Receipt.created_at))\
     .all()
    
    # Видачі по днях
    issues = db.query(
        func.date(Issue.created_at).label("date"),
        func.count(Issue.id).label("count"),
        func.sum(Issue.total_amount).label("total")
    ).filter(Issue.created_at >= since)\
     .group_by(func.date(Issue.created_at))\
     .all()
    
    # Формуємо timeline
    receipts_dict = {str(r.date): {"count": r.count, "total": float(r.total or 0)} for r in receipts}
    issues_dict = {str(i.date): {"count": i.count, "total": float(i.total or 0)} for i in issues}
    
    # Генеруємо всі дати в діапазоні
    timeline = []
    current = datetime.now().date()
    start = (datetime.now() - timedelta(days=days)).date()
    
    while start <= current:
        date_str = str(start)
        timeline.append({
            "date": date_str,
            "receipts_count": receipts_dict.get(date_str, {}).get("count", 0),
            "receipts_total": receipts_dict.get(date_str, {}).get("total", 0),
            "issues_count": issues_dict.get(date_str, {}).get("count", 0),
            "issues_total": issues_dict.get(date_str, {}).get("total", 0),
        })
        start += timedelta(days=1)
    
    return timeline


@router.get("/low-stock-alert")
def get_low_stock_alert(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Матеріали з критично низькими запасами"""
    
    low_stock = db.query(
        Material.id,
        Material.code,
        Material.name,
        Material.unit,
        Material.min_stock,
        StockCurrent.warehouse_id,
        Warehouse.name.label("warehouse_name"),
        StockCurrent.quantity,
        StockCurrent.reserved_quantity,
        (StockCurrent.quantity - StockCurrent.reserved_quantity).label("available")
    ).join(StockCurrent, Material.id == StockCurrent.material_id)\
     .join(Warehouse, StockCurrent.warehouse_id == Warehouse.id)\
     .filter((StockCurrent.quantity - StockCurrent.reserved_quantity) < Material.min_stock)\
     .order_by((StockCurrent.quantity - StockCurrent.reserved_quantity) / Material.min_stock)\
     .limit(limit)\
     .all()
    
    return [
        {
            "material_id": item.id,
            "code": item.code,
            "name": item.name,
            "unit": item.unit,
            "warehouse_id": item.warehouse_id,
            "warehouse_name": item.warehouse_name,
            "min_stock": float(item.min_stock),
            "quantity": float(item.quantity),
            "reserved": float(item.reserved_quantity),
            "available": float(item.available),
            "shortage": float(item.min_stock - item.available),
            "fill_rate": float(item.available / item.min_stock * 100) if item.min_stock > 0 else 0,
        }
        for item in low_stock
    ]


@router.get("/recent-activities")
def get_recent_activities(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Останні операції в системі"""
    
    activities = db.query(
        StockLedger.id,
        StockLedger.date_time,
        StockLedger.movement_type,
        StockLedger.qty_change,
        StockLedger.reference_doc_type,
        StockLedger.reference_doc_id,
        StockLedger.remarks,
        Material.code.label("material_code"),
        Material.name.label("material_name"),
        Warehouse.name.label("warehouse_name")
    ).join(Material, StockLedger.material_id == Material.id, isouter=True)\
     .join(Warehouse, StockLedger.warehouse_id == Warehouse.id, isouter=True)\
     .order_by(desc(StockLedger.date_time))\
     .limit(limit)\
     .all()
    
    return [
        {
            "id": a.id,
            "timestamp": a.date_time.isoformat() if a.date_time else None,
            "type": a.movement_type.value if a.movement_type else None,
            "qty_change": float(a.qty_change),
            "reference": f"{a.reference_doc_type} #{a.reference_doc_id}" if a.reference_doc_type else None,
            "material": f"{a.material_code} — {a.material_name}" if a.material_code else "Unknown",
            "warehouse": a.warehouse_name or "Unknown",
            "remarks": a.remarks,
        }
        for a in activities
    ]


@router.get("/category-distribution")
def get_category_distribution(db: Session = Depends(get_db)):
    """Розподіл матеріалів по категоріях"""
    from ..models import Category
    
    distribution = db.query(
        Category.id,
        Category.name,
        func.count(Material.id).label("material_count"),
        func.sum(StockCurrent.quantity).label("total_quantity")
    ).join(Material, Category.id == Material.category_id, isouter=True)\
     .join(StockCurrent, Material.id == StockCurrent.material_id, isouter=True)\
     .group_by(Category.id, Category.name)\
     .all()
    
    # Матеріали без категорії
    no_category = db.query(
        func.count(Material.id).label("material_count"),
        func.sum(StockCurrent.quantity).label("total_quantity")
    ).filter(Material.category_id == None)\
     .join(StockCurrent, Material.id == StockCurrent.material_id, isouter=True)\
     .first()
    
    result = [
        {
            "category_id": d.id,
            "category_name": d.name,
            "material_count": d.material_count or 0,
            "total_quantity": float(d.total_quantity or 0),
        }
        for d in distribution
    ]
    
    if no_category and no_category.material_count:
        result.append({
            "category_id": None,
            "category_name": "Uncategorized",
            "material_count": no_category.material_count or 0,
            "total_quantity": float(no_category.total_quantity or 0),
        })
    
    return result