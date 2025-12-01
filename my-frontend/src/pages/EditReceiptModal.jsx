import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal"; // Перевірте шлях імпорту
import CurrencySelect from "../components/CurrencySelect"; // Перевірте шлях імпорту

const emptyItem = { material_id: "", warehouse_id: "", qty: "1", unit_price: "0", currency: "UAH", weight: "", notes: "" };

export default function EditReceiptModal({ 
  open, 
  onClose, 
  receipt, 
  materials = [], 
  warehouses = [], 
  suppliers = [], 
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
      id: receipt?.id || null,
      document_number: receipt?.document_number || "",
      supplier_id: receipt?.supplier_id?.toString() || "",
      currency: receipt?.currency || "UAH",
      notes: receipt?.notes || "",
      items: (receipt?.items?.length ? receipt.items : [emptyItem]).map(it => ({
        material_id: it.material_id?.toString() || "",
        warehouse_id: it.warehouse_id?.toString() || "",
        qty: (it.qty ?? 1).toString(),
        unit_price: (it.unit_price ?? 0).toString(),
        currency: it.currency || receipt?.currency || "UAH",
        weight: (it.weight ?? "").toString(),
        notes: it.notes || ""
      }))
    });
  }, [open, receipt]);

  const totalAmount = useMemo(() => {
    if (!form) return 0;
    return form.items.reduce((sum, it) => {
      const qty = parseFloat(it.qty) || 0;
      const price = parseFloat(it.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
  }, [form]);

  // --- Helpers for Filtering ---
  // Створюємо мапу: warehouse_id -> Set(material_ids)
  const stockMap = useMemo(() => {
    const map = {};
    stock.forEach(s => {
      if (!map[s.warehouse_id]) map[s.warehouse_id] = new Set();
      map[s.warehouse_id].add(s.material_id);
    });
    return map;
  }, [stock]);

  const setItem = (index, updates) => {
    setForm(prev => {
      const newItems = [...prev.items];
      // Якщо змінився склад, скидаємо матеріал, якщо його немає на новому складі
      if (updates.warehouse_id) {
        const newWhId = parseInt(updates.warehouse_id);
        const currentMatId = parseInt(newItems[index].material_id);
        
        // Перевіряємо, чи є цей матеріал на новому складі
        const availableMats = stockMap[newWhId];
        const isAvailable = availableMats && availableMats.has(currentMatId);

        // Якщо матеріалу немає на складі, і ми хочемо сувору фільтрацію "як в Issues",
        // то логічно скинути вибір матеріалу. Але для зручності можна залишити.
        // Тут я залишаю як є, бо користувач може змінити потім матеріал.
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
      if (!form.supplier_id) throw new Error("Supplier is required");
      if (form.items.length === 0) throw new Error("Add at least one item");

      const payload = {
        document_number: form.document_number,
        supplier_id: parseInt(form.supplier_id),
        currency: form.currency,
        notes: form.notes,
        items: form.items.map(it => {
          if (!it.material_id || !it.warehouse_id || !it.qty) {
            throw new Error("Material, Warehouse and Qty are required for all items");
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

      if (form.id) await api.put(`/api/receipts/${form.id}`, payload);
      else await api.post("/api/receipts", payload);

      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save receipt");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !form) return null;

  return (
    <Modal open={open} onClose={onClose} title={form.id ? "Edit Receipt" : "New Receipt"}>
      <form onSubmit={submit} className="space-y-6">
        
        {/* Шапка (як раніше) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <label className="label">Doc Number <span className="text-red-500">*</span></label>
            <input 
              className="input" 
              value={form.document_number} 
              onChange={e => setForm({...form, document_number: e.target.value})}
              placeholder="e.g. IN-001"
            />
          </div>
          <div>
            <label className="label">Supplier <span className="text-red-500">*</span></label>
            <select 
              className="input" 
              value={form.supplier_id} 
              onChange={e => setForm({...form, supplier_id: e.target.value})}
            >
              <option value="">-- Select Supplier --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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

        {/* Таблиця товарів */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-600 font-semibold">
              <tr>
                <th className="p-2 min-w-[150px]">Warehouse <span className="text-red-500">*</span></th>
                <th className="p-2 min-w-[200px]">Material <span className="text-red-500">*</span></th>
                <th className="p-2 w-24 text-right">Qty</th>
                <th className="p-2 w-28 text-right">Price</th>
                <th className="p-2 w-24 text-right">Total</th>
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {form.items.map((it, idx) => {
                // ЛОГІКА ФІЛЬТРАЦІЇ
                // 1. Отримуємо ID обраного складу
                const whId = parseInt(it.warehouse_id);
                
                // 2. Фільтруємо матеріали:
                // Якщо склад обрано -> показуємо тільки ті, що є в stockMap[whId]
                // Якщо склад НЕ обрано -> показуємо всі (щоб можна було створити перший запис)
                let filteredMaterials = materials;
                
                if (whId) {
                  const availableIds = stockMap[whId];
                  // Якщо на складі взагалі пусто, список буде порожнім (або можна додати опцію "Всі")
                  if (availableIds) {
                     filteredMaterials = materials.filter(m => availableIds.has(m.id));
                  } else {
                     filteredMaterials = []; // Склад порожній
                  }
                  
                  // Лайфхак: Якщо ми редагуємо існуючий документ, а товару вже немає на складі (0), 
                  // але він є в документі -> треба його залишити в списку, щоб було видно.
                  if (it.material_id) {
                    const currentMat = materials.find(m => m.id === parseInt(it.material_id));
                    // Якщо поточний матеріал не потрапив у фільтр, додаємо його примусово
                    if (currentMat && !filteredMaterials.includes(currentMat)) {
                      filteredMaterials = [currentMat, ...filteredMaterials];
                    }
                  }
                }

                return (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2">
                       <select 
                        className="input text-sm py-1" 
                        value={it.warehouse_id}
                        onChange={e => setItem(idx, { warehouse_id: e.target.value })}
                      >
                        <option value="">-- Select WH --</option>
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
                        disabled={!it.warehouse_id} // Блокуємо, поки не обрано склад (як в Issues)
                      >
                        <option value="">
                          {!it.warehouse_id ? "← Select Warehouse first" : "-- Select Material --"}
                        </option>
                        {filteredMaterials.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.code} — {m.name}
                          </option>
                        ))}
                        {/* Опція для додавання нового товару на склад, якщо його там немає */}
                        {it.warehouse_id && filteredMaterials.length < materials.length && (
                             <option disabled>──────────</option>
                        )}
                         {it.warehouse_id && (
                           // Це дозволяє обрати будь-який матеріал, якщо його немає в списку наявності
                           // Корисно для Receipts, бо ми ПРИЙМАЄМО товар.
                           materials
                             .filter(m => !filteredMaterials.includes(m))
                             .map(m => (
                               <option key={m.id} value={m.id} className="text-slate-400">
                                 {m.code} — {m.name} (New on WH)
                               </option>
                             ))
                         )}
                      </select>
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" step="0.0001" min="0"
                        className="input text-sm py-1 text-right"
                        value={it.qty}
                        onChange={e => setItem(idx, { qty: e.target.value })}
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
              {saving ? "Saving..." : (form.id ? "Save Changes" : "Create Receipt")}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}