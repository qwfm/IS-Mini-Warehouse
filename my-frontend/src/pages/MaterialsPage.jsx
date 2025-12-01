// src/pages/MaterialsPage.jsx
import { useEffect, useState } from "react";
import { useApi } from "../api/client";
import useAuthz from "../hooks/useAuthz";
import CurrencySelect from "../components/CurrencySelect";

export default function MaterialsPage() {
  const api = useApi();
  const { hasRole } = useAuthz();

  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]); // 1. Стан для категорій
  const [canWrite, setCanWrite] = useState(false);
  
  // 2. Додаємо category_id у початковий стан форми
  const [form, setForm] = useState({ id: null, code: "", name: "", unit: "pcs", price: 0, currency: "UAH", category_id: "" });
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Функція завантаження даних
  const load = async () => {
    // Завантажуємо і матеріали, і категорії паралельно
    const [materialsData, categoriesData] = await Promise.all([
      api.get("/api/materials"),
      api.get("/api/categories")
    ]);
    setRows(materialsData);
    setCategories(categoriesData);
  };

  useEffect(() => {
    (async () => {
      await load();
      const isAdmin = await hasRole("admin");
      const isStorekeeper = await hasRole("storekeeper");
      setCanWrite(isAdmin || isStorekeeper);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (e) => {
    e.preventDefault();
    const payload = { 
      code: form.code, 
      name: form.name, 
      unit: form.unit, 
      price: +form.price, 
      currency: form.currency,
      // 3. Відправляємо category_id (або null, якщо не вибрано)
      category_id: form.category_id ? parseInt(form.category_id) : null 
    };

    if (form.id) await api.put(`/api/materials/${form.id}`, payload);
    else await api.post("/api/materials", payload);
    
    resetForm();
    await load();
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Delete material?")) return;
    await api.del(`/api/materials/${id}`);
    await load();
  };

  const startEdit = (row) => {
    // При редагуванні підставляємо існуючий category_id або пустий рядок
    setForm({ ...row, category_id: row.category_id || "" });
    setIsFormOpen(true);
  };

  const resetForm = () => {
    setForm({ id: null, code: "", name: "", unit: "pcs", price: 0, currency: "UAH", category_id: "" });
    setIsFormOpen(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Materials Reference</h1>
        {canWrite && (
          <button onClick={() => setIsFormOpen(true)} className="btn btn-primary">
            + New Material
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="mb-6 p-4 bg-white rounded-lg shadow border border-slate-200">
          <h3 className="text-lg font-semibold mb-4">{form.id ? "Edit Material" : "New Material"}</h3>
          <form onSubmit={save}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="label">Code (SKU)</label>
                <input 
                  className="input" 
                  value={form.code} 
                  onChange={e => setForm({ ...form, code: e.target.value })} 
                  required 
                />
              </div>
              <div>
                <label className="label">Name</label>
                <input 
                  className="input" 
                  value={form.name} 
                  onChange={e => setForm({ ...form, name: e.target.value })} 
                  required 
                />
              </div>
              
              {/* 4. Випадаючий список для Категорії */}
              <div>
                <label className="label">Category</label>
                <select 
                  className="input"
                  value={form.category_id}
                  onChange={e => setForm({ ...form, category_id: e.target.value })}
                >
                  <option value="">-- No Category --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Unit</label>
                <select 
                  className="input" 
                  value={form.unit} 
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                >
                  <option value="pcs">pcs</option>
                  <option value="kg">kg</option>
                  <option value="l">l</option>
                  <option value="m">m</option>
                </select>
              </div>
              <div>
                <label className="label">Std Price</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    step="0.01" 
                    className="input w-2/3" 
                    value={form.price} 
                    onChange={e => setForm({ ...form, price: e.target.value })} 
                  />
                  <div className="w-1/3">
                    <CurrencySelect 
                      value={form.currency} 
                      onChange={v => setForm({ ...form, currency: v })} 
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={resetForm} className="btn btn-ghost">Cancel</button>
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
              <th>Category</th> {/* 5. Нова колонка */}
              <th>Unit</th>
              <th className="text-right">Std Price</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              // Знаходимо назву категорії за ID
              const catName = categories.find(c => c.id === r.category_id)?.name || "-";
              
              return (
                <tr key={r.id}>
                  <td className="text-slate-500 text-sm">{r.id}</td>
                  <td className="font-mono text-sm">{r.code}</td>
                  <td className="font-medium">{r.name}</td>
                  
                  {/* Відображення категорії */}
                  <td>
                    <span className={`px-2 py-1 rounded text-xs ${r.category_id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400'}`}>
                      {catName}
                    </span>
                  </td>

                  <td><span className="badge bg-slate-100 text-slate-600">{r.unit}</span></td>
                  <td className="text-right">{Number(r.price).toFixed(2)} <span className="text-xs text-slate-500">{r.currency}</span></td>
                  <td className="text-right">
                    {canWrite && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(r)} className="text-sky-600 hover:text-sky-800 font-medium text-sm">
                          Edit
                        </button>
                        <button onClick={() => deleteItem(r.id)} className="text-rose-600 hover:text-rose-800 font-medium text-sm">
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}