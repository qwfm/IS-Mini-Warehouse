import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import { useApi } from "../api/client";

// Допоміжне форматування чисел
const fmt = (v, d = 2) => (v == null ? "-" : Number(v).toFixed(d));

export default function IssueDetailsModal({ open, onClose, issueId, materials = [], warehouses = [] }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const matsById = Object.fromEntries(materials.map(m => [m.id, m]));
  const whsById  = Object.fromEntries(warehouses.map(w => [w.id, w]));

  useEffect(() => {
    if (!open || !issueId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/issues/${issueId}`);
        setData(res);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, issueId]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={data ? `Issue ${data.document_number || data.id}` : "Issue details"}>
      {loading || !data ? (
        <p style={{padding:8}}>Loading…</p>
      ) : (
        <div style={{display:"grid", gap:12, minWidth:780}}>
          {/* Header info */}
          <div style={{display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8}}>
            <div><b>Client:</b> {data.client_id ?? "-"}</div>
            <div><b>Date:</b> {data.date?.slice(0,10)}</div>
            <div><b>Currency:</b> {data.currency}</div>
            <div><b>Document #:</b> {data.document_number}</div>
            <div><b>Total amount:</b> {fmt(data.total_amount)}</div>
            <div><b>Notes:</b> {data.notes || "-"}</div>
          </div>

          {/* Items */}
          <div>
            <h4 style={{margin:"8px 0"}}>Items</h4>
            <table width="100%" cellPadding="6" style={{borderCollapse:"collapse"}}>
              <thead>
                <tr style={{borderBottom:"1px solid #ddd"}}>
                  <th align="left">Material</th>
                  <th align="left">Warehouse</th>
                  <th align="right">Qty</th>
                  <th align="right">Unit price</th>
                  <th align="center">Curr</th>
                  <th align="right">Total</th>
                  <th align="right">Weight</th>
                  <th align="left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(data.items || []).map((it) => {
                  const m = matsById[it.material_id];
                  const w = whsById[it.warehouse_id];
                  return (
                    <tr key={it.id} style={{borderTop:"1px solid #eee"}}>
                      <td>{m ? `${m.code} — ${m.name}` : it.material_id}</td>
                      <td>{w ? w.name : (it.warehouse_id ?? "-")}</td>
                      <td align="right">{fmt(it.qty, 4)}</td>
                      <td align="right">{fmt(it.unit_price, 2)}</td>
                      <td align="center">{it.currency}</td>
                      <td align="right"><b>{fmt(it.total_price, 2)}</b></td>
                      <td align="right">{it.weight != null ? fmt(it.weight, 6) : "-"}</td>
                      <td>{it.notes || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{display:"flex", justifyContent:"flex-end", gap:8}}>
            <button onClick={onClose}>Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
