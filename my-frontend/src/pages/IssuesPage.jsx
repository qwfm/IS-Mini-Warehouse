import { useEffect, useState } from "react";
import { useApi } from "../api/client";
import useAuthz from "../hooks/useAuthz";
import EditIssueModal from "./EditIssueModal"; // Перевірте шлях імпорту (або ../components/EditIssueModal)
import IssueDetailsModal from "./IssueDetailsModal"; // Перевірте шлях імпорту

export default function IssuesPage() {
  const api = useApi();
  const { hasRole } = useAuthz();

  // Дані
  const [rows, setRows] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [clients, setClients] = useState([]);
  const [stock, setStock] = useState([]); // Додано: для контролю наявності

  // Стан UI
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  // Модальні вікна
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  
  const [viewOpen, setViewOpen] = useState(false);
  const [viewId, setViewId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, mData, wData, cData, stData] = await Promise.all([
        api.get("/api/issues"),
        api.get("/api/materials?is_active=true"),
        api.get("/api/warehouses"),
        api.get("/api/clients"),
        api.get("/api/stock/current") // Завантажуємо актуальні залишки
      ]);
      
      setRows(rData);
      setMaterials(mData);
      setWarehouses(wData);
      setClients(cData);
      setStock(stData);
    } catch (e) {
      console.error("Failed to load issues data", e);
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
    if (!confirm(`Delete issue ${row.document_number}? This will return items to stock.`)) return;
    await api.del(`/api/issues/${row.id}`);
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Issues</h1>
          <p className="text-slate-600">Sales and outgoing items</p>
        </div>
        {canCreate && (
          <button onClick={handleCreate} className="btn btn-primary">
            + New Issue
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
                  <th>Client</th>
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
                      No issues found.
                    </td>
                  </tr>
                ) : (
                  rows.map(r => {
                    const clientName = clients.find(c => c.id === r.client_id)?.name || r.client_id;
                    return (
                      <tr key={r.id}>
                        <td className="text-slate-500 text-xs">{r.id}</td>
                        <td className="font-medium">{r.document_number}</td>
                        <td>{clientName}</td>
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
      <EditIssueModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        issue={editing}
        materials={materials}
        warehouses={warehouses}
        clients={clients}
        stock={stock} // Передаємо залишки для фільтрації
        api={api}
        onSaved={loadData}
      />

      {/* Модалка перегляду */}
      <IssueDetailsModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        issueId={viewId}
        materials={materials}
        warehouses={warehouses}
      />
    </div>
  );
}