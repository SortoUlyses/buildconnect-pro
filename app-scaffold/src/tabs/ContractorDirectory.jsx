import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject, todayLocal } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { DEMO_CONTRACTORS } from "../demoData.js";

// — Star Rating display -------------------------------------------------------
export function Stars({ rating }) {
  return (
    <span style={{ color:"#EF9F27", fontSize:14, letterSpacing:1 }}>
      {"*".repeat(Math.floor(rating))}{"*".repeat(5-Math.floor(rating))}
      <span style={{ fontSize:12, color:"#2C2C2A", marginLeft:5, letterSpacing:0 }}>{rating.toFixed(1)}</span>
    </span>
  );
}

// — Availability mini-calendar (shows booked days as unavailable) -------------
export const AVAIL_DAYS = ["S","M","T","W","T","F","S"];
export const AVAIL_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function AvailabilityCalendar({ bookedDates = [], selectedDate, onSelectDate }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = todayLocal();

  const prevMonth = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <button onClick={prevMonth} style={{ background:"none", border:"1px solid #D3D1C7", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontSize:14, color:"#2C2C2A" }}>&lt;</button>
        <span style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{AVAIL_MONTHS[month]} {year}</span>
        <button onClick={nextMonth} style={{ background:"none", border:"1px solid #D3D1C7", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontSize:14, color:"#2C2C2A" }}>{">"}</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:2 }}>
        {AVAIL_DAYS.map((d,i) => <div key={i} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:"#2C2C2A", padding:"3px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {Array.from({length:firstDay}).map((_,i) => <div key={`e${i}`} />)}
        {Array.from({length:daysInMonth}).map((_,i) => {
          const d = i + 1;
          const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
          const isPast = ds < todayStr;
          const isBooked = bookedDates.includes(ds);
          const isSelected = selectedDate === ds;
          const isToday = ds === todayStr;
          const unavailable = isPast || isBooked;
          return (
            <button key={d} disabled={unavailable} onClick={() => onSelectDate(ds)}
              title={isBooked ? "Unavailable — contractor has a job scheduled" : isPast ? "Past date" : "Available"}
              style={{
                padding:"6px 2px", borderRadius:6, border: isSelected?"2px solid #0F6E56": isToday?"1.5px solid #185FA5":"1px solid transparent",
                background: isSelected?"#E1F5EE": isBooked?"#FCEBEB": isPast?"#F8F7F4":"#fff",
                color: isSelected?"#0F6E56": isBooked?"#D3D1C7": isPast?"#C4C2B9":"#2C2C2A",
                fontSize:12, fontWeight: isSelected||isToday?700:400,
                cursor: unavailable?"not-allowed":"pointer",
                textDecoration: isBooked?"line-through":"none",
              }}>
              {d}
            </button>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:12, marginTop:10, flexWrap:"wrap" }}>
        {[["#fff","#2C2C2A","Available"],["#E1F5EE","#0F6E56","Selected"],["#FCEBEB","#D3D1C7","Unavailable"]].map(([bg,c,label])=>(
          <div key={label} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:12, height:12, borderRadius:3, background:bg, border:"1px solid #D3D1C7" }} />
            <span style={{ fontSize:11, color:"#2C2C2A" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// — Quote Request Form --------------------------------------------------------
export function QuoteRequestForm({ contractor, onClose }) {
  const [form, setForm] = useState({ name:"", email:"", phone:"", projectType:"", description:"", preferredDate:"", altDate:"", timePreference:"", budget:"" });
  const [submitted, setSubmitted] = useState(false);
  const set = k => v => setForm(f=>({...f,[k]:v}));

  // Derive booked dates from contractor schedule stored in localStorage
  const bookedDates = (() => {
    try {
      const sched = JSON.parse(localStorage.getItem("bcp_schedule_v2") || "[]");
      return sched.map(e => e.date);
    } catch { return []; }
  })();

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.phone || !form.projectType || !form.preferredDate) {
      alert("Please fill in all required fields and select a preferred date."); return;
    }
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{ textAlign:"center", padding:"40px 20px" }}>
      <div style={{ fontSize:56, marginBottom:14 }}></div>
      <h3 style={{ fontSize:20, fontWeight:800, color:"#0F6E56", marginBottom:8 }}>Quote Request Sent!</h3>
      <p style={{ fontSize:14, color:"#2C2C2A", marginBottom:4 }}>Your request has been sent to <strong>{contractor.name}</strong>.</p>
      <p style={{ fontSize:13, color:"#2C2C2A", marginBottom:6 }}>Preferred date: <strong style={{ color:"#0C447C" }}>{form.preferredDate}</strong></p>
      {form.altDate && <p style={{ fontSize:13, color:"#2C2C2A", marginBottom:6 }}>Alternate date: <strong style={{ color:"#0C447C" }}>{form.altDate}</strong></p>}
      <p style={{ fontSize:13, color:"#2C2C2A", marginBottom:28 }}>Expect a response within 24 hours.</p>
      <Btn onClick={onClose} variant="ghost">Close</Btn>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize:16, fontWeight:800, color:"#0C447C", marginBottom:4 }}>Request a Quote</div>
      <p style={{ fontSize:13, color:"#2C2C2A", marginBottom:18 }}>Fill in your details and pick available dates from {contractor.name.split(" ")[0]}'s calendar below.</p>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 14px" }}>
        <Field label="Your Name" value={form.name} onChange={set("name")} placeholder="Jane Smith" required />
        <Field label="Phone Number" type="tel" value={form.phone} onChange={set("phone")} placeholder="(555) 000-0000" required />
        <Field label="Email Address" type="email" value={form.email} onChange={set("email")} placeholder="jane@email.com" required />
        <Field label="Project Type" value={form.projectType} onChange={set("projectType")}>
          <select value={form.projectType} onChange={e=>set("projectType")(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
            <option value="">Select...</option>
            {(contractor.trades||[]).map(t=><option key={t} value={t}>{TRADES[t]?.icon||""} {t}</option>)}
            <option value="Estimate / Inspection"> Estimate / Inspection</option>
            <option value="Other">Other</option>
          </select>
        </Field>
      </div>

      <Field label="Budget Range">
        <select value={form.budget} onChange={e=>set("budget")(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
          <option value="">Select a budget range...</option>
          {BUDGET_RANGES.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      </Field>

      <Field label="Project Description" value={form.description} onChange={set("description")} as="textarea" rows={3} placeholder="Briefly describe what you need done..." />

      {/* Scheduling section */}
      <div style={{ background:"#F8F7F4", borderRadius:12, padding:"16px 18px", marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:800, color:"#0C447C", marginBottom:2 }}> Pick Your Preferred Date</div>
        <p style={{ fontSize:12, color:"#2C2C2A", marginBottom:14 }}>
          Dates marked in red are already booked. Green dates are open — select your first choice below.
        </p>
        <AvailabilityCalendar bookedDates={bookedDates} selectedDate={form.preferredDate} onSelectDate={set("preferredDate")} />
        {form.preferredDate && (
          <div style={{ marginTop:12, padding:"8px 12px", background:"#E1F5EE", borderRadius:8, fontSize:13, color:"#0F6E56", fontWeight:600 }}>
            v Preferred date: {form.preferredDate}
          </div>
        )}
      </div>

      {/* Alternate date */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 14px" }}>
        <Field label="Alternate Date (optional)" type="date" value={form.altDate} onChange={set("altDate")} />
        <Field label="Preferred Time of Day">
          <select value={form.timePreference} onChange={e=>set("timePreference")(e.target.value)} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
            <option value="">No preference</option>
            <option value="Morning (7am-12pm)"> Morning (7am-12pm)</option>
            <option value="Afternoon (12pm-5pm)">sun Afternoon (12pm-5pm)</option>
            <option value="Evening (5pm-8pm)"> Evening (5pm-8pm)</option>
          </select>
        </Field>
      </div>

      <div style={{ display:"flex", gap:10, marginTop:4 }}>
        <Btn onClick={handleSubmit} variant="success" style={{ flex:1 }}>Send Quote Request</Btn>
        <Btn onClick={onClose} variant="ghost">Cancel</Btn>
      </div>
    </div>
  );
}

// — Contractor Profile Detail Modal -------------------------------------------
export function ContractorModal({ contractor, onClose, onSubmitProject }) {
  const [photoIdx, setPhotoIdx] = useState(null);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const initials = contractor.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const photos = contractor.photos || [];

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", display:"flex", alignItems:"flex-start", justifyContent:"center", zIndex:1000, padding:"20px 16px", overflowY:"auto" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:700, marginTop:20, marginBottom:20, overflow:"hidden" }}>

        {/* Hero banner */}
        <div style={{ background:"#0C447C", padding:"28px 28px 0", position:"relative" }}>
          <div style={{ position:"absolute", top:-20, right:-20, width:160, height:160, borderRadius:"50%", background:"rgba(255,255,255,0.05)" }} />
          <button onClick={onClose} style={{ position:"absolute", top:14, right:14, background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"50%", width:32, height:32, cursor:"pointer", color:"#fff", fontSize:18, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
          <div style={{ display:"flex", gap:18, alignItems:"flex-end" }}>
            <div style={{ width:72, height:72, borderRadius:14, background:"#FAEEDA", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:800, color:"#0C447C", border:"3px solid #fff", flexShrink:0, overflow:"hidden" }}>
              {contractor.photo ? <img src={contractor.photo} alt={contractor.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : initials}
            </div>
            <div style={{ flex:1, paddingBottom:20 }}>
              <div style={{ fontSize:20, fontWeight:800, color:"#fff", letterSpacing:"-0.02em" }}>{contractor.name}</div>
              <div style={{ fontSize:13, color:"#B5D4F4", marginBottom:8 }}>{contractor.company} · {contractor.city}, {contractor.state}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {contractor.licensed && <Badge text="✓ Licensed" color="#0F6E56" bg="#E1F5EE" />}
                {contractor.insured && <Badge text="✓ Insured" color="#185FA5" bg="#E6F1FB" />}
                {contractor.backgroundCheck && <Badge text="✓ Background Checked" color="#534AB7" bg="#EEEDFE" />}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding:"24px 28px" }}>

          {showQuoteForm ? (
            <QuoteRequestForm contractor={contractor} onClose={() => { setShowQuoteForm(false); onClose(); }} />
          ) : (
            <>
              {/* Rating + trades */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, flexWrap:"wrap", gap:10 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                  <Stars rating={contractor.rating} />
                  <span style={{ fontSize:13, color:"#2C2C2A" }}>({contractor.reviewCount} reviews)</span>
                  <span style={{ fontSize:13, color:"#2C2C2A" }}>. {contractor.years} yrs in business</span>
                </div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {(contractor.trades||[]).map(t => <Badge key={t} text={t} color={TRADES[t]?.color||"#444"} bg={TRADES[t]?.bg||"#eee"} />)}
                </div>
              </div>

              {/* About */}
              <div style={{ marginBottom:20 }}>
                <SectionTitle>About</SectionTitle>
                <p style={{ fontSize:14, color:"#2C2C2A", lineHeight:1.75, margin:0 }}>{contractor.bio}</p>
              </div>

              {/* Details grid */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
                <div style={{ background:"#F8F7F4", borderRadius:10, padding:"14px 16px" }}>
                  <SectionTitle>Contact</SectionTitle>
                  {contractor.phone && <div style={{ fontSize:13, color:"#2C2C2A", marginBottom:5 }}> {contractor.phone}</div>}
                  {contractor.email && <div style={{ fontSize:13, color:"#185FA5", marginBottom:5, wordBreak:"break-all" }}> {contractor.email}</div>}
                  {contractor.website && <div style={{ fontSize:13, color:"#185FA5" }}> {contractor.website}</div>}
                </div>
                <div style={{ background:"#F8F7F4", borderRadius:10, padding:"14px 16px" }}>
                  <SectionTitle>Credentials</SectionTitle>
                  {contractor.licenseNum && <div style={{ fontSize:13, color:"#2C2C2A", marginBottom:5 }}> License: {contractor.licenseNum}</div>}
                  {contractor.insurance && <div style={{ fontSize:13, color:"#2C2C2A", marginBottom:5 }}> {contractor.insurance}</div>}
                </div>
              </div>

              {/* Service area */}
              {contractor.serviceArea && (
                <div style={{ background:"#E6F1FB", borderRadius:10, padding:"12px 16px", marginBottom:20 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#0C447C", textTransform:"uppercase", letterSpacing:"0.05em" }}> Service Area: </span>
                  <span style={{ fontSize:13, color:"#185FA5" }}>{contractor.serviceArea}</span>
                </div>
              )}

              {/* Photo portfolio */}
              {photos.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <SectionTitle>Portfolio ({photos.length} photos)</SectionTitle>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8 }}>
                    {photos.map((p,i) => (
                      <div key={p.id} onClick={()=>setPhotoIdx(i)} style={{ borderRadius:8, overflow:"hidden", cursor:"pointer", border:"1.5px solid #D3D1C7" }}>
                        <div style={{ paddingBottom:"75%", position:"relative" }}>
                          <img src={p.src} alt={p.caption} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                        </div>
                        {p.caption && <div style={{ padding:"5px 8px", fontSize:11, color:"#2C2C2A" }}>{p.caption}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div style={{ borderTop:"1px solid #F1EFE8", paddingTop:20, display:"flex", flexDirection:"column", gap:10 }}>
                {onSubmitProject && (
                  <button type="button" onClick={() => { onClose(); onSubmitProject(contractor); }}
                    style={{ display:"block", width:"100%", padding:"14px", borderRadius:10, border:"none", background:"#0C447C", color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit", textAlign:"center", letterSpacing:"-0.01em" }}>
                    Submit a Project to {contractor.name.split(" ")[0]} &gt;
                  </button>
                )}
                <div style={{ display:"flex", gap:10 }}>
                  <Btn variant="success" onClick={() => setShowQuoteForm(true)} style={{ flex:1 }}> Request a Quote & Schedule</Btn>
                  <Btn variant="ghost" onClick={onClose}>Close</Btn>
                </div>
                {onSubmitProject && (
                  <p style={{ fontSize:11, color:"#888780", textAlign:"center", lineHeight:1.5 }}>
                    Submitting a project lets {contractor.name.split(" ")[0]} review your details and send you a formal bid — the fastest way to get an accurate quote.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Photo lightbox */}
      {photoIdx !== null && (
        <div onClick={()=>setPhotoIdx(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ maxWidth:700, width:"100%", background:"#fff", borderRadius:12, overflow:"hidden" }}>
            <img src={photos[photoIdx].src} alt={photos[photoIdx].caption} style={{ width:"100%", maxHeight:500, objectFit:"contain", display:"block", background:"#111" }} />
            <div style={{ padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={()=>setPhotoIdx(i=>(i-1+photos.length)%photos.length)} style={{ background:"none", border:"1.5px solid #D3D1C7", borderRadius:6, padding:"4px 12px", cursor:"pointer", fontSize:16 }}>&lt;</button>
                <button onClick={()=>setPhotoIdx(i=>(i+1)%photos.length)} style={{ background:"none", border:"1.5px solid #D3D1C7", borderRadius:6, padding:"4px 12px", cursor:"pointer", fontSize:16 }}>{">"}</button>
                <span style={{ fontSize:13, color:"#2C2C2A", alignSelf:"center" }}>{photoIdx+1} / {photos.length}</span>
              </div>
              <span style={{ fontSize:13, color:"#2C2C2A" }}>{photos[photoIdx].caption}</span>
              <button onClick={()=>setPhotoIdx(null)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#2C2C2A" }}>✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// — Contractor Directory (consumer-facing) ------------------------------------
export function ContractorDirectory({ liveProfile, livePhotos, onSubmitProject, onJoinAsContractor, onViewProfile }) {
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [credFilter, setCredFilter] = useState(""); // licensed | insured | backgroundCheck
  const [sortBy, setSortBy] = useState("rating"); // rating | reviews | years
  const [selected, setSelected] = useState(null);

  // Merge live contractor profile into directory if they have a name
  const allContractors = [
    ...(liveProfile?.name ? [{
      ...liveProfile,
      id: "live",
      rating: liveProfile.rating || 5.0,
      reviewCount: liveProfile.reviewCount || 0,
      photos: livePhotos || [],
    }] : []),
    ...DEMO_CONTRACTORS,
  ];

  const cities = [...new Set(allContractors.map(c => c.city))].sort();

  const filtered = allContractors.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.company.toLowerCase().includes(q) && !(c.bio||"").toLowerCase().includes(q) && !(c.city||"").toLowerCase().includes(q)) return false;
    }
    if (tradeFilter && !(c.trades||[]).includes(tradeFilter)) return false;
    if (cityFilter && c.city !== cityFilter) return false;
    if (credFilter && !c[credFilter]) return false;
    return true;
  }).sort((a,b) => {
    if (sortBy==="rating") return b.rating - a.rating;
    if (sortBy==="reviews") return b.reviewCount - a.reviewCount;
    if (sortBy==="years") return Number(b.years||0) - Number(a.years||0);
    return 0;
  });

  const initials = name => (name||"??").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  return (
    <div>
      {/* Search bar */}
      <div style={{ background:"#F1EFE8", borderRadius:12, padding:"16px 18px", marginBottom:18 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <input
            placeholder=" Search by name, trade, or city..."
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{ flex:1, minWidth:200, padding:"10px 14px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", outline:"none", background:"#fff" }}
          />
          <select value={tradeFilter} onChange={e=>setTradeFilter(e.target.value)} style={{ padding:"10px 14px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
            <option value="">All Trades</option>
            {Object.keys(TRADES).map(t=><option key={t} value={t}>{TRADES[t].icon} {t}</option>)}
          </select>
          <select value={cityFilter} onChange={e=>setCityFilter(e.target.value)} style={{ padding:"10px 14px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
            <option value="">All Cities</option>
            {cities.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ padding:"10px 14px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
            <option value="rating">Sort: Highest Rated</option>
            <option value="reviews">Sort: Most Reviews</option>
            <option value="years">Sort: Most Experience</option>
          </select>
        </div>

      </div>

      {/* Results count */}
      <div style={{ fontSize:13, color:"#2C2C2A", marginBottom:14 }}>
        Showing <strong style={{ color:"#2C2C2A" }}>{filtered.length}</strong> contractor{filtered.length!==1?"s":""} {cityFilter?`in ${cityFilter}`:"in your area"}
      </div>

      {/* Grid of contractor cards */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", border:"2px dashed #D3D1C7", borderRadius:12, color:"#2C2C2A" }}>
          <div style={{ fontSize:48, marginBottom:12 }}></div>
          <p style={{ fontSize:15 }}>No contractors match your filters. Try broadening your search.</p>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
          {filtered.map(c => {
            const avatarBg    = c.avatarBg    || "#E6F1FB";
            const avatarColor = c.avatarColor || "#0C447C";
            const inits       = c.initials    || initials(c.name);
            const photoSrc    = c.photo || c.photos?.[0]?.src;
            return (
              <div key={c.id} style={{ background:"#fff", border:"1.5px solid #E8E6DF", borderRadius:16, overflow:"hidden", display:"flex", flexDirection:"column", transition:"box-shadow 0.2s, transform 0.2s, border-color 0.15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 8px 28px rgba(12,68,124,0.1)"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.borderColor="#B5D4F4"; }}
                onMouseLeave={e=>{ e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="#E8E6DF"; }}>

                {/* Consistent header — always same height, always navy gradient */}
                <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", height:80, flexShrink:0, position:"relative" }}>
                  {/* Avatar centered, overlapping bottom of header */}
                  <div style={{ position:"absolute", bottom:-36, left:"50%", transform:"translateX(-50%)", width:72, height:72, borderRadius:16, background:avatarBg, border:"3px solid #fff", boxShadow:"0 4px 14px rgba(0,0,0,0.15)", overflow:"hidden", flexShrink:0 }}>
                    {photoSrc
                      ? <img src={photoSrc} alt={c.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                      : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:900, color:avatarColor }}>{inits}</div>
                    }
                  </div>
                </div>

                {/* Body — padded top to clear the avatar overlap */}
                <div style={{ paddingTop:44, padding:"44px 20px 20px", flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>

                  {/* Name + company */}
                  <div style={{ textAlign:"center", marginBottom:10 }}>
                    <div style={{ fontSize:16, fontWeight:800, color:"#2C2C2A", marginBottom:2, letterSpacing:"-0.01em" }}>{c.name}</div>
                    <div style={{ fontSize:12, color:"#888780" }}>{c.company}</div>
                  </div>

                  {/* Rating */}
                  <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:8 }}>
                    <span style={{ color:"#EF9F27", fontSize:13, letterSpacing:1 }}>
                      {"*".repeat(Math.floor(c.rating||5))}{"*".repeat(5-Math.floor(c.rating||5))}
                    </span>
                    <span style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{(c.rating||5).toFixed(1)}</span>
                    <span style={{ fontSize:12, color:"#B4B2A9" }}>({c.reviewCount||0})</span>
                  </div>

                  {/* Location + experience */}
                  <div style={{ fontSize:12, color:"#888780", marginBottom:6, textAlign:"center" }}>
                     {c.city}, {c.state||"CA"} &nbsp;.&nbsp; {c.years} yrs
                  </div>

                  {/* Response rate badge */}
                  {c.responseRate && (
                    <div style={{ fontSize:11, fontWeight:700, color: c.responseRate>=90?"#0F6E56":c.responseRate>=80?"#854F0B":"#888780", background: c.responseRate>=90?"#E1F5EE":c.responseRate>=80?"#FAEEDA":"#F1EFE8", borderRadius:20, padding:"3px 10px", marginBottom:10 }}>
                      ⚡ Responds {c.responseTime||"quickly"}
                    </div>
                  )}

                  {/* Trade badges */}
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", justifyContent:"center", marginBottom:10 }}>
                    {(c.trades||[]).slice(0,2).map(t=>(
                      <span key={t} style={{ fontSize:11, fontWeight:600, color:TRADES[t]?.color||"#0C447C", background:TRADES[t]?.bg||"#E6F1FB", borderRadius:20, padding:"3px 10px" }}>{t}</span>
                    ))}
                    {(c.trades||[]).length>2 && <span style={{ fontSize:11, color:"#888780", alignSelf:"center" }}>+{c.trades.length-2} more</span>}
                  </div>

                  {/* Credential pills */}
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", justifyContent:"center", marginBottom:16 }}>
                    {c.licensed        && <span style={{ fontSize:10, fontWeight:700, color:"#0F6E56", background:"#E1F5EE", borderRadius:20, padding:"3px 9px" }}>✓ Licensed</span>}
                    {c.insured         && <span style={{ fontSize:10, fontWeight:700, color:"#185FA5", background:"#E6F1FB", borderRadius:20, padding:"3px 9px" }}>✓ Insured</span>}
                    {c.backgroundCheck && <span style={{ fontSize:10, fontWeight:700, color:"#534AB7", background:"#EEEDFE", borderRadius:20, padding:"3px 9px" }}>✓ BG Checked</span>}
                  </div>

                  {/* Action buttons — always at bottom */}
                  <div style={{ display:"flex", gap:8, width:"100%", marginTop:"auto" }}>
                    <button type="button" onClick={e=>{ e.stopPropagation(); onViewProfile ? onViewProfile(c) : setSelected(c); }}
                      style={{ flex:1, padding:"9px 0", borderRadius:9, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                      View Profile
                    </button>
                    {onSubmitProject && (
                      <button type="button" onClick={e=>{ e.stopPropagation(); onSubmitProject(c); }}
                        style={{ flex:1, padding:"9px 0", borderRadius:9, border:"none", background:"#0C447C", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                        Get Bids &gt;
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && <ContractorModal contractor={selected} onClose={()=>setSelected(null)} onSubmitProject={onSubmitProject} />}

      {/* Are you a contractor? Banner */}
      {onJoinAsContractor && (
        <div style={{ marginTop:28, background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", borderRadius:14, padding:"22px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:"#fff", marginBottom:4 }}>Are you a licensed contractor in San Diego?</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)" }}>Plans from free — no commitment required. See what fits your business.</div>
          </div>
          <button type="button" onClick={onJoinAsContractor}
            style={{ padding:"11px 24px", borderRadius:9, border:"none", background:"#EF9F27", color:"#082E56", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0 }}>
            Join as a Contractor &gt;
          </button>
        </div>
      )}
    </div>
  );
}

