import { createContext, useCallback, useContext, useEffect, useState } from "react";

const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [t, setT] = useState(null);
  const show = useCallback((msg, kind = "ok") => {
    setT({ msg, kind });
    setTimeout(() => setT(null), kind === "error" ? 5000 : 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div className={`toast ${t.kind}`}>{t.msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** Run an async action; show its error as a toast; return true on success. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, okMsg) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast(okMsg); return true; }
    catch (e) { toast(e.message, "error"); return false; }
    finally { setBusy(false); }
  }, [toast]);
  return [run, busy];
}

export function Drawer({ title, sub, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={title}>
        <button className="btn x" onClick={onClose} aria-label="Close">✕</button>
        <h2>{title}</h2>
        {sub && <p className="muted small" style={{ marginTop: 0 }}>{sub}</p>}
        {children}
      </aside>
    </>
  );
}

export function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

export function Chip({ kind, children }) {
  return <span className={`chip ${kind ?? ""}`}>{children}</span>;
}

export function Empty({ title, children }) {
  return <div className="empty"><strong>{title}</strong>{children}</div>;
}

export function Card({ title, right, children, style }) {
  return (
    <section className="card" style={style}>
      {title && <div className="cardhead"><h3>{title}</h3>{right}</div>}
      <div className="cardbody">{children}</div>
    </section>
  );
}
