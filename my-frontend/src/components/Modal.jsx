export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
        <div className="fixed inset-0 z-50 overflow-auto">
    <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
    <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg border border-slate-200 overflow-auto">
        <div className="p-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="p-4 max-h-[80vh] overflow-auto">
            {children}
        </div>
        </div>
    </div>
    </div>


  );
}