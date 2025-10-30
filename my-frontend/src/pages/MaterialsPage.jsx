import { useEffect, useState } from "react";
import { useApi } from "../api/client";
import useAuthz from "../hooks/useAuthz";
import CurrencySelect from "../components/CurrencySelect";

export default function MaterialsPage() {
  const api = useApi();
  const { hasRole } = useAuthz();

  const [rows, setRows] = useState([]);
  const [canWrite, setCanWrite] = useState(false);
  const [form, setForm] = useState({ id:null, code:"", name:"", unit:"pcs", price:0, currency:"UAH" });

  const load = async () => setRows(await api.get("/api/materials"));

  useEffect(()=>{ (async()=>{
    await load();
    setCanWrite(await hasRole("admin"));
  })(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const payload = { code:form.code, name:form.name, unit:form.unit, price:+form.price, currency:form.currency };
    if (form.id) await api.put(`/api/materials/${form.id}`, payload);
    else await api.post("/api/materials", payload);
    setForm({ id:null, code:"", name:"", unit:"pcs", price:0, currency:"UAH" });
    await load();
  };

  return (
    <div style={{padding:16}}>
      <h2>Materials</h2>
      {canWrite && (
        <form onSubmit={save} style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:16}}>
          <input placeholder="code" value={form.code} onChange={e=>setForm({...form, code:e.target.value})}/>
          <input placeholder="name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
          <input placeholder="unit" value={form.unit} onChange={e=>setForm({...form, unit:e.target.value})}/>
          <input type="number" step="0.01" placeholder="price" value={form.price} onChange={e=>setForm({...form, price:e.target.value})}/>
          <CurrencySelect value={form.currency} onChange={(v)=>setForm({...form, currency: v || "UAH"})} />
          <button>{form.id ? "Save" : "Create"}</button>
        </form>
      )}
      <ul>
        {rows.map(r=>(
          <li key={r.id}>
            <b>{r.code}</b> — {r.name} ({r.unit}) — {r.price} {r.currency}
            {canWrite && <button style={{marginLeft:8}} onClick={()=>setForm({ id:r.id, code:r.code, name:r.name, unit:r.unit, price:r.price, currency:r.currency })}>Edit</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
