import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";

// — Client Submit Form --------------------------------------------------------
export function ClientForm({ onSubmit, prefill }) {
  const [form, setForm] = useState({
    propertyType:"", trade: prefill?.trade||"", projectTitle:"", description:"",
    urgency:"", budget:"", sqft:"", address:"", city:"",
    state: prefill?.state || "CA", zip: prefill?.zip||"", name: prefill?.name||"",
    email:"", phone: prefill?.phone||"", company:""
  });
  const [step, setStep] = useState(prefill?.trade ? 2 : 1);
  const [submitted, setSubmitted] = useState(null);
  const [accountCreated, setAccountCreated] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const set = k => v => { setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:false})); };

  const validateStep = (s) => {
    const e = {};
    if (s===1) {
      if (!form.propertyType) e.propertyType = "Please select a property type.";
      if (!form.trade) e.trade = "Please select a trade category.";
    }
    if (s===2) {
      if (!form.projectTitle) e.projectTitle = "Project title is required.";
      if (!form.description) e.description = "Please describe your project.";
      if (!form.urgency) e.urgency = "Please select a timeline.";
      if (!form.budget) e.budget = "Please select a budget range.";
    }
    if (s===3) {
      if (!form.address) e.address = "Street address is required.";
      if (!form.city) e.city = "City is required.";
      if (!form.state) e.state = "State is required.";
    }
    if (s===4) {
      if (!form.name) e.name = "Your name is required.";
      if (!form.email) e.email = "Email address is required.";
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Please enter a valid email.";
      if (!form.phone) e.phone = "Phone number is required.";
    }
    return e;
  };

  const handleContinue = () => {
    const e = validateStep(step);
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setStep(s=>s+1);
  };

  const handleSubmit = async () => {
    const e = validateStep(4);
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await onSubmit(form);
      if (!result) {
        setSubmitError("Something went wrong submitting your project. Please try again, or refresh the page if the problem continues.");
        setSubmitting(false);
        return;
      }
      setSubmitted(result);
      setSubmitting(false);
    } catch (err) {
      console.error("Failed to submit project:", err);
      setSubmitError("Something went wrong submitting your project. Please try again, or refresh the page if the problem continues.");
      setSubmitting(false);
    }
  };

  const TITLE_PLACEHOLDERS = {
    "HVAC": "e.g. Full HVAC system replacement",
    "Electrical": "e.g. Panel upgrade and whole-home rewiring",
    "Flooring": "e.g. Hardwood flooring installation — 1,200 sq ft",
    "Roofing": "e.g. Full roof replacement — asphalt shingle",
    "Plumbing": "e.g. Kitchen and bathroom plumbing remodel",
    "Framing": "e.g. Room addition framing — 400 sq ft",
    "Painting": "e.g. Exterior house painting — 2,500 sq ft",
    "Concrete": "e.g. Driveway replacement and patio pour",
    "Landscaping": "e.g. Backyard landscaping and irrigation install",
    "Demolition": "e.g. Interior demo for full kitchen remodel",
    "Insulation": "e.g. Attic insulation upgrade — blown-in",
    "Windows": "e.g. Replace 12 windows — double pane",
    "Asphalt": "e.g. Driveway resurfacing — 800 sq ft",
    "Trucking": "e.g. Debris hauling and site cleanup",
    "Remodel": "e.g. Full kitchen remodel with new layout",
    "Solar": "e.g. Solar panel system install — 8kW",
    "Pool": "e.g. In-ground pool installation with decking",
    "Locksmith": "e.g. Full home rekeying and smart lock install",
  };
  const inp = (err) => ({ width:"100%", boxSizing:"border-box", padding:"11px 14px", fontSize:14, border: err?"2px solid #A32D2D":"1.5px solid #D3D1C7", borderRadius:8, fontFamily:"inherit", outline:"none", background: err?"#FFF8F8":"#fff", color:"#2C2C2A" });
  const lbl = { display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:6, letterSpacing:"0.04em", textTransform:"uppercase" };
  const err_ = { marginTop:5, fontSize:12, color:"#A32D2D", fontWeight:600 };
  const fw = { marginBottom:18 };
  const STEPS = ["Property Type","Project Details","Location","Your Info"];

  if (submitted) return (
    <div style={{ maxWidth:580, margin:"0 auto" }}>
      <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:16, padding:"40px 36px", textAlign:"center", marginBottom:20 }}>
        <div style={{ width:56, height:56, borderRadius:"50%", background:"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px", fontSize:22, fontWeight:800, color:"#0F6E56" }}>✓</div>
        <h2 style={{ fontSize:24, fontWeight:800, color:"#0F6E56", marginBottom:8, letterSpacing:"-0.02em" }}>Project Submitted</h2>
        <p style={{ fontSize:14, color:"#2C2C2A", marginBottom:4 }}>Reference ID: <strong style={{ color:"#185FA5" }}>#{submitted.id.slice(-6).toUpperCase()}</strong></p>
        <p style={{ fontSize:13, color:"#2C2C2A", lineHeight:1.7, marginBottom:24 }}>Licensed contractors in your area will review your project and submit bids within 24-48 hours. You will be contacted at the email and phone number you provided.</p>
        <button onClick={()=>{ setSubmitted(null); setForm({ propertyType:"",trade:"",projectTitle:"",description:"",urgency:"",budget:"",sqft:"",address:"",city:"",state:"CA",zip:"",name:"",email:"",phone:"",company:"" }); setStep(1); setSubmitting(false); setSubmitError(""); setErrors({}); }}
          style={{ padding:"10px 28px", borderRadius:8, border:"1.5px solid #D3D1C7", background:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", color:"#2C2C2A" }}>
          Submit Another Project
        </button>
      </div>
      <div style={{ background:"#0C447C", borderRadius:16, padding:"28px 32px" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#B5D4F4", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Next step</div>
        <h3 style={{ fontSize:18, fontWeight:800, color:"#fff", marginBottom:8, letterSpacing:"-0.02em" }}>Create a free account to track your bids</h3>
        <p style={{ fontSize:13, color:"#B5D4F4", lineHeight:1.7, marginBottom:20 }}>With a BuildConnect Pro account you can track incoming bids, message contractors directly, accept quotes, and manage all your projects in one place.</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
          {[["Bid notifications","Get alerted the moment a contractor bids"],["Direct messaging","Chat with contractors before committing"],["Project dashboard","Track all your active and past projects"],["Leave reviews","Help your community find great contractors"]].map(([title, desc])=>(
            <div key={title} style={{ background:"rgba(255,255,255,0.1)", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#fff", marginBottom:3 }}>{title}</div>
              <div style={{ fontSize:11, color:"#B5D4F4", lineHeight:1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
          {[["Your name", submitted.name||"", "text"], ["Email address", submitted.email||"", "email"], ["Create a password", "", "password"], ["Confirm password", "", "password"]].map(([ph, val, type])=>(
            <input key={ph} placeholder={ph} defaultValue={val} type={type}
              style={{ padding:"10px 14px", fontSize:14, border:"none", borderRadius:8, fontFamily:"inherit", outline:"none", color:"#2C2C2A" }} />
          ))}
        </div>
        {accountCreated ? (
          <div style={{ background:"#E1F5EE", border:"1.5px solid #0F6E56", borderRadius:10, padding:"14px 18px", textAlign:"center" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#0F6E56", marginBottom:4 }}>Account created successfully!</div>
            <div style={{ fontSize:13, color:"#2C2C2A" }}>You can now track your bids and manage your project from the My Projects tab.</div>
          </div>
        ) : (
          <button onClick={()=>setAccountCreated(true)}
            style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background:"#FAEEDA", color:"#0C447C", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>
            Create My Free Account
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:580, margin:"0 auto" }}>
      <div style={{ marginBottom:28 }}>
        <h2 style={{ fontSize:22, fontWeight:800, color:"#0C447C", marginBottom:4, letterSpacing:"-0.02em" }}>Submit Your Project</h2>
        <p style={{ fontSize:14, color:"#2C2C2A" }}>Get free bids from licensed local contractors within 24-48 hours.</p>
      </div>

      <div style={{ marginBottom:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
          {STEPS.map((s,i) => (
            <span key={i} style={{ fontSize:11, fontWeight: step===i+1?700:400, color: step>i+1?"#0F6E56":step===i+1?"#185FA5":"#2C2C2A" }}>
              {step>i+1 ? "✓ " : ""}{s}
            </span>
          ))}
        </div>
        <div style={{ height:4, background:"#F1EFE8", borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${(step/4)*100}%`, background:"#185FA5", borderRadius:4, transition:"width 0.3s ease" }} />
        </div>
      </div>

      <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:14, padding:"28px 32px" }}>

        {step===1 && (
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:"#2C2C2A", marginBottom:20 }}>What type of property and work do you need?</div>
            <div style={fw}>
              <label style={lbl}>Property Type <span style={{ color:"#A32D2D" }}>★</span></label>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[["Residential","Homes, condos, townhouses"],["Commercial","Offices, retail, industrial"]].map(([pt, desc])=>(
                  <button key={pt} type="button" onClick={()=>{ set("propertyType")(pt); set("budget")(""); }}
                    style={{ padding:"18px 16px", borderRadius:10, border: form.propertyType===pt?"2px solid #185FA5":errors.propertyType?"2px solid #A32D2D":"1.5px solid #D3D1C7", background: form.propertyType===pt?"#E6F1FB":"#fff", cursor:"pointer", textAlign:"left" }}>
                    <div style={{ fontSize:15, fontWeight:700, color: form.propertyType===pt?"#185FA5":"#2C2C2A", marginBottom:4 }}>{pt}</div>
                    <div style={{ fontSize:12, color:"#2C2C2A" }}>{desc}</div>
                  </button>
                ))}
              </div>
              {errors.propertyType && <div style={err_}>{errors.propertyType}</div>}
            </div>
            <div style={fw}>
              <label style={lbl}>Trade Category <span style={{ color:"#A32D2D" }}>★</span></label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:8 }}>
                {Object.entries(TRADES).map(([k,t])=>(
                  <button key={k} type="button" onClick={()=>{ set("trade")(k); set("budget")(""); }}
                    style={{ padding:"10px 12px", borderRadius:8, border: form.trade===k?`2px solid ${t.color}`:"1.5px solid #D3D1C7", background: form.trade===k?t.bg:"#fff", cursor:"pointer", textAlign:"left", fontSize:13, fontWeight: form.trade===k?700:400, color: form.trade===k?t.color:"#2C2C2A" }}>
                    {k}
                  </button>
                ))}
              </div>
              {errors.trade && <div style={err_}>{errors.trade}</div>}
            </div>
          </div>
        )}

        {step===2 && (
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:"#2C2C2A", marginBottom:20 }}>Tell us about your project</div>
            <div style={fw}>
              <label style={lbl}>Project Title <span style={{ color:"#A32D2D" }}>★</span></label>
              <input value={form.projectTitle} onChange={e=>set("projectTitle")(e.target.value)} placeholder={TITLE_PLACEHOLDERS[form.trade] || "e.g. Describe your project in one line"} style={inp(errors.projectTitle)} />
              {errors.projectTitle && <div style={err_}>{errors.projectTitle}</div>}
            </div>
            <div style={fw}>
              <label style={lbl}>Project Description <span style={{ color:"#A32D2D" }}>★</span></label>
              <textarea value={form.description} onChange={e=>set("description")(e.target.value)} rows={5}
                placeholder="Describe the scope of work, existing conditions, any preferences or special requirements..."
                style={{ ...inp(errors.description), resize:"vertical", lineHeight:1.6 }} />
              {errors.description && <div style={err_}>{errors.description}</div>}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={fw}>
                <label style={lbl}>Timeline <span style={{ color:"#A32D2D" }}>★</span></label>
                <select value={form.urgency} onChange={e=>set("urgency")(e.target.value)} style={inp(errors.urgency)}>
                  <option value="">Select...</option>{URGENCY.map(o=><option key={o}>{o}</option>)}
                </select>
                {errors.urgency && <div style={err_}>{errors.urgency}</div>}
              </div>
              <div style={fw}>
                <label style={lbl}>Budget Range <span style={{ color:"#A32D2D" }}>★</span></label>
                <select value={form.budget} onChange={e=>set("budget")(e.target.value)} style={inp(errors.budget)}>
                  <option value="">Select...</option>
                  {(TRADE_BUDGET_RANGES[form.trade]?.[form.propertyType] || BUDGET_RANGES).map(o=><option key={o}>{o}</option>)}
                </select>
                {errors.budget && <div style={err_}>{errors.budget}</div>}
              </div>
            </div>
            <div style={fw}>
              <label style={lbl}>Property Size (sq ft) <span style={{ fontSize:10, fontWeight:400, textTransform:"none", letterSpacing:0 }}>-- optional</span></label>
              <input type="number" value={form.sqft} onChange={e=>set("sqft")(e.target.value)} placeholder="Approximate square footage" style={inp(false)} />
            </div>
          </div>
        )}

        {step===3 && (
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:"#2C2C2A", marginBottom:6 }}>Where is the property located?</div>

            {/* Pre-fill notice — only show when zip or other fields carried over */}
            {prefill?.zip && (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"#E1F5EE", border:"1px solid #B5F5D8", borderRadius:8, padding:"9px 14px", marginBottom:18, fontSize:13, color:"#0F6E56", fontWeight:500 }}>
                <span style={{ fontSize:15 }}>✓</span>
                <span>ZIP code <strong>{form.zip}</strong> carried over from your earlier entry — just add your street address and city below.</span>
              </div>
            )}

            <div style={fw}>
              <label style={lbl}>Street Address <span style={{ color:"#A32D2D" }}>★</span></label>
              <input value={form.address} onChange={e=>set("address")(e.target.value)} placeholder="123 Main Street" style={inp(errors.address)} />
              {errors.address && <div style={err_}>{errors.address}</div>}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:12 }}>
              <div style={fw}>
                <label style={lbl}>City <span style={{ color:"#A32D2D" }}>★</span></label>
                <input value={form.city} onChange={e=>set("city")(e.target.value)} placeholder="San Diego" style={inp(errors.city)} />
                {errors.city && <div style={err_}>{errors.city}</div>}
              </div>
              <div style={fw}>
                <label style={lbl}>State <span style={{ color:"#A32D2D" }}>★</span></label>
                <input value={form.state} onChange={e=>set("state")(e.target.value)} placeholder="CA" maxLength={2} style={inp(errors.state)} />
                {errors.state && <div style={err_}>{errors.state}</div>}
              </div>
              <div style={fw}>
                <label style={{ ...lbl, display:"flex", alignItems:"center", gap:6 }}>
                  ZIP
                  {prefill?.zip && <span style={{ fontSize:10, fontWeight:700, color:"#0F6E56", background:"#E1F5EE", borderRadius:10, padding:"1px 7px", textTransform:"uppercase", letterSpacing:"0.04em" }}>Pre-filled</span>}
                </label>
                <input
                  value={form.zip}
                  onChange={e=>set("zip")(e.target.value)}
                  placeholder="92101"
                  style={{ ...inp(false), background: prefill?.zip ? "#F8F7F4" : "#fff", color: prefill?.zip ? "#0F6E56" : "#2C2C2A", fontWeight: prefill?.zip ? 600 : 400 }}
                />
              </div>
            </div>
          </div>
        )}

        {step===4 && (
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:"#2C2C2A", marginBottom:4 }}>How should contractors reach you?</div>
            <p style={{ fontSize:13, color:"#2C2C2A", marginBottom: prefill?.name ? 10 : 20 }}>Your contact information is only shared with a contractor after you accept their bid.</p>

            {/* Pre-fill notice for contact info */}
            {prefill?.name && (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"#E1F5EE", border:"1px solid #B5F5D8", borderRadius:8, padding:"9px 14px", marginBottom:18, fontSize:13, color:"#0F6E56", fontWeight:500 }}>
                <span style={{ fontSize:15 }}>✓</span>
                <span>Name and phone carried over — just add your email address below.</span>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div style={fw}>
                <label style={lbl}>Full Name <span style={{ color:"#A32D2D" }}>★</span></label>
                <input value={form.name} onChange={e=>set("name")(e.target.value)} placeholder="Jane Smith" style={inp(errors.name)} />
                {errors.name && <div style={err_}>{errors.name}</div>}
              </div>
              <div style={fw}>
                <label style={lbl}>Company <span style={{ fontSize:10, fontWeight:400, textTransform:"none", letterSpacing:0 }}>-- optional</span></label>
                <input value={form.company} onChange={e=>set("company")(e.target.value)} placeholder="Company name" style={inp(false)} />
              </div>
              <div style={fw}>
                <label style={lbl}>Email Address <span style={{ color:"#A32D2D" }}>★</span></label>
                <input type="email" value={form.email} onChange={e=>set("email")(e.target.value)} placeholder="jane@example.com" style={inp(errors.email)} />
                {errors.email && <div style={err_}>{errors.email}</div>}
              </div>
              <div style={fw}>
                <label style={lbl}>Phone Number <span style={{ color:"#A32D2D" }}>★</span></label>
                <input type="tel" value={form.phone} onChange={e=>set("phone")(e.target.value)} placeholder="(555) 000-0000" style={inp(errors.phone)} />
                {errors.phone && <div style={err_}>{errors.phone}</div>}
              </div>
            </div>
            <div style={{ background:"#F8F7F4", borderRadius:8, padding:"12px 16px", fontSize:13, color:"#2C2C2A", border:"1.5px solid #D3D1C7" }}>
              Your contact details are kept private and only shared with a contractor after you formally accept their bid.
            </div>
            {submitError && (
              <div style={{ marginTop:16, background:"#FCEBEB", border:"1.5px solid #F3C6C6", borderRadius:8, padding:"12px 16px", fontSize:13, color:"#A32D2D", fontWeight:600 }}>
                {submitError}
              </div>
            )}
          </div>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:24, paddingTop:20, borderTop:"1px solid #F1EFE8" }}>
          <button onClick={()=>{setStep(s=>s-1); setErrors({});}} disabled={step===1}
            style={{ padding:"10px 20px", borderRadius:8, border:"1.5px solid #D3D1C7", background:"#fff", fontSize:14, fontWeight:600, cursor: step===1?"not-allowed":"pointer", fontFamily:"inherit", color:"#2C2C2A", opacity: step===1?0.4:1 }}>
            Back
          </button>
          {step < 4 ? (
            <button onClick={handleContinue}
              style={{ padding:"10px 28px", borderRadius:8, border:"none", background:"#185FA5", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              Continue
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              style={{ padding:"10px 28px", borderRadius:8, border:"none", background: submitting?"#B4B2A9":"#0F6E56", color:"#fff", fontSize:14, fontWeight:700, cursor: submitting?"not-allowed":"pointer", fontFamily:"inherit" }}>
              {submitting ? "Submitting..." : "Submit Project"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


