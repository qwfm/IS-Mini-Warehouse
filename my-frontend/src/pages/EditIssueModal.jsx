import { useEffect, useMemo, useState, setError } from "react";
import Modal from "../components/Modal";
import CurrencySelect from "../components/CurrencySelect";

const emptyItem = { material_id:"", warehouse_id:"", qty:"1", unit_price:"0", currency:"UAH", weight:"", notes:"" };

export default function EditIssueModal({
  open, onClose, issue, materials, warehouses, clients, onSaved, api
}) {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      id: issue.id,
      document_number: issue.document_number || "",
      client_id: issue.client_id?.toString() || "",
      currency: issue.currency || "UAH",
      notes: issue.notes || "",
      items: (issue.items?.length ? issue.items : [emptyItem]).map(it => ({
        material_id: it.material_id?.toString() || "",
        warehouse_id: it.warehouse_id?.toString() || "",
        qty: (it.qty ?? it.quantity ?? 1).toString(),
        unit_price: (it.unit_price ?? 0).toString(),
        currency: it.currency || issue.currency || "UAH",
        weight: (it.weight ?? "").toString(),
        notes: it.notes || ""
      }))
    });
  }, [open, issue]);

  const addItem = () => setForm(f => ({...f, items:[...f.items, {...emptyItem, currency:f.currency}]}));
  const removeItem = (i) => setForm(f => ({...f, items: f.items.filter((_, idx)=> idx!==i)}));
  const setItem = (i, patch) => setForm(f => {
    const next = f.items.slice(); next[i] = {...next[i], ...patch}; return {...f, items: next};
  });

  const totals = useMemo(() => {
    if (!form) return { total: 0 };
    return {
      total: form.items.reduce((acc, it)=> acc + (Number(it.qty||0) * Number(it.unit_price||0)), 0)
    };
  }, [form]);

  if (!form) return null;

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const payload = {
        document_number: form.document_number || undefined,
        client_id: form.client_id ? Number(form.client_id) : null,
        currency: form.currency || "UAH",
        notes: form.notes || null,
        items: form.items.map(it => ({
          material_id: Number(it.material_id),
          warehouse_id: it.warehouse_id ? Number(it.warehouse_id) : null,
          qty: Number(it.qty),
          unit_price: Number(it.unit_price),
          currency: it.currency || form.currency || "UAH",
          weight: it.weight ? Number(it.weight) : null,
          notes: it.notes || null,
          total_price: Number(it.qty) * Number(it.unit_price)
        }))
      };
      await api.put(`/api/issues/${form.id}`, payload); 
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Edit issue failed:", err);
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit Issue #${form.document_number || form.id}`}>
      <form onSubmit={save} style={{display:"grid", gap:12}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8}}>
          <input placeholder="Document number (optional)" value={form.document_number}
                 onChange={(e)=>setForm({...form, document_number:e.target.value})}/>
          <select value={form.client_id} onChange={(e)=>setForm({...form, client_id:e.target.value})}>
            <option value="">-- client --</option>
            {clients.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <CurrencySelect value={form.currency} onChange={(val)=>setForm({...form, currency: val || "UAH"})}/>
        </div>

        <textarea placeholder="Notes" value={form.notes}
                  onChange={(e)=>setForm({...form, notes:e.target.value})}/>

        <div>
          <h4 style={{margin:"8px 0"}}>Items</h4>
          {form.items.map((it, idx)=>(
            <div key={idx} style={{display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr 1fr 2fr auto", gap:6, alignItems:"center", marginBottom:6}}>
              <select value={it.material_id} onChange={e=>setItem(idx,{material_id:e.target.value})}>
                <option value="">material</option>
                {materials.map(m=> <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
              </select>
              <select value={it.warehouse_id} onChange={e=>setItem(idx,{warehouse_id:e.target.value})}>
                <option value="">warehouse</option>
                {warehouses.map(w=> <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <input type="number" step="0.0001" placeholder="qty" value={it.qty}
                     onChange={e=>setItem(idx,{qty:e.target.value})}/>
              <input type="number" step="0.01" placeholder="unit price" value={it.unit_price}
                     onChange={e=>setItem(idx,{unit_price:e.target.value})}/>
              <CurrencySelect value={it.currency || form.currency}
                              onChange={(val)=>setItem(idx,{currency: val || form.currency})}/>
              <input type="number" step="0.000001" placeholder="weight" value={it.weight}
                     onChange={e=>setItem(idx,{weight:e.target.value})}/>
              <input placeholder="notes" value={it.notes}
                     onChange={e=>setItem(idx,{notes:e.target.value})}/>
              <div style={{textAlign:"right"}}>{(Number(it.qty||0)*Number(it.unit_price||0)).toFixed(2)}</div>
              <button type="button" onClick={()=>removeItem(idx)} aria-label={`remove item ${idx+1}`}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addItem}>+ Add item</button>
        </div>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8}}>
          <div><b>Total:</b> {totals.total.toFixed(2)} {form.currency}</div>
          <div style={{display:"flex", gap:8}}>
            <button type="button" onClick={onClose}>Close</button>
            <button type="submit">Save edit</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
