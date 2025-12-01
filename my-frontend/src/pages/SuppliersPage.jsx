import { useEffect, useState } from "react";
import { useApi } from "../api/client";
import useAuthz from "../hooks/useAuthz";

export default function SuppliersPage(){
  const api = useApi();
  const { hasRole, hasPerm } = useAuthz();
  const [rows, setRows] = useState([]);
  const [canWrite, setCanWrite] = useState(false);
  const [form, setForm] = useState({ id:null, name:"", contact_info:"" });
  const [isFormOpen, setIsFormOpen] = useState(false);

  const load = async () => setRows(await api.get("/api/suppliers"));

  useEffect(()=>{ (async()=>{
    await load();
    setCanWrite((await hasRole("admin")) || (await hasPerm("write:suppliers")));
  })(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const payload = { name: form.name.trim(), contact_info: form.contact_info || null };
    if (!payload.name) return;

    if (form.id) await api.put(`/api/suppliers/${form.id}`, payload);
    else         await api.post("/api/suppliers", payload);

    resetForm();
    await load();
  };

  const resetForm = () => {
    setForm({ id:null, name:"", contact_info:"" });
    setIsFormOpen(false);
  }

  const startEdit = (r) => {
    setForm({ id:r.id, name:r.name ?? "", contact_info:r.contact_info ?? "" });
    setIsFormOpen(true);
  }

  const remove = async (id) => { 
    if (confirm("Delete supplier?")) { await api.del(`/api/suppliers/${id}`); await load(); }
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center">
        <div>
           <h2 className="page-title">Suppliers</h2>
           <p className="text-slate-600">Manage your supply partners</p>
        </div>
        {canWrite && !isFormOpen && (
          <button onClick={() => setIsFormOpen(true)} className="btn btn-primary">
            + New Supplier
          </button>
        )}
      </div>

      {canWrite && isFormOpen && (
        <div className="card bg-slate-50 border-slate-200">
           <h3 className="font-semibold mb-4">{form.id ? "Edit Supplier" : "Add Supplier"}</h3>
           <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <label className="label">Name</label>
               <input className="input" placeholder="Supplier Company" value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/>
             </div>
             <div>
               <label className="label">Contact Info</label>
               <input className="input" placeholder="Email / Phone" value={form.contact_info} onChange={e=>setForm({...form, contact_info:e.target.value})}/>
             </div>
             <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                <button type="button" onClick={resetForm} className="btn">Cancel</button>
                <button type="submit" className="btn btn-primary">{form.id ? "Save" : "Create"}</button>
             </div>
           </form>
        </div>
      )}

      <div className="card">
        <table className="table w-full">
          <thead>
            <tr>
              <th className="w-16">ID</th>
              <th>Name</th>
              <th>Contact Info</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td className="text-slate-500 text-sm">{r.id}</td>
                <td className="font-medium">{r.name}</td>
                <td className="text-slate-600">{r.contact_info || "—"}</td>
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
    </div>
  );
}