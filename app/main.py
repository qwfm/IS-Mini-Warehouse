from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .security import require_auth

from .routers import (
    categories,
    suppliers,
    warehouses,
    materials,
    clients,
    issues,
    stock,
    receipts,
    users,
    stock_ledger,
    dashboard
)

app = FastAPI(
    title="Mini Warehouse API",
    description="Система управління складським обліком"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Type"]
)

app.include_router(categories.router)
app.include_router(suppliers.router)
app.include_router(warehouses.router)
app.include_router(materials.router)
app.include_router(clients.router)
app.include_router(issues.router)
app.include_router(stock.router)
app.include_router(stock_ledger.router)
app.include_router(receipts.router)
app.include_router(users.router)
app.include_router(dashboard.router)

@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "mini-warehouse"}


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Mini Warehouse API",
        "docs": "/docs"
    }