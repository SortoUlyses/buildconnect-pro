import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { expenseFromDb, expenseToDb, projectFromDb, projectToDb, projectCrewFromDb, projectCrewToDb, projectMaterialFromDb, projectMaterialToDb, projectExpenseRowFromDb, projectExpenseRowToDb, projectPermitFeeFromDb, projectPermitFeeToDb, projectSubcontractorFromDb, projectSubcontractorToDb, projectPermitFromDb, projectPhotoRowFromDb } from "../lib/mappers.js";
import { uploadContractorPhoto, deleteContractorPhoto } from "../lib/storage.js";

// — Contractor Portal (tabs: Leads, Profile, Photos, Invoices, Schedule) ------
// — Project Manager Tab -------------------------------------------------------
export const EMPTY_MANUAL_PROJECT = (overrides = {}) => ({
  id: uid(),
  source: "manual",
  projectTitle: "",
  trade: "",
  propertyType: "Residential",
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  city: "",
  state: "",
  description: "",
  contractAmount: "",
  stage: "not_started",
  notes: "",
  startDate: "",
  targetDate: "",
  crew: [],
  materials: [],
  projectExpenses: [],
  permits: [],
  permitFees: [],
  subcontractors: [],
  projectPhotos: [],
  ...overrides,
});

export const EMPTY_CREW_MEMBER = () => ({ id: uid(), name: "", role: "", startTime: "", hours: "", hourlyRate: "", overtimeHours: "", doubleHours: "", useOT: false });
export const EMPTY_MATERIAL = () => ({ id: uid(), item: "", quantity: "", cost: "" });

// Calculate crew member wages with optional California OT rules
// Regular: up to 8h at 1x. Overtime: 8-12h at 1.5x. Double: 12h+ at 2x.
// If overtimeHours/doubleHours are entered manually, use those instead.
export const calcWage = (c) => {
  const rate  = Number(c.hourlyRate) || 0;
  const total = Number(c.hours)      || 0;
  if (!c.useOT || rate === 0) return rate * total;
  const reg    = Number(c.overtimeHours) !== 0 || Number(c.doubleHours) !== 0
    ? Math.max(0, total - (Number(c.overtimeHours)||0) - (Number(c.doubleHours)||0))
    : Math.min(total, 8);
  const ot     = Number(c.overtimeHours) !== 0 || Number(c.doubleHours) !== 0
    ? (Number(c.overtimeHours) || 0)
    : Math.min(Math.max(total - 8, 0), 4);
  const dbl    = Number(c.overtimeHours) !== 0 || Number(c.doubleHours) !== 0
    ? (Number(c.doubleHours) || 0)
    : Math.max(total - 12, 0);
  return (reg * rate) + (ot * rate * 1.5) + (dbl * rate * 2);
};

// — Crew / Labor tracking ------------------------------------------------------
const CREW_FIELD_TO_COLUMN = { name:"name", role:"role", startTime:"start_time", hours:"hours", hourlyRate:"hourly_rate", overtimeHours:"overtime_hours", doubleHours:"double_hours", useOT:"use_ot" };

