import { useEffect, useState } from "react";
import { useApi } from "../api/client";
import useAuthz from "../hooks/useAuthz";
import EditReceiptModal from "./EditReceiptModal"; // Переконайтесь, що шлях правильний
import ReceiptDetailsModal from "./ReceiptDetailsModal"; // Переконайтесь, що шлях правильний

export default function ReceiptsPage() {
  const api = useApi();
  const { hasRole } = useAuthz();

  // Дані
  const [rows, setRows] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stock, setStock] = useState([]); // Додано: для фільтрації в модалці
  
  // Стан UI
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  // Модальні вікна
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  
  const [viewOpen, setViewOpen] = useState(false);
  const [viewId, setViewId] = useState(null);

  // Завантаження всіх даних
  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, mData, wData, sData, stData] = await Promise.all([
        api.get("/api/receipts"),
        api.get("/api/materials?is_active=true"),
        api.get("/api/warehouses"),
        api.get("/api/suppliers"),
        api.get("/api/stock/current") // Завантажуємо залишки
      ]);
      
      setRows(rData);
      setMaterials(mData);
      setWarehouses(wData);
      setSuppliers(sData);
      setStock(stData); // Зберігаємо залишки
    } catch (e) {
      console.error("Failed to load receipts data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadData();
      const isAdmin = await hasRole("admin");
      const isStorekeeper = await hasRole("storekeeper");
      
      setCanCreate(isAdmin || isStorekeeper);
      setCanDelete(isAdmin);
    })();
  }, []);

  const handleCreate = () => {
    setEditing(null); 
    setEditOpen(true);
  };

  const handleEdit = (row) => {
    setEditing(row);
    setEditOpen(true);
  };

  const remove = async (row) => {
    if (!confirm(`Delete receipt ${row.document_number}? This will revert stock changes.`)) return;
    await api.del(`/api/receipts/${row.id}`);
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Receipts</h1>
          <p className="text-slate-600">Incoming goods management</p>
        </div>
        {canCreate && (
          <button onClick={handleCreate} className="btn btn-primary">
            + New Receipt
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-500">Loading data...</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="w-16">ID</th>
                  <th>Number</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Currency</th>
                  <th className="text-right">Total Amount</th>
                  <th className="text-right w-48">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-6 text-slate-500">
                      No receipts found.
                    </td>
                  </tr>
                ) : (
                  rows.map(r => {
                    const supplierName = suppliers.find(s => s.id === r.supplier_id)?.name || r.supplier_id;
                    return (
                      <tr key={r.id}>
                        <td className="text-slate-500 text-xs">{r.id}</td>
                        <td className="font-medium">{r.document_number}</td>
                        <td>{supplierName}</td>
                        <td className="text-slate-600">
                          {new Date(r.date).toLocaleDateString()}
                        </td>
                        <td><span className="badge bg-slate-100">{r.currency}</span></td>
                        <td className="text-right font-mono font-medium">
                          {Number(r.total_amount).toFixed(2)}
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => { setViewId(r.id); setViewOpen(true); }} 
                              className="btn btn-sm"
                            >
                              View
                            </button>
                            {canCreate && (
                              <button 
                                onClick={() => handleEdit(r)} 
                                className="text-sky-600 hover:bg-sky-50 px-2 py-1 rounded text-sm font-medium transition-colors"
                              >
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button 
                                onClick={() => remove(r)} 
                                className="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded text-sm font-medium transition-colors"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Модалка редагування */}
      <EditReceiptModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        receipt={editing}
        materials={materials}
        warehouses={warehouses}
        suppliers={suppliers}
        stock={stock} // Передаємо залишки
        api={api}
        onSaved={loadData}
      />

      {/* Модалка перегляду */}
      <ReceiptDetailsModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        receiptId={viewId}
        materials={materials}
        warehouses={warehouses}
      />
    </div>
  );
}