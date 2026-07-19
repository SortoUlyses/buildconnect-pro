import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";

export function DirectProjectSubmit({ contractors, onSubmit, onBack, backLabel, estimatorPrefill, auth, onNeedAuth }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    propertyType: estimatorPrefill?.propertyType || "",
    description:"", budget: estimatorPrefill?.budget || "", urgency:"",
    projectTitle: estimatorPrefill?.jobType || "",
    city:"", state:"CA", zip:"",
    name:"", email:"", phone:""
  });
  const [submitted, setSubmitted] = useState(false);
  const set = k => v => setForm(f=>({...f,[k]:v}));

  const primary    = contractors[0] || {};
  const trade      = primary.trades?.[0] || estimatorPrefill?.trade || "";
  const isMultiple = contractors.length > 1;
  const jobType    = estimatorPrefill?.jobType || "";
  const budgetFromEstimator = estimatorPrefill?.budget || "";

  // Build display names
  const nameList = contractors.length === 1
    ? contractors[0].name
    : contractors.slice(0,-1).map(c=>c.name).join(", ") + " & " + contractors[contractors.length-1].name;

  const firstName = isMultiple ? "them" : primary.name?.split(" ")[0] || "the contractor";

  // Specific description placeholders based on exact job type from estimator
  const descPlaceholder = (() => {
    const jt = jobType.toLowerCase();
    if (jt.includes("tile roof"))     return `e.g. "I have a 2,200 sq ft home with an aging clay tile roof. Several tiles are cracked and I'm noticing staining on the ceiling in two rooms. Looking for a full tile roof replacement with new underlayment. The house was built in 1994 and the current roof has never been replaced."`;
    if (jt.includes("shingle"))       return `e.g. "My 1,800 sq ft home has a 20-year-old asphalt shingle roof. After the last storm I found several curling shingles and granules in the gutters. I'd like a full shingle replacement with 30-year architectural shingles. No known decking damage but I'd appreciate an inspection."`;
    if (jt.includes("flat roof"))     return `e.g. "I have a commercial flat roof (approx 3,000 sq ft) that has developed two leak points near the drains. Looking for a full TPO or modified bitumen replacement. The current roof is about 15 years old and has been patched twice."`;
    if (jt.includes("panel upgrade")) return `e.g. "My home currently has a 100A panel from the 1970s. I'm adding an EV charger and a hot tub and the electrician said I need to upgrade to 200A. Looking for a licensed C-10 electrician to pull permits and complete a full panel upgrade."`;
    if (jt.includes("ev charger"))    return `e.g. "I just bought a Tesla Model Y and need a Level 2 (240V) EV charger installed in my garage. The panel is about 30 feet from the garage. I'd like a NEMA 14-50 outlet or a hardwired charger — open to recommendations. Looking for a licensed electrician who pulls permits."`;
    if (jt.includes("rewir"))         return `e.g. "I'm renovating a 1955 home and the inspector flagged knob-and-tube wiring throughout. I need a full rewire of the home (approx 1,600 sq ft, 3 bed/2 bath) to bring everything up to current code. Panel upgrade may also be needed."`;
    if (jt.includes("hvac") || jt.includes("central air")) return `e.g. "My central HVAC system is 18 years old and stopped cooling effectively. The upstairs rooms won't get below 80 degF. I have a 2,400 sq ft two-story home and I'm looking for a full system replacement — both furnace and AC. I have existing ductwork that was inspected two years ago."`;
    if (jt.includes("mini") || jt.includes("split"))       return `e.g. "I'm adding a home office addition (approx 350 sq ft) that isn't connected to the central HVAC system. Looking for a single-zone mini-split installation — I'd like something quiet and energy efficient. The space has standard 8-foot ceilings and one exterior wall."`;
    if (jt.includes("kitchen remodel")) return `e.g. "I want to gut and remodel my 1990s kitchen (approx 180 sq ft). Plans include new cabinets, quartz countertops, tile backsplash, new appliances (I'll supply them), and updated plumbing/electrical. I'd like to remove the peninsula wall to open the space to the living room."`;
    if (jt.includes("bathroom"))      return `e.g. "I have a dated master bathroom (approx 80 sq ft) that needs a full remodel. I'd like to convert the old tub to a walk-in shower, add double vanity sinks, update the lighting, and retile the floor and shower walls. Keeping the toilet in its current location."`;
    if (jt.includes("plumb"))         return `e.g. "I have a whole-home repiping project — my house was built in 1968 and still has the original galvanized steel pipes. I've had two pinhole leaks in the last year. The house is approximately 1,800 sq ft with 3 bathrooms. I'd like to repipe with copper or PEX."`;
    if (jt.includes("hardwood") || jt.includes("floor")) return `e.g. "I want to install new hardwood flooring in my living room, dining room, and hallway — approximately 650 sq ft total. I'm currently on carpet that needs to be removed. Interested in 3/4 inch solid oak in a natural finish. Open to engineered hardwood as well."`;
    if (jt.includes("concrete") || jt.includes("driveway")) return `e.g. "My existing driveway is approximately 600 sq ft and has multiple large cracks that have worsened over the last two winters. I'd like a full concrete replacement with expansion joints. I'm also interested in a small decorative apron near the garage. The current driveway is about 4 inches thick."`;
    if (jt.includes("window"))        return `e.g. "I have 12 single-pane windows throughout my home that I'd like to replace with energy-efficient dual-pane vinyl windows. Most are standard double-hung sizes but two in the kitchen are larger. I'm located in a coastal area so I need windows rated for salt air exposure."`;
    if (jt.includes("door"))          return `e.g. "I need my front entry door replaced. Currently have a hollow-core door with a broken frame. Looking for a solid wood or fiberglass entry door, approximately 36x80 inches, with new hardware and weatherstripping. The home is Spanish-style so a wood look is preferred."`;
    if (jt.includes("paint") || jt.includes("exterior")) return `e.g. "I need the exterior of my 2,200 sq ft two-story stucco home repainted. The current paint is approximately 10 years old and showing significant chalking and peeling in areas. I'd like a full wash, prime, and two-coat paint job. I'll choose colors — looking for input on best stucco-compatible products."`;
    if (trade)  return `e.g. "Describe your ${trade.toLowerCase()} project in as much detail as possible — current condition, what you want done, approximate size or scope, and any special requirements. The more detail you provide, the more accurate the bids you'll receive."`;
    return `e.g. "Describe your project in as much detail as possible — current condition, what you want done, size or scope, and any special requirements. The more detail you provide, the more accurate the bids you'll receive."`;
  })();

  const canProceed = form.propertyType && form.description.trim().length > 10 && form.budget;
  const canSubmit  = form.name.trim() && form.phone.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    const lead = {
      id: uid(),
      createdAt: new Date().toISOString(),
      projectTitle: form.projectTitle.trim() || `${trade} project`,
      trade,
      propertyType: form.propertyType,
      description: form.description,
      urgency: form.urgency || "Flexible",
      budget: form.budget,
      sqft: "",
      city: form.city || primary.city || "San Diego",
      state: form.state || "CA",
      zip: form.zip,
      name: form.name,
      email: form.email,
      phone: form.phone,
      status: "open",
      directContractorIds: contractors.map(c=>c.id),
      directContractorNames: contractors.map(c=>c.name),
    };
    if (!auth) { onNeedAuth?.(lead); return; }
    onSubmit(lead);
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{ textAlign:"center", padding:"60px 20px" }}>
      <div style={{ fontSize:56, marginBottom:16 }}></div>
      <h2 style={{ fontSize:24, fontWeight:800, color:"#0C447C", marginBottom:10, letterSpacing:"-0.02em" }}>
        {isMultiple ? `Project sent to ${contractors.length} contractors!` : `Project sent to ${primary.name?.split(" ")[0]}!`}
      </h2>
      <p style={{ fontSize:15, color:"#5F5E5A", lineHeight:1.7, maxWidth:460, margin:"0 auto 20px" }}>
        {isMultiple
          ? `${nameList} will each review your project details and respond with their own bid. You can compare them side by side in My Projects.`
          : `${primary.name?.split(" ")[0]} will review your project and respond with a formal bid. You'll be notified the moment it arrives.`}
      </p>
      <div style={{ background:"#E1F5EE", borderRadius:12, padding:"16px 20px", maxWidth:420, margin:"0 auto 28px", border:"1.5px solid #B5F5D8" }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#0F6E56", marginBottom:4 }}>What happens next</div>
        <p style={{ fontSize:13, color:"#2C2C2A", lineHeight:1.65, margin:0 }}>
          {isMultiple ? "Each contractor" : primary.name?.split(" ")[0]} will typically respond within 24-48 hours.
          {isMultiple ? " You'll be able to compare all their bids side by side." : " You'll get a notification the moment they submit their bid."}
        </p>
      </div>
      <button type="button" onClick={onBack}
        style={{ padding:"12px 28px", borderRadius:10, border:"none", background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font }}>
        ← Back to Find Contractors
      </button>
    </div>
  );

  const renderPropBtn = (value, label) => (
    <button type="button" onClick={() => set("propertyType")(value)}
      style={{ flex:1, padding:"18px 12px", borderRadius:12, border: form.propertyType===value?"2px solid #0C447C":"1.5px solid #D3D1C7", background: form.propertyType===value?"#E6F1FB":"#fff", cursor:"pointer", fontFamily:font, textAlign:"center", transition:"all 0.15s" }}>
      <div style={{ fontSize:14, fontWeight:700, color: form.propertyType===value?"#0C447C":"#2C2C2A" }}>{label}</div>
    </button>
  );

  const renderUrgencyBtn = (value, label, sub) => (
    <button type="button" onClick={() => set("urgency")(value)}
      style={{ flex:1, padding:"13px 8px", borderRadius:10, border: form.urgency===value?"2px solid #0C447C":"1.5px solid #D3D1C7", background: form.urgency===value?"#E6F1FB":"#fff", cursor:"pointer", fontFamily:font, textAlign:"center", transition:"all 0.15s" }}>
      <div style={{ fontSize:13, fontWeight:700, color: form.urgency===value?"#0C447C":"#2C2C2A", marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:11, color:"#888780" }}>{sub}</div>
    </button>
  );

  return (
    <div style={{ fontFamily:font, maxWidth:600, margin:"0 auto" }}>

      {/* Back link */}
      <button type="button" onClick={onBack}
        style={{ background:"none", border:"none", color:"#185FA5", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font, padding:0, marginBottom:24, display:"flex", alignItems:"center", gap:6 }}>
        {backLabel || "Back"}
      </button>

      {/* — Contractor identity card — */}
      <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", borderRadius:14, padding:"20px 24px", marginBottom:28 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.55)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>
          {isMultiple ? `Sending bids to ${contractors.length} contractors` : "Submitting directly to"}
        </div>

        {isMultiple ? (
          /* Multiple — avatars + comma list */
          <div>
            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
              {contractors.map(c => (
                <div key={c.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:c.avatarBg||"#E6F1FB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:c.avatarColor||"#0C447C", flexShrink:0 }}>
                    {c.initials||c.name?.slice(0,2).toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:15, fontWeight:700, color:"#fff", lineHeight:1.5 }}>
              {contractors.map((c, i) => (
                <span key={c.id}>
                  <span style={{ color:"#EF9F27" }}>{c.name}</span>
                  {i < contractors.length - 2 && <span style={{ color:"rgba(255,255,255,0.5)" }}>,  </span>}
                  {i === contractors.length - 2 && <span style={{ color:"rgba(255,255,255,0.5)" }}>  &  </span>}
                </span>
              ))}
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:6 }}>
              {contractors.map(c=>c.company).join(" · ")}
            </div>
          </div>
        ) : (
          /* Single — full row */
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:52, height:52, borderRadius:10, background:primary.avatarBg||"#E6F1FB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:primary.avatarColor||"#0C447C", flexShrink:0 }}>
              {primary.initials||primary.name?.slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:17, fontWeight:800, color:"#fff", letterSpacing:"-0.01em" }}>{primary.name}</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)" }}>{primary.company} · {primary.city}, CA</div>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              <div style={{ fontSize:14, color:"#EF9F27", letterSpacing:1 }}>{"*".repeat(Math.floor(primary.rating||5))}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:2 }}>{primary.reviewCount||0} reviews</div>
            </div>
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:28 }}>
        {["Project Details","Your Info"].map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <div key={n} style={{ display:"flex", alignItems:"center", gap:8, flex: i<1?1:"auto" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background: done?"#0F6E56":active?"#0C447C":"#D3D1C7", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff", flexShrink:0 }}>
                  {done ? "v" : n}
                </div>
                <span style={{ fontSize:13, fontWeight: active?700:500, color: active?"#0C447C":done?"#0F6E56":"#888780" }}>{label}</span>
              </div>
              {i < 1 && <div style={{ flex:1, height:2, background: step>1?"#0F6E56":"#E8E6DF", borderRadius:2, marginLeft:8 }} />}
            </div>
          );
        })}
      </div>

      {/* — STEP 1 — */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:"#0C447C", marginBottom:6, letterSpacing:"-0.02em" }}>
            {isMultiple ? "Tell them about your project" : `Tell ${firstName} about your project`}
          </h2>
          <p style={{ fontSize:14, color:"#5F5E5A", marginBottom:28, lineHeight:1.65 }}>
            {isMultiple
              ? `Each contractor will receive the same project details and submit their own independent bid. Give them enough to work with.`
              : `Give ${firstName} the details they need to put together an accurate bid. The more specific you are, the better.`}
          </p>

          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:10, letterSpacing:"0.06em", textTransform:"uppercase" }}>Property Type</label>
            {estimatorPrefill?.propertyType && form.propertyType === estimatorPrefill.propertyType ? (
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"#E1F5EE", border:"1.5px solid #B5F5D8", borderRadius:9 }}>
                <span style={{ fontSize:20 }}>{form.propertyType === "Residential" ? "home" : "office"}</span>
                <span style={{ fontSize:15, fontWeight:800, color:"#0F6E56" }}>{form.propertyType}</span>
                <span style={{ fontSize:12, color:"#0F6E56", fontWeight:600 }}>-- carried over from your cost estimate</span>
                <button type="button" onClick={()=>set("propertyType")("")}
                  style={{ marginLeft:"auto", fontSize:11, color:"#888780", background:"none", border:"none", cursor:"pointer", fontFamily:font, textDecoration:"underline" }}>
                  Change
                </button>
              </div>
            ) : (
              <div style={{ display:"flex", gap:12 }}>
                {renderPropBtn("Residential", "Residential")}
                {renderPropBtn("Commercial", "Commercial")}
              </div>
            )}
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:8, letterSpacing:"0.06em", textTransform:"uppercase" }}>What do you need done?</label>
            <input type="text" value={form.projectTitle} onChange={e=>set("projectTitle")(e.target.value)}
              placeholder={jobType ? `e.g. "${jobType} — ${primary.city||"San Diego"} home"` : `e.g. "Replace HVAC system in 2,400 sq ft home"`}
              style={{ width:"100%", padding:"12px 14px", borderRadius:9, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", marginBottom:10, boxSizing:"border-box" }} />
            <textarea value={form.description} onChange={e=>set("description")(e.target.value)}
              placeholder={descPlaceholder}
              rows={6}
              style={{ width:"100%", padding:"12px 14px", borderRadius:9, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", resize:"vertical", lineHeight:1.7, boxSizing:"border-box" }} />
            <div style={{ fontSize:11, color: form.description.length < 10 ? "#A32D2D" : "#888780", marginTop:5 }}>
              {form.description.length < 10 ? `${10 - form.description.length} more characters needed` : `${form.description.length} characters — good detail`}
            </div>
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:8, letterSpacing:"0.06em", textTransform:"uppercase" }}>Budget Range</label>
            {budgetFromEstimator ? (
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"#E1F5EE", border:"1.5px solid #B5F5D8", borderRadius:9 }}>
                <span style={{ fontSize:18, fontWeight:900, color:"#0F6E56" }}>{budgetFromEstimator}</span>
                <span style={{ fontSize:12, color:"#0F6E56", fontWeight:600 }}>-- carried over from your cost estimate</span>
                <button type="button" onClick={()=>set("budget")("")}
                  style={{ marginLeft:"auto", fontSize:11, color:"#888780", background:"none", border:"none", cursor:"pointer", fontFamily:font, textDecoration:"underline" }}>
                  Change
                </button>
              </div>
            ) : (
              <select value={form.budget} onChange={e=>set("budget")(e.target.value)}
                style={{ width:"100%", padding:"12px 14px", borderRadius:9, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, background:"#fff", color:form.budget?"#2C2C2A":"#9CA3AF", outline:"none", boxSizing:"border-box" }}>
                <option value="">Select your budget range...</option>
                {BUDGET_RANGES.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            )}
          </div>

          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:10, letterSpacing:"0.06em", textTransform:"uppercase" }}>How soon do you need this done?</label>
            <div style={{ display:"flex", gap:8 }}>
              {renderUrgencyBtn("Emergency", "ASAP", "Within days")}
              {renderUrgencyBtn("Urgent", "Urgent", "1-2 weeks")}
              {renderUrgencyBtn("Soon", "Soon", "1-2 months")}
              {renderUrgencyBtn("Flexible", "Flexible", "No rush")}
            </div>
          </div>

          <div style={{ marginBottom:32 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:8, letterSpacing:"0.06em", textTransform:"uppercase" }}>Project Location</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <input type="text" placeholder="City" value={form.city} onChange={e=>set("city")(e.target.value)}
                style={{ padding:"12px 14px", borderRadius:9, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box" }} />
              <input type="text" placeholder="ZIP code" value={form.zip} onChange={e=>set("zip")(e.target.value)} maxLength={5}
                style={{ padding:"12px 14px", borderRadius:9, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>

          <button type="button" onClick={()=>setStep(2)} disabled={!canProceed}
            style={{ display:"block", width:"100%", padding:"15px", borderRadius:10, border:"none", background: canProceed?"#0C447C":"#D3D1C7", color:"#fff", fontSize:15, fontWeight:800, cursor: canProceed?"pointer":"not-allowed", fontFamily:font, transition:"background 0.15s" }}
            onMouseEnter={e=>{ if(canProceed) e.currentTarget.style.background="#185FA5"; }}
            onMouseLeave={e=>{ if(canProceed) e.currentTarget.style.background="#0C447C"; }}>
            Continue &gt;
          </button>
          {!canProceed && (
            <p style={{ fontSize:12, color:"#A32D2D", textAlign:"center", marginTop:10 }}>Please fill in property type, description (10+ characters), and budget to continue.</p>
          )}
        </div>
      )}

      {/* — STEP 2 — */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:"#0C447C", marginBottom:6, letterSpacing:"-0.02em" }}>
            Last step — how can {isMultiple ? "they" : firstName} reach you?
          </h2>
          <p style={{ fontSize:14, color:"#5F5E5A", marginBottom:28, lineHeight:1.65 }}>
            {isMultiple
              ? `Each contractor will receive your contact info when you submit. They'll use it to ask questions or schedule a site visit.`
              : `Your contact info will be shared with ${firstName} when you submit.`}
          </p>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            <div>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Your Name <span style={{ color:"#A32D2D" }}>★</span></label>
              <input type="text" placeholder="Jane Smith" value={form.name} onChange={e=>set("name")(e.target.value)}
                style={{ width:"100%", padding:"12px 14px", borderRadius:9, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Phone Number <span style={{ color:"#A32D2D" }}>★</span></label>
              <input type="tel" placeholder="(619) 000-0000" value={form.phone} onChange={e=>set("phone")(e.target.value)}
                style={{ width:"100%", padding:"12px 14px", borderRadius:9, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>

          <div style={{ marginBottom:28 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Email Address</label>
            <input type="email" placeholder="jane@email.com" value={form.email} onChange={e=>set("email")(e.target.value)}
              style={{ width:"100%", padding:"12px 14px", borderRadius:9, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box" }} />
          </div>

          {/* Summary */}
          <div style={{ background:"#F8F7F4", borderRadius:12, border:"1.5px solid #E8E6DF", padding:"18px 20px", marginBottom:24 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Your Project Summary</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom: form.description?12:0 }}>
              {[
                [isMultiple ? "Sending to" : "Contractor", isMultiple ? contractors.map(c=>c.name.split(" ")[0]).join(", ") : primary.name],
                ["Trade", trade],
                ["Property", form.propertyType],
                ["Budget", form.budget],
                ["Timeline", form.urgency || "Flexible"],
                ["Location", form.city ? `${form.city}${form.zip?", "+form.zip:""}` : "Not specified"],
              ].map(([k,v]) => (
                <div key={k}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:2 }}>{k}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#2C2C2A" }}>{v||"—"}</div>
                </div>
              ))}
            </div>
            {form.description && (
              <div style={{ paddingTop:12, borderTop:"1px solid #E8E6DF" }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Description</div>
                <p style={{ fontSize:13, color:"#2C2C2A", lineHeight:1.6, margin:0 }}>{form.description.length > 150 ? form.description.slice(0,150)+"..." : form.description}</p>
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:12 }}>
            <button type="button" onClick={()=>setStep(1)}
              style={{ padding:"14px 24px", borderRadius:10, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:font }}>
              Back
            </button>
            <button type="button" onClick={handleSubmit} disabled={!canSubmit}
              style={{ flex:1, padding:"14px", borderRadius:10, border:"none", background: canSubmit?"#0F6E56":"#D3D1C7", color:"#fff", fontSize:15, fontWeight:800, cursor: canSubmit?"pointer":"not-allowed", fontFamily:font, transition:"background 0.15s" }}
              onMouseEnter={e=>{ if(canSubmit) e.currentTarget.style.background="#0D5E49"; }}
              onMouseLeave={e=>{ if(canSubmit) e.currentTarget.style.background="#0F6E56"; }}>
              {isMultiple ? `Send to ${contractors.length} Contractors ->` : `Send Project to ${firstName} ->`}
            </button>
          </div>
          {!canSubmit && (
            <p style={{ fontSize:12, color:"#A32D2D", textAlign:"center", marginTop:10 }}>Name and phone number are required.</p>
          )}
        </div>
      )}
    </div>
  );
}

// — Consumer Message Modal ----------------------------------------------------
