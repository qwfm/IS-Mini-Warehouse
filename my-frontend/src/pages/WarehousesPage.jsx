import { useEffect, useState } from "react";
import { useApi } from "../api/client";
import useAuthz from "../hooks/useAuthz";

export default function WarehousesPage(){
  const api = useApi();
  const { hasRole, hasPerm } = useAuthz();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [form, setForm] = useState({ id:null, name:"", address:"", capacity:"", capacity_unit:"" });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setRows(await api.get("/api/warehouses")); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ (async()=>{
    await load();
    setCanWrite((await hasRole("admin")) || (await hasPerm("write:warehouses")));
  })(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      address: form.address || null,
      capacity: form.capacity ? Number(form.capacity) : null,
      capacity_unit: form.capacity_unit || null
    };
    if (!payload.name) return;

    if (form.id) await api.put(`/api/warehouses/${form.id}`, payload);
    else         await api.post("/api/warehouses", payload);
    
    resetForm();
    await load();
  };

  const resetForm = () => {
    setForm({ id:null, name:"", address:"", capacity:"", capacity_unit:"" });
    setIsFormOpen(false);
  }

  const startEdit = (r) => {
    setForm({ 
      id:r.id, 
      name:r.name, 
      address:r.address??"", 
      capacity:r.capacity??"", 
      capacity_unit:r.capacity_unit??"" 
    });
    setIsFormOpen(true);
  }

  const remove = async (id) => { 
    if(confirm("Delete warehouse?")) { await api.del(`/api/warehouses/${id}`); await load(); }
  };

  return (
    <div className="space-y-6">
       <div className="page-header flex justify-between items-center">
        <div>
           <h2 className="page-title">Warehouses</h2>
           <p className="text-slate-600">Manage storage locations</p>
        </div>
        {canWrite && !isFormOpen && (
          <button onClick={() => setIsFormOpen(true)} className="btn btn-primary">
            + New Warehouse
          </button>
        )}
      </div>

      {canWrite && isFormOpen && (
        <div className="card bg-slate-50 border-slate-200">
           <h3 className="font-semibold mb-4">{form.id ? "Edit Warehouse" : "Create Warehouse"}</h3>
           <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="md:col-span-1">
               <label className="label">Name</label>
               <input className="input" placeholder="Main Warehouse" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
             </div>
             <div className="md:col-span-1">
               <label className="label">Address</label>
               <input className="input" placeholder="Location address" value={form.address} onChange={e=>setForm({...form, address:e.target.value})}/>
             </div>
             <div className="md:col-span-1">
               <label className="label">Capacity</label>
               <input type="number" step="0.01" className="input" value={form.capacity} onChange={e=>setForm({...form, capacity:e.target.value})}/>
             </div>
             <div className="md:col-span-1">
               <label className="label">Unit</label>
               <input className="input" placeholder="m3, sq.m" value={form.capacity_unit} onChange={e=>setForm({...form, capacity_unit:e.target.value})}/>
             </div>
             <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={resetForm} className="btn">Cancel</button>
                <button type="submit" className="btn btn-primary">{form.id ? "Save" : "Create"}</button>
             </div>
           </form>
        </div>
      )}

      {loading ? <p>Loading…</p> : (
        <div className="card">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="w-16">ID</th>
                <th>Name</th>
                <th>Address</th>
                <th className="text-right">Capacity</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td className="text-slate-500 text-sm">{r.id}</td>
                  <td className="font-medium">{r.name}</td>
                  <td className="text-slate-600">{r.address || "—"}</td>
                  <td className="text-right">
                     {r.capacity ? `${r.capacity} ${r.capacity_unit||""}` : "—"}
                  </td>
                  <td className="text-right flex justify-end gap-2">
                    {canWrite && <>
                      <button onClick={()=>startEdit(r)} className="btn btn-sm">Edit</button>
                      <button onClick={()=>remove(r.id)} className="btn-danger btn-sm">Delete</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}