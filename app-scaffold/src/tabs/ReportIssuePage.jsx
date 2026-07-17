import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";

export function ReportIssuePage({ leads, bids, auth, onLogin, onNavigate }) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const [form, setForm] = useState({
    issueType: "", project: "", contractor: "", description: "",
    name: auth?.name || "", email: auth?.email || "", urgency: "normal",
  });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const set = k => v => { setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:undefined})); };

  // Build list of the user's projects with accepted bids for the dropdown
  const myProjects = (leads||[]).map(lead => {
    const accepted = (bids||[]).find(b => b.leadId===lead.id && b.status==="accepted");
    return accepted ? { label:`${lead.projectTitle||lead.trade} — ${accepted.company}`, leadId:lead.id, contractor:accepted.company } : null;
  }).filter(Boolean);

  const ISSUE_TYPES = [
    { id:"quality",     icon:"🔧", label:"Poor Workmanship",         desc:"Work was incomplete, substandard, or not as agreed" },
    { id:"safety",      icon:"!",  label:"Safety Concern",           desc:"Contractor created unsafe conditions at my home" },
    { id:"fraud",       icon:"🚨", label:"Fraudulent Contractor",     desc:"Contractor misrepresented credentials or disappeared" },
    { id:"billing",     icon:"💵", label:"Billing Dispute",           desc:"Charged more than agreed or unauthorised charges" },
    { id:"noshow",      icon:"🚫", label:"No-Show / Unresponsive",    desc:"Contractor accepted the job then went silent" },
    { id:"platform",    icon:"💻", label:"Platform Issue",            desc:"Problem with the BuildConnect Pro website or app" },
    { id:"other",       icon:"💬", label:"Other",                     desc:"Something else that doesn't fit the above categories" },
  ];

  const submit = () => {
    const e = {};
    if (!form.issueType)              e.issueType    = "Please select an issue type.";
    if (!form.description.trim())     e.description  = "Please describe the issue.";
    if (form.description.trim().length < 20) e.description = "Please provide more detail (at least 20 characters).";
    if (!form.name.trim())            e.name         = "Your name is required.";
    if (!form.email.trim())           e.email        = "Your email is required so we can follow up.";
    if (Object.keys(e).length) { setErrors(e); return; }
    // TODO: Replace with Supabase insert -> supabase.from('reports').insert({...form, reportedAt: new Date()})
    setSubmitted(true);
  };

  const inpStyle = err => ({
    width:"100%", padding:"11px 14px", borderRadius:9,
    border:`1.5px solid ${err?"#A32D2D":"#D3D1C7"}`,
    fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box", background:"#fff",
  });
  const lbl = { display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 };
  const err_ = { fontSize:12, color:"#A32D2D", marginTop:4 };

  // — Success state --
  if (submitted) return (
    <div style={{ fontFamily:font }}>
      <div style={{ textAlign:"center", padding:"60px 24px", background:"#E1F5EE", borderRadius:14, border:"1.5px solid #B5F5D8" }}>
        <div style={{ fontSize:52, marginBottom:14 }}>✓</div>
        <h3 style={{ fontSize:22, fontWeight:900, color:"#0F6E56", marginBottom:10, letterSpacing:"-0.01em" }}>Report submitted.</h3>
        <p style={{ fontSize:14, color:"#2C2C2A", lineHeight:1.75, maxWidth:460, margin:"0 auto 12px" }}>
          Thank you for letting us know. A member of the BuildConnect Pro team will review your report and follow up at <strong>{form.email}</strong> within 24 hours.
        </p>
        <p style={{ fontSize:13, color:"#5F5E5A", lineHeight:1.65, maxWidth:440, margin:"0 auto 28px" }}>
          If the issue involves a safety risk or ongoing harm, please also contact local authorities. For urgent platform issues, email us directly at <strong>support@buildconnectpro.com</strong>.
        </p>
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          <button type="button" onClick={()=>onNavigate("home")}
            style={{ padding:"11px 24px", borderRadius:9, border:"none", background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font }}>
            ← Back to Home
          </button>
          <button type="button" onClick={()=>onNavigate("myLeads")}
            style={{ padding:"11px 24px", borderRadius:9, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:font }}>
            View My Projects
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily:font, maxWidth:640, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", borderRadius:14, padding:"26px 30px", marginBottom:24 }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8 }}> Report an Issue</div>
        <h2 style={{ fontSize:24, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", margin:"0 0 6px" }}>Had a problem? Tell us.</h2>
        <p style={{ fontSize:14, color:"rgba(255,255,255,0.65)", margin:0, lineHeight:1.65 }}>
          Every report is reviewed by a real person within 24 hours. Contractors found to be in violation are suspended pending investigation.
        </p>

        {/* Trust signals */}
        <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginTop:16 }}>
          {[["","24hr response"],["","Your identity protected"],["!","Contractor review triggered"],["","All reports logged"]].map(([icon,label])=>(
            <div key={label} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"rgba(255,255,255,0.7)" }}>
              <span>{icon}</span>{label}
            </div>
          ))}
        </div>
      </div>

      {/* Issue type selector */}
      <div style={{ background:"#fff", border:`1.5px solid ${errors.issueType?"#A32D2D":"#D3D1C7"}`, borderRadius:14, padding:"22px 24px", marginBottom:16 }}>
        <label style={{ ...lbl, marginBottom:14 }}>What type of issue are you reporting? <span style={{ color:"#A32D2D" }}>★</span></label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {ISSUE_TYPES.map(t => (
            <button key={t.id} type="button" onClick={()=>{ set("issueType")(t.id); setErrors(e=>({...e,issueType:undefined})); }}
              style={{ padding:"12px 14px", borderRadius:10, border:`${form.issueType===t.id?"2px solid #0C447C":"1.5px solid #D3D1C7"}`, background:form.issueType===t.id?"#E6F1FB":"#fff", cursor:"pointer", textAlign:"left", fontFamily:font, transition:"all 0.15s" }}>
              <div style={{ fontSize:16, marginBottom:4 }}>{t.icon}</div>
              <div style={{ fontSize:13, fontWeight:700, color:form.issueType===t.id?"#0C447C":"#2C2C2A", marginBottom:2 }}>{t.label}</div>
              <div style={{ fontSize:11, color:"#888780", lineHeight:1.4 }}>{t.desc}</div>
            </button>
          ))}
        </div>
        {errors.issueType && <div style={err_}>{errors.issueType}</div>}
      </div>

      {/* Project reference */}
      {myProjects.length > 0 && (
        <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:14, padding:"22px 24px", marginBottom:16 }}>
          <label style={lbl}>Related Project <span style={{ fontSize:10, fontWeight:400, textTransform:"none", letterSpacing:0 }}>-- optional but helps us investigate faster</span></label>
          <select value={form.project} onChange={e=>{
            set("project")(e.target.value);
            const p = myProjects.find(p=>p.leadId===e.target.value);
            if (p) set("contractor")(p.contractor);
          }} style={{ ...inpStyle(false), color:form.project?"#2C2C2A":"#9CA3AF" }}>
            <option value="">Select a project...</option>
            {myProjects.map(p=><option key={p.leadId} value={p.leadId}>{p.label}</option>)}
          </select>
          {form.contractor && (
            <div style={{ fontSize:12, color:"#5F5E5A", marginTop:8 }}>Contractor: <strong>{form.contractor}</strong></div>
          )}
        </div>
      )}

      {/* Description */}
      <div style={{ background:"#fff", border:`1.5px solid ${errors.description?"#A32D2D":"#D3D1C7"}`, borderRadius:14, padding:"22px 24px", marginBottom:16 }}>
        <label style={lbl}>Describe the issue <span style={{ color:"#A32D2D" }}>★</span></label>
        <p style={{ fontSize:13, color:"#888780", marginBottom:12, lineHeight:1.6 }}>
          Be as specific as possible — dates, what was agreed, what happened, and any supporting details.
        </p>
        <textarea value={form.description} onChange={e=>set("description")(e.target.value)}
          placeholder="e.g. The contractor agreed to complete the panel upgrade by March 15th. They showed up once, collected a deposit of $1,800, and have not responded to calls or messages in 3 weeks. The work is incomplete and I believe they have taken my money."
          rows={6}
          style={{ width:"100%", padding:"12px 14px", borderRadius:9, border:`1.5px solid ${errors.description?"#A32D2D":"#D3D1C7"}`, fontSize:14, fontFamily:font, outline:"none", resize:"vertical", lineHeight:1.7, boxSizing:"border-box" }} />
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
          {errors.description && <div style={err_}>{errors.description}</div>}
          <span style={{ fontSize:11, color:form.description.length<20?"#A32D2D":"#888780", marginLeft:"auto" }}>{form.description.length} chars</span>
        </div>
      </div>

      {/* Urgency */}
      <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:14, padding:"22px 24px", marginBottom:16 }}>
        <label style={{ ...lbl, marginBottom:12 }}>How urgent is this?</label>
        <div style={{ display:"flex", gap:8 }}>
          {[["normal","","Not urgent","I can wait a few days"],["high","","Fairly urgent","Work is stalled or disputed"],["critical","","Critical","Safety risk or active fraud"]].map(([val,dot,label,sub])=>(
            <button key={val} type="button" onClick={()=>set("urgency")(val)}
              style={{ flex:1, padding:"10px 12px", borderRadius:9, border:`${form.urgency===val?"2px solid #0C447C":"1.5px solid #D3D1C7"}`, background:form.urgency===val?"#E6F1FB":"#fff", cursor:"pointer", textAlign:"center", fontFamily:font }}>
              <div style={{ fontSize:16, marginBottom:3 }}>{dot}</div>
              <div style={{ fontSize:12, fontWeight:700, color:form.urgency===val?"#0C447C":"#2C2C2A" }}>{label}</div>
              <div style={{ fontSize:10, color:"#888780", lineHeight:1.4 }}>{sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Contact info */}
      <div style={{ background:"#fff", border:`1.5px solid ${errors.name||errors.email?"#A32D2D":"#D3D1C7"}`, borderRadius:14, padding:"22px 24px", marginBottom:24 }}>
        <label style={{ ...lbl, marginBottom:14 }}>Your contact information <span style={{ color:"#A32D2D" }}>★</span></label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div>
            <label style={lbl}>Full Name</label>
            <input value={form.name} onChange={e=>set("name")(e.target.value)} placeholder="Jane Smith" style={inpStyle(errors.name)} />
            {errors.name && <div style={err_}>{errors.name}</div>}
          </div>
          <div>
            <label style={lbl}>Email Address</label>
            <input type="email" value={form.email} onChange={e=>set("email")(e.target.value)} placeholder="jane@email.com" style={inpStyle(errors.email)} />
            {errors.email && <div style={err_}>{errors.email}</div>}
          </div>
        </div>
        <div style={{ fontSize:12, color:"#888780", marginTop:10, lineHeight:1.5 }}>
           Your contact details are only used to follow up on this report. They are never shared with the contractor being reported.
        </div>
      </div>

      {/* Submit */}
      <button type="button" onClick={submit}
        style={{ display:"block", width:"100%", padding:"14px", borderRadius:10, border:"none", background:"#A32D2D", color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:font, marginBottom:12 }}
        onMouseEnter={e=>e.currentTarget.style.background="#8B1F1F"}
        onMouseLeave={e=>e.currentTarget.style.background="#A32D2D"}>
        Submit Report
      </button>
      <div style={{ textAlign:"center", fontSize:12, color:"#888780", lineHeight:1.6 }}>
        For immediate safety emergencies call <strong>911</strong>. For urgent fraud, also contact the California Contractors State License Board at <strong>1-800-321-2752</strong>.
      </div>
    </div>
  );
}

