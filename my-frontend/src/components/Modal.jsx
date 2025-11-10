export default function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-container">
        <div className="flex items-center justify-center min-h-full p-4">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <button 
                onClick={onClose} 
                className="btn-ghost p-1 hover:bg-slate-100 rounded-lg"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              {children}
            </div>
            {footer && <div className="modal-footer">{footer}</div>}
          </div>
        </div>
      </div>
    </>
  );
}