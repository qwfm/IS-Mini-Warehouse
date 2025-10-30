import { useEffect, useState } from "react";
import { useApi } from "../api/client";
import useAuthz from "../hooks/useAuthz";

export default function WarehousesPage(){
  const api = useApi();
  const { hasRole, hasPerm } = useAuthz();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [form, setForm] = useState({
    id:null, name:"", address:"", capacity:"", capacity_unit:""
  });

  const load = async () => {
    setLoading(true);
    try { setRows(await api.get("/api/warehouses")); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ (async()=>{
    await load();
    setCanWrite((await hasRole("admin")) || (await hasPerm("write:warehouses")));
  })(); }, []);

  const editing = form.id !== null;

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      address: form.address || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      capacity_unit: form.capacity_unit || null
    };
    if (!payload.name) return;

    if (editing) await api.put(`/api/warehouses/${form.id}`, payload);
    else         await api.post("/api/warehouses", payload);

    setForm({ id:null, name:"", address:"", capacity:"", capacity_unit:"" });
    await load();
  };

  const startEdit = (r) => setForm({
    id:r.id, name:r.name ?? "", address:r.address ?? "",
    capacity:r.capacity ?? "", capacity_unit:r.capacity_unit ?? ""
  });

  const cancel = () => setForm({ id:null, name:"", address:"", capacity:"", capacity_unit:"" });

  const remove = async (id) => { if (confirm("Delete warehouse?")) { await api.del(`/api/warehouses/${id}`); await load(); }};

  return (
    <div style={{padding:16, maxWidth:900}}>
      <h2>Warehouses</h2>

      {canWrite && (
        <form onSubmit={submit} style={{display:"grid", gridTemplateColumns:"2fr 3fr 1fr 1fr auto", gap:8, marginBottom:16}}>
          <input placeholder="name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
          <input placeholder="address" value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/>
          <input type="number" step="0.01" placeholder="capacity" value={form.capacity} onChange={e=>setForm({...form, capacity:e.target.value})}/>
          <input placeholder="unit" value={form.capacity_unit} onChange={e=>setForm({...form, capacity_unit:e.target.value})}/>
          <div>
            <button type="submit">{editing ? "Save" : "Create"}</button>{" "}
            {editing && <button type="button" onClick={cancel}>Cancel</button>}
          </div>
        </form>
      )}

      {loading ? <p>Loading…</p> : (
        <table width="100%" cellPadding="6" style={{borderCollapse:"collapse"}}>
          <thead><tr>
            <th align="left">Name</th><th align="left">Address</th><th>Capacity</th><th>Unit</th><th/>
          </tr></thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id} style={{borderTop:"1px solid #ddd"}}>
                <td>{r.name}</td>
                <td>{r.address}</td>
                <td align="right">{r.capacity ?? "-"}</td>
                <td align="center">{r.capacity_unit ?? "-"}</td>
                <td align="right" style={{whiteSpace:"nowrap"}}>
                  {canWrite && <>
                    <button onClick={()=>startEdit(r)}>Edit</button>{" "}
                    <button onClick={()=>remove(r.id)}>Delete</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
