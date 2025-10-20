# app/models.py
from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Enum as PgEnum
from sqlalchemy.orm import relationship, declarative_base
import enum

Base = declarative_base()

class StockMovementType(enum.Enum):
    receipt = "receipt"
    issue = "issue"
    transfer = "transfer"

class Receipt(Base):
    __tablename__ = "receipts"
    id = Column(Integer, primary_key=True)
    document_number = Column(String, unique=True, nullable=False)
    total_amount = Column(Numeric(14, 2), nullable=False)

class ReceiptItem(Base):
    __tablename__ = "receipt_items"
    id = Column(Integer, primary_key=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id"), nullable=False)
    material_id = Column(Integer, nullable=False)
    warehouse_id = Column(Integer, nullable=False)
    qty = Column(Numeric(18, 4), nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False)
    total_price = Column(Numeric(14, 2), nullable=False)

class StockCurrent(Base):
    __tablename__ = "stock_current"
    id = Column(Integer, primary_key=True)
    warehouse_id = Column(Integer, nullable=False)
    material_id = Column(Integer, nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False)
    reserved_quantity = Column(Numeric(18, 4), nullable=False)

class StockLedger(Base):
    __tablename__ = "stock_ledger"
    id = Column(Integer, primary_key=True)
    warehouse_id = Column(Integer, nullable=False)
    material_id = Column(Integer, nullable=False)
    movement_type = Column(PgEnum(StockMovementType, name="stock_movement_type"), nullable=False)
    qty_change = Column(Numeric(18, 4), nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False)
    currency = Column(String, nullable=True)
    total_price = Column(Numeric(14, 2), nullable=False)
    reference_doc_type = Column(String, nullable=True)
    reference_doc_id = Column(Integer, nullable=True)
    remarks = Column(String, nullable=True)