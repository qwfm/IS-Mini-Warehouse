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
      setCanWrite( (await hasRole("admin")) || (await hasPerm("write:categories")) );
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (editing) {
      await api.put(`/api/categories/${form.id}`, { 
        name: form.name, 
        description: form.description || null 
      });
    } else {
      await api.post("/api/categories", { 
        name: form.name, 
        description: form.description || null 
      });
    }
    setForm({ id:null, name:"", description:"" });
    await load();
  };

  const startEdit = (row) => setForm({ 
    id: row.id, 
    name: row.name, 
    description: row.description ?? "" 
  });
  
  const cancel = () => setForm({ id:null, name:"", description:"" });
  
  const remove = async (id) => { 
    if (confirm("Delete this category?")) { 
      await api.del(`/api/categories/${id}`); 
      await load(); 
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title">Categories</h1>
        <p className="text-slate-600 mt-1">Manage material categories</p>
      </div>

      {canWrite && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">
            {editing ? "Edit Category" : "Create New Category"}
          </h3>
          <form onSubmit={submit} className="space-y-4">
            <div className="form-grid-2">
              <div className="field">
                <label className="label">Name *</label>
                <input 
                  placeholder="Category name" 
                  value={form.name} 
                  onChange={e=>setForm({...form, name:e.target.value})}
                  required
                />
              </div>
              <div className="field">
                <label className="label">Description</label>
                <input 
                  placeholder="Optional description" 
                  value={form.description} 
                  onChange={e=>setForm({...form, description:e.target.value})}
                />
              </div>
            </div>
            <div className="toolbar justify-end">
              {editing && (
                <button type="button" onClick={cancel} className="btn">
                  Cancel
                </button>
              )}
              <button type="submit" className="btn-primary">
                {editing ? "Save Changes" : "Create Category"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
          <p className="mt-4 text-slate-600">Loading categories...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-600">No categories yet</p>
          {canWrite && (
            <p className="text-sm text-slate-500 mt-2">
              Create your first category above
            </p>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>(
                  <tr key={r.id}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-slate-600">{r.description || "—"}</td>
                    <td>
                      {canWrite && (
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={()=>startEdit(r)} 
                            className="btn btn-sm"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={()=>remove(r.id)} 
                            className="btn-danger btn-sm"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}