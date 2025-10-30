import { useEffect, useMemo, useState } from "react";
import Modal from "../components/Modal";
import CurrencySelect from "../components/CurrencySelect";

const emptyItem = { material_id:"", warehouse_id:"", qty:"1", unit_price:"0", currency:"UAH", weight:"", notes:"" };

export default function EditReceiptModal({ open, onClose, receipt, materials, warehouses, suppliers, api, onSaved }) {
  const [form, setForm] = useState(null);

  useEffect(()=>{ if(!open) return;
    setForm({
      id: receipt.id,
      document_number: receipt.document_number||"",
      supplier_id: receipt.supplier_id?.toString()||"",
      currency: receipt.currency||"UAH",
      notes: receipt.notes||"",
      items: (receipt.items?.length? receipt.items : [emptyItem]).map(it=>({
        material_id: it.material_id?.toString()||"",
        warehouse_id: it.warehouse_id?.toString()||"",
        qty: (it.qty ?? 1).toString(),
        unit_price: (it.unit_price ?? 0).toString(),
        currency: it.currency || receipt.currency || "UAH",
        weight: (it.weight ?? "").toString(),
        notes: it.notes || ""
      }))
    });
  },[open, receipt]);

  const totals = useMemo(()=> !form ? {total:0} : { total: form.items.reduce((s,i)=>s+(+i.qty||0)*(+i.unit_price||0),0) }, [form]);

  if (!form) return null;

  const setItem = (i, patch) => setForm(f=>{ const next=f.items.slice(); next[i]={...next[i],...patch}; return {...f, items:next}; });
  const addItem = ()=> setForm(f=>({...f, items:[...f.items, {...emptyItem, currency:f.currency}]}));
  const removeItem = i => setForm(f=>({...f, items:f.items.filter((_,idx)=>idx!==i)}));

  const save = async (e)=>{
    e.preventDefault();
    const payload = {
      document_number: form.document_number || undefined,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      currency: form.currency || "UAH",
      notes: form.notes || null,
      items: form.items.map(it=>({
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
    await api.put(`/api/receipts/${form.id}`, payload);
    onSaved?.(); onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit Receipt #${form.document_number || form.id}`}>
      <form onSubmit={save} style={{display:"grid", gap:12}}>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8}}>
          <input placeholder="Document number" value={form.document_number} onChange={e=>setForm({...form, document_number:e.target.value})}/>
          <select value={form.supplier_id} onChange={e=>setForm({...form, supplier_id:e.target.value})}>
            <option value="">-- supplier --</option>
            {suppliers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <CurrencySelect value={form.currency} onChange={val=>setForm({...form, currency: val || "UAH"})}/>
        </div>
        <textarea placeholder="Notes" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})}/>
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
              <input type="number" step="0.0001" placeholder="qty" value={it.qty} onChange={e=>setItem(idx,{qty:e.target.value})}/>
              <input type="number" step="0.01" placeholder="unit price" value={it.unit_price} onChange={e=>setItem(idx,{unit_price:e.target.value})}/>
              <CurrencySelect value={it.currency || form.currency} onChange={val=>setItem(idx,{currency: val || form.currency})}/>
              <input type="number" step="0.000001" placeholder="weight" value={it.weight} onChange={e=>setItem(idx,{weight:e.target.value})}/>
              <input placeholder="notes" value={it.notes} onChange={e=>setItem(idx,{notes:e.target.value})}/>
              <div style={{textAlign:"right"}}>{((+it.qty||0)*(+it.unit_price||0)).toFixed(2)}</div>
              <button type="button" onClick={()=>removeItem(idx)}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addItem}>+ Add item</button>
        </div>
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
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
