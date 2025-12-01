import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import CurrencySelect from "../components/CurrencySelect";

const emptyItem = { material_id: "", warehouse_id: "", qty: "1", unit_price: "0", currency: "UAH", weight: "", notes: "" };

export default function EditIssueModal({ 
  open, 
  onClose, 
  issue, 
  materials = [], 
  warehouses = [], 
  clients = [], 
  stock = [], // Отримуємо залишки
  onSaved, 
  api 
}) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    
    setForm({
      id: issue?.id || null,
      document_number: issue?.document_number || "",
      client_id: issue?.client_id?.toString() || "",
      currency: issue?.currency || "UAH",
      notes: issue?.notes || "",
      items: (issue?.items?.length ? issue.items : [emptyItem]).map(it => ({
        material_id: it.material_id?.toString() || "",
        warehouse_id: it.warehouse_id?.toString() || "",
        qty: (it.qty ?? 1).toString(),
        unit_price: (it.unit_price ?? 0).toString(),
        currency: it.currency || issue?.currency || "UAH",
        weight: (it.weight ?? "").toString(),
        notes: it.notes || ""
      }))
    });
  }, [open, issue]);

  const totalAmount = useMemo(() => {
    if (!form) return 0;
    return form.items.reduce((sum, it) => {
      const qty = parseFloat(it.qty) || 0;
      const price = parseFloat(it.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
  }, [form]);

  // --- Map for Filtering & Quantity Check ---
  // warehouse_id -> { material_id: quantity }
  const stockMap = useMemo(() => {
    const map = {};
    stock.forEach(s => {
      if (!map[s.warehouse_id]) map[s.warehouse_id] = {};
      // Зберігаємо доступну кількість (quantity - reserved)
      const available = Number(s.quantity) - Number(s.reserved_quantity);
      map[s.warehouse_id][s.material_id] = available;
    });
    return map;
  }, [stock]);

  const setItem = (index, updates) => {
    setForm(prev => {
      const newItems = [...prev.items];
      
      // Якщо змінився склад, скидаємо матеріал
      if (updates.warehouse_id && updates.warehouse_id !== newItems[index].warehouse_id) {
         updates.material_id = ""; // Reset material
         updates.unit_price = "0"; // Reset price
      }

      // Якщо обрали матеріал, автоматично підтягуємо його базову ціну як ціну продажу (для зручності)
      if (updates.material_id) {
        const mat = materials.find(m => m.id === parseInt(updates.material_id));
        if (mat) {
          updates.unit_price = mat.price.toString();
        }
      }

      newItems[index] = { ...newItems[index], ...updates };
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...emptyItem, currency: prev.currency }]
    }));
  };

  const removeItem = (index) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      if (!form.document_number.trim()) throw new Error("Document number is required");
      if (!form.client_id) throw new Error("Client is required");
      if (form.items.length === 0) throw new Error("Add at least one item");

      const payload = {
        document_number: form.document_number,
        client_id: parseInt(form.client_id),
        currency: form.currency,
        notes: form.notes,
        items: form.items.map(it => {
          if (!it.material_id || !it.warehouse_id || !it.qty) {
            throw new Error("Material, Warehouse and Qty are required");
          }
          return {
            material_id: parseInt(it.material_id),
            warehouse_id: parseInt(it.warehouse_id),
            qty: parseFloat(it.qty),
            unit_price: parseFloat(it.unit_price),
            currency: it.currency,
            weight: it.weight ? parseFloat(it.weight) : null,
            notes: it.notes
          };
        })
      };

      if (form.id) await api.put(`/api/issues/${form.id}`, payload);
      else await api.post("/api/issues", payload);

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save issue");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !form) return null;

  return (
    <Modal open={open} onClose={onClose} title={form.id ? "Edit Issue (Sale)" : "New Issue (Sale)"}>
      <form onSubmit={submit} className="space-y-6">
        
        {/* Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <label className="label">Doc Number <span className="text-red-500">*</span></label>
            <input 
              className="input" 
              value={form.document_number} 
              onChange={e => setForm({...form, document_number: e.target.value})}
              placeholder="e.g. OUT-001"
            />
          </div>
          <div>
            <label className="label">Client <span className="text-red-500">*</span></label>
            <select 
              className="input" 
              value={form.client_id} 
              onChange={e => setForm({...form, client_id: e.target.value})}
            >
              <option value="">-- Select Client --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Currency</label>
            <div className="mt-1">
              <CurrencySelect value={form.currency} onChange={val => setForm({...form, currency: val || "UAH"})} />
            </div>
          </div>
          <div className="md:col-span-3">
             <label className="label">Notes</label>
             <input className="input" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold">
              <tr>
                <th className="p-2 min-w-[150px]">Warehouse <span className="text-red-500">*</span></th>
                <th className="p-2 min-w-[250px]">Material <span className="text-red-500">*</span></th>
                <th className="p-2 w-24 text-right">Qty</th>
                <th className="p-2 w-28 text-right">Price</th>
                <th className="p-2 w-24 text-right">Total</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {form.items.map((it, idx) => {
                const whId = parseInt(it.warehouse_id);
                
                // Фільтрація матеріалів:
                // Показуємо ТІЛЬКИ ті, що є на обраному складі з кількістю > 0
                let filteredMaterials = [];
                
                if (whId && stockMap[whId]) {
                  const whStock = stockMap[whId];
                  // Фільтруємо materials, залишаючи ті, ID яких є в ключах whStock і кількість > 0
                  filteredMaterials = materials.filter(m => {
                    const qty = whStock[m.id];
                    return qty && qty > 0;
                  });

                  // Якщо редагуємо і товар був у чеку, але на складі вже 0 (або менше, бо резерв),
                  // все одно показуємо його, щоб не зникав зі списку.
                  if (it.material_id) {
                     const currentMat = materials.find(m => m.id === parseInt(it.material_id));
                     if (currentMat && !filteredMaterials.includes(currentMat)) {
                        filteredMaterials = [currentMat, ...filteredMaterials];
                     }
                  }
                }

                // Визначаємо доступну кількість для показу в UI
                const currentStockQty = (whId && it.material_id && stockMap[whId]) 
                    ? stockMap[whId][it.material_id] 
                    : 0;

                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2">
                       <select 
                        className="input text-sm py-1" 
                        value={it.warehouse_id}
                        onChange={e => setItem(idx, { warehouse_id: e.target.value })}
                      >
                        <option value="">-- WH --</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <select 
                        className="input text-sm py-1" 
                        value={it.material_id}
                        onChange={e => setItem(idx, { material_id: e.target.value })}
                        disabled={!it.warehouse_id}
                      >
                        <option value="">
                          {!it.warehouse_id ? "← Select Warehouse" : "-- Select Material --"}
                        </option>
                        {filteredMaterials.map(m => {
                          const avail = stockMap[whId][m.id];
                          return (
                            <option key={m.id} value={m.id}>
                              {m.code} — {m.name} (Avail: {avail} {m.unit})
                            </option>
                          );
                        })}
                        {it.warehouse_id && filteredMaterials.length === 0 && (
                          <option disabled>No items available</option>
                        )}
                      </select>
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" step="0.0001" min="0"
                        className={`input text-sm py-1 text-right ${it.qty > currentStockQty ? 'border-red-300 bg-red-50' : ''}`}
                        value={it.qty}
                        onChange={e => setItem(idx, { qty: e.target.value })}
                        title={it.qty > currentStockQty ? `Warning: Only ${currentStockQty} available` : ""}
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" step="0.01" min="0"
                        className="input text-sm py-1 text-right"
                        value={it.unit_price}
                        onChange={e => setItem(idx, { unit_price: e.target.value })}
                      />
                    </td>
                    <td className="p-2 text-right font-medium text-slate-700">
                      {((parseFloat(it.qty) || 0) * (parseFloat(it.unit_price) || 0)).toFixed(2)}
                    </td>
                    <td className="p-2 text-center">
                      <button 
                        type="button" onClick={() => removeItem(idx)}
                        className="text-red-500 hover:text-red-700 font-bold px-2"
                      >✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-2 bg-slate-50 border-t border-slate-200">
            <button type="button" onClick={addItem} className="text-sky-600 hover:text-sky-800 text-sm font-semibold">
              + Add another item
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div className="text-lg font-bold text-slate-800">
            Total: {totalAmount.toFixed(2)} <span className="text-sm font-normal text-slate-500">{form.currency}</span>
          </div>
          <div className="flex gap-3">
            {error && <span className="text-red-600 text-sm self-center mr-2">{error}</span>}
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving..." : (form.id ? "Save Changes" : "Create Issue")}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}