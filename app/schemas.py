from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal

class CategoryBase(BaseModel):
    name: str = Field(..., max_length=150)
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=150)
    description: Optional[str] = None

class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class SupplierBase(BaseModel):
    name: str = Field(..., max_length=255)
    contact_info: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    contact_info: Optional[str] = None

class SupplierResponse(SupplierBase):
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ClientBase(BaseModel):
    name: str = Field(..., max_length=255)
    contact_info: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    contact_info: Optional[str] = None

class ClientResponse(ClientBase):
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class WarehouseBase(BaseModel):
    name: str = Field(..., max_length=200)
    address: Optional[str] = None
    manager_name: Optional[str] = Field(None, max_length=200)
    capacity: Optional[Decimal] = None
    capacity_unit: Optional[str] = Field(None, max_length=32)

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    address: Optional[str] = None
    manager_name: Optional[str] = Field(None, max_length=200)
    capacity: Optional[Decimal] = None
    capacity_unit: Optional[str] = Field(None, max_length=32)

class WarehouseResponse(WarehouseBase):
    id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class MaterialBase(BaseModel):
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=255)
    unit: str = Field(..., max_length=32)
    weight_per_unit: Optional[Decimal] = None
    description: Optional[str] = None
    price: Decimal = Field(default=Decimal("0.00"))
    currency: str = Field(default="UAH", max_length=3)
    min_stock: Decimal = Field(default=Decimal("0.0000"))
    category_id: Optional[int] = None
    is_active: bool = True

class MaterialCreate(MaterialBase):
    pass

class MaterialUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=64)
    name: Optional[str] = Field(None, max_length=255)
    unit: Optional[str] = Field(None, max_length=32)
    weight_per_unit: Optional[Decimal] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    currency: Optional[str] = Field(None, max_length=3)
    min_stock: Optional[Decimal] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None

class MaterialResponse(MaterialBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class ReceiptItemCreate(BaseModel):
    material_id: int
    warehouse_id: Optional[int] = None
    qty: Decimal
    unit_price: Decimal
    currency: str = "UAH"
    weight: Optional[Decimal] = None
    notes: Optional[str] = None

class ReceiptItemResponse(BaseModel):
    id: int
    receipt_id: int
    material_id: int
    warehouse_id: Optional[int] = None
    qty: Decimal
    unit_price: Decimal
    currency: str
    total_price: Decimal
    weight: Optional[Decimal] = None
    notes: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class ReceiptCreate(BaseModel):
    document_number: str = Field(..., max_length=100)
    supplier_id: Optional[int] = None
    currency: str = "UAH"
    notes: Optional[str] = None
    items: list[ReceiptItemCreate]

class ReceiptResponse(BaseModel):
    id: int
    document_number: str
    date: datetime
    supplier_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    currency: str
    total_amount: Decimal
    created_at: datetime
    notes: Optional[str] = None
    items: list[ReceiptItemResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

class IssueItemCreate(BaseModel):
    material_id: int
    warehouse_id: Optional[int] = None
    qty: Decimal
    unit_price: Decimal
    currency: str = "UAH"
    weight: Optional[Decimal] = None
    notes: Optional[str] = None

class IssueItemResponse(BaseModel):
    id: int
    issue_id: int
    material_id: int
    warehouse_id: Optional[int] = None
    qty: Decimal
    unit_price: Decimal
    currency: str
    total_price: Decimal
    weight: Optional[Decimal] = None
    notes: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class IssueCreate(BaseModel):
    document_number: str = Field(..., max_length=100)
    client_id: Optional[int] = None
    currency: str = "UAH"
    notes: Optional[str] = None
    items: list[IssueItemCreate]

class IssueResponse(BaseModel):
    id: int
    document_number: str
    date: datetime
    client_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    currency: str
    total_amount: Decimal
    created_at: datetime
    notes: Optional[str] = None
    items: list[IssueItemResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

class StockCurrentResponse(BaseModel):
    id: int
    warehouse_id: int
    material_id: int
    quantity: Decimal
    reserved_quantity: Decimal
    last_updated: datetime
    
    model_config = ConfigDict(from_attributes=True)