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
  const [isFormOpen, setIsFormOpen] = useState(false);

  const load = async () => setRows(await api.get("/api/materials"));

  useEffect(()=>{ (async()=>{
    await load();
    
    const isAdmin = await hasRole("admin");
    const isStorekeeper = await hasRole("storekeeper");
    
    setCanWrite(isAdmin || isStorekeeper);
    
  })(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const payload = { code:form.code, name:form.name, unit:form.unit, price:+form.price, currency:form.currency };
    if (form.id) await api.put(`/api/materials/${form.id}`, payload);
    else await api.post("/api/materials", payload);
    
    resetForm();
    await load();
  };

  const resetForm = () => {
    setForm({ id:null, code:"", name:"", unit:"pcs", price:0, currency:"UAH" });
    setIsFormOpen(false);
  }

  const startEdit = (r) => {
    setForm({ ...r });
    setIsFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center">
        <div>
          <h2 className="page-title">Materials</h2>
          <p className="text-slate-600">Product catalog management</p>
        </div>
        {canWrite && !isFormOpen && (
          <button onClick={() => setIsFormOpen(true)} className="btn btn-primary">
            + New Material
          </button>
        )}
      </div>

      {canWrite && isFormOpen && (
        <div className="card bg-slate-50 border-slate-200">
          <h3 className="font-semibold mb-4">{form.id ? "Edit Material" : "Create Material"}</h3>
          <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-1">
               <label className="label">Code</label>
               <input className="input" placeholder="SKU-001" value={form.code} onChange={e=>setForm({...form, code:e.target.value})}/>
            </div>
            <div className="md:col-span-2">
               <label className="label">Name</label>
               <input className="input" placeholder="Material Name" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
            </div>
            <div className="md:col-span-1">
               <label className="label">Unit</label>
               <input className="input" placeholder="pcs, kg" value={form.unit} onChange={e=>setForm({...form, unit:e.target.value})}/>
            </div>
            <div className="md:col-span-1">
               <label className="label">Price</label>
               <input type="number" step="0.01" className="input" value={form.price} onChange={e=>setForm({...form, price:e.target.value})}/>
            </div>
             <div className="md:col-span-1">
               <label className="label">Currency</label>
               <div className="mt-1"><CurrencySelect value={form.currency} onChange={(v)=>setForm({...form, currency: v || "UAH"})} /></div>
            </div>
            
            <div className="md:col-span-6 flex justify-end gap-2 mt-2">
              <button type="button" onClick={resetForm} className="btn">Cancel</button>
              <button type="submit" className="btn btn-primary">{form.id ? "Save Changes" : "Create Material"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <table className="table w-full">
          <thead>
            <tr>
              <th className="w-16">ID</th>
              <th>Code</th>
              <th>Name</th>
              <th>Unit</th>
              <th className="text-right">Std Price</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td className="text-slate-500 text-sm">{r.id}</td>
                <td className="font-mono text-sm">{r.code}</td>
                <td className="font-medium">{r.name}</td>
                <td><span className="badge bg-slate-100 text-slate-600">{r.unit}</span></td>
                <td className="text-right">{Number(r.price).toFixed(2)} <span className="text-xs text-slate-500">{r.currency}</span></td>
                <td className="text-right">
                  {canWrite && (
                    <button onClick={()=>startEdit(r)} className="text-sky-600 hover:text-sky-800 font-medium text-sm">
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}