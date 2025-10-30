import { useEffect, useState } from "react";
import { useApi } from "../api/client";
import useAuthz from "../hooks/useAuthz";

export default function ClientsPage(){
  const api = useApi();
  const { hasRole, hasPerm } = useAuthz();
  const [rows, setRows] = useState([]);
  const [canWrite, setCanWrite] = useState(false);
  const [form, setForm] = useState({ id:null, name:"", contact_info:"" });

  const load = async () => setRows(await api.get("/api/clients"));

  useEffect(()=>{ (async()=>{
    await load();
    setCanWrite((await hasRole("admin")) || (await hasPerm("write:clients")));
  })(); }, []);

  const editing = form.id !== null;

  const submit = async (e) => {
    e.preventDefault();
    const payload = { name: form.name.trim(), contact_info: form.contact_info || null };
    if (!payload.name) return;

    if (editing) await api.put(`/api/clients/${form.id}`, payload);
    else         await api.post("/api/clients", payload);

    setForm({ id:null, name:"", contact_info:"" });
    await load();
  };

  const startEdit = (r) => setForm({ id:r.id, name:r.name ?? "", contact_info:r.contact_info ?? "" });
  const cancel = () => setForm({ id:null, name:"", contact_info:"" });
  const remove = async (id) => { if (confirm("Delete client?")) { await api.del(`/api/clients/${id}`); await load(); }};

  return (
    <div style={{padding:16, maxWidth:800}}>
      <h2>Clients</h2>
      {canWrite && (
        <form onSubmit={submit} style={{display:"grid", gridTemplateColumns:"1fr 2fr auto", gap:8, marginBottom:16}}>
          <input placeholder="name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
          <input placeholder="contact info" value={form.contact_info} onChange={e=>setForm({...form, contact_info:e.target.value})}/>
          <div>
            <button type="submit">{editing ? "Save" : "Create"}</button>{" "}
            {editing && <button type="button" onClick={cancel}>Cancel</button>}
          </div>
        </form>
      )}

      <ul>
        {rows.map(r=>(
          <li key={r.id}>
            <b>{r.name}</b>{r.contact_info ? ` — ${r.contact_info}` : ""}
            {canWrite && <>
              <button style={{marginLeft:8}} onClick={()=>startEdit(r)}>Edit</button>{" "}
              <button onClick={()=>remove(r.id)}>Delete</button>
            </>}
          </li>
        ))}
      </ul>
    </div>
  );
}
