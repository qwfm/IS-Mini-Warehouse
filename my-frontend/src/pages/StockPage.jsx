import { useEffect, useState } from "react";
import { useApi } from "../api/client";

export default function StockPage(){
  const api = useApi();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ (async()=>{
    setRows(await api.get("/api/stock/current"));
    setLoading(false);
  })(); }, []);

  return (
    <div style={{padding:16}}>
      <h2>Stock</h2>
      {loading ? <p>Loading…</p> : (
        <table cellPadding="6" style={{borderCollapse:"collapse"}}>
          <thead><tr>
            <th>Warehouse</th><th>Material</th><th>Qty</th><th>Reserved</th>
          </tr></thead>
          <tbody>
            {rows.map(r=>(
              <tr key={`${r.warehouse_id}-${r.material_id}`} style={{borderTop:"1px solid #ddd"}}>
                <td>{r.warehouse_name ?? r.warehouse_id}</td>
                <td>{r.material_code ? `${r.material_code} — ` : ""}{r.material_name ?? r.material_id}</td>
                <td align="right">{r.quantity}</td>
                <td align="right">{r.reserved_quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
