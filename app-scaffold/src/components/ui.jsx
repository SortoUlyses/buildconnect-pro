// — Shared UI components ------------------------------------------------------
export const Btn = ({ children, onClick, variant = "primary", small, disabled, style = {} }) => {
  const base = { padding: small ? "7px 14px" : "10px 22px", borderRadius: 8, fontSize: small ? 12 : 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", border: "none", fontFamily: "inherit", transition: "opacity 0.15s", opacity: disabled ? 0.5 : 1, ...style };
  const variants = {
    primary: { background: "#185FA5", color: "#fff" },
    success: { background: "#0F6E56", color: "#fff" },
    danger:  { background: "#A32D2D", color: "#fff" },
    ghost:   { background: "#fff", color: "#444441", border: "1.5px solid #D3D1C7" },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant] }}>{children}</button>;
};

export const Badge = ({ text, color = "#185FA5", bg = "#E6F1FB" }) => (
  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: bg, color, letterSpacing: "0.04em", textTransform: "uppercase" }}>{text}</span>
);

export const Field = ({ label, value, onChange, type = "text", placeholder, required, as, rows = 3, children }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444441", marginBottom: 5, letterSpacing: "0.04em", textTransform: "uppercase" }}>
      {label}{required && <span style={{ color: "#A32D2D", marginLeft: 3 }}>★</span>}
    </label>
    {children || (as === "textarea"
      ? <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", fontSize: 14, border: "1.5px solid #D3D1C7", borderRadius: 8, fontFamily: "inherit", resize: "vertical", outline: "none" }} />
      : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
          style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", fontSize: 14, border: "1.5px solid #D3D1C7", borderRadius: 8, fontFamily: "inherit", outline: "none" }} />
    )}
  </div>
);

export const Card = ({ children, style = {} }) => (
  <div style={{ background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 12, padding: "20px 22px", marginBottom: 14, ...style }}>{children}</div>
);

export const SectionTitle = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>{children}</div>
);