export function CrewSection({ crew, laborHours, projectTitle, projectKey, projectId, setProjects, setExpenses, auth }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_CREW_MEMBER());
  const [justAdded, setJustAdded] = useState(false);

  const totalWages = crew.reduce((s,c) => s + calcWage(c), 0);

  const setCrew = updater => setProjects(prev => ({ ...prev, [projectKey]: { ...prev[projectKey], crew: updater(prev[projectKey]?.crew || []) } }));

  const addMember = async () => {
    if (!form.name) { alert("Please enter a crew member name."); return; }
    const { data, error } = await supabase.from("project_crew").insert({ ...projectCrewToDb(form), project_id: projectId, contractor_id: auth.id }).select().single();
    if (error) { console.error("Failed to add crew member:", error); return; }
    const saved = projectCrewFromDb(data);
    setCrew(list => [...list, saved]);

    const wageCost = calcWage(saved);
    if (typeof setExpenses === "function" && wageCost > 0) {
      const otNote = saved.useOT ? ` (incl. OT)` : "";
      const newExpense = { sourceId: saved.id, date: new Date().toISOString().slice(0,10), category: "Labor", description: `${saved.name}${saved.role ? ` (${saved.role})` : ""} — ${saved.hours}h @ ${fmt$(saved.hourlyRate)}/hr${otNote}`, amount: wageCost, project: projectTitle, projectKey };
      const { data: expData, error: expError } = await supabase.from("expenses").insert({ ...expenseToDb(newExpense), source_id: newExpense.sourceId, contractor_id: auth.id }).select().single();
      if (expError) { console.error("Failed to log crew wage expense:", expError); }
      else setExpenses(prev => [expenseFromDb(expData), ...prev]);
    }

    setForm(EMPTY_CREW_MEMBER());
    setAdding(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 3000);
  };

  const removeMember = async id => {
    setCrew(list => list.filter(c => c.id !== id));
    const { error } = await supabase.from("project_crew").delete().eq("id", id);
    if (error) { console.error("Failed to remove crew member:", error); return; }
    if (typeof setExpenses === "function") {
      await supabase.from("expenses").delete().eq("source_id", id);
      setExpenses(prev => prev.filter(e => e.sourceId !== id));
    }
  };

  // Optimistic — updates local state immediately so typing doesn't lag behind
  // the network round trip, persists to Supabase in the background.
  const updateField = (id, key, val) => {
    setCrew(list => list.map(c => c.id === id ? { ...c, [key]: val } : c));
    const column = CREW_FIELD_TO_COLUMN[key] || key;
    supabase.from("project_crew").update({ [column]: val === "" ? null : val }).eq("id", id)
      .then(({ error }) => { if (error) console.error("Failed to update crew member:", error); });
  };
  const toggleOT = id => {
    setCrew(list => list.map(c => c.id === id ? { ...c, useOT: !c.useOT } : c));
    const current = crew.find(c => c.id === id);
    supabase.from("project_crew").update({ use_ot: !current?.useOT }).eq("id", id)
      .then(({ error }) => { if (error) console.error("Failed to update crew member:", error); });
  };

  // Auto-calculate OT breakdown from total hours when useOT is on and no manual override
  const autoOT = (total) => {
    const t = Number(total) || 0;
    return { reg: Math.min(t,8), ot: Math.min(Math.max(t-8,0),4), dbl: Math.max(t-12,0) };
  };

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <SectionTitle> Crew &amp; Hours{laborHours>0?` · ${laborHours}h`:""}{totalWages>0?` · ${fmt$(totalWages)} in wages`:""}</SectionTitle>
        <Btn onClick={()=>setAdding(true)} variant="ghost" small>+ Add Crew Member</Btn>
      </div>
      <p style={{ fontSize:11, color:"#2C2C2A", marginTop:-6, marginBottom:8 }}>Crew wages added here also show up automatically in the Expenses tab. Toggle OT to apply California overtime rules (1.5x after 8h · 2x after 12h).</p>
      {justAdded && (
        <div style={{ background:"#E1F5EE", borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:12, color:"#0F6E56", fontWeight:600 }}>
          v Added — this crew member's wages now appear here and in the Expenses tab.
        </div>
      )}

      {crew.length === 0 && !adding ? (
        <div style={{ fontSize:13, color:"#2C2C2A", padding:"10px 0" }}>No crew assigned yet.</div>
      ) : (
        <div style={{ border:"1.5px solid #D3D1C7", borderRadius:10, overflow:"hidden", marginBottom:adding?10:0 }}>
          {/* Column headers */}
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1.2fr 0.9fr 0.8fr 0.9fr 0.7fr 1.2fr 36px", background:"#F1EFE8", padding:"7px 10px", fontSize:10, fontWeight:700, color:"#2C2C2A", textTransform:"uppercase", letterSpacing:"0.04em" }}>
            <span>Name</span><span>Role</span><span>Start</span><span>Hours</span><span>Rate/hr</span><span>OT</span><span>Total Wage</span><span></span>
          </div>

          {crew.map(c => {
            const auto = autoOT(c.hours);
            const wage = calcWage(c);
            return (
              <div key={c.id}>
                {/* Main row */}
                <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1.2fr 0.9fr 0.8fr 0.9fr 0.7fr 1.2fr 36px", borderTop:"1px solid #F1EFE8", alignItems:"center" }}>
                  <input value={c.name} onChange={e=>updateField(c.id,"name",e.target.value)} placeholder="Name"
                    style={{ border:"none", padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" }} />
                  <input value={c.role} onChange={e=>updateField(c.id,"role",e.target.value)} placeholder="Role"
                    style={{ border:"none", borderLeft:"1px solid #F1EFE8", padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" }} />
                  <input type="time" value={c.startTime} onChange={e=>updateField(c.id,"startTime",e.target.value)}
                    style={{ border:"none", borderLeft:"1px solid #F1EFE8", padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" }} />
                  <input type="number" value={c.hours} onChange={e=>updateField(c.id,"hours",e.target.value)} placeholder="0"
                    style={{ border:"none", borderLeft:"1px solid #F1EFE8", padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" }} />
                  <input type="number" value={c.hourlyRate} onChange={e=>updateField(c.id,"hourlyRate",e.target.value)} placeholder="0.00"
                    style={{ border:"none", borderLeft:"1px solid #F1EFE8", padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" }} />
                  {/* OT toggle */}
                  <div style={{ borderLeft:"1px solid #F1EFE8", padding:"6px 8px", display:"flex", justifyContent:"center" }}>
                    <button type="button" onClick={()=>toggleOT(c.id)} title={c.useOT ? "Overtime ON — click to turn off" : "Click to enable overtime calculation"}
                      style={{ padding:"3px 8px", borderRadius:6, border:"none", background:c.useOT?"#0C447C":"#E8E6DF", color:c.useOT?"#fff":"#888780", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.03em" }}>
                      {c.useOT ? "ON" : "OFF"}
                    </button>
                  </div>
                  {/* Wage total */}
                  <div style={{ padding:"8px 10px", borderLeft:"1px solid #F1EFE8" }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{fmt$(wage)}</div>
                    {c.useOT && Number(c.hours) > 8 && (
                      <div style={{ fontSize:9, color:"#185FA5", fontWeight:600, marginTop:2 }}>incl. OT</div>
                    )}
                  </div>
                  <button onClick={()=>removeMember(c.id)} style={{ background:"none", border:"none", fontSize:15, cursor:"pointer", color:"#A32D2D" }}>✕</button>
                </div>

                {/* OT breakdown row — only when OT is on and hours > 8 */}
                {c.useOT && Number(c.hours) > 0 && (
                  <div style={{ background:"#E6F1FB", padding:"8px 12px 10px", borderTop:"1px solid #D3D1C7" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>
                       Overtime Breakdown — California Rules (1.5x after 8h · 2x after 12h)
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                      {/* Regular */}
                      <div style={{ background:"#fff", borderRadius:8, padding:"8px 10px" }}>
                        <div style={{ fontSize:10, color:"#888780", fontWeight:600, marginBottom:4 }}>Regular (1x)</div>
                        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                          <input type="number" placeholder="0"
                            value={c.overtimeHours || c.doubleHours ? Math.max(0, Number(c.hours) - (Number(c.overtimeHours)||0) - (Number(c.doubleHours)||0)) : auto.reg}
                            readOnly={true}
                            style={{ width:40, padding:"3px 6px", borderRadius:5, border:"1px solid #D3D1C7", fontSize:12, fontFamily:"inherit", outline:"none", background:"#F8F7F4", textAlign:"center" }} />
                          <span style={{ fontSize:11, color:"#5F5E5A" }}>h x {fmt$(c.hourlyRate)}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:"#2C2C2A", marginLeft:"auto" }}>
                            {fmt$((c.overtimeHours || c.doubleHours ? Math.max(0, Number(c.hours) - (Number(c.overtimeHours)||0) - (Number(c.doubleHours)||0)) : auto.reg) * (Number(c.hourlyRate)||0))}
                          </span>
                        </div>
                      </div>
                      {/* Overtime 1.5x */}
                      <div style={{ background:"#fff", borderRadius:8, padding:"8px 10px" }}>
                        <div style={{ fontSize:10, color:"#854F0B", fontWeight:600, marginBottom:4 }}>Overtime (1.5x)</div>
                        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                          <input type="number" min="0" placeholder="auto"
                            value={c.overtimeHours}
                            onChange={e=>updateField(c.id,"overtimeHours",e.target.value)}
                            style={{ width:40, padding:"3px 6px", borderRadius:5, border:"1.5px solid #EF9F27", fontSize:12, fontFamily:"inherit", outline:"none", textAlign:"center" }} />
                          <span style={{ fontSize:11, color:"#5F5E5A" }}>h x {fmt$(Number(c.hourlyRate)*1.5)}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:"#854F0B", marginLeft:"auto" }}>
                            {fmt$((Number(c.overtimeHours) || auto.ot) * (Number(c.hourlyRate)||0) * 1.5)}
                          </span>
                        </div>
                        <div style={{ fontSize:9, color:"#888780", marginTop:3 }}>Override auto · blank = auto</div>
                      </div>
                      {/* Double time 2x */}
                      <div style={{ background:"#fff", borderRadius:8, padding:"8px 10px" }}>
                        <div style={{ fontSize:10, color:"#A32D2D", fontWeight:600, marginBottom:4 }}>Double Time (2x)</div>
                        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                          <input type="number" min="0" placeholder="auto"
                            value={c.doubleHours}
                            onChange={e=>updateField(c.id,"doubleHours",e.target.value)}
                            style={{ width:40, padding:"3px 6px", borderRadius:5, border:"1.5px solid #A32D2D", fontSize:12, fontFamily:"inherit", outline:"none", textAlign:"center" }} />
                          <span style={{ fontSize:11, color:"#5F5E5A" }}>h x {fmt$(Number(c.hourlyRate)*2)}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:"#A32D2D", marginLeft:"auto" }}>
                            {fmt$((Number(c.doubleHours) || auto.dbl) * (Number(c.hourlyRate)||0) * 2)}
                          </span>
                        </div>
                        <div style={{ fontSize:9, color:"#888780", marginTop:3 }}>Override auto · blank = auto</div>
                      </div>
                    </div>
                    {/* Total with OT */}
                    <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:8, marginTop:10, paddingTop:8, borderTop:"1px solid #D3D1C7" }}>
                      <span style={{ fontSize:12, color:"#185FA5", fontWeight:600 }}>Total with overtime:</span>
                      <span style={{ fontSize:16, fontWeight:900, color:"#0C447C" }}>{fmt$(wage)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Totals footer */}
          {crew.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1.2fr 0.9fr 0.8fr 0.9fr 0.7fr 1.2fr 36px", background:"#0C447C", padding:"10px", alignItems:"center" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.75)", gridColumn:"1/6" }}>Total Crew Wages</div>
              <div />
              <div style={{ fontSize:16, fontWeight:900, color:"#fff" }}>{fmt$(totalWages)}</div>
              <div />
            </div>
          )}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div style={{ background:"#F8F7F4", borderRadius:10, padding:14, border:"1.5px solid #D3D1C7" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#0C447C", marginBottom:12 }}>New Crew Member</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Crew member name *" autoFocus
              style={{ padding:"8px 10px", borderRadius:7, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
            <input value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} placeholder="Role (e.g. Electrician)"
              style={{ padding:"8px 10px", borderRadius:7, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
            <input type="time" value={form.startTime} onChange={e=>setForm(f=>({...f,startTime:e.target.value}))}
              style={{ padding:"8px 10px", borderRadius:7, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
            <input type="number" value={form.hours} onChange={e=>setForm(f=>({...f,hours:e.target.value}))} placeholder="Total hours worked"
              style={{ padding:"8px 10px", borderRadius:7, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
            <input type="number" value={form.hourlyRate} onChange={e=>setForm(f=>({...f,hourlyRate:e.target.value}))} placeholder="Base hourly rate ($)"
              style={{ padding:"8px 10px", borderRadius:7, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
            {/* OT toggle in form */}
            <label style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:form.useOT?"#E6F1FB":"#fff", borderRadius:7, border:`1.5px solid ${form.useOT?"#185FA5":"#D3D1C7"}`, cursor:"pointer" }}>
              <input type="checkbox" checked={form.useOT} onChange={e=>setForm(f=>({...f,useOT:e.target.checked}))} style={{ accentColor:"#0C447C", width:15, height:15 }} />
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:form.useOT?"#0C447C":"#2C2C2A" }}>Calculate Overtime</div>
                <div style={{ fontSize:10, color:"#888780" }}>CA rules: 1.5x after 8h, 2x after 12h</div>
              </div>
            </label>
          </div>
          {/* Preview wage in form */}
          {(Number(form.hours) > 0 || Number(form.hourlyRate) > 0) && (
            <div style={{ background:form.useOT&&Number(form.hours)>8?"#E6F1FB":"#E1F5EE", borderRadius:8, padding:"8px 12px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:12, color:"#5F5E5A" }}>
                {form.useOT && Number(form.hours) > 8
                  ? `${Math.min(Number(form.hours),8)}h reg + ${Math.min(Math.max(Number(form.hours)-8,0),4)}h OT + ${Math.max(Number(form.hours)-12,0)}h DT`
                  : `${form.hours}h x ${fmt$(form.hourlyRate)}`}
              </span>
              <span style={{ fontSize:15, fontWeight:900, color:"#0C447C" }}>{fmt$(calcWage(form))}</span>
            </div>
          )}
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={addMember} variant="success" small>Add to Crew</Btn>
            <Btn onClick={()=>{setAdding(false); setForm(EMPTY_CREW_MEMBER());}} variant="ghost" small>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
export const EMPTY_PROJECT_EXPENSE = () => ({ id: uid(), description: "", amount: "", date: new Date().toISOString().slice(0,10) });
export const EMPTY_PERMIT_FEE = () => ({ id: uid(), permitType: "", fee: "", date: new Date().toISOString().slice(0,10) });
export const EMPTY_SUBCONTRACTOR = () => ({ id: uid(), name: "", trade: "", phone: "", email: "", cost: "" });

// — Add / Edit Project Modal (top-level so inputs never lose focus) ----------
export function AddProjectModal({ manualForm, setManualForm, onSave, onCancel }) {
  const set = k => v => setManualForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:14, padding:28, width:"100%", maxWidth:480, boxSizing:"border-box", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ fontSize:16, fontWeight:800, color:"#0C447C", marginBottom:4 }}>Add a Project</div>
        <p style={{ fontSize:12, color:"#2C2C2A", marginBottom:16 }}>For jobs you landed outside the bidding portal — referrals, repeat clients, walk-ins, etc.</p>
        <Field label="Project Title" value={manualForm.projectTitle} onChange={set("projectTitle")} placeholder="e.g. Backyard deck rebuild" required />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 12px" }}>
          <Field label="Trade">
            <select value={manualForm.trade} onChange={e=>set("trade")(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
              <option value="">Select...</option>
              {Object.keys(TRADES).map(t=><option key={t} value={t}>{TRADES[t].icon} {t}</option>)}
            </select>
          </Field>
          <Field label="Property Type">
            <select value={manualForm.propertyType} onChange={e=>set("propertyType")(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
              <option value="Residential">home Residential</option>
              <option value="Commercial">office Commercial</option>
            </select>
          </Field>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 12px" }}>
          <Field label="Client Name" value={manualForm.clientName} onChange={set("clientName")} placeholder="Jane Smith" required />
          <Field label="Client Phone" value={manualForm.clientPhone} onChange={set("clientPhone")} placeholder="(555) 000-0000" />
        </div>
        <Field label="Client Email" type="email" value={manualForm.clientEmail} onChange={set("clientEmail")} placeholder="jane@email.com" />
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:"0 12px" }}>
          <Field label="City" value={manualForm.city} onChange={set("city")} placeholder="San Diego" />
          <Field label="State" value={manualForm.state} onChange={set("state")} placeholder="CA" />
        </div>
        <Field label="Contract Amount ($)" type="number" value={manualForm.contractAmount} onChange={set("contractAmount")} placeholder="0.00" />
        <Field label="Description" value={manualForm.description} onChange={set("description")} as="textarea" rows={3} placeholder="Scope of work..." />
        <div style={{ display:"flex", gap:8, marginTop:4 }}>
          <Btn onClick={onSave} variant="success">Add Project</Btn>
          <Btn onClick={onCancel} variant="ghost">Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

// — Materials list -------------------------------------------------------------
export function MaterialsSection({ materials, projectTitle, projectKey, projectId, setProjects, setExpenses, auth }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_MATERIAL());
  const [justAdded, setJustAdded] = useState(false);

  const totalCost = materials.reduce((s,m)=>s+(Number(m.quantity)*Number(m.cost)||0),0);

  const setMaterials = updater => setProjects(prev => ({ ...prev, [projectKey]: { ...prev[projectKey], materials: updater(prev[projectKey]?.materials || []) } }));

  const addMaterial = async () => {
    if (!form.item) { alert("Please enter a material name."); return; }
    const { data, error } = await supabase.from("project_materials").insert({ ...projectMaterialToDb(form), project_id: projectId, contractor_id: auth.id }).select().single();
    if (error) { console.error("Failed to add material:", error); return; }
    const saved = projectMaterialFromDb(data);
    setMaterials(list => [...list, saved]);

    const lineTotal = Number(saved.quantity) * Number(saved.cost) || 0;
    if (typeof setExpenses === "function" && lineTotal > 0) {
      const newExpense = { sourceId: saved.id, date: new Date().toISOString().slice(0,10), category: "Materials", description: `${saved.item} (x${saved.quantity || 1})`, amount: lineTotal, project: projectTitle, projectKey };
      const { data: expData, error: expError } = await supabase.from("expenses").insert({ ...expenseToDb(newExpense), source_id: newExpense.sourceId, contractor_id: auth.id }).select().single();
      if (expError) { console.error("Failed to log material expense:", expError); }
      else setExpenses(prev => [expenseFromDb(expData), ...prev]);
    }

    setForm(EMPTY_MATERIAL());
    setAdding(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 3000);
  };
  const removeMaterial = async id => {
    setMaterials(list => list.filter(m => m.id !== id));
    const { error } = await supabase.from("project_materials").delete().eq("id", id);
    if (error) { console.error("Failed to remove material:", error); return; }
    if (typeof setExpenses === "function") {
      await supabase.from("expenses").delete().eq("source_id", id);
      setExpenses(prev => prev.filter(e => e.sourceId !== id));
    }
  };
  // Optimistic — see CrewSection.updateField for why.
  const updateField = (id, key, val) => {
    setMaterials(list => list.map(m => m.id === id ? { ...m, [key]: val } : m));
    supabase.from("project_materials").update({ [key]: val === "" ? null : val }).eq("id", id)
      .then(({ error }) => { if (error) console.error("Failed to update material:", error); });
  };

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <SectionTitle> Materials{totalCost>0?` · ${fmt$(totalCost)} total`:""}</SectionTitle>
        <Btn onClick={()=>setAdding(true)} variant="ghost" small>+ Add Material</Btn>
      </div>
      <p style={{ fontSize:11, color:"#2C2C2A", marginTop:-6, marginBottom:8 }}>Materials added here also show up automatically in the Expenses tab.</p>
      {justAdded && (
        <div style={{ background:"#E1F5EE", borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:12, color:"#0F6E56", fontWeight:600 }}>
          v Added — this material's cost now appears here and in the Expenses tab.
        </div>
      )}

      {materials.length === 0 && !adding ? (
        <div style={{ fontSize:13, color:"#2C2C2A", padding:"10px 0" }}>No materials logged yet.</div>
      ) : (
        <div style={{ border:"1.5px solid #D3D1C7", borderRadius:10, overflow:"hidden", marginBottom:adding?10:0 }}>
          <div style={{ display:"grid", gridTemplateColumns:"2.5fr 1fr 1fr 1fr 36px", background:"#F1EFE8", padding:"7px 10px", fontSize:10, fontWeight:700, color:"#2C2C2A", textTransform:"uppercase", letterSpacing:"0.04em" }}>
            <span>Item</span><span>Qty</span><span>Cost ea.</span><span>Total</span><span></span>
          </div>
          {materials.map(m => (
            <div key={m.id} style={{ display:"grid", gridTemplateColumns:"2.5fr 1fr 1fr 1fr 36px", borderTop:"1px solid #F1EFE8", alignItems:"center" }}>
              <input value={m.item} onChange={e=>updateField(m.id,"item",e.target.value)} placeholder="Material / item" style={{ border:"none", padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" }} />
              <input type="number" value={m.quantity} onChange={e=>updateField(m.id,"quantity",e.target.value)} placeholder="0" style={{ border:"none", borderLeft:"1px solid #F1EFE8", padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" }} />
              <input type="number" value={m.cost} onChange={e=>updateField(m.id,"cost",e.target.value)} placeholder="0.00" style={{ border:"none", borderLeft:"1px solid #F1EFE8", padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" }} />
              <div style={{ padding:"8px 10px", fontSize:13, fontWeight:700, color:"#2C2C2A", borderLeft:"1px solid #F1EFE8" }}>{fmt$(Number(m.quantity)*Number(m.cost)||0)}</div>
              <button onClick={()=>removeMaterial(m.id)} style={{ background:"none", border:"none", fontSize:15, cursor:"pointer", color:"#A32D2D" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={{ background:"#F8F7F4", borderRadius:10, padding:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <input value={form.item} onChange={e=>setForm(f=>({...f,item:e.target.value}))} placeholder="Material / item name" autoFocus style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none", gridColumn:"1 / -1" }} />
          <input type="number" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} placeholder="Quantity" style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
          <input type="number" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} placeholder="Cost per unit ($)" style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
          <div style={{ display:"flex", gap:8, gridColumn:"1 / -1" }}>
            <Btn onClick={addMaterial} variant="success" small>Add</Btn>
            <Btn onClick={()=>{setAdding(false); setForm(EMPTY_MATERIAL());}} variant="ghost" small>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// — Project-level expenses box -------------------------------------------------
export function ProjectExpensesSection({ projectExpenses, projectTitle, projectKey, projectId, setProjects, setExpenses, auth }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_PROJECT_EXPENSE());
  const [justAdded, setJustAdded] = useState(false);

  const total = projectExpenses.reduce((s,e)=>s+(Number(e.amount)||0),0);

  const setProjectExpenses = updater => setProjects(prev => ({ ...prev, [projectKey]: { ...prev[projectKey], projectExpenses: updater(prev[projectKey]?.projectExpenses || []) } }));

  const addExpense = async () => {
    if (!form.description || !form.amount) { alert("Please enter a description and amount."); return; }
    const { data, error } = await supabase.from("project_expenses").insert({ ...projectExpenseRowToDb(form), project_id: projectId, contractor_id: auth.id }).select().single();
    if (error) { console.error("Failed to add project expense:", error); return; }
    const saved = projectExpenseRowFromDb(data);
    setProjectExpenses(list => [...list, saved]);

    // Also push the same entry into the global Expenses tab so it shows up there too.
    // source_id links back to this project_expenses row so removeExpense can find it below.
    if (typeof setExpenses === "function") {
      const newExpense = { date: saved.date, category: "Other", description: saved.description, amount: saved.amount, project: projectTitle, projectKey };
      const { data: expData, error: expError } = await supabase.from("expenses").insert({ ...expenseToDb(newExpense), source_id: saved.id, contractor_id: auth.id }).select().single();
      if (expError) { console.error("Failed to log project expense:", expError); }
      else setExpenses(prev => [expenseFromDb(expData), ...prev]);
    }

    setForm(EMPTY_PROJECT_EXPENSE());
    setAdding(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 3000);
  };
  const removeExpense = async id => {
    setProjectExpenses(list => list.filter(e => e.id !== id));
    const { error } = await supabase.from("project_expenses").delete().eq("id", id);
    if (error) { console.error("Failed to remove project expense:", error); return; }
    if (typeof setExpenses === "function") {
      await supabase.from("expenses").delete().eq("source_id", id);
      setExpenses(prev => prev.filter(e => e.sourceId !== id));
    }
  };

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <SectionTitle>$ Project Expenses{total>0?` · ${fmt$(total)} total`:""}</SectionTitle>
        <Btn onClick={()=>setAdding(true)} variant="ghost" small>+ Add Expense</Btn>
      </div>
      <p style={{ fontSize:11, color:"#2C2C2A", marginTop:-6, marginBottom:8 }}>Expenses added here also show up automatically in the Expenses tab.</p>
      {justAdded && (
        <div style={{ background:"#E1F5EE", borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:12, color:"#0F6E56", fontWeight:600 }}>
          v Added — this expense now appears here and in the Expenses tab.
        </div>
      )}

      {projectExpenses.length === 0 && !adding ? (
        <div style={{ fontSize:13, color:"#2C2C2A", padding:"6px 0" }}>No project-specific expenses logged yet.</div>
      ) : (
        <div>
          {projectExpenses.map(e => (
            <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:8, marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#2C2C2A" }}>{e.description}</div>
                <div style={{ fontSize:11, color:"#2C2C2A" }}>{e.date}</div>
              </div>
              <div style={{ fontSize:14, fontWeight:800, color:"#A32D2D" }}>{fmt$(e.amount)}</div>
              <button onClick={()=>removeExpense(e.id)} style={{ background:"none", border:"none", fontSize:15, cursor:"pointer", color:"#A32D2D" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={{ background:"#F8F7F4", borderRadius:10, padding:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Expense description" autoFocus style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none", gridColumn:"1 / -1" }} />
          <input type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="Amount ($)" style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
          <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
          <div style={{ display:"flex", gap:8, gridColumn:"1 / -1" }}>
            <Btn onClick={addExpense} variant="success" small>Add</Btn>
            <Btn onClick={()=>{setAdding(false); setForm(EMPTY_PROJECT_EXPENSE());}} variant="ghost" small>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// — Permit Fees ----------------------------------------------------------------
export function PermitFeesSection({ permitFees, projectTitle, projectKey, projectId, setProjects, setExpenses, auth }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_PERMIT_FEE());
  const [justAdded, setJustAdded] = useState(false);

  const total = permitFees.reduce((s,p)=>s+(Number(p.fee)||0),0);

  const setPermitFees = updater => setProjects(prev => ({ ...prev, [projectKey]: { ...prev[projectKey], permitFees: updater(prev[projectKey]?.permitFees || []) } }));

  const addFee = async () => {
    if (!form.permitType || !form.fee) { alert("Please enter a permit type and fee amount."); return; }
    const { data, error } = await supabase.from("project_permit_fees").insert({ ...projectPermitFeeToDb(form), project_id: projectId, contractor_id: auth.id }).select().single();
    if (error) { console.error("Failed to add permit fee:", error); return; }
    const saved = projectPermitFeeFromDb(data);
    setPermitFees(list => [...list, saved]);

    if (typeof setExpenses === "function") {
      const newExpense = { sourceId: saved.id, date: saved.date, category: "Permits", description: `${saved.permitType} permit fee`, amount: saved.fee, project: projectTitle, projectKey };
      const { data: expData, error: expError } = await supabase.from("expenses").insert({ ...expenseToDb(newExpense), source_id: newExpense.sourceId, contractor_id: auth.id }).select().single();
      if (expError) { console.error("Failed to log permit fee expense:", expError); }
      else setExpenses(prev => [expenseFromDb(expData), ...prev]);
    }

    setForm(EMPTY_PERMIT_FEE());
    setAdding(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 3000);
  };
  const removeFee = async id => {
    setPermitFees(list => list.filter(p => p.id !== id));
    const { error } = await supabase.from("project_permit_fees").delete().eq("id", id);
    if (error) { console.error("Failed to remove permit fee:", error); return; }
    if (typeof setExpenses === "function") {
      await supabase.from("expenses").delete().eq("source_id", id);
      setExpenses(prev => prev.filter(e => e.sourceId !== id));
    }
  };

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <SectionTitle> Permit Fees{total>0?` · ${fmt$(total)} total`:""}</SectionTitle>
        <Btn onClick={()=>setAdding(true)} variant="ghost" small>+ Add Permit Fee</Btn>
      </div>
      <p style={{ fontSize:11, color:"#2C2C2A", marginTop:-6, marginBottom:8 }}>Permit fees added here also show up automatically in the Expenses tab.</p>
      {justAdded && (
        <div style={{ background:"#E1F5EE", borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:12, color:"#0F6E56", fontWeight:600 }}>
          v Added — this permit fee now appears here and in the Expenses tab.
        </div>
      )}

      {permitFees.length === 0 && !adding ? (
        <div style={{ fontSize:13, color:"#2C2C2A", padding:"6px 0" }}>No permit fees logged yet.</div>
      ) : (
        <div>
          {permitFees.map(p => (
            <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:8, marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#2C2C2A" }}>{p.permitType}</div>
                <div style={{ fontSize:11, color:"#2C2C2A" }}>{p.date}</div>
              </div>
              <div style={{ fontSize:14, fontWeight:800, color:"#A32D2D" }}>{fmt$(p.fee)}</div>
              <button onClick={()=>removeFee(p.id)} style={{ background:"none", border:"none", fontSize:15, cursor:"pointer", color:"#A32D2D" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={{ background:"#F8F7F4", borderRadius:10, padding:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <input value={form.permitType} onChange={e=>setForm(f=>({...f,permitType:e.target.value}))} placeholder="Permit type (e.g. Electrical permit)" autoFocus style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none", gridColumn:"1 / -1" }} />
          <input type="number" value={form.fee} onChange={e=>setForm(f=>({...f,fee:e.target.value}))} placeholder="Fee amount ($)" style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
          <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
          <div style={{ display:"flex", gap:8, gridColumn:"1 / -1" }}>
            <Btn onClick={addFee} variant="success" small>Add</Btn>
            <Btn onClick={()=>{setAdding(false); setForm(EMPTY_PERMIT_FEE());}} variant="ghost" small>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// — Subcontractors ------------------------------------------------------------
export function SubcontractorsSection({ subcontractors, projectTitle, projectKey, projectId, setProjects, setExpenses, auth }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_SUBCONTRACTOR());
  const [justAdded, setJustAdded] = useState(false);

  const total = subcontractors.reduce((s,c)=>s+(Number(c.cost)||0),0);

  const setSubcontractors = updater => setProjects(prev => ({ ...prev, [projectKey]: { ...prev[projectKey], subcontractors: updater(prev[projectKey]?.subcontractors || []) } }));

  const addSub = async () => {
    if (!form.name || !form.cost) { alert("Please enter a name and cost."); return; }
    const { data, error } = await supabase.from("project_subcontractors").insert({ ...projectSubcontractorToDb(form), project_id: projectId, contractor_id: auth.id }).select().single();
    if (error) { console.error("Failed to add subcontractor:", error); return; }
    const saved = projectSubcontractorFromDb(data);
    setSubcontractors(list => [...list, saved]);

    if (typeof setExpenses === "function") {
      const newExpense = { sourceId: saved.id, date: new Date().toISOString().slice(0,10), category: "Subcontractor", description: `${saved.name}${saved.trade ? ` (${saved.trade})` : ""}`, amount: saved.cost, project: projectTitle, projectKey };
      const { data: expData, error: expError } = await supabase.from("expenses").insert({ ...expenseToDb(newExpense), source_id: newExpense.sourceId, contractor_id: auth.id }).select().single();
      if (expError) { console.error("Failed to log subcontractor expense:", expError); }
      else setExpenses(prev => [expenseFromDb(expData), ...prev]);
    }

    setForm(EMPTY_SUBCONTRACTOR());
    setAdding(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 3000);
  };
  const removeSub = async id => {
    setSubcontractors(list => list.filter(c => c.id !== id));
    const { error } = await supabase.from("project_subcontractors").delete().eq("id", id);
    if (error) { console.error("Failed to remove subcontractor:", error); return; }
    if (typeof setExpenses === "function") {
      await supabase.from("expenses").delete().eq("source_id", id);
      setExpenses(prev => prev.filter(e => e.sourceId !== id));
    }
  };

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <SectionTitle> Subcontractors{total>0?` · ${fmt$(total)} total`:""}</SectionTitle>
        <Btn onClick={()=>setAdding(true)} variant="ghost" small>+ Add Subcontractor</Btn>
      </div>
      <p style={{ fontSize:11, color:"#2C2C2A", marginTop:-6, marginBottom:8 }}>Subcontractor costs added here also show up automatically in the Expenses tab.</p>
      {justAdded && (
        <div style={{ background:"#E1F5EE", borderRadius:8, padding:"8px 12px", marginBottom:10, fontSize:12, color:"#0F6E56", fontWeight:600 }}>
          v Added — this subcontractor cost now appears here and in the Expenses tab.
        </div>
      )}

      {subcontractors.length === 0 && !adding ? (
        <div style={{ fontSize:13, color:"#2C2C2A", padding:"6px 0" }}>No subcontractors added yet.</div>
      ) : (
        <div>
          {subcontractors.map(c => (
            <div key={c.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:8, marginBottom:6 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#2C2C2A" }}>{c.name}{c.trade?` · ${c.trade}`:""}</div>
                <div style={{ fontSize:11, color:"#2C2C2A" }}>{[c.phone, c.email].filter(Boolean).join(" · ") || "No contact info"}</div>
              </div>
              <div style={{ fontSize:14, fontWeight:800, color:"#A32D2D" }}>{fmt$(c.cost)}</div>
              <button onClick={()=>removeSub(c.id)} style={{ background:"none", border:"none", fontSize:15, cursor:"pointer", color:"#A32D2D" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div style={{ background:"#F8F7F4", borderRadius:10, padding:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Subcontractor / company name" autoFocus style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none", gridColumn:"1 / -1" }} />
          <input value={form.trade} onChange={e=>setForm(f=>({...f,trade:e.target.value}))} placeholder="Trade (e.g. Plumbing)" style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
          <input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="Phone number" style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
          <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="Email address" style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none" }} />
          <input type="number" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} placeholder="Cost ($)" style={{ padding:"7px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none", gridColumn:"1 / -1" }} />
          <div style={{ display:"flex", gap:8, gridColumn:"1 / -1" }}>
            <Btn onClick={addSub} variant="success" small>Add</Btn>
            <Btn onClick={()=>{setAdding(false); setForm(EMPTY_SUBCONTRACTOR());}} variant="ghost" small>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// — Permit document uploads ---------------------------------------------------
export function PermitsUploadSection({ permits, projectKey, projectId, setProjects, auth }) {
  const fileRef = useRef();

  const setPermits = updater => setProjects(prev => ({ ...prev, [projectKey]: { ...prev[projectKey], permits: updater(prev[projectKey]?.permits || []) } }));

  const handleFiles = async e => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const { path, url, error: uploadErr } = await uploadContractorPhoto(file, auth.id, "permits");
      if (uploadErr) { console.error("Failed to upload permit document:", uploadErr); continue; }
      const { data, error } = await supabase.from("project_permits").insert({
        project_id: projectId, contractor_id: auth.id, name: file.name, url, storage_path: path, is_image: isImage,
      }).select().single();
      if (error) { console.error("Failed to save permit record:", error); continue; }
      setPermits(list => [projectPermitFromDb(data), ...list]);
    }
  };

  const removePermit = async id => {
    const permit = (permits || []).find(p => p.id === id);
    if (permit?.storagePath) await deleteContractorPhoto(permit.storagePath);
    const { error } = await supabase.from("project_permits").delete().eq("id", id);
    if (error) { console.error("Failed to delete permit document:", error); return; }
    setPermits(list => list.filter(p => p.id !== id));
  };

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <SectionTitle> Permits &amp; Documents{permits.length>0?` · ${permits.length} file${permits.length!==1?"s":""}`:""}</SectionTitle>
        <input ref={fileRef} type="file" accept="image/*,.pdf" multiple onChange={handleFiles} style={{ display:"none" }} />
        <Btn onClick={()=>fileRef.current?.click()} variant="ghost" small> Upload Permit</Btn>
      </div>

      {permits.length === 0 ? (
        <div style={{ fontSize:13, color:"#2C2C2A", padding:"10px 0" }}>No permits uploaded yet. Upload permit PDFs or photos of physical permits.</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))", gap:10 }}>
          {permits.map(p => (
            <div key={p.id} style={{ border:"1.5px solid #D3D1C7", borderRadius:10, overflow:"hidden", background:"#fff" }}>
              {p.isImage ? (
                <a href={p.src} target="_blank" rel="noopener noreferrer" style={{ display:"block", paddingBottom:"75%", position:"relative" }}>
                  <img src={p.src} alt={p.name} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                </a>
              ) : (
                <a href={p.src} download={p.name} style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:90, textDecoration:"none", background:"#F8F7F4" }}>
                  <span style={{ fontSize:28 }}></span>
                </a>
              )}
              <div style={{ padding:"6px 8px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:11, color:"#2C2C2A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</span>
                <button onClick={()=>removePermit(p.id)} style={{ background:"none", border:"none", fontSize:13, cursor:"pointer", color:"#A32D2D", flexShrink:0 }}></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// — Project Photos ------------------------------------------------------------
export function ProjectPhotosSection({ projectPhotos, projectKey, projectId, setProjects, auth }) {
  const fileRef = useRef();
  const [lightbox, setLightbox] = useState(null);

  const setProjectPhotos = updater => setProjects(prev => ({ ...prev, [projectKey]: { ...prev[projectKey], projectPhotos: updater(prev[projectKey]?.projectPhotos || []) } }));

  const handleFiles = async e => {
    const files = Array.from(e.target.files);
    e.target.value = "";
    for (const file of files) {
      const { path, url, error: uploadErr } = await uploadContractorPhoto(file, auth.id, "projects");
      if (uploadErr) { console.error("Failed to upload job photo:", uploadErr); continue; }
      const { data, error } = await supabase.from("project_photos").insert({
        project_id: projectId, contractor_id: auth.id, url, storage_path: path,
      }).select().single();
      if (error) { console.error("Failed to save job photo record:", error); continue; }
      setProjectPhotos(list => [projectPhotoRowFromDb(data), ...list]);
    }
  };

  const removePhoto = async id => {
    const photo = (projectPhotos || []).find(p => p.id === id);
    if (photo?.storagePath) await deleteContractorPhoto(photo.storagePath);
    const { error } = await supabase.from("project_photos").delete().eq("id", id);
    if (error) { console.error("Failed to delete job photo:", error); return; }
    setProjectPhotos(list => list.filter(p => p.id !== id));
    if (lightbox?.id === id) setLightbox(null);
  };

  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <SectionTitle>photo Job Photos{projectPhotos.length>0?` · ${projectPhotos.length} photo${projectPhotos.length!==1?"s":""}`:""}</SectionTitle>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display:"none" }} />
        <Btn onClick={()=>fileRef.current?.click()} variant="ghost" small>photo Upload Photo</Btn>
      </div>

      {projectPhotos.length === 0 ? (
        <div style={{ fontSize:13, color:"#2C2C2A", padding:"10px 0" }}>No photos uploaded for this job yet.</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(110px, 1fr))", gap:8 }}>
          {projectPhotos.map(p => (
            <div key={p.id} style={{ borderRadius:8, overflow:"hidden", border:"1.5px solid #D3D1C7", position:"relative" }}>
              <div onClick={()=>setLightbox(p)} style={{ paddingBottom:"75%", position:"relative", cursor:"pointer" }}>
                <img src={p.src} alt="Job site" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
              </div>
              <button onClick={()=>removePhoto(p.id)} style={{ position:"absolute", top:4, right:4, background:"rgba(0,0,0,0.6)", border:"none", borderRadius:6, color:"#fff", fontSize:12, padding:"2px 6px", cursor:"pointer" }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div onClick={()=>setLightbox(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
          <img src={lightbox.src} alt="Job site full size" style={{ maxWidth:"100%", maxHeight:"90vh", objectFit:"contain", borderRadius:8 }} />
        </div>
      )}
    </div>
  );
}

export function ProjectManagerTab({ bids, leads, projects, setProjects, invoices, expenses, setExpenses, schedule, pendingFromInvoice, onConsumePendingInvoice, auth }) {
  const [showArchive, setShowArchive] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_PROJECT());

  // If an invoice was sent over from the Invoices tab, open the Add Project form pre-filled
  useEffect(() => {
    if (pendingFromInvoice) {
      setManualForm(EMPTY_MANUAL_PROJECT({
        projectTitle: pendingFromInvoice.project || "",
        clientName: pendingFromInvoice.client || "",
        clientEmail: pendingFromInvoice.email || "",
        contractAmount: (pendingFromInvoice.items||[]).reduce((s,i)=>s+(Number(i.qty)*Number(i.rate)||0),0),
        description: pendingFromInvoice.notes || "",
      }));
      setShowAddForm(true);
      onConsumePendingInvoice && onConsumePendingInvoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFromInvoice]);

const DEFAULT_PROJECT_DETAIL = { stage: "not_started", notes: "", startDate: "", targetDate: "", completedDate: "", crew: [], materials: [], projectExpenses: [], permits: [], permitFees: [], subcontractors: [], projectPhotos: [] };
  const PROJECT_FIELD_TO_COLUMN = { stage: "stage", startDate: "start_date", targetDate: "target_date", notes: "notes" };

  // Won projects = accepted bids, joined with their lead data. `projects[b.id]`
  // is the real Supabase row (see App.jsx's load effect) once it's loaded —
  // `id` here is the real projects.id, needed by every child section below to
  // insert rows against the right project_id FK.
  const bidProjects = bids.filter(b => b.status === "accepted").map(b => {
    const lead = leads.find(l => l.id === b.leadId) || {};
    const proj = projects[b.id] || DEFAULT_PROJECT_DETAIL;
    return {
      key: b.id,
      id: proj.id,
      source: "bid",
      stage: proj.stage || "not_started",
      notes: proj.notes || "",
      startDate: proj.startDate || "",
      targetDate: proj.targetDate || "",
      completedDate: proj.completedDate || "",
      crew: proj.crew || [],
      materials: proj.materials || [],
      projectExpenses: proj.projectExpenses || [],
      permits: proj.permits || [],
      permitFees: proj.permitFees || [],
      subcontractors: proj.subcontractors || [],
      projectPhotos: proj.projectPhotos || [],
      projectTitle: lead.projectTitle || "Untitled Project",
      trade: lead.trade || "",
      clientName: lead.name || "Unknown client",
      city: lead.city || "",
      state: lead.state || "",
      description: lead.description || "",
      contractAmount: b.amount || 0,
      bid: b,
    };
  });

  // Manually-added projects, stored directly in projects[id] (id === key) with source:"manual"
  const manualProjects = Object.entries(projects)
    .filter(([k, v]) => v.source === "manual")
    .map(([k, v]) => ({ key: k, crew: v.crew || [], materials: v.materials || [], projectExpenses: v.projectExpenses || [], permits: v.permits || [], permitFees: v.permitFees || [], subcontractors: v.subcontractors || [], projectPhotos: v.projectPhotos || [], ...v }));

  const allProjects = [...bidProjects, ...manualProjects];

  const updateProject = async (key, patch) => {
    const current = projects[key];
    if (!current?.id) { console.error("Cannot update project — its record hasn't loaded yet."); return; }
    const completingNow = "stage" in patch ? (patch.stage === "completed" ? new Date().toISOString() : null) : undefined;
    // Optimistic local update first, so stage/date buttons feel instant.
    setProjects(prev => ({
      ...prev,
      [key]: { ...(prev[key] || DEFAULT_PROJECT_DETAIL), ...patch, ...(completingNow !== undefined ? { completedDate: completingNow || "" } : {}) },
    }));
    const dbPatch = {};
    Object.entries(patch).forEach(([k, v]) => { if (PROJECT_FIELD_TO_COLUMN[k]) dbPatch[PROJECT_FIELD_TO_COLUMN[k]] = v === "" ? null : v; });
    if (completingNow !== undefined) dbPatch.completed_at = completingNow;
    const { error } = await supabase.from("projects").update(dbPatch).eq("id", current.id);
    if (error) console.error("Failed to update project:", error);
  };

  const deleteManualProject = async key => {
    const current = projects[key];
    setExpandedId(null);
    if (!current?.id) { setProjects(prev => { const u = { ...prev }; delete u[key]; return u; }); return; }
    // Child rows (crew/materials/expenses/permit fees/subcontractors/permits/photos)
    // cascade-delete automatically via their project_id foreign key.
    const { error } = await supabase.from("projects").delete().eq("id", current.id);
    if (error) { console.error("Failed to delete project:", error); return; }
    setProjects(prev => { const u = { ...prev }; delete u[key]; return u; });
  };

  const saveManualProject = async () => {
    if (!manualForm.projectTitle || !manualForm.clientName) { alert("Please enter at least a project title and client name."); return; }
    const { data, error } = await supabase.from("projects").insert({
      ...projectToDb(manualForm), source: "manual", bid_id: null, contractor_id: auth.id,
    }).select().single();
    if (error) { console.error("Failed to add project:", error); return; }
    const saved = projectFromDb(data);
    setProjects(prev => ({ ...prev, [saved.id]: saved }));
    setShowAddForm(false);
    setManualForm(EMPTY_MANUAL_PROJECT());
  };

  const activeProjects = allProjects.filter(p => p.stage !== "completed");
  const archivedProjects = allProjects.filter(p => p.stage === "completed");

  const stageCounts = Object.keys(PROJECT_STAGES).reduce((acc,k) => {
    acc[k] = allProjects.filter(p=>p.stage===k).length;
    return acc;
  }, {});

  const invTotal = inv => (inv.items || []).reduce((s, i) => s + (Number(i.qty) * Number(i.rate) || 0), 0);

  // Date filter for completed projects tab
  const [archiveDateRange, setArchiveDateRange] = useState("all");

  // Filter completed projects by date range using targetDate
  const filteredArchived = (() => {
    if (archiveDateRange === "all") return archivedProjects;
    const r = getDateRange(archiveDateRange === "month" ? "month" : archiveDateRange === "quarter" ? "quarter" : "year");
    if (!r) return archivedProjects;
    return archivedProjects.filter(p => p.targetDate && p.targetDate >= r.start && p.targetDate <= r.end);
  })();

  const displayedProjects = showArchive ? filteredArchived : activeProjects;

  // Financial summary — changes based on active vs completed view
  const summaryProjects = showArchive ? filteredArchived : activeProjects;
  const totalContractValue = summaryProjects.reduce((s,p) => s + (Number(p.contractAmount)||0), 0);
  const totalCosts = expenses.filter(e => summaryProjects.some(p => matchProject(e, p.key, p.projectTitle))).reduce((s,e) => s + (Number(e.amount)||0), 0);
  const totalProfit = invoices.filter(i => summaryProjects.some(p => matchProject(i, p.key, p.projectTitle))).reduce((s,i) => s + invTotal(i), 0) - totalCosts;

  if (allProjects.length === 0) return (
    <div>
      {showAddForm && <AddProjectModal manualForm={manualForm} setManualForm={setManualForm} onSave={saveManualProject} onCancel={()=>{setShowAddForm(false); setManualForm(EMPTY_MANUAL_PROJECT());}} />}
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
        <Btn onClick={()=>{setManualForm(EMPTY_MANUAL_PROJECT()); setShowAddForm(true);}} variant="primary">+ Add a Project</Btn>
      </div>
      <div style={{ textAlign:"center", padding:"60px 20px", border:"2px dashed #D3D1C7", borderRadius:12 }}>
        <div style={{ fontSize:48, marginBottom:12 }}></div>
        <p style={{ fontSize:15, color:"#2C2C2A", marginBottom:6 }}>No active projects yet.</p>
        <p style={{ fontSize:13, color:"#2C2C2A" }}>Once a homeowner accepts one of your bids in the Leads tab it will show up here automatically — or click "Add a Project" above for jobs you landed outside the platform.</p>
      </div>
    </div>
  );

  return (
    <div>
      {showAddForm && <AddProjectModal manualForm={manualForm} setManualForm={setManualForm} onSave={saveManualProject} onCancel={()=>{setShowAddForm(false); setManualForm(EMPTY_MANUAL_PROJECT());}} />}

      {/* Financial summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:10, marginBottom:12 }}>
        <div style={{ background:"#E6F1FB", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{showArchive ? "Completed" : "Active"} Contract Value</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#185FA5" }}>{fmt$(totalContractValue)}</div>
        </div>
        <div style={{ background:"#FCEBEB", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#A32D2D", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{showArchive ? "Completed" : "Active"} Costs</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#A32D2D" }}>{fmt$(totalCosts)}</div>
        </div>
        <div style={{ background: totalProfit >= 0 ? "#E1F5EE" : "#FCEBEB", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color: totalProfit >= 0 ? "#0F6E56" : "#A32D2D", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Net Profit</div>
          <div style={{ fontSize:22, fontWeight:800, color: totalProfit >= 0 ? "#0F6E56" : "#A32D2D" }}>{fmt$(totalProfit)}</div>
        </div>
      </div>

      {/* Stage count summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10, marginBottom:16 }}>
        {Object.entries(PROJECT_STAGES).map(([k,s]) => (
          <div key={k} style={{ background:s.bg, borderRadius:10, padding:"12px 14px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:s.color, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:3 }}>{s.label}</div>
            <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{stageCounts[k]}</div>
          </div>
        ))}
      </div>

      {/* Active / Archive toggle + Add button */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: showArchive ? 10 : 18, gap:10 }}>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={()=>{ setShowArchive(false); setArchiveDateRange("all"); }}
            style={{ padding:"7px 18px", borderRadius:20, border: !showArchive?"2px solid #185FA5":"1.5px solid #D3D1C7", background: !showArchive?"#E6F1FB":"#fff", color: !showArchive?"#185FA5":"#2C2C2A", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            Active ({activeProjects.length})
          </button>
          <button onClick={()=>setShowArchive(true)}
            style={{ padding:"7px 18px", borderRadius:20, border: showArchive?"2px solid #5F5E5A":"1.5px solid #D3D1C7", background: showArchive?"#F1EFE8":"#fff", color:"#2C2C2A", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            Completed ({archivedProjects.length})
          </button>
        </div>
        <Btn onClick={()=>{setManualForm(EMPTY_MANUAL_PROJECT()); setShowAddForm(true);}} variant="primary">+ Add a Project</Btn>
      </div>

      {/* Date filter — only on Completed tab */}
      {showArchive && (
        <div style={{ display:"flex", gap:6, marginBottom:18, flexWrap:"wrap" }}>
          {[["all","All Time"],["month","This Month"],["quarter","This Quarter"],["year","This Year"]].map(([key, label]) => (
            <button key={key} onClick={()=>setArchiveDateRange(key)}
              style={{ padding:"6px 14px", borderRadius:20, border: archiveDateRange===key?"2px solid #5F5E5A":"1.5px solid #D3D1C7", background: archiveDateRange===key?"#F1EFE8":"#fff", color: archiveDateRange===key?"#5F5E5A":"#2C2C2A", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              {label}
            </button>
          ))}
        </div>
      )}

      {displayedProjects.length === 0 ? (
        <div style={{ textAlign:"center", padding:"40px 20px", color:"#2C2C2A", border:"2px dashed #D3D1C7", borderRadius:12 }}>
          {showArchive ? (archiveDateRange === "all" ? "No completed projects yet." : "No completed projects in this period.") : "No active projects. Add a project or win a bid to get started."}
        </div>
      ) : displayedProjects.map(p => {
        const trade = TRADES[p.trade] || {};
        const projectInvoices = invoices.filter(i => matchProject(i, p.key, p.projectTitle));
        const globalExpenses = expenses.filter(e => matchProject(e, p.key, p.projectTitle));
        const revenue = projectInvoices.reduce((s,i)=>s+invTotal(i),0);
        // Materials and project-level expenses are mirrored into the global expenses list when added,
        // so globalExpenses already includes them — no need to add them again here.
        const cost = globalExpenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
        const laborHours = (p.crew||[]).reduce((s,c)=>s+(Number(c.hours)||0),0);
        const scheduledJobs = schedule.filter(ev => ev.linkedProjectKey ? ev.linkedProjectKey === p.key : (ev.client||"").toLowerCase() === (p.clientName||"").toLowerCase());
        const expanded = expandedId === p.key;
        const stage = PROJECT_STAGES[p.stage] || PROJECT_STAGES.not_started;

        return (
          <div key={p.key} style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:12, overflow:"hidden", marginBottom:14 }}>
            <div style={{ padding:"16px 20px", cursor:"pointer" }} onClick={()=>setExpandedId(expanded?null:p.key)}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, flex:1 }}>
                  <div style={{ width:44, height:44, borderRadius:10, background:trade.bg||"#F1EFE8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{trade.icon||""}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                      <span style={{ fontSize:15, fontWeight:700, color:"#2C2C2A" }}>{p.projectTitle || "Untitled Project"}</span>
                      <Badge text={stage.label} color={stage.color} bg={stage.bg} />
                      {p.source === "manual" && <Badge text="Added Manually" color="#534AB7" bg="#EEEDFE" />}
                    </div>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <Badge text={p.trade||"—"} color={trade.color||"#5F5E5A"} bg={trade.bg||"#F1EFE8"} />
                      <span style={{ fontSize:12, color:"#2C2C2A" }}> {p.clientName||"Unknown client"}</span>
                      <span style={{ fontSize:12, color:"#2C2C2A" }}> {p.city||"—"}, {p.state||""}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:"#0F6E56" }}>{fmt$(p.contractAmount)}</div>
                  <div style={{ fontSize:11, color:"#2C2C2A" }}>{p.source==="manual"?"contract amount":"bid amount"}</div>
                </div>
              </div>
            </div>

            {expanded && (
              <div style={{ borderTop:"1px solid #F1EFE8", padding:"16px 20px" }}>
                {/* Stage selector */}
                <div style={{ marginBottom:16 }}>
                  <SectionTitle>Project Stage</SectionTitle>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {Object.entries(PROJECT_STAGES).map(([k,s]) => (
                      <button key={k} onClick={()=>updateProject(p.key,{stage:k})}
                        style={{ padding:"7px 14px", borderRadius:20, border: p.stage===k?`2px solid ${s.color}`:"1.5px solid #D3D1C7", background: p.stage===k?s.bg:"#fff", color: p.stage===k?s.color:"#2C2C2A", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dates */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                  <Field label="Start Date" type="date" value={p.startDate} onChange={v=>updateProject(p.key,{startDate:v})} />
                  <Field label="Target Completion" type="date" value={p.targetDate} onChange={v=>updateProject(p.key,{targetDate:v})} />
                </div>

                {/* Job costing snapshot */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10, marginBottom:16 }}>
                  <div style={{ background:"#E1F5EE", borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#0F6E56", textTransform:"uppercase", marginBottom:2 }}>Invoiced</div>
                    <div style={{ fontSize:16, fontWeight:800, color:"#0F6E56" }}>{fmt$(revenue)}</div>
                  </div>
                  <div style={{ background:"#FCEBEB", borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#A32D2D", textTransform:"uppercase", marginBottom:2 }}>Total Cost</div>
                    <div style={{ fontSize:16, fontWeight:800, color:"#A32D2D" }}>{fmt$(cost)}</div>
                  </div>
                  <div style={{ background:"#E6F1FB", borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#185FA5", textTransform:"uppercase", marginBottom:2 }}>Profit So Far</div>
                    <div style={{ fontSize:16, fontWeight:800, color:"#185FA5" }}>{fmt$(revenue-cost)}</div>
                  </div>
                  <div style={{ background:"#FAEEDA", borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#854F0B", textTransform:"uppercase", marginBottom:2 }}>Labor Hours</div>
                    <div style={{ fontSize:16, fontWeight:800, color:"#854F0B" }}>{laborHours}h</div>
                  </div>
                </div>
                {(revenue > 0 || cost > 0) && (
                  <p style={{ fontSize:11, color:"#2C2C2A", marginTop:-10, marginBottom:16 }}>Invoiced and Total Cost are pulled from invoices and expenses whose project name matches "{p.projectTitle}" — including materials and expenses added below, since those are mirrored into the Expenses tab automatically.</p>
                )}

                {/* Crew / Labor tracking */}
                <CrewSection crew={p.crew||[]} laborHours={laborHours} projectTitle={p.projectTitle} projectKey={p.key} projectId={p.id} setProjects={setProjects} setExpenses={setExpenses} auth={auth} />

                {/* Materials list */}
                <div style={{ borderTop:"1px solid #F1EFE8", paddingTop:16 }}>
                  <MaterialsSection materials={p.materials||[]} projectTitle={p.projectTitle} projectKey={p.key} projectId={p.id} setProjects={setProjects} setExpenses={setExpenses} auth={auth} />
                </div>

                {/* Project-level expenses */}
                <div style={{ borderTop:"1px solid #F1EFE8", paddingTop:16 }}>
                  <ProjectExpensesSection projectExpenses={p.projectExpenses||[]} projectTitle={p.projectTitle} projectKey={p.key} projectId={p.id} setProjects={setProjects} setExpenses={setExpenses} auth={auth} />
                </div>

                {/* Permit fees */}
                <div style={{ borderTop:"1px solid #F1EFE8", paddingTop:16 }}>
                  <PermitFeesSection permitFees={p.permitFees||[]} projectTitle={p.projectTitle} projectKey={p.key} projectId={p.id} setProjects={setProjects} setExpenses={setExpenses} auth={auth} />
                </div>

                {/* Subcontractors */}
                <div style={{ borderTop:"1px solid #F1EFE8", paddingTop:16 }}>
                  <SubcontractorsSection subcontractors={p.subcontractors||[]} projectTitle={p.projectTitle} projectKey={p.key} projectId={p.id} setProjects={setProjects} setExpenses={setExpenses} auth={auth} />
                </div>

                {/* Permit documents */}
                <PermitsUploadSection permits={p.permits||[]} projectKey={p.key} projectId={p.id} setProjects={setProjects} auth={auth} />

                {/* Job photos */}
                <ProjectPhotosSection projectPhotos={p.projectPhotos||[]} projectKey={p.key} projectId={p.id} setProjects={setProjects} auth={auth} />

                {/* Scheduled site visits */}
                {scheduledJobs.length > 0 && (
                  <div style={{ marginBottom:16 }}>
                    <SectionTitle>Scheduled Site Visits</SectionTitle>
                    {scheduledJobs.map(ev => (
                      <div key={ev.id} style={{ fontSize:13, color:"#2C2C2A", padding:"6px 0", borderBottom:"1px solid #F1EFE8" }}> {ev.date} · {ev.title}</div>
                    ))}
                  </div>
                )}

                {/* Original job description */}
                <div style={{ marginBottom:16 }}>
                  <SectionTitle>{p.source==="manual" ? "Job Description" : "Original Job Description"}</SectionTitle>
                  <p style={{ fontSize:13, color:"#2C2C2A", lineHeight:1.6, margin:0, background:"#F8F7F4", borderRadius:8, padding:"10px 12px" }}>{p.description || "No description on file."}</p>
                </div>

                {/* Notes */}
                <Field label="Project Notes" value={p.notes} onChange={v=>updateProject(p.key,{notes:v})} as="textarea" rows={3} placeholder="Site access details, material orders, client preferences, subcontractor coordination..." />

                {p.source === "manual" && (
                  <div style={{ marginTop:8 }}>
                    <Btn onClick={()=>deleteManualProject(p.key)} variant="danger" small> Remove Project</Btn>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

