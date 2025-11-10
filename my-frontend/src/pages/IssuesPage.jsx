import { useEffect, useMemo, useState } from "react";
import { useApi } from "../api/client";
import useAuthz from "../hooks/useAuthz";
import CurrencySelect from "../components/CurrencySelect";
import EditIssueModal from "./EditIssueModal";
import IssueDetailsModal from "./IssueDetailsModal";

const emptyItem = { material_id:"", warehouse_id:"", qty:"1", unit_price:"0", currency:"UAH", weight:"", notes:"" };

export default function IssuesPage(){
  const api = useApi();
  const { hasRole, hasPerm } = useAuthz();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);

  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [clients, setClients] = useState([]);
  const [availableMaterials, setAvailableMaterials] = useState([]);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewId, setViewId] = useState(null);

  const [form, setForm] = useState({
    document_number: "",
    client_id: "",
    currency: "UAH",
    notes: "",
    items: [ { ...emptyItem } ],
  });

  const loadLists = async () => {
    setLoading(true);
    try {
      const [docs, mats, whs, cls, avail] = await Promise.all([
        api.get("/api/issues"),
        api.get("/api/materials"),
        api.get("/api/warehouses"),
        api.get("/api/clients"),
        api.get("/api/stock/available-materials"),
      ]);
      setRows(docs);
      setMaterials(mats);
      setWarehouses(whs);
      setClients(cls);
      setAvailableMaterials(avail);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ (async()=>{
    await loadLists();
    setCanCreate((await hasRole("storekeeper")) || (await hasRole("admin")) || (await hasPerm("create:issues")));
  })(); }, []);

  // Фільтрація матеріалів для конкретного item
  const getAvailableForItem = (item) => {
    if (!item.warehouse_id) {
      // Якщо склад не вибраний — показуємо всі матеріали, що є на будь-якому складі
      return availableMaterials;
    }
    // Якщо склад вибраний — тільки матеріали з цього складу
    return availableMaterials.filter(am => am.warehouse_id === Number(item.warehouse_id));
  };

  // Отримати склади для матеріалу
  const getWarehousesForMaterial = (materialId) => {
    if (!materialId) return warehouses;
    const whIds = new Set(
      availableMaterials
        .filter(am => am.material_id === Number(materialId))
        .map(am => am.warehouse_id)
    );
    return warehouses.filter(w => whIds.has(w.id));
  };

  const addItem = () => setForm(f => ({...f, items: [...f.items, {...emptyItem, currency:f.currency}]}));
  
  const removeItem = (i) => setForm(f => ({...f, items: f.items.filter((_, idx)=> idx !== i)}));
  
  const setItem = (i, patch) => setForm(f => {
    const next = f.items.slice();
    const updated = {...next[i], ...patch};
    
    // Якщо змінився матеріал і склад ще не вибраний
    if (patch.material_id !== undefined && !updated.warehouse_id) {
      const whForMat = getWarehousesForMaterial(patch.material_id);
      // Якщо матеріал є тільки на одному складі — автоматично вибираємо
      if (whForMat.length === 1) {
        updated.warehouse_id = String(whForMat[0].id);
      }
      // Якщо змінився склад на один, де немає вибраного матеріалу — скидаємо матеріал
      if (updated.material_id) {
        const matExists = availableMaterials.some(
          am => am.material_id === Number(updated.material_id) && 
                am.warehouse_id === Number(whForMat[0]?.id)
        );
        if (!matExists) {
          updated.material_id = "";
        }
      }
    }
    
    // Якщо змінився склад
    if (patch.warehouse_id !== undefined && updated.material_id) {
      // Перевіряємо, чи є матеріал на новому складі
      const matExists = availableMaterials.some(
        am => am.material_id === Number(updated.material_id) && 
              am.warehouse_id === Number(patch.warehouse_id)
      );
      if (!matExists) {
        updated.material_id = "";
      }
    }
    
    next[i] = updated;
    return {...f, items: next};
  });

  const totals = useMemo(()=>{
    let sum = 0;
    for (const it of form.items) {
      sum += (Number(it.qty) || 0) * (Number(it.unit_price) || 0);
    }
    return { total: sum };
  }, [form.items]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.client_id) return alert("Select client");
    if (!form.items.length) return alert("Add at least one item");

    const payload = {
      document_number: form.document_number || undefined,
      client_id: Number(form.client_id),
      currency: form.currency || "UAH",
      notes: form.notes || null,
      items: form.items.map(it => ({
        material_id: Number(it.material_id),
        warehouse_id: it.warehouse_id ? Number(it.warehouse_id) : null,
        qty: Number(it.qty),
        unit_price: Number(it.unit_price),
        currency: it.currency || form.currency || "UAH",
        weight: it.weight ? Number(it.weight) : null,
        notes: it.notes || null,
        total_price: Number(it.qty) * Number(it.unit_price),
      }))
    };

    try {
      await api.post("/api/issues", payload);
      setForm({ document_number:"", client_id:"", currency:"UAH", notes:"", items:[{...emptyItem}] });
      await loadLists();
    } catch (e) {
      alert(e.message);
    }
  };

  const remove = async (row) => {
    if (!confirm(`Delete issue ${row.document_number || row.id}?`)) return;
    await api.del(`/api/issues/${row.id}`);
    await loadLists();
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Issues</h1>
        <p className="text-slate-600 mt-1">Manage outgoing goods issues</p>
      </div>

      {canCreate && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Create New Issue</h3>
          <form onSubmit={submit} className="space-y-6">
            <div className="form-grid-3">
              <div className="field">
                <label className="label">Document Number</label>
                <input 
                  placeholder="Optional" 
                  value={form.document_number}
                  onChange={e=>setForm({...form, document_number:e.target.value})}
                />
              </div>
              <div className="field">
                <label className="label">Client *</label>
                <select 
                  value={form.client_id} 
                  onChange={e=>setForm({...form, client_id:e.target.value})}
                  required
                >
                  <option value="">Select client</option>
                  {clients.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Currency</label>
                <CurrencySelect 
                  value={form.currency} 
                  onChange={(val)=>setForm({...form, currency: val || "UAH"})}
                />
              </div>
            </div>

            <div className="field">
              <label className="label">Notes</label>
              <textarea 
                placeholder="Optional notes" 
                value={form.notes} 
                onChange={e=>setForm({...form, notes:e.target.value})}
                rows={2}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0">Items *</label>
                <button type="button" onClick={addItem} className="btn btn-sm">
                  + Add Item
                </button>
              </div>

              <div className="space-y-2">
                {form.items.map((it, idx)=>{
                  const availForItem = getAvailableForItem(it);
                  const whForMaterial = getWarehousesForMaterial(it.material_id);
                  
                  return (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="field lg:col-span-2">
                          <label className="label text-xs">
                            Warehouse {it.warehouse_id && "(filters materials)"}
                          </label>
                          <select 
                            value={it.warehouse_id} 
                            onChange={e=>setItem(idx,{warehouse_id:e.target.value})}
                          >
                            <option value="">All warehouses</option>
                            {whForMaterial.map(w=> (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="field lg:col-span-2">
                          <label className="label text-xs">
                            Material ({availForItem.length} available)
                          </label>
                          <select 
                            value={it.material_id} 
                            onChange={e=>setItem(idx,{material_id:e.target.value})}
                          >
                            <option value="">Select material</option>
                            {availForItem.map(am=> {
                              const wh = warehouses.find(w => w.id === am.warehouse_id);
                              return (
                                <option key={`${am.material_id}-${am.warehouse_id}`} value={am.material_id}>
                                  {am.material_code} — {am.material_name} 
                                  {!it.warehouse_id && ` @ ${wh?.name || am.warehouse_id}`}
                                  {` (avail: ${am.available})`}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        
                        <div className="field">
                          <label className="label text-xs">Quantity</label>
                          <input 
                            type="number" 
                            step="0.0001" 
                            value={it.qty} 
                            onChange={e=>setItem(idx,{qty:e.target.value})}
                          />
                        </div>
                        <div className="field">
                          <label className="label text-xs">Unit Price</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            value={it.unit_price} 
                            onChange={e=>setItem(idx,{unit_price:e.target.value})}
                          />
                        </div>
                        <div className="field">
                          <label className="label text-xs">Currency</label>
                          <CurrencySelect 
                            value={it.currency || form.currency} 
                            onChange={(val)=>setItem(idx,{currency: val || form.currency})}
                          />
                        </div>
                        <div className="field">
                          <label className="label text-xs">Weight</label>
                          <input 
                            type="number" 
                            step="0.000001" 
                            placeholder="Optional" 
                            value={it.weight} 
                            onChange={e=>setItem(idx,{weight:e.target.value})}
                          />
                        </div>
                        
                        <div className="field lg:col-span-3">
                          <label className="label text-xs">Notes</label>
                          <input 
                            placeholder="Optional" 
                            value={it.notes} 
                            onChange={e=>setItem(idx,{notes:e.target.value})}
                          />
                        </div>
                        <div className="field">
                          <label className="label text-xs">Line Total</label>
                          <div className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-medium">
                            {((Number(it.qty)||0)*(Number(it.unit_price)||0)).toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button 
                          type="button" 
                          onClick={()=>removeItem(idx)} 
                          className="btn-danger btn-sm"
                        >
                          Remove Item
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="text-lg font-semibold">
                Total: <span className="text-sky-600">{totals.total.toFixed(2)} {form.currency}</span>
              </div>
              <button type="submit" className="btn-primary">
                Create Issue
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
          <p className="mt-4 text-slate-600">Loading issues...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-600">No issues yet</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Document #</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Currency</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>(
                  <tr key={r.id}>
                    <td className="font-medium">{r.document_number || r.id}</td>
                    <td>{r.client_name || r.client_id || "—"}</td>
                    <td>{r.date?.slice(0,10)}</td>
                    <td>{r.currency}</td>
                    <td className="text-right font-medium">{r.total_amount}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button onClick={()=>{setViewId(r.id); setViewOpen(true);}} className="btn btn-sm">
                          View
                        </button>
                        <button onClick={()=>{setEditing(r); setEditOpen(true);}} className="btn btn-sm">
                          Edit
                        </button>
                        <button onClick={()=>remove(r)} className="btn-danger btn-sm">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EditIssueModal
        open={editOpen}
        onClose={()=>setEditOpen(false)}
        issue={editing || {}}
        materials={materials}
        warehouses={warehouses}
        clients={clients}
        onSaved={loadLists}
        api={api}
      />
      
      <IssueDetailsModal
        open={viewOpen}
        onClose={()=>setViewOpen(false)}
        issueId={viewId}
        materials={materials}
        warehouses={warehouses}
      />
    </div>
  );
}