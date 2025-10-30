import { CURRENCIES } from "../constants/currencies";

export default function CurrencySelect({ value, onChange, placeholder = "Currency" }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{`-- ${placeholder} --`}</option>
      {CURRENCIES.map(c => (
        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
      ))}
    </select>
  );
}
