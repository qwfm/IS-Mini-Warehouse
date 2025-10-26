from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import (
    categories,
    suppliers,
    warehouses,
    materials,
    clients,
    issues,
    stock,
    receipts
)

app = FastAPI(
    title="Mini Warehouse API",
    description="Система управління складським обліком"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(categories.router)
app.include_router(suppliers.router)
app.include_router(warehouses.router)
app.include_router(materials.router)
app.include_router(clients.router)
app.include_router(issues.router)
app.include_router(stock.router)
app.include_router(receipts.router)


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