export default function DateRangePicker({ from, to, onChange, presets = [7, 14, 30], withTime = false }) {
  const id = (s) => `${s}-${Math.random().toString(36).slice(2,7)}`;
  const dateType = withTime ? "datetime-local" : "date";

  const setPreset = (days) => {
    const end = new Date(); end.setHours(0,0,0,0);
    const start = new Date(end); start.setDate(start.getDate() - days + 1);
    const fmt = (d) => d.toISOString().slice(0, withTime ? 16 : 10);
    onChange({ from: fmt(start), to: fmt(end) });
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type={dateType}
        value={from}
        onChange={e => onChange({ from: e.target.value, to })}
        className="input input-sm"
        aria-label="From date"
      />
      <span className="text-slate-400">—</span>
      <input
        type={dateType}
        value={to}
        onChange={e => onChange({ from, to: e.target.value })}
        className="input input-sm"
        aria-label="To date"
      />
    </div>
  );
}
