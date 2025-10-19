from sqlalchemy import (
    Table, Column, Integer, String, Numeric, Text, ForeignKey, DateTime, func, Enum, Boolean
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# app/models.py
from sqlalchemy import (
    Column, Integer, String, Numeric, Text, ForeignKey, DateTime, func, Boolean, BigInteger
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False, unique=True)
    description = Column(Text)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), nullable=False, unique=True)
    full_name = Column(String(255))
    auth0_sub = Column(String(255), unique=True)
    is_active = Column(Boolean, default=True)

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)

class Client(Base):
    __tablename__ = "clients"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)

class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)

class Material(Base):
    __tablename__ = "materials"
    id = Column(Integer, primary_key=True)
    code = Column(String(64), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    unit = Column(String(32), nullable=False)
    weight_per_unit = Column(Numeric(18,6))
    price = Column(Numeric(14,2), nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="UAH")

class StockCurrent(Base):
    __tablename__ = "stock_current"
    id = Column(Integer, primary_key=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    quantity = Column(Numeric(18,4), nullable=False, default=0)
    reserved_quantity = Column(Numeric(18,4), nullable=False, default=0)

class StockLedger(Base):
    __tablename__ = "stock_ledger"
    id = Column(BigInteger, primary_key=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    material_id = Column(Integer, ForeignKey("materials.id"))
    date_time = Column(DateTime, server_default=func.now())
    movement_type = Column(String(50))
    qty_change = Column(Numeric(18,4), nullable=False)
    unit_price = Column(Numeric(14,2))
    currency = Column(String(3))
    total_price = Column(Numeric(18,4))
    reference_doc_type = Column(String(50))
    reference_doc_id = Column(Integer)
    remarks = Column(Text)

class Receipt(Base):
    __tablename__ = "receipts"
    id = Column(Integer, primary_key=True)
    document_number = Column(String(100), nullable=False, unique=True)
    total_amount = Column(Numeric(18,4), nullable=False, default=0)

class ReceiptItem(Base):
    __tablename__ = "receipt_items"
    id = Column(Integer, primary_key=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    qty = Column(Numeric(18,4), nullable=False)
    unit_price = Column(Numeric(14,2), nullable=False)
    total_price = Column(Numeric(18,4))
