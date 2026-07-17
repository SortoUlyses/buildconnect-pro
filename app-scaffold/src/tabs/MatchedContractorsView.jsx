import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { MATCHED_CONTRACTORS, DEMO_CONTRACTORS } from "../demoData.js";

// — Matched Contractors View --------------------------------------------------
export function MatchedContractorsView({ trade, propertyType, jobType, budget, onBack, onViewProfile, onRequestBids }) {
  const [selected, setSelected] = useState(new Set());
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const matched = MATCHED_CONTRACTORS
    .filter(c => c.trades.includes(trade))
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    .slice(0, 10);

  const toggle = id => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const selectAll = () => setSelected(new Set(matched.map(c => c.id)));
  const clearAll = () => setSelected(new Set());

  const renderStars = (rating, size=14) => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    return (
      <span style={{ color:"#EF9F27", fontSize:size, letterSpacing:1 }}>
        {"*".repeat(full)}{half ? "1/2" : ""}{"*".repeat(5 - full - (half?1:0))}
      </span>
    );
  };

  return (
    <div style={{ fontFamily:font, minHeight:"100vh", background:"#F8F7F4" }}>
      {/* Header */}
      <div style={{ background:"#0C447C", padding:"20px 32px" }}>
        <div style={{ maxWidth:960, margin:"0 auto" }}>
          <button type="button" onClick={onBack}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,0.7)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font, display:"flex", alignItems:"center", gap:6, marginBottom:14, padding:0 }}
            onMouseEnter={e=>e.currentTarget.style.color="#fff"}
            onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.7)"}>
            ← Back to Cost Estimator
          </button>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Matched Contractors</div>
              <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 }}>
                {trade} Contractors in San Diego
              </h1>
              <p style={{ fontSize:14, color:"rgba(255,255,255,0.7)" }}>
                {matched.length} licensed contractors matched · {propertyType} · Sorted by rating
              </p>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button type="button" onClick={selectAll}
                style={{ padding:"8px 16px", borderRadius:8, border:"1.5px solid rgba(255,255,255,0.25)", background:"none", color:"rgba(255,255,255,0.8)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:font }}>
                Select All
              </button>
              <button type="button" onClick={clearAll}
                style={{ padding:"8px 16px", borderRadius:8, border:"1.5px solid rgba(255,255,255,0.15)", background:"none", color:"rgba(255,255,255,0.5)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:font }}>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contractor grid */}
      <div style={{ maxWidth:960, margin:"0 auto", padding:"28px 16px 120px" }}>
        {matched.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7" }}>
            <p style={{ fontSize:16, color:"#5F5E5A" }}>No contractors found for {trade} yet. We're growing our network — check back soon or submit your project and we'll match you manually.</p>
            <button type="button" onClick={onBack} style={{ marginTop:16, padding:"10px 24px", borderRadius:8, background:"#0C447C", color:"#fff", border:"none", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font }}>Back Go Back</button>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:16 }}>
            {matched.map(c => (
              <div key={c.id}
                style={{ background:"#fff", border: selected.has(c.id) ? "2px solid #0C447C" : "1.5px solid #D3D1C7", borderRadius:14, overflow:"hidden", transition:"box-shadow 0.2s, transform 0.2s, border-color 0.15s",
                  boxShadow: selected.has(c.id) ? "0 0 0 3px rgba(12,68,124,0.1)" : "none" }}
                onMouseEnter={e=>{ if(!selected.has(c.id)) e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.08)"; e.currentTarget.style.transform="translateY(-2px)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.boxShadow = selected.has(c.id)?"0 0 0 3px rgba(12,68,124,0.1)":"none"; e.currentTarget.style.transform="translateY(0)"; }}>

                {/* Card header */}
                <div style={{ padding:"18px 18px 12px", display:"flex", gap:12, alignItems:"flex-start" }}>
                  <div style={{ position:"relative", flexShrink:0 }}>
                    <div style={{ width:52, height:52, borderRadius:10, background:c.avatarBg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:900, color:c.avatarColor }}>
                      {c.initials}
                    </div>
                    {selected.has(c.id) && (
                      <div style={{ position:"absolute", top:-6, right:-6, width:20, height:20, borderRadius:"50%", background:"#0C447C", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:800 }}>✓</div>
                    )}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:"#2C2C2A", marginBottom:1 }}>{c.name}</div>
                    <div style={{ fontSize:12, color:"#5F5E5A", marginBottom:6 }}>{c.company}</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      {renderStars(c.rating)}
                      <span style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{c.rating.toFixed(1)}</span>
                      <span style={{ fontSize:12, color:"#888780" }}>({c.reviewCount})</span>
                    </div>
                  </div>
                </div>

                {/* Badges */}
                <div style={{ padding:"0 18px 12px", display:"flex", gap:6, flexWrap:"wrap" }}>
                  {c.licensed && <span style={{ fontSize:10, fontWeight:700, color:"#0F6E56", background:"#E1F5EE", borderRadius:20, padding:"3px 8px" }}>Licensed</span>}
                  {c.insured && <span style={{ fontSize:10, fontWeight:700, color:"#185FA5", background:"#E6F1FB", borderRadius:20, padding:"3px 8px" }}>Insured</span>}
                  {c.backgroundCheck && <span style={{ fontSize:10, fontWeight:700, color:"#534AB7", background:"#EEEDFE", borderRadius:20, padding:"3px 8px" }}>Background Checked</span>}
                </div>

                {/* Highlights */}
                <div style={{ padding:"0 18px 12px", borderTop:"1px solid #F1EFE8", paddingTop:12 }}>
                  {c.highlights.map((h,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"#5F5E5A", marginBottom:5 }}>
                      <span style={{ width:5, height:5, borderRadius:"50%", background:"#EF9F27", flexShrink:0 }} />
                      {h}
                    </div>
                  ))}
                  <div style={{ fontSize:11, color:"#888780", marginTop:6 }}> {c.city} · {c.years} years experience</div>
                </div>

                {/* Actions */}
                <div style={{ padding:"12px 18px", borderTop:"1px solid #F1EFE8", display:"flex", gap:8 }}>
                  <button type="button" onClick={() => onViewProfile(c)}
                    style={{ flex:1, padding:"9px 0", borderRadius:8, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font }}>
                    View Profile
                  </button>
                  <button type="button" onClick={() => toggle(c.id)}
                    style={{ flex:1, padding:"9px 0", borderRadius:8, border:"none", background: selected.has(c.id) ? "#0C447C" : "#EF9F27", color: selected.has(c.id) ? "#fff" : "#082E56", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:font }}>
                    {selected.has(c.id) ? "✓ Selected" : "Select"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      {selected.size > 0 && (
        <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#0C447C", borderTop:"3px solid #EF9F27", padding:"16px 32px", zIndex:100 }}>
          <div style={{ maxWidth:960, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
            <div>
              <span style={{ fontSize:16, fontWeight:800, color:"#fff" }}>{selected.size} contractor{selected.size !== 1 ? "s" : ""} selected</span>
              <span style={{ fontSize:13, color:"rgba(255,255,255,0.65)", marginLeft:10 }}>They'll each receive your project details and submit a bid.</span>
            </div>
            <button type="button" onClick={() => onRequestBids([...selected], trade, jobType, budget)}
              style={{ padding:"13px 32px", borderRadius:10, border:"none", background:"#EF9F27", color:"#082E56", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:font, whiteSpace:"nowrap" }}>
              Request Bids from {selected.size} Contractor{selected.size !== 1 ? "s" : ""} &gt;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// — Contractor Profile View ---------------------------------------------------
export function ContractorProfileView({ contractor: c, onBack, onRequestBid, backLabel }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Safe fallbacks — ContractorProfileView may receive DEMO_CONTRACTORS or MATCHED_CONTRACTORS
  const trades      = c.trades      || [];
  const highlights  = c.highlights  || [];
  const initials    = c.initials    || (c.name||"??").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const avatarBg    = c.avatarBg    || "#E6F1FB";
  const avatarColor = c.avatarColor || "#0C447C";
  const rating      = c.rating      || 5.0;
  const reviewCount = c.reviewCount || 0;
  const serviceArea = c.serviceArea || (c.city ? `${c.city}, CA` : "San Diego, CA");

  const renderStars = (r, size=18) => (
    <span style={{ color:"#EF9F27", fontSize:size, letterSpacing:1 }}>
      {"*".repeat(Math.floor(rating))}{rating % 1 >= 0.5 ? "*" : ""}
    </span>
  );

  const DEMO_REVIEWS_FOR_PROFILE = [
    { name:"Sandra M.", date:"March 2025", rating:5, text:`${c.name} and the team were professional from start to finish. Showed up on time, kept the site clean, and the work was exactly what was quoted. Highly recommend.` },
    { name:"Kevin T.",  date:"January 2025", rating:5, text:`Best contractor experience I've had in San Diego. Clear communication, fair pricing, and the job came out great. Will definitely use again for our next project.` },
    { name:"Rachel B.", date:"November 2024", rating:4, text:`Very happy with the work. A couple of small scheduling hiccups but they communicated well and made it right. Final result looks great.` },
  ];

  return (
    <div style={{ fontFamily:font, minHeight:"100vh", background:"#F8F7F4" }}>
      {/* Back bar */}
      <div style={{ background:"#0C447C", padding:"16px 32px" }}>
        <div style={{ maxWidth:960, margin:"0 auto" }}>
          <button type="button" onClick={onBack}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,0.7)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font, display:"flex", alignItems:"center", gap:6, padding:0 }}
            onMouseEnter={e=>e.currentTarget.style.color="#fff"}
            onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.7)"}>
            {backLabel || "Back"}
          </button>
        </div>
      </div>

      {/* Profile hero */}
      <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", padding:"36px 32px" }}>
        <div style={{ maxWidth:960, margin:"0 auto", display:"flex", gap:24, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ width:80, height:80, borderRadius:14, background:avatarBg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, fontWeight:900, color:avatarColor, flexShrink:0 }}>
            {initials}
          </div>
          <div style={{ flex:1 }}>
            <h1 style={{ fontSize:28, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 }}>{c.name}</h1>
            <div style={{ fontSize:15, color:"rgba(255,255,255,0.75)", marginBottom:10 }}>{c.company} · {c.city}, CA</div>
            <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
              {renderStars(rating)}
              <span style={{ fontSize:15, fontWeight:700, color:"#fff" }}>{rating.toFixed(1)}</span>
              <span style={{ fontSize:13, color:"rgba(255,255,255,0.6)" }}>({reviewCount} reviews)</span>
              <span style={{ width:1, height:16, background:"rgba(255,255,255,0.2)", display:"inline-block" }} />
              <span style={{ fontSize:13, color:"rgba(255,255,255,0.7)" }}>{c.years} years in business</span>
              {c.responseRate && (
                <>
                  <span style={{ width:1, height:16, background:"rgba(255,255,255,0.2)", display:"inline-block" }} />
                  <span style={{ fontSize:13, color: c.responseRate>=90?"#B5F5D8":c.responseRate>=80?"#FAC775":"rgba(255,255,255,0.6)", fontWeight:600 }}>
                    Responds {c.responseTime||"quickly"} · {c.responseRate}% response rate
                  </span>
                </>
              )}
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:10 }}>
              {trades.map(t => <span key={t} style={{ fontSize:11, fontWeight:700, color:"#EF9F27", background:"rgba(239,159,39,0.15)", border:"1px solid rgba(239,159,39,0.3)", borderRadius:20, padding:"3px 10px" }}>{t}</span>)}
              {c.licensed && <span style={{ fontSize:11, fontWeight:700, color:"#B5F5D8", background:"rgba(15,110,86,0.3)", borderRadius:20, padding:"3px 10px" }}>Licensed</span>}
              {c.insured && <span style={{ fontSize:11, fontWeight:700, color:"#B5D4F4", background:"rgba(24,95,165,0.3)", borderRadius:20, padding:"3px 10px" }}>Insured</span>}
              {c.backgroundCheck && <span style={{ fontSize:11, fontWeight:700, color:"#C4BEFF", background:"rgba(83,74,183,0.3)", borderRadius:20, padding:"3px 10px" }}>Background Checked</span>}
            </div>
          </div>
          <button type="button" onClick={() => onRequestBid(c)}
            style={{ padding:"14px 28px", borderRadius:10, border:"none", background:"#EF9F27", color:"#082E56", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:font, whiteSpace:"nowrap" }}>
            Request a Bid &gt;
          </button>
        </div>
      </div>

      {/* Profile body */}
      <div style={{ maxWidth:960, margin:"0 auto", padding:"28px 16px", display:"grid", gridTemplateColumns:"2fr 1fr", gap:20 }}>

        {/* Left column */}
        <div>
          {/* About */}
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", padding:"24px", marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>About</div>
            <p style={{ fontSize:14, color:"#2C2C2A", lineHeight:1.75 }}>{c.bio || "No bio provided."}</p>
          </div>

          {/* Specialties — only show if highlights exist */}
          {highlights.length > 0 && (
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", padding:"24px", marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:14 }}>What We Do Best</div>
            {highlights.map((h,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom: i < highlights.length-1 ? "1px solid #F1EFE8" : "none" }}>
                <div style={{ width:32, height:32, borderRadius:8, background:"#FAEEDA", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontSize:14, color:"#854F0B", fontWeight:700 }}>{i+1}</span>
                </div>
                <span style={{ fontSize:14, color:"#2C2C2A", fontWeight:500 }}>{h}</span>
              </div>
            ))}
          </div>
          )}

          {/* Reviews */}
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", padding:"24px" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:16 }}>Recent Reviews</div>
            {DEMO_REVIEWS_FOR_PROFILE.map((r, i) => (
              <div key={i} style={{ paddingBottom:16, marginBottom:16, borderBottom: i < DEMO_REVIEWS_FOR_PROFILE.length-1 ? "1px solid #F1EFE8" : "none" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <div style={{ width:34, height:34, borderRadius:"50%", background:"#E6F1FB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#0C447C" }}>
                      {r.name.split(" ").map(w=>w[0]).join("")}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{r.name}</div>
                      <div style={{ fontSize:11, color:"#888780" }}>{r.date}</div>
                    </div>
                  </div>
                  {renderStars(r.rating, 14)}
                </div>
                <p style={{ fontSize:13, color:"#5F5E5A", lineHeight:1.7, fontStyle:"italic" }}>"{r.text}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Quick stats */}
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", padding:"24px", marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:14 }}>At a Glance</div>
            {[
              ["Rating",            `${rating.toFixed(1)} / 5.0`],
              ["Reviews",           reviewCount],
              ["Years in Business", c.years || "—"],
              ["Location",          `${c.city}, CA`],
              ["License",           c.licensed ? "Active & Verified" : "—"],
              ["Insurance",         c.insured  ? "Fully Insured" : "—"],
            ].map(([label, val]) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #F1EFE8", fontSize:13 }}>
                <span style={{ color:"#888780" }}>{label}</span>
                <span style={{ fontWeight:700, color:"#2C2C2A" }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Service area */}
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", padding:"24px", marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>Service Area</div>
            <p style={{ fontSize:13, color:"#2C2C2A", lineHeight:1.65 }}>{serviceArea}</p>
          </div>

          {/* CTA card */}
          <div style={{ background:"#0C447C", borderRadius:14, padding:"24px" }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#fff", marginBottom:8 }}>Ready to get a bid?</div>
            <p style={{ fontSize:13, color:"rgba(255,255,255,0.7)", marginBottom:16, lineHeight:1.6 }}>Submit your project details and {(c.name||"this contractor").split(" ")[0]} will review and respond with a detailed bid.</p>
            <button type="button" onClick={() => onRequestBid(c)}
              style={{ display:"block", width:"100%", padding:"12px", borderRadius:9, border:"none", background:"#EF9F27", color:"#082E56", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:font }}>
              Request a Bid &gt;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// — Home Landing View ---------------------------------------------------------
// — Price Transparency Market Data -------------------------------------------
// Seeded aggregate data derived from real San Diego market ranges.
// When live transaction data exists, replace with a Supabase aggregate query.
// Shape: { samples, low, avg, high } — all dollar amounts as integers.
export const MARKET_DATA = {
  Residential: {
    "HVAC": {
      "Basic System":      { samples:94,  low:6200,   avg:8100,   high:9800  },
      "Mid-Range":         { samples:112, low:8600,   avg:11200,  high:13400 },
      "High-Efficiency":   { samples:67,  low:11500,  avg:15200,  high:19800 },
    },
    "Electrical": {
      "Panel Upgrade":     { samples:203, low:3200,   avg:4900,   high:6800  },
      "Rewire / Outlets":  { samples:88,  low:3800,   avg:7400,   high:12500 },
      "EV Charger":        { samples:176, low:750,    avg:1600,   high:2600  },
    },
    "Plumbing": {
      "Repairs & Fixtures":{ samples:318, low:480,    avg:2100,   high:3800  },
      "Repipe (Partial)":  { samples:74,  low:3800,   avg:6400,   high:9200  },
      "Full Repipe":       { samples:52,  low:8500,   avg:13200,  high:18500 },
    },
    "Roofing": {
      "Asphalt Shingle":   { samples:143, low:11200,  avg:16800,  high:23500 },
      "Tile Roof":         { samples:97,  low:21000,  avg:32500,  high:47000 },
      "Metal Roof":        { samples:41,  low:26000,  avg:40000,  high:58000 },
    },
    "Remodel": {
      "Kitchen (Minor)":   { samples:88,  low:23000,  avg:34000,  high:47000 },
      "Kitchen (Full)":    { samples:62,  low:47000,  avg:71000,  high:105000},
      "Bathroom":          { samples:119, low:13500,  avg:26000,  high:43000 },
    },
    "Flooring": {
      "Luxury Vinyl (LVP)":{ samples:214, low:3600,   avg:6200,   high:9400  },
      "Hardwood":          { samples:131, low:8200,   avg:13800,  high:21000 },
      "Tile":              { samples:167, low:5500,   avg:10400,  high:17000 },
    },
    "Painting": {
      "Interior (Full Home)":{ samples:248, low:3800,  avg:6400,  high:9600  },
      "Exterior":          { samples:193, low:4600,   avg:8900,   high:14500 },
      "Single Room":       { samples:312, low:420,    avg:1100,   high:1900  },
    },
    "Concrete": {
      "Driveway":          { samples:108, low:4600,   avg:8800,   high:14500 },
      "Patio / Walkway":   { samples:134, low:3200,   avg:6100,   high:9600  },
      "Foundation Work":   { samples:44,  low:7500,   avg:17000,  high:32000 },
    },
    "Landscaping": {
      "Lawn & Plants":     { samples:187, low:2800,   avg:6400,   high:10800 },
      "Hardscape & Design":{ samples:96,  low:11000,  avg:24000,  high:43000 },
      "Full Backyard":     { samples:58,  low:28000,  avg:51000,  high:85000 },
    },
    "Solar": {
      "Small System (4-5 kW)": { samples:144, low:9800,  avg:12400, high:15200 },
      "Mid System (6-8 kW)":   { samples:188, low:13500, avg:17200, high:21500 },
      "Large + Battery (9-12 kW)":{ samples:92, low:20000, avg:28500, high:40000 },
    },
    "Windows": {
      "1-5 Windows":       { samples:224, low:1400,   avg:3600,   high:6400  },
      "Full Home (10-15 Windows)":{ samples:97, low:7500, avg:13200, high:21000 },
      "Premium / Impact":  { samples:63,  low:16000,  avg:27000,  high:42000 },
    },
  },
  Commercial: {
    "HVAC": {
      "Small Office / Retail":{ samples:48, low:14000, avg:26000,  high:42000 },
      "Mid-Size Building":    { samples:31, low:38000, avg:88000,  high:155000},
    },
    "Electrical": {
      "Tenant Improvement":   { samples:54, low:14000, avg:31000,  high:52000 },
      "Service Upgrade":      { samples:27, low:19000, avg:47000,  high:83000 },
    },
  },
};

// Parse a range string like "$8,000 - $20,000" -> { min: 8000, max: 20000 }
export const parseRange = str => {
  if (!str) return null;
  const nums = str.replace(/\+/g,"").replace(/[$,]/g,"").split(/[----]/).map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
  return nums.length >= 2 ? { min:nums[0], max:nums[1] } : null;
};

// Determine market position of an amount vs market data
export const marketPosition = (amount, data) => {
  if (!data || !amount) return null;
  const pct = (amount - data.low) / (data.high - data.low);
  if (amount < data.low)               return { label:"Below Market",  color:"#0F6E56", bg:"#E1F5EE", pct:0,              detail:`You paid ${fmt$(data.low - amount)} below the typical low` };
  if (amount <= data.avg)              return { label:"Good Price",     color:"#185FA5", bg:"#E6F1FB", pct:Math.min(pct,0.5), detail:`You paid ${fmt$(data.avg - amount)} below the San Diego average` };
  if (amount <= data.high)             return { label:"Fair Price",     color:"#854F0B", bg:"#FAEEDA", pct:Math.min(pct,0.85), detail:`You paid near the San Diego average of ${fmt$(data.avg)}` };
  return                                      { label:"Above Market",   color:"#A32D2D", bg:"#FCEBEB", pct:1,              detail:`You paid ${fmt$(amount - data.high)} above the typical high` };
};

// — Price Comparison Bar (inline, used in My Projects + My Home Record) -------
export function PriceComparisonBar({ trade, propertyType, scope, amount }) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const data = MARKET_DATA[propertyType]?.[trade]?.[scope];
  if (!data || !amount) return null;
  const pos  = marketPosition(Number(amount), data);
  if (!pos) return null;
  const paidPct = Math.min(Math.max((Number(amount) - data.low) / (data.high - data.low), 0), 1);

  return (
    <div style={{ background:pos.bg, border:`1.5px solid ${pos.color}22`, borderRadius:10, padding:"12px 16px", marginTop:8, fontFamily:font }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ fontSize:12, fontWeight:800, color:pos.color }}>{pos.label}</div>
        <div style={{ fontSize:11, color:"#888780" }}>Based on {data.samples} San Diego projects</div>
      </div>

      {/* Range bar */}
      <div style={{ position:"relative", marginBottom:10 }}>
        <div style={{ height:8, borderRadius:20, background:"linear-gradient(to right, #0F6E56, #185FA5, #854F0B, #A32D2D)", opacity:0.25 }} />
        <div style={{ position:"absolute", top:0, left:0, right:0, height:8, borderRadius:20, display:"flex", alignItems:"center" }}>
          {/* You paid marker */}
          <div style={{ position:"absolute", left:`${paidPct*100}%`, transform:"translateX(-50%)", display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ width:14, height:14, borderRadius:"50%", background:pos.color, border:"2px solid #fff", boxShadow:"0 1px 4px rgba(0,0,0,0.2)", marginTop:-3 }} />
          </div>
        </div>
        {/* Labels */}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
          <span style={{ fontSize:10, color:"#888780" }}>Low {fmt$(data.low)}</span>
          <span style={{ fontSize:10, color:"#888780", position:"absolute", left:"50%", transform:"translateX(-50%)" }}>Avg {fmt$(data.avg)}</span>
          <span style={{ fontSize:10, color:"#888780" }}>High {fmt$(data.high)}</span>
        </div>
      </div>

      <div style={{ fontSize:12, color:"#2C2C2A", lineHeight:1.5 }}>
        <strong style={{ color:pos.color }}>You paid {fmt$(amount)}</strong> — {pos.detail}.
      </div>
    </div>
  );
}

