import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { invoiceFromDb, invoiceToDb } from "../lib/mappers.js";

// — Invoice Tab ---------------------------------------------------------------
export const EMPTY_INV = () => ({ id: uid(), number: `INV-${Date.now().toString().slice(-5)}`, client: "", email: "", project: "", projectId: "", date: new Date().toISOString().slice(0, 10), due: "", status: "draft", notes: "", items: [{ desc: "", qty: 1, rate: "" }] });

export function InvoicesTab({ invoices, setInvoices, onSendToProjects, projectLinkedInvoiceIds, auth, projects }) {
  const [view, setView] = useState("list");
  const [current, setCurrent] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [copiedReminderId, setCopiedReminderId] = useState(null);
  const [reminderModal, setReminderModal] = useState(null);

  const openNew = () => { setCurrent(EMPTY_INV()); setView("edit"); };
  const openEdit = inv => { setCurrent(JSON.parse(JSON.stringify(inv))); setView("edit"); };

  const saveInv = async () => {
    const exists = invoices.find(i => i.id === current.id);
    if (exists) {
      const { data, error } = await supabase.from("invoices").update(invoiceToDb(current)).eq("id", current.id).select().single();
      if (error) { console.error("Failed to update invoice:", error); return; }
      const saved = invoiceFromDb(data);
      setInvoices(prev => prev.map(i => i.id === saved.id ? saved : i));
    } else {
      const { data, error } = await supabase.from("invoices").insert({ ...invoiceToDb(current), contractor_id: auth.id }).select().single();
      if (error) { console.error("Failed to create invoice:", error); return; }
      setInvoices(prev => [invoiceFromDb(data), ...prev]);
    }
    setView("list");
  };

  const deleteInv = async id => {
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) { console.error("Failed to delete invoice:", error); return; }
    setInvoices(prev => prev.filter(i => i.id !== id));
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const setStatus = async (inv, status) => {
    if (status === inv.status) return;
    const { error } = await supabase.from("invoices").update({ status }).eq("id", inv.id);
    if (error) { console.error("Failed to update invoice status:", error); return; }
    setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, status } : i));
  };

  const applyBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    const ids = [...selected];
    const { error } = await supabase.from("invoices").update({ status: bulkStatus }).in("id", ids);
    if (error) { console.error("Failed to bulk-update invoice status:", error); return; }
    setInvoices(prev => prev.map(i => selected.has(i.id) ? { ...i, status: bulkStatus } : i));
    setSelected(new Set());
    setBulkStatus("");
  };

  const toggleSelect = id => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = ids => {
    const allSelected = ids.every(id => selected.has(id));
    setSelected(prev => {
      const s = new Set(prev);
      ids.forEach(id => allSelected ? s.delete(id) : s.add(id));
      return s;
    });
  };

  const total = inv => (inv.items || []).reduce((s, i) => s + (Number(i.qty) * Number(i.rate) || 0), 0);

  // Overdue aging — days past due
  const today = new Date().toISOString().slice(0, 10);
  const daysOverdue = inv => {
    if (!inv.due || inv.status === "paid") return 0;
    const diff = Math.floor((new Date(today) - new Date(inv.due)) / 86400000);
    return diff > 0 ? diff : 0;
  };

  // Auto-flag sent invoices past their due date as overdue
  const overdueInvoices = invoices.filter(i => i.status === "overdue" || (i.status !== "paid" && i.status !== "draft" && i.due && i.due < today));

  // Stats
  const totals = { draft: 0, sent: 0, paid: 0, overdue: 0 };
  invoices.forEach(i => { totals[i.status] = (totals[i.status] || 0) + total(i); });

  const [dateRange, setDateRange] = useState("all");
  const [search, setSearch] = useState("");
  const dateFiltered = filterByDateRange(invoices, "date", dateRange);
  const visibleInvoices = search.trim()
    ? dateFiltered.filter(i => [i.number, i.client, i.project].some(f => (f||"").toLowerCase().includes(search.toLowerCase())))
    : dateFiltered;

  // Non-overdue invoices for main list (overdue ones appear in their own section)
  const overdueIds = new Set(overdueInvoices.map(i => i.id));
  const mainInvoices = visibleInvoices.filter(i => !overdueIds.has(i.id));

  if (view === "edit" && current) return <InvoiceEditor inv={current} setInv={setCurrent} onSave={saveInv} onCancel={() => setView("list")} total={total} allInvoices={invoices} projects={projects} />;
  if (view === "preview" && current) return <InvoicePreview inv={current} total={total} onBack={() => setView("list")} />;

  const DATE_FILTERS = [["all","All Time"],["month","This Month"],["quarter","Last 3 Months"],["year","This Year"]];

  const copyReminder = inv => {
    const days = daysOverdue(inv);
    const msg = `Hi ${inv.client || "there"},\n\nThis is a friendly reminder that invoice ${inv.number} for "${inv.project || "your project"}" is ${days > 0 ? `${days} day${days !== 1 ? "s" : ""} past due` : "now overdue"}.\n\nAmount due: ${fmt$(total(inv))}\nOriginal due date: ${inv.due || "—"}\n\nPlease let me know if you have any questions. I appreciate your prompt attention to this.\n\nThank you`;
    setReminderModal({ inv, msg });
  };

  const renderInvoiceRow = (inv, showOverdueBadge = false) => {
    const days = daysOverdue(inv);
    return (
      <div key={inv.id} style={{ background: "#fff", border: `1.5px solid ${selected.has(inv.id) ? "#185FA5" : "#D3D1C7"}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
        <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggleSelect(inv.id)}
          style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#2C2C2A" }}>{inv.number}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {Object.entries(INV_STATUS).map(([key, val]) => (
                <button key={key} onClick={() => setStatus(inv, key)}
                  style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, letterSpacing: "0.04em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit", border: inv.status === key ? "none" : "1.5px solid #D3D1C7", background: inv.status === key ? val.bg : "#fff", color: inv.status === key ? val.color : "#888780" }}>
                  {val.label}
                </button>
              ))}
            </div>
            {showOverdueBadge && days > 0 && (
              <Badge text={`${days} day${days !== 1 ? "s" : ""} overdue`} color="#A32D2D" bg="#FCEBEB" />
            )}
          </div>
          <div style={{ fontSize: 13, color: "#5F5E5A" }}>{inv.client || "No client"} · {inv.project || "No project"}</div>
          <div style={{ fontSize: 12, color: "#888780", marginTop: 2 }}>Due: {inv.due || "—"}</div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#2C2C2A", textAlign: "right", minWidth: 80 }}>{fmt$(total(inv))}</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <Btn onClick={() => { setCurrent(inv); setView("preview"); }} variant="ghost" small>View</Btn>
          <Btn onClick={() => openEdit(inv)} variant="ghost" small>Edit</Btn>
          {showOverdueBadge && (
            <Btn onClick={() => copyReminder(inv)} variant={copiedReminderId === inv.id ? "success" : "ghost"} small>
              {copiedReminderId === inv.id ? "Copied!" : "Copy Reminder"}
            </Btn>
          )}
          {onSendToProjects && (
            projectLinkedInvoiceIds && projectLinkedInvoiceIds.has(inv.id)
              ? <Btn variant="ghost" small disabled>In Projects</Btn>
              : <Btn onClick={() => onSendToProjects(inv)} variant="primary" small>Add to Projects</Btn>
          )}
          <Btn onClick={() => deleteInv(inv.id)} variant="danger" small>Delete</Btn>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Reminder message modal */}
      {reminderModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:14, padding:28, width:"100%", maxWidth:480, boxSizing:"border-box" }}>
            <div style={{ fontSize:16, fontWeight:800, color:"#0C447C", marginBottom:6 }}>Payment Reminder</div>
            <p style={{ fontSize:13, color:"#2C2C2A", marginBottom:14 }}>Select all the text below and copy it to send via text or email.</p>
            <textarea readOnly value={reminderModal.msg} rows={10} onFocus={e=>e.target.select()}
              style={{ width:"100%", boxSizing:"border-box", padding:"10px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", resize:"none", background:"#F8F7F4", color:"#2C2C2A", lineHeight:1.6 }} />
            <div style={{ display:"flex", gap:10, marginTop:14 }}>
              <Btn onClick={()=>{ try { navigator.clipboard.writeText(reminderModal.msg).then(()=>{ setCopiedReminderId(reminderModal.inv.id); setTimeout(()=>setCopiedReminderId(null),2500); }); } catch(e){} }} variant={copiedReminderId===reminderModal.inv.id?"success":"primary"} small>
                {copiedReminderId===reminderModal.inv.id ? "Copied!" : "Copy to Clipboard"}
              </Btn>
              <Btn onClick={()=>setReminderModal(null)} variant="ghost" small>Close</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Summary tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
        {[["Draft", totals.draft, "#854F0B", "#FAEEDA"], ["Sent", totals.sent, "#185FA5", "#E6F1FB"], ["Paid", totals.paid, "#0F6E56", "#E1F5EE"], ["Overdue", totals.overdue, "#A32D2D", "#FCEBEB"]].map(([label, val, color, bg]) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{fmt$(val)}</div>
          </div>
        ))}
      </div>

      {/* Search + date filters + new button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #D3D1C7", fontSize: 13, fontFamily: "inherit", outline: "none", width: 180 }} />
          {DATE_FILTERS.map(([key, label]) => (
            <button key={key} onClick={() => setDateRange(key)}
              style={{ padding: "6px 14px", borderRadius: 20, border: dateRange === key ? "2px solid #185FA5" : "1.5px solid #D3D1C7", background: dateRange === key ? "#E6F1FB" : "#fff", color: dateRange === key ? "#185FA5" : "#5F5E5A", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {label}
            </button>
          ))}
        </div>
        <Btn onClick={openNew} variant="primary">+ New Invoice</Btn>
      </div>

      {/* Bulk action bar — appears when any invoice is selected */}
      {selected.size > 0 && (
        <div style={{ background: "#E6F1FB", border: "1.5px solid #185FA5", borderRadius: 10, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#185FA5" }}>{selected.size} invoice{selected.size !== 1 ? "s" : ""} selected</span>
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #185FA5", fontSize: 13, fontFamily: "inherit", background: "#fff", color: "#2C2C2A" }}>
            <option value="">Apply status...</option>
            {Object.entries(INV_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <Btn onClick={applyBulkStatus} variant="primary" small>Apply</Btn>
          <Btn onClick={() => setSelected(new Set())} variant="ghost" small>Clear Selection</Btn>
        </div>
      )}

      {visibleInvoices.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", border: "2px dashed #D3D1C7", borderRadius: 12 }}>
          <p style={{ fontSize: 15, color: "#888780", marginBottom: 16 }}>{invoices.length === 0 ? "No invoices yet. Create your first invoice to get paid faster." : "No invoices match your search or filter."}</p>
          {invoices.length === 0 && <Btn onClick={openNew}>Create Invoice</Btn>}
        </div>
      ) : (
        <div>
          {/* Overdue section */}
          {overdueInvoices.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 4, height: 18, borderRadius: 2, background: "#A32D2D" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#A32D2D", textTransform: "uppercase", letterSpacing: "0.05em" }}>Overdue ({overdueInvoices.length})</span>
                </div>
                <button onClick={() => toggleAll(overdueInvoices.map(i => i.id))}
                  style={{ fontSize: 12, color: "#888780", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  {overdueInvoices.every(i => selected.has(i.id)) ? "Deselect all" : "Select all overdue"}
                </button>
              </div>
              {overdueInvoices.sort((a,b) => (a.due||"").localeCompare(b.due||"")).map(inv => renderInvoiceRow(inv, true))}
            </div>
          )}

          {/* Main invoice list */}
          {mainInvoices.length > 0 && (
            <div>
              {overdueInvoices.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 4, height: 18, borderRadius: 2, background: "#D3D1C7" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.05em" }}>All Invoices ({mainInvoices.length})</span>
                  </div>
                  <button onClick={() => toggleAll(mainInvoices.map(i => i.id))}
                    style={{ fontSize: 12, color: "#888780", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    {mainInvoices.every(i => selected.has(i.id)) ? "Deselect all" : "Select all"}
                  </button>
                </div>
              )}
              {mainInvoices.map(inv => renderInvoiceRow(inv))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function InvoiceEditor({ inv, setInv, onSave, onCancel, total, allInvoices = [], projects = {} }) {
  const set = k => v => setInv(d => ({ ...d, [k]: v }));
  const setItem = (i, k, v) => setInv(d => { const items = [...d.items]; items[i] = { ...items[i], [k]: v }; return { ...d, items }; });
  const addItem = () => setInv(d => ({ ...d, items: [...d.items, { desc: "", qty: 1, rate: "" }] }));
  const removeItem = i => setInv(d => ({ ...d, items: d.items.filter((_, idx) => idx !== i) }));

  // Real projects the contractor can pick from, so the invoice links back
  // to an actual project id instead of only a freeform text label.
  const projectOptions = Object.values(projects).filter(p => p.projectTitle);
  const linkedProject = projectOptions.find(p => p.id === inv.projectId);
  const pickProject = val => {
    if (val === "__manual__") { setInv(d => ({ ...d, projectId: "" })); return; }
    const p = projectOptions.find(p => p.id === val);
    setInv(d => ({ ...d, projectId: val, project: p ? p.projectTitle : d.project }));
  };

  // Duplicate detection — check if another open invoice exists for the same client + project
  const duplicate = inv.client && inv.project
    ? allInvoices.find(i => i.id !== inv.id && i.status !== "paid" && sameProject(i.project, inv.project) && (i.client||"").trim().toLowerCase() === (inv.client||"").trim().toLowerCase())
    : null;

  return (
    <Card>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#0C447C", marginBottom: 20 }}>{inv.number} — Edit Invoice</div>

      {duplicate && (
        <div style={{ background: "#FAEEDA", border: "1.5px solid #E8C07A", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#854F0B" }}>
          <strong>Possible duplicate:</strong> Invoice {duplicate.number} for {duplicate.client} on "{duplicate.project}" already exists with status "{INV_STATUS[duplicate.status]?.label || duplicate.status}". You can still save, but check if this is intentional.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Client Name" value={inv.client} onChange={set("client")} placeholder="Jane Smith" required />
        <Field label="Client Email" type="email" value={inv.email} onChange={set("email")} placeholder="jane@email.com" />
        <Field label="Project / Description">
          <select value={linkedProject ? inv.projectId : "__manual__"} onChange={e => pickProject(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #D3D1C7", fontSize: 14, fontFamily: "inherit" }}>
            <option value="__manual__">Other / type manually</option>
            {projectOptions.map(p => <option key={p.id} value={p.id}>{p.projectTitle}</option>)}
          </select>
          {!linkedProject && (
            <input value={inv.project} onChange={e => set("project")(e.target.value)} placeholder="Kitchen remodel — phase 2"
              style={{ marginTop: 8, width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #D3D1C7", fontSize: 14, fontFamily: "inherit" }} />
          )}
        </Field>
        <Field label="Status">
          <select value={inv.status} onChange={e => set("status")(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #D3D1C7", fontSize: 14, fontFamily: "inherit" }}>
            {Object.entries(INV_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Invoice Date" type="date" value={inv.date} onChange={set("date")} />
        <Field label="Due Date" type="date" value={inv.due} onChange={set("due")} />
      </div>

      <SectionTitle>Line Items</SectionTitle>
      <div style={{ border: "1.5px solid #D3D1C7", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 36px", background: "#F1EFE8", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <span>Description</span><span>Qty</span><span>Rate ($)</span><span></span>
        </div>
        {inv.items.map((item, i) => (
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
          <div style={{ fontSize: 12, color: "#888780", marginBottom: 4 }}>TOTAL</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0C447C" }}>{fmt$(total(inv))}</div>
        </div>
      </div>

      <Field label="Notes" value={inv.notes} onChange={set("notes")} as="textarea" rows={2} placeholder="Payment terms, thank you note, bank details..." />

      <div style={{ display: "flex", gap: 10 }}>
        <Btn onClick={onSave} variant="success">Save Invoice</Btn>
        <Btn onClick={onCancel} variant="ghost">Cancel</Btn>
      </div>
    </Card>
  );
}

export function InvoicePreview({ inv, total, onBack }) {
  return (
    <div>
      <style>{`@media print { body * { visibility: hidden; } #invoice-print, #invoice-print * { visibility: visible; } #invoice-print { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; } .no-print { display: none !important; } }`}</style>
      <div className="no-print" style={{ marginBottom: 16, display: "flex", gap: 10 }}>
        <Btn onClick={onBack} variant="ghost" small>Back ← Back to Invoices</Btn>
        <Btn onClick={() => window.print()} variant="primary" small>print Download PDF</Btn>
      </div>
      <div id="invoice-print" style={{ background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 12, padding: "36px 40px", maxWidth: 680 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36, borderBottom: "2px solid #0C447C", paddingBottom: 24 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0C447C", letterSpacing: "-0.03em" }}>INVOICE</div>
            <div style={{ fontSize: 16, color: "#888780", marginTop: 2 }}>{inv.number}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Badge text={INV_STATUS[inv.status]?.label || "Draft"} color={INV_STATUS[inv.status]?.color} bg={INV_STATUS[inv.status]?.bg} />
            <div style={{ fontSize: 12, color: "#888780", marginTop: 8 }}>Date: {inv.date}</div>
            <div style={{ fontSize: 12, color: "#888780" }}>Due: {inv.due || "—"}</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 28 }}>
          <div><div style={{ fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Bill To</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#2C2C2A" }}>{inv.client || "—"}</div>
            <div style={{ fontSize: 13, color: "#5F5E5A" }}>{inv.email}</div>
          </div>
          <div><div style={{ fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Project</div>
            <div style={{ fontSize: 14, color: "#2C2C2A" }}>{inv.project || "—"}</div>
          </div>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead><tr style={{ background: "#F1EFE8" }}>
            {["Description", "Qty", "Rate", "Amount"].map(h => <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: h === "Description" ? "left" : "right" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {inv.items.map((item, i) => (
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
            <div style={{ fontSize: 11, color: "#B5D4F4", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Total Due</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff" }}>{fmt$(total(inv))}</div>
          </div>
        </div>
        {inv.notes && <div style={{ borderTop: "1px solid #F1EFE8", paddingTop: 16, fontSize: 13, color: "#5F5E5A", lineHeight: 1.6 }}><strong>Notes:</strong> {inv.notes}</div>}
      </div>
    </div>
  );
}

