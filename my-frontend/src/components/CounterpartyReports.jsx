import { useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../api/client";
import CurrencySelect from "./CurrencySelect";

function SmallBar({ label, value, max }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700 truncate flex-1">{label}</span>
        <span className="font-medium text-slate-900 ml-2">{value.toFixed(2)}</span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-sky-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CounterpartyReports() {
  const api = useApi();
  const [tab, setTab] = useState("clients");
  const [currency, setCurrency] = useState("UAH");
  const [from, setFrom] = useState(() => new Date(Date.now() - 29*24*3600*1000).toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));

  const [data, setData] = useState([]);
  const [err, setErr] = useState("");
  const inflight = useRef(null);  // AbortController
  const mounted = useRef(true);

  useEffect(() => {
    return () => { mounted.current = false; if (inflight.current) inflight.current.abort(); };
  }, []);

  const maxVal = useMemo(() => Math.max(...data.map(x => Number(x.total) || 0), 0), [data]);

  useEffect(() => {
    (async () => {
      setErr("");
      if (inflight.current) inflight.current.abort();
      inflight.current = new AbortController();
      const signal = inflight.current.signal;

      try {
        const q = new URLSearchParams({ type: tab, from, to, currency, limit: "10" }).toString();
        const res = await api.get(`/api/dashboard/counterparty-report?${q}`, { signal });
        if (!mounted.current) return;
        setData(res || []);
      } catch (e) {
        if (e.name === "AbortError") return;
        if (!mounted.current) return;
        setData([]);
        setErr("Counterparty report endpoint is not available. Please add /api/dashboard/counterparty-report on backend.");
      }
    })();
    // ВАЖЛИВО: НЕ включати 'api' у залежності, інакше ефект циклічно перезапускатиметься
  }, [tab, currency, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">🤝 Counterparty Reports</h3>
          <span className="text-slate-400">·</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button className={`px-3 py-1 text-sm ${tab==='clients'?'bg-slate-900 text-white':'bg-white text-slate-700'}`} onClick={()=>setTab("clients")}>Clients</button>
            <button className={`px-3 py-1 text-sm ${tab==='suppliers'?'bg-slate-900 text-white':'bg-white text-slate-700'}`} onClick={()=>setTab("suppliers")}>Suppliers</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="input input-sm" />
          <span className="text-slate-400">—</span>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="input input-sm" />
          <CurrencySelect value={currency} onChange={setCurrency} />
        </div>
      </div>

      {err && <p className="text-xs text-amber-700 mb-3">{err}</p>}

      {data.length === 0 ? (
        <p className="text-slate-500">No data</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {data.map((row, i) => (
              <SmallBar key={i} label={row.name || row.email || row.company || `#${row.id}`} value={Number(row.total)||0} max={maxVal} />
            ))}
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Counterparty</th>
                  <th className="py-2 pr-3">Docs</th>
                  <th className="py-2 pr-3">Qty</th>
                  <th className="py-2 pr-3">Total, {currency}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.map((row, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 text-slate-500">{i+1}</td>
                    <td className="py-2 pr-3">{row.name || row.email || row.company || `#${row.id}`}</td>
                    <td className="py-2 pr-3">{row.docs_count ?? "-"}</td>
                    <td className="py-2 pr-3">{Number(row.total_qty || 0).toFixed(2)}</td>
                    <td className="py-2 pr-3 font-medium">{Number(row.total || 0).toFixed(2)}</td>
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
