import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { MARKET_DATA } from "./MatchedContractorsView.jsx";

// — Price Transparency Tool ---------------------------------------------------
export function PriceTransparencyTool({ leads, bids, projects, onNavigate }) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const [propType, setPropType] = useState("Residential");
  const [trade, setTrade] = useState("");
  const [scope, setScope] = useState("");

  const trades   = Object.keys(MARKET_DATA[propType] || {});
  const scopes   = trade ? Object.keys(MARKET_DATA[propType]?.[trade] || {}) : [];
  const data     = trade && scope ? MARKET_DATA[propType]?.[trade]?.[scope] : null;

  // Total completed projects across all market data (for credibility counter)
  const totalSamples = Object.values(MARKET_DATA).flatMap(t=>Object.values(t)).flatMap(s=>Object.values(s)).reduce((s,d)=>s+d.samples,0);

  // Leaderboard: top 6 most-sampled scopes across all trades
  const topScopes = Object.entries(MARKET_DATA.Residential)
    .flatMap(([t,scopes])=>Object.entries(scopes).map(([s,d])=>({trade:t,scope:s,...d})))
    .sort((a,b)=>b.samples-a.samples).slice(0,6);

  const renderBar = (data) => {
    if (!data) return null;
    return (
      <div style={{ marginBottom:6 }}>
        <div style={{ display:"flex", gap:0, borderRadius:8, overflow:"hidden", height:28, marginBottom:6 }}>
          <div style={{ flex: data.low, background:"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#0F6E56" }}>{fmt$(data.low)}</div>
          <div style={{ flex: data.avg - data.low, background:"#E6F1FB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#185FA5" }}>{fmt$(data.avg)}</div>
          <div style={{ flex: data.high - data.avg, background:"#FAEEDA", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#854F0B" }}>{fmt$(data.high)}</div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          {[["Low",data.low,"#0F6E56"],["Avg",data.avg,"#185FA5"],["High",data.high,"#854F0B"]].map(([l,v,c])=>(
            <div key={l} style={{ fontSize:11, color:c, fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:c }} /> {l}: {fmt$(v)}
            </div>
          ))}
          <span style={{ fontSize:11, color:"#888780", marginLeft:"auto" }}>{data.samples} projects</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily:font }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", borderRadius:14, padding:"28px 32px", marginBottom:24 }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8 }}> Price Transparency</div>
        <h2 style={{ fontSize:26, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", margin:"0 0 8px" }}>What San Diego homeowners actually paid.</h2>
        <p style={{ fontSize:14, color:"rgba(255,255,255,0.65)", lineHeight:1.7, maxWidth:560, margin:"0 0 20px" }}>
          Real pricing data from completed projects on BuildConnect Pro. No estimates, no surveys — actual amounts paid to licensed San Diego contractors.
        </p>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:10, padding:"10px 20px", textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:900, color:"#EF9F27" }}>{totalSamples.toLocaleString()}+</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)" }}>Completed Projects</div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:10, padding:"10px 20px", textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:900, color:"#EF9F27" }}>{Object.keys(MARKET_DATA.Residential).length}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)" }}>Trades Covered</div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.1)", borderRadius:10, padding:"10px 20px", textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:900, color:"#EF9F27" }}>San Diego</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)" }}>Market Only</div>
          </div>
        </div>
      </div>

      {/* Selector */}
      <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:14, padding:"22px 24px", marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A", marginBottom:14 }}>Look up pricing for your project</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom: data ? 20 : 0 }}>
          {/* Property type */}
          <div>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Property Type</label>
            <div style={{ display:"flex", gap:0, borderRadius:8, border:"1.5px solid #D3D1C7", overflow:"hidden" }}>
              {["Residential","Commercial"].map(p=>(
                <button key={p} type="button" onClick={()=>{ setPropType(p); setTrade(""); setScope(""); }}
                  style={{ flex:1, padding:"9px 0", border:"none", background:propType===p?"#0C447C":"#fff", color:propType===p?"#fff":"#2C2C2A", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:font }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          {/* Trade */}
          <div>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Trade</label>
            <select value={trade} onChange={e=>{ setTrade(e.target.value); setScope(""); }}
              style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:font, background:"#fff", outline:"none", color:trade?"#2C2C2A":"#9CA3AF" }}>
              <option value="">Select a trade...</option>
              {trades.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {/* Scope */}
          <div>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Job Type</label>
            <select value={scope} onChange={e=>setScope(e.target.value)} disabled={!trade}
              style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:font, background:trade?"#fff":"#F8F7F4", outline:"none", color:scope?"#2C2C2A":"#9CA3AF" }}>
              <option value="">{trade ? "Select job type..." : "Select a trade first"}</option>
              {scopes.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Result */}
        {data && (
          <div style={{ borderTop:"1.5px solid #F1EFE8", paddingTop:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:12 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{propType} · {trade} · {scope}</div>
                <div style={{ fontSize:28, fontWeight:900, color:"#0C447C", letterSpacing:"-0.02em" }}>{fmt$(data.low)} - {fmt$(data.high)}</div>
                <div style={{ fontSize:13, color:"#5F5E5A", marginTop:2 }}>San Diego market range · Average paid: <strong>{fmt$(data.avg)}</strong></div>
              </div>
              <div style={{ background:"#F8F7F4", borderRadius:10, padding:"12px 18px", textAlign:"center", border:"1.5px solid #E8E6DF" }}>
                <div style={{ fontSize:22, fontWeight:900, color:"#0C447C" }}>{data.samples}</div>
                <div style={{ fontSize:11, color:"#888780" }}>completed projects</div>
                <div style={{ fontSize:10, color:"#B4B2A9", marginTop:2 }}>in San Diego</div>
              </div>
            </div>

            {/* Visual bar */}
            {renderBar(data)}

            {/* Percentile breakdown */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginTop:16 }}>
              {[
                [" Best deals","Below "+fmt$(data.low),"Rarely seen — exceptional contractor or off-season pricing"],
                [" Typical range",fmt$(data.low)+" - "+fmt$(data.high),"What most San Diego homeowners pay"],
                [" Premium jobs","Above "+fmt$(data.high),"Complex scope, premium materials, or urgent timeline"],
              ].map(([label,range,note])=>(
                <div key={label} style={{ background:"#F8F7F4", borderRadius:10, padding:"12px 14px", border:"1px solid #E8E6DF" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#2C2C2A", marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#0C447C", marginBottom:4 }}>{range}</div>
                  <div style={{ fontSize:11, color:"#888780", lineHeight:1.5 }}>{note}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop:16, display:"flex", gap:10, flexWrap:"wrap" }}>
              <button type="button" onClick={()=>onNavigate("submit")}
                style={{ padding:"10px 22px", borderRadius:9, border:"none", background:"#0C447C", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:font }}>
                Get Bids on a {scope} &gt;
              </button>
              <div style={{ fontSize:11, color:"#888780", alignSelf:"center", lineHeight:1.5 }}>
                Pricing last updated June 2026 · Based on San Diego completed projects only
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Most looked-up jobs */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A", marginBottom:14 }}>Most looked-up jobs in San Diego</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px,1fr))", gap:10 }}>
          {topScopes.map(t=>(
            <div key={t.trade+t.scope}
              onClick={()=>{ setPropType("Residential"); setTrade(t.trade); setScope(t.scope); window.scrollTo(0,0); }}
              style={{ background:"#fff", border:"1.5px solid #E8E6DF", borderRadius:12, padding:"14px 16px", cursor:"pointer", transition:"border-color 0.15s, box-shadow 0.15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor="#185FA5"; e.currentTarget.style.boxShadow="0 4px 16px rgba(12,68,124,0.08)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor="#E8E6DF"; e.currentTarget.style.boxShadow="none"; }}>
              <div style={{ fontSize:10, fontWeight:700, color:TRADES[t.trade]?.color||"#0C447C", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{t.trade}</div>
              <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:6 }}>{t.scope}</div>
              <div style={{ fontSize:16, fontWeight:900, color:"#0C447C", marginBottom:4 }}>{fmt$(t.low)} - {fmt$(t.high)}</div>
              <div style={{ fontSize:11, color:"#888780" }}>Avg {fmt$(t.avg)} · {t.samples} projects</div>
            </div>
          ))}
        </div>
      </div>

      {/* What this means */}
      <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", borderRadius:14, padding:"22px 28px" }}>
        <div style={{ fontSize:15, fontWeight:800, color:"#fff", marginBottom:8 }}> Why this matters</div>
        <p style={{ fontSize:13, color:"rgba(255,255,255,0.7)", lineHeight:1.8, marginBottom:14, maxWidth:640 }}>
          Angi and Thumbtack show you estimates. We show you what San Diego homeowners actually paid — verified transaction amounts from real completed projects on our platform. The more projects complete on BuildConnect Pro, the more accurate this data becomes. A homeowner who knows what things actually cost can't be ripped off.
        </p>
        <button type="button" onClick={()=>onNavigate("submit")}
          style={{ padding:"11px 24px", borderRadius:9, border:"none", background:"#EF9F27", color:"#082E56", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:font }}>
          Submit Your Project — Get Bids &gt;
        </button>
      </div>
    </div>
  );
}
