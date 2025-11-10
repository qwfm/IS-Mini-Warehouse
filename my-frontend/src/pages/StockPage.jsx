import { useEffect, useState } from "react";
import { useApi } from "../api/client";

export default function StockPage(){
  const api = useApi();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ warehouse_id: "", material_id: "" });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.warehouse_id) params.append("warehouse_id", filters.warehouse_id);
      if (filters.material_id) params.append("material_id", filters.material_id);
      
      const data = await api.get(`/api/stock/current?${params.toString()}`);
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ load(); }, []);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Current Stock</h1>
        <p className="text-slate-600 mt-1">View current inventory levels</p>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Filters</h3>
        <div className="form-grid-3">
          <div className="field">
            <label className="label">Warehouse ID</label>
            <input 
              type="number"
              placeholder="Filter by warehouse ID" 
              value={filters.warehouse_id}
              onChange={e=>setFilters({...filters, warehouse_id:e.target.value})}
            />
          </div>
          <div className="field">
            <label className="label">Material ID</label>
            <input 
              type="number"
              placeholder="Filter by material ID" 
              value={filters.material_id}
              onChange={e=>setFilters({...filters, material_id:e.target.value})}
            />
          </div>
          <div className="field flex items-end">
            <button onClick={load} className="btn-primary w-full">
              Search
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
          <p className="mt-4 text-slate-600">Loading stock...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-600">No stock records found</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th>Material</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Reserved</th>
                  <th className="text-right">Available</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>{
                  const available = Number(r.quantity) - Number(r.reserved_quantity);
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="font-medium">{r.warehouse_name || "—"}</div>
                      </td>
                      <td>
                        <div className="font-medium">
                          {r.material_code && <span className="text-slate-500">{r.material_code} — </span>}
                          {r.material_name || "—"}
                        </div>
                      </td>
                      <td className="text-right font-medium">{Number(r.quantity).toFixed(4)}</td>
                      <td className="text-right text-amber-600">{Number(r.reserved_quantity).toFixed(4)}</td>
                      <td className="text-right">
                        <span className={`font-medium ${available > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                          {available.toFixed(4)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}