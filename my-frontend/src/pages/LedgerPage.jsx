import { useEffect, useState } from "react";
import { useApi } from "../api/client";

export default function LedgerPage(){
  const api = useApi();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    warehouse_id: "", material_id: "", movement_type: "", date_from: "", date_to: ""
  });

  const load = async () => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k,v])=> { if(v) qs.append(k, v); });
    const data = await api.get(`/api/stock-ledger?${qs.toString()}`);
    setRows(data);
  };

  useEffect(()=>{ load(); }, []);

  return (
    <div style={{padding:16}}>
      <h2>Stock Ledger</h2>
      <div style={{display:"grid", gridTemplateColumns:"repeat(5, minmax(0,1fr))", gap:8, margin:"8px 0"}}>
        <input placeholder="Warehouse ID" value={filters.warehouse_id} onChange={e=>setFilters({...filters, warehouse_id:e.target.value})}/>
        <input placeholder="Material ID" value={filters.material_id} onChange={e=>setFilters({...filters, material_id:e.target.value})}/>
        <select value={filters.movement_type} onChange={e=>setFilters({...filters, movement_type:e.target.value})}>
          <option value="">— movement —</option>
          <option value="receipt">receipt</option>
          <option value="issue">issue</option>
          <option value="adjustment">adjustment</option>
          <option value="transfer">transfer</option>
          <option value="reservation">reservation</option>
          <option value="release_reservation">release_reservation</option>
          <option value="return">return</option>
        </select>
        <input type="datetime-local" value={filters.date_from} onChange={e=>setFilters({...filters, date_from:e.target.value})}/>
        <input type="datetime-local" value={filters.date_to} onChange={e=>setFilters({...filters, date_to:e.target.value})}/>
      </div>
      <button onClick={load}>Search</button>

      <div style={{overflow:"auto", marginTop:12}}>
        <table border="1" cellPadding="6" style={{width:"100%", borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <th>Time</th><th>WH</th><th>Material</th><th>Type</th>
              <th>Qty Δ</th><th>Unit Price</th><th>Currency</th><th>Total</th>
              <th>Ref</th><th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td>{new Date(r.date_time).toLocaleString()}</td>
                <td>{r.warehouse_id}</td>
                <td>{r.material_id}</td>
                <td>{r.movement_type}</td>
                <td>{r.qty_change}</td>
                <td>{r.unit_price ?? ""}</td>
                <td>{r.currency ?? ""}</td>
                <td>{r.total_price ?? ""}</td>
                <td>{r.reference_doc_type} #{r.reference_doc_id}</td>
                <td>{r.remarks ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
