import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { invoiceFromDb, estimateFromDb, estimateToDb } from "../lib/mappers.js";

// — Estimates Tab -------------------------------------------------------------
export const EMPTY_EST = () => ({ id: uid(), number: `EST-${Date.now().toString().slice(-5)}`, client: "", email: "", project: "", date: new Date().toISOString().slice(0, 10), expires: "", status: "draft", notes: "", items: [{ desc: "", qty: 1, rate: "" }] });

export function EstimatesTab({ estimates, setEstimates, invoices, setInvoices, auth }) {
  const [view, setView] = useState("list"); // list | edit | preview
  const [current, setCurrent] = useState(null);

  // Auto-expire any sent estimates whose expiry date has passed. Re-checks
  // whenever the loaded estimate count changes (e.g. right after they load
  // from Supabase), not just on mount.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const toExpire = estimates.filter(e => e.status === "sent" && e.expires && e.expires < today);
    if (toExpire.length === 0) return;
    (async () => {
      const ids = toExpire.map(e => e.id);
      const { error } = await supabase.from("estimates").update({ status: "expired" }).in("id", ids);
      if (error) { console.error("Failed to auto-expire estimates:", error); return; }
      setEstimates(prev => prev.map(e => ids.includes(e.id) ? { ...e, status: "expired" } : e));
    })();
  }, [estimates.length]);

  const openNew = () => { setCurrent(EMPTY_EST()); setView("edit"); };
  const openEdit = est => { setCurrent(JSON.parse(JSON.stringify(est))); setView("edit"); };

  const saveEst = async () => {
    const exists = estimates.find(i => i.id === current.id);
    if (exists) {
      const { data, error } = await supabase.from("estimates").update(estimateToDb(current)).eq("id", current.id).select().single();
      if (error) { console.error("Failed to update estimate:", error); return; }
      const saved = estimateFromDb(data);
      setEstimates(prev => prev.map(i => i.id === saved.id ? saved : i));
    } else {
      const { data, error } = await supabase.from("estimates").insert({ ...estimateToDb(current), contractor_id: auth.id }).select().single();
      if (error) { console.error("Failed to create estimate:", error); return; }
      setEstimates(prev => [estimateFromDb(data), ...prev]);
    }
    setView("list");
  };

  const deleteEst = async id => {
    const { error } = await supabase.from("estimates").delete().eq("id", id);
    if (error) { console.error("Failed to delete estimate:", error); return; }
    setEstimates(prev => prev.filter(i => i.id !== id));
  };

  const cycleStatus = async est => {
    const order = ["draft", "sent", "approved", "declined", "expired"];
    const next = order[(order.indexOf(est.status) + 1) % order.length];
    const { error } = await supabase.from("estimates").update({ status: next }).eq("id", est.id);
    if (error) { console.error("Failed to update estimate status:", error); return; }
    setEstimates(prev => prev.map(i => i.id === est.id ? { ...i, status: next } : i));
  };

  const convertToInvoice = async est => {
    // Already converted — don't create a duplicate, just confirm where it lives
    if (est.convertedInvoiceId) {
      const existing = invoices.find(i => i.id === est.convertedInvoiceId);
      if (existing) {
        alert(`This estimate was already converted to invoice ${existing.number}. Check the Invoices tab — no duplicate was created.`);
        return;
      }
    }
    const invPayload = {
      number: `INV-${Date.now().toString().slice(-5)}`,
      client: est.client, email: est.email, project: est.project,
      date: new Date().toISOString().slice(0,10), due: null, status: "draft",
      notes: `Converted from estimate ${est.number}. ${est.notes||""}`.trim(),
      items: JSON.parse(JSON.stringify(est.items)),
    };
    const { data: invRow, error: invErr } = await supabase.from("invoices").insert({ ...invPayload, contractor_id: auth.id }).select().single();
    if (invErr) { console.error("Failed to create invoice from estimate:", invErr); return; }
    const inv = invoiceFromDb(invRow);
    setInvoices(prev => [inv, ...prev]);

    const { error: estErr } = await supabase.from("estimates").update({ status: "approved", converted_invoice_id: inv.id }).eq("id", est.id);
    if (estErr) { console.error("Failed to link estimate to invoice:", estErr); return; }
    setEstimates(prev => prev.map(i => i.id === est.id ? { ...i, status: "approved", convertedInvoiceId: inv.id } : i));
    alert(`Created invoice ${inv.number} from this estimate. Check the Invoices tab.`);
  };

  const total = est => (est.items || []).reduce((s, i) => s + (Number(i.qty) * Number(i.rate) || 0), 0);

  const totals = { draft: 0, sent: 0, approved: 0, declined: 0, expired: 0 };
  estimates.forEach(i => { totals[i.status] = (totals[i.status] || 0) + total(i); });

  const [estSearch, setEstSearch] = useState("");
  const [estDateRange, setEstDateRange] = useState("all");
  const dateFilteredEsts = filterByDateRange(estimates, "date", estDateRange);
  const visibleEstimates = estSearch.trim()
    ? dateFilteredEsts.filter(e => [e.number, e.client, e.project].some(f => (f||"").toLowerCase().includes(estSearch.toLowerCase())))
    : dateFilteredEsts;

  if (view === "edit" && current) return <EstimateEditor est={current} setEst={setCurrent} onSave={saveEst} onCancel={() => setView("list")} total={total} />;
  if (view === "preview" && current) return <EstimatePreview est={current} total={total} onBack={() => setView("list")} onConvert={() => { convertToInvoice(current); setView("list"); }} />;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
        {Object.entries(EST_STATUS).map(([k, s]) => (
          <div key={k} style={{ background: s.bg, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{fmt$(totals[k])}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Search estimates..."
            value={estSearch}
            onChange={e => setEstSearch(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #D3D1C7", fontSize: 13, fontFamily: "inherit", outline: "none", width: 180 }}
          />
          {[["all","All Time"],["month","This Month"],["quarter","Last 3 Months"],["year","This Year"]].map(([key, label]) => (
            <button key={key} onClick={() => setEstDateRange(key)}
              style={{ padding: "6px 14px", borderRadius: 20, border: estDateRange === key ? "2px solid #185FA5" : "1.5px solid #D3D1C7", background: estDateRange === key ? "#E6F1FB" : "#fff", color: estDateRange === key ? "#185FA5" : "#5F5E5A", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {label}
            </button>
          ))}
        </div>
        <Btn onClick={openNew} variant="primary">+ New Estimate</Btn>
      </div>

      {visibleEstimates.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", border: "2px dashed #D3D1C7", borderRadius: 12 }}>
          <p style={{ fontSize: 15, color: "#888780", marginBottom: 16 }}>{estimates.length === 0 ? "No estimates yet. Send a detailed quote before work begins." : "No estimates match your search or filter."}</p>
          {estimates.length === 0 && <Btn onClick={openNew}>Create Estimate</Btn>}
        </div>
      ) : (
        <div>
          {visibleEstimates.map(est => {
            const s = EST_STATUS[est.status] || EST_STATUS.draft;
            return (
              <div key={est.id} style={{ background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 10, padding: "14px 18px", marginBottom: 10, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#2C2C2A" }}>{est.number}</span>
                    <Badge text={s.label} color={s.color} bg={s.bg} />
                    {est.convertedInvoiceId && invoices.find(i=>i.id===est.convertedInvoiceId) && (
                      <Badge text={`-> ${invoices.find(i=>i.id===est.convertedInvoiceId).number}`} color="#185FA5" bg="#E6F1FB" />
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "#5F5E5A" }}>{est.client || "No client"} · {est.project || "No project"}</div>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 2 }}>Expires: {est.expires || "—"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#2C2C2A" }}>{fmt$(total(est))}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Btn onClick={() => { setCurrent(est); setView("preview"); }} variant="ghost" small> View</Btn>
                  <Btn onClick={() => openEdit(est)} variant="ghost" small></Btn>
                  <Btn onClick={() => cycleStatus(est)} variant="ghost" small>refresh Status</Btn>
                  <Btn onClick={() => convertToInvoice(est)} variant={est.convertedInvoiceId ? "ghost" : "success"} small>{est.convertedInvoiceId ? "✓ Invoiced" : "-> Invoice"}</Btn>
                  <Btn onClick={() => deleteEst(est.id)} variant="danger" small></Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EstimateEditor({ est, setEst, onSave, onCancel, total }) {
  const set = k => v => setEst(d => ({ ...d, [k]: v }));
  const setItem = (i, k, v) => setEst(d => { const items = [...d.items]; items[i] = { ...items[i], [k]: v }; return { ...d, items }; });
  const addItem = () => setEst(d => ({ ...d, items: [...d.items, { desc: "", qty: 1, rate: "" }] }));
  const removeItem = i => setEst(d => ({ ...d, items: d.items.filter((_, idx) => idx !== i) }));

  return (
    <Card>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#0C447C", marginBottom: 20 }}>{est.number} — Edit Estimate</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Client Name" value={est.client} onChange={set("client")} placeholder="Jane Smith" required />
        <Field label="Client Email" type="email" value={est.email} onChange={set("email")} placeholder="jane@email.com" />
        <Field label="Project / Description" value={est.project} onChange={set("project")} placeholder="Kitchen remodel — phase 2" />
        <Field label="Status">
          <select value={est.status} onChange={e => set("status")(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #D3D1C7", fontSize: 14, fontFamily: "inherit" }}>
            {Object.entries(EST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Estimate Date" type="date" value={est.date} onChange={set("date")} />
        <Field label="Expires On" type="date" value={est.expires} onChange={set("expires")} />
      </div>

      <SectionTitle>Line Items</SectionTitle>
      <div style={{ border: "1.5px solid #D3D1C7", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 36px", background: "#F1EFE8", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <span>Description</span><span>Qty</span><span>Rate ($)</span><span></span>
        </div>
        {est.items.map((item, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 36px", borderTop: "1px solid #F1EFE8", alignItems: "center" }}>
            <input value={item.desc} onChange={e => setItem(i, "desc", e.target.value)} placeholder="Labor, materials..." style={{ border: "none", padding: "10px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
            <input type="number" value={item.qty} onChange={e => setItem(i, "qty", e.target.value)} style={{ border: "none", borderLeft: "1px solid #F1EFE8", padding: "10px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
            <input type="number" value={item.rate} onChange={e => setItem(i, "rate", e.target.value)} placeholder="0.00" style={{ border: "none", borderLeft: "1px solid #F1EFE8", padding: "10px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
            <button onClick={() => removeItem(i)} style={{ background: "none", border: "none", fontSize: 16, cursor: "pointer", color: "#A32D2D", padding: "0 10px" }}>✕</button>
          </div>
        ))}
        <div style={{ borderTop: "1px solid #F1EFE8", padding: "8px 12px" }}>
          <button onClick={addItem} style={{ background: "none", border: "none", fontSize: 13, color: "#185FA5", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Add Line Item</button>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <div style={{ background: "#F1EFE8", borderRadius: 10, padding: "12px 20px", textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>ESTIMATED TOTAL</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0C447C" }}>{fmt$(total(est))}</div>
        </div>
      </div>

      <Field label="Notes" value={est.notes} onChange={set("notes")} as="textarea" rows={2} placeholder="Scope assumptions, validity period, terms..." />

      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={onSave} variant="success">Save Estimate</Btn>
        <Btn onClick={onCancel} variant="ghost">Cancel</Btn>
      </div>
    </Card>
  );
}

export function EstimatePreview({ est, total, onBack, onConvert }) {
  return (
    <div>
      <style>{`@media print { body * { visibility: hidden; } #estimate-print, #estimate-print * { visibility: visible; } #estimate-print { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; } .no-print { display: none !important; } }`}</style>
      <div className="no-print" style={{ marginBottom: 16, display:"flex", justifyContent:"space-between" }}>
        <Btn onClick={onBack} variant="ghost" small>Back ← Back to Estimates</Btn>
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={() => window.print()} variant="primary" small>print Download PDF</Btn>
          <Btn onClick={onConvert} variant={est.convertedInvoiceId ? "ghost" : "success"} small>{est.convertedInvoiceId ? "✓ Already Invoiced" : "-> Convert to Invoice"}</Btn>
        </div>
      </div>
      <div id="estimate-print" style={{ background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 12, padding: "36px 40px", maxWidth: 680 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36, borderBottom: "2px solid #0C447C", paddingBottom: 24 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0C447C", letterSpacing: "-0.03em" }}>ESTIMATE</div>
            <div style={{ fontSize: 16, color: "#888780", marginTop: 2 }}>{est.number}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Badge text={EST_STATUS[est.status]?.label || "Draft"} color={EST_STATUS[est.status]?.color} bg={EST_STATUS[est.status]?.bg} />
            <div style={{ fontSize: 12, color: "#888780", marginTop: 8 }}>Date: {est.date}</div>
            <div style={{ fontSize: 12, color: "#888780" }}>Expires: {est.expires || "—"}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
          <div><div style={{ fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Prepared For</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#2C2C2A" }}>{est.client || "—"}</div>
            <div style={{ fontSize: 13, color: "#5F5E5A" }}>{est.email}</div>
          </div>
          <div><div style={{ fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Project</div>
            <div style={{ fontSize: 14, color: "#2C2C2A" }}>{est.project || "—"}</div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead><tr style={{ background: "#F1EFE8" }}>
            {["Description", "Qty", "Rate", "Amount"].map(h => <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: h === "Description" ? "left" : "right" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {est.items.map((item, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F1EFE8" }}>
                <td style={{ padding: "10px 12px", fontSize: 14, color: "#2C2C2A" }}>{item.desc || "—"}</td>
                <td style={{ padding: "10px 12px", fontSize: 14, color: "#5F5E5A", textAlign: "right" }}>{item.qty}</td>
                <td style={{ padding: "10px 12px", fontSize: 14, color: "#5F5E5A", textAlign: "right" }}>{fmt$(item.rate)}</td>
                <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 600, color: "#2C2C2A", textAlign: "right" }}>{fmt$(Number(item.qty) * Number(item.rate))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
          <div style={{ background: "#0C447C", borderRadius: 10, padding: "14px 24px", minWidth: 180, textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#B5D4F4", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Estimated Total</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>{fmt$(total(est))}</div>
          </div>
        </div>
        {est.notes && <div style={{ borderTop: "1px solid #F1EFE8", paddingTop: 16, fontSize: 13, color: "#5F5E5A", lineHeight: 1.6 }}><strong>Notes:</strong> {est.notes}</div>}
      </div>
    </div>
  );
}

