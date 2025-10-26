from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, Boolean, Text, DateTime, Enum as PgEnum
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()

class StockMovementType(enum.Enum):
    receipt = "receipt"
    issue = "issue"
    adjustment = "adjustment"
    transfer = "transfer"
    reservation = "reservation"
    release_reservation = "release_reservation"
    return_ = "return"

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False, unique=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    materials = relationship("Material", back_populates="category")

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, unique=True)
    full_name = Column(String(255))
    auth0_sub = Column(String(255), unique=True) 
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    contact_info = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    receipts = relationship("Receipt", back_populates="supplier")

class Client(Base):
    __tablename__ = "clients"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    contact_info = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    issues = relationship("Issue", back_populates="client")

class Warehouse(Base):
    __tablename__ = "warehouses"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    address = Column(Text)
    manager_name = Column(String(200))
    capacity = Column(Numeric(18, 4))
    capacity_unit = Column(String(32))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    stock_current = relationship("StockCurrent", back_populates="warehouse")

class Material(Base):
    __tablename__ = "materials"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(64), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    unit = Column(String(32), nullable=False)
    weight_per_unit = Column(Numeric(18, 6))
    description = Column(Text)
    price = Column(Numeric(14, 2), nullable=False, default=0)
    currency = Column(String(3), nullable=False, default="UAH")
    min_stock = Column(Numeric(18, 4), nullable=False, default=0)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"))
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    category = relationship("Category", back_populates="materials")
    stock_current = relationship("StockCurrent", back_populates="material")

class StockCurrent(Base):
    __tablename__ = "stock_current"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Numeric(18, 4), nullable=False, default=0)
    reserved_quantity = Column(Numeric(18, 4), nullable=False, default=0)
    last_updated = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    warehouse = relationship("Warehouse", back_populates="stock_current")
    material = relationship("Material", back_populates="stock_current")

class StockLedger(Base):
    __tablename__ = "stock_ledger"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="SET NULL"))
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="SET NULL"))
    date_time = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    movement_type = Column(PgEnum(StockMovementType, name="stock_movement_type"), nullable=False)
    qty_change = Column(Numeric(18, 4), nullable=False)
    unit_price = Column(Numeric(14, 2))
    currency = Column(String(3))
    total_price = Column(Numeric(18, 4))
    reference_doc_type = Column(String(50))
    reference_doc_id = Column(Integer)
    remarks = Column(Text)

class Receipt(Base):
    __tablename__ = "receipts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_number = Column(String(100), nullable=False, unique=True)
    date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="SET NULL"))
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    currency = Column(String(3), nullable=False, default="UAH")
    total_amount = Column(Numeric(18, 4), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    notes = Column(Text)
    
    supplier = relationship("Supplier", back_populates="receipts")
    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")

class ReceiptItem(Base):
    __tablename__ = "receipt_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="RESTRICT"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="SET NULL"))
    qty = Column(Numeric(18, 4), nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="UAH")
    total_price = Column(Numeric(18, 4), nullable=False)
    weight = Column(Numeric(18, 6))
    notes = Column(Text)
    
    receipt = relationship("Receipt", back_populates="items")

class Issue(Base):
    __tablename__ = "issues"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    document_number = Column(String(100), nullable=False, unique=True)
    date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="SET NULL"))
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    currency = Column(String(3), nullable=False, default="UAH")
    total_amount = Column(Numeric(18, 4), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    notes = Column(Text)
    
    client = relationship("Client", back_populates="issues")
    items = relationship("IssueItem", back_populates="issue", cascade="all, delete-orphan")

class IssueItem(Base):
    __tablename__ = "issue_items"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_id = Column(Integer, ForeignKey("issues.id", ondelete="CASCADE"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id", ondelete="RESTRICT"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="SET NULL"))
    qty = Column(Numeric(18, 4), nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="UAH")
    total_price = Column(Numeric(18, 4), nullable=False)
    weight = Column(Numeric(18, 6))
    notes = Column(Text)
    
    issue = relationship("Issue", back_populates="items")