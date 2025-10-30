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
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canCreate, setCanCreate] = useState(false);

  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [clients, setClients] = useState([]);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewId, setViewId] = useState(null);

  const openView = (row) => { setViewId(row.id); setViewOpen(true); };
  const closeView = () => setViewOpen(false);

  const openEdit = (row) => { setEditing(row); setEditOpen(true); };
  const closeEdit = () => setEditOpen(false);

  const remove = async (row) => {
    if (!confirm(`Delete issue ${row.document_number || row.id}?`)) return;
    await api.del(`/api/issues/${row.id}`);
    await loadLists();
  };

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
      const [docs, mats, whs, cls] = await Promise.all([
        api.get("/api/issues"),
        api.get("/api/materials"),
        api.get("/api/warehouses"),
        api.get("/api/clients"),
      ]);
      setRows(docs);
      setMaterials(mats);
      setWarehouses(whs);
      setClients(cls);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ (async()=>{
    await loadLists();
    setCanCreate((await hasRole("storekeeper")) || (await hasRole("admin")) || (await hasPerm("create:issues")));
  })(); }, []);

  const addItem = () => setForm(f => ({...f, items: [...f.items, {...emptyItem}]}));
  const removeItem = (i) => setForm(f => ({...f, items: f.items.filter((_, idx)=> idx !== i)}));
  const setItem = (i, patch) => setForm(f => {
    const next = f.items.slice();
    next[i] = {...next[i], ...patch};
    return {...f, items: next};
  });

  const totals = useMemo(()=>{
    let sum = 0;
    for (const it of form.items) {
      const qty = Number(it.qty) || 0;
      const up  = Number(it.unit_price) || 0;
      sum += qty * up;
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
      if (form.__editId) {
        await api.put(`/api/issues/${form.__editId}`, payload);
      } else {
        await api.post("/api/issues", payload);
      }
      setForm({ document_number:"", client_id:"", currency:"UAH", notes:"", items:[{...emptyItem}], __editId: undefined });
      await loadLists();
    } catch (e) {
      alert(e.message); // тепер побачиш конкретне detail, напр. "Material 3 not available in warehouse 1"
    }
    setForm({ document_number:"", client_id:"", currency:"UAH", notes:"", items:[{...emptyItem}], __editId: undefined });   
    await loadLists();
  };

  return (
    <div style={{padding:16, maxWidth:1000}}>
      <h2>Issues</h2>

      {canCreate && (
        <form onSubmit={submit} style={{display:"grid", gap:12, marginBottom:24}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8}}>
            <input placeholder="Document number (optional)" value={form.document_number}
                   onChange={e=>setForm({...form, document_number:e.target.value})}/>
            <select value={form.client_id} onChange={e=>setForm({...form, client_id:e.target.value})}>
              <option value="">-- client --</option>
              {clients.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <CurrencySelect value={form.currency} onChange={(val)=>setForm({...form, currency: val || "UAH"})}/>
          </div>

          <textarea placeholder="Notes" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/>

          <div>
            <h4 style={{margin:"8px 0"}}>Items</h4>
            {form.items.map((it, idx)=>(
              <div key={idx} style={{display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr 1fr 2fr auto", gap:6, alignItems:"center", marginBottom:6}}>
                <select value={it.material_id} onChange={e=>setItem(idx,{material_id:e.target.value})}>
                  <option value="">material</option>
                  {materials.map(m=> <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                </select>
                <select value={it.warehouse_id} onChange={e=>setItem(idx,{warehouse_id:e.target.value})}>
                  <option value="">warehouse</option>
                  {warehouses.map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <input type="number" step="0.0001" placeholder="qty" value={it.qty} onChange={e=>setItem(idx,{qty:e.target.value})}/>
                <input type="number" step="0.01" placeholder="unit price" value={it.unit_price} onChange={e=>setItem(idx,{unit_price:e.target.value})}/>
                <CurrencySelect placeholder="item currency" value={it.currency || form.currency} onChange={(val)=>setItem(idx, { currency: val || form.currency })}/>
                <input type="number" step="0.000001" placeholder="weight" value={it.weight} onChange={e=>setItem(idx,{weight:e.target.value})}/>
                <input placeholder="notes" value={it.notes} onChange={e=>setItem(idx,{notes:e.target.value})}/>
                <div style={{textAlign:"right"}}>{(Number(it.qty||0)*Number(it.unit_price||0)).toFixed(2)}</div>
                <button type="button" onClick={()=>removeItem(idx)} style={{marginLeft:6}}>✕</button>
              </div>
            ))}
            <button type="button" onClick={addItem}>+ Add item</button>
          </div>

          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div><b>Total:</b> {totals.total.toFixed(2)} {form.currency}</div>
            <button type="submit">Create issue</button>
          </div>
        </form>
      )}

      {loading ? <p>Loading…</p> : (
        <>
        <table width="100%" cellPadding="6" style={{borderCollapse:"collapse"}}>

          <thead>
              <tr>
                <th align="left">#</th>
                <th>Client</th>
                <th>Date</th>
                <th>Currency</th>
                <th align="right">Total</th>
                <th>Actions</th> 
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} style={{borderTop:"1px solid #ddd"}}>
                  <td>{r.document_number || r.id}</td>
                  <td align="center">{r.client_name || r.client_id || "-"}</td>
                  <td align="center">{r.date?.slice(0,10)}</td>
                  <td align="center">{r.currency}</td>
                  <td align="right">{r.total_amount}</td>
                  <td align="center" style={{whiteSpace:"nowrap"}}>
                    <button onClick={()=>openView(r)} style={{marginRight:8}}>View</button>
                    <button onClick={()=>openEdit(r)} style={{marginRight:8}}>Edit</button>
                    <button onClick={()=>remove(r)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
        </table>
        <EditIssueModal
          open={editOpen}
          onClose={closeEdit}
          issue={editing || {}}
          materials={materials}
          warehouses={warehouses}
          clients={clients}
          api={api}
          onSaved={loadLists}
        />
        <IssueDetailsModal
          open={viewOpen}
          onClose={closeView}
          issueId={viewId}
          materials={materials}
          warehouses={warehouses}
        />
        </>
      )}
    </div>
  );
}
