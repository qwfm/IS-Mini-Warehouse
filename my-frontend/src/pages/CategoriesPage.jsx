import { useEffect, useMemo, useState } from "react";
import { useApi } from "../api/client";
import useAuthz from "../hooks/useAuthz";

export default function CategoriesPage() {
  const api = useApi();
  const { hasRole, hasPerm } = useAuthz();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [form, setForm] = useState({ id:null, name:"", description:"" });
  const editing = useMemo(()=> form.id !== null, [form.id]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get("/api/categories");
      setRows(data);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      await load();
      // дозвіл або по ролі admin, або по scope write:categories
      setCanWrite( (await hasRole("admin")) || (await hasPerm("write:categories")) );
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (editing) {
      await api.put(`/api/categories/${form.id}`, { name: form.name, description: form.description || null });
    } else {
      await api.post("/api/categories", { name: form.name, description: form.description || null });
    }
    setForm({ id:null, name:"", description:"" });
    await load();
  };

  const startEdit = (row) => setForm({ id: row.id, name: row.name, description: row.description ?? "" });
  const cancel = () => setForm({ id:null, name:"", description:"" });
  const remove = async (id) => { if (confirm("Delete?")) { await api.del(`/api/categories/${id}`); await load(); }};

  return (
    <div style={{padding:16, maxWidth:800}}>
      <h2>Categories</h2>

      {loading ? <p>Loading…</p> : (
        <>
          {canWrite && (
            <form onSubmit={submit} style={{display:"grid", gap:8, marginBottom:16}}>
              <input placeholder="Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
              <textarea placeholder="Description" value={form.description} onChange={e=>setForm({...form, description:e.target.value})}/>
              <div style={{display:"flex", gap:8}}>
                <button type="submit">{editing ? "Save" : "Create"}</button>
                {editing && <button type="button" onClick={cancel}>Cancel</button>}
              </div>
            </form>
          )}

          <table width="100%" cellPadding="6" style={{borderCollapse:"collapse"}}>
            <thead>
              <tr><th align="left">Name</th><th align="left">Description</th><th/></tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id} style={{borderTop:"1px solid #ddd"}}>
                  <td>{r.name}</td>
                  <td>{r.description}</td>
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
        </>
      )}
    </div>
  );
}

