import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";

// — Contractor Portal Preview (marketing page) --------------------------------
export function ContractorPortalPreview({ onSignup, onViewPricing, onBack }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const navy = "#0C447C"; const amber = "#EF9F27"; const green = "#0F6E56";

  const features = [
    {
      id:"dashboard", label:"Dashboard", icon:"📊",
      headline:"Your entire business at a glance.",
      desc:"See today's revenue, active leads, project status, unread messages, and outstanding invoices the moment you log in. No hunting through tabs.",
      mock: (
        <MockCard>
          <MockHeader>BuildConnect Pro — Dashboard</MockHeader>
          <div style={{ padding:16 }}>
            {/* Stat row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
              {[["Revenue MTD","$24,800",green],["Open Leads","3",navy],["Active Jobs","2","#854F0B"],["Unpaid Invoices","$8,400","#A32D2D"]].map(([l,v,c])=>(
                <div key={l} style={{ background:"#F8F7F4", borderRadius:10, padding:"12px 14px", border:"1.5px solid #E8E6DF" }}>
                  <div style={{ fontSize:10, color:"#888780", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>{l}</div>
                  <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
                </div>
              ))}
            </div>
            {/* Recent leads */}
            <div style={{ fontSize:11, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Recent Leads</div>
            {[["Panel Upgrade — Chula Vista","Electrical","$3,200","2h ago",amber],["HVAC Replacement — El Cajon","HVAC","$8,500","5h ago","#E1F5EE"]].map(([t,tr,a,time,bg])=>(
              <div key={t} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:bg===amber?"#FAEEDA":"#F8F7F4", borderRadius:8, marginBottom:6 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#2C2C2A" }}>{t}</div>
                  <div style={{ fontSize:10, color:"#888780" }}>{tr} · {time}</div>
                </div>
                <div style={{ fontSize:12, fontWeight:800, color:navy }}>{a}</div>
                <div style={{ fontSize:10, fontWeight:700, color:bg===amber?"#854F0B":green, background:bg===amber?"#FAEEDA":"#E1F5EE", borderRadius:20, padding:"2px 8px" }}>{bg===amber?"New":"Bidding"}</div>
              </div>
            ))}
          </div>
        </MockCard>
      )
    },
    {
      id:"leads", label:"Leads", icon:"📋",
      headline:"Quality leads. No pay-per-click.",
      desc:"See every open job in your trade and area. Review the full project details, estimated budget, urgency, and homeowner info before deciding to bid. You choose what you go after.",
      mock: (
        <MockCard>
          <MockHeader>BuildConnect Pro — Leads</MockHeader>
          <div style={{ padding:16 }}>
            <div style={{ background:"#FCEBEB", border:"1.5px solid #F3C6C6", borderRadius:10, padding:"10px 14px", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:14 }}>!</span>
              <div>
                <div style={{ fontSize:12, fontWeight:800, color:"#A32D2D" }}>Emergency Lead — National City</div>
                <div style={{ fontSize:11, color:"#A32D2D" }}>Panel upgrade needed ASAP — budget $2,500-$5,000</div>
              </div>
              <div style={{ marginLeft:"auto", fontSize:10, fontWeight:700, color:"#fff", background:"#A32D2D", borderRadius:20, padding:"2px 10px" }}>URGENT</div>
            </div>
            {[
              ["200A Panel Upgrade","Electrical","Chula Vista","$3,200-$6,000","Flexible","4 bids"],
              ["EV Charger Install","Electrical","Bonita","$800-$1,500","Soon","1 bid"],
            ].map(([t,tr,city,budget,urg,bids])=>(
              <div key={t} style={{ border:"1.5px solid #E8E6DF", borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{t}</div>
                    <div style={{ fontSize:11, color:"#888780" }}>{tr} · {city}</div>
                  </div>
                  <div style={{ fontSize:12, fontWeight:800, color:navy }}>{budget}</div>
                </div>
                <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                  <span style={{ fontSize:10, fontWeight:600, color:navy, background:"#E6F1FB", borderRadius:20, padding:"2px 8px" }}>{urg}</span>
                  <span style={{ fontSize:10, color:"#888780" }}>{bids} so far</span>
                  <button type="button" style={{ marginLeft:"auto", padding:"5px 14px", borderRadius:7, border:"none", background:navy, color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:font }}>Place Bid</button>
                </div>
              </div>
            ))}
          </div>
        </MockCard>
      )
    },
    {
       id:"estimates", label:"Estimates & Invoices", icon:"📄",
      headline:"Proposals and invoices — built in.",
      desc:"Build professional line-item estimates and send invoices directly from your portal. No more Google Docs or separate billing software. Everything lives in one place.",
      mock: (
        <MockCard>
          <MockHeader>BuildConnect Pro — Invoice #INV-00142</MockHeader>
          <div style={{ padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:navy }}>Sandoval Electric</div>
                <div style={{ fontSize:11, color:"#888780" }}>National City, CA · C10-1049821</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em" }}>Invoice To</div>
                <div style={{ fontSize:12, fontWeight:700, color:"#2C2C2A" }}>Sarah Mitchell</div>
                <div style={{ fontSize:11, color:"#888780" }}>Chula Vista, CA</div>
              </div>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, marginBottom:12 }}>
              <thead>
                <tr style={{ background:"#F8F7F4" }}>
                  {["Description","Qty","Rate","Total"].map(h=>(
                    <th key={h} style={{ padding:"7px 10px", textAlign:h==="Total"||h==="Rate"?"right":"left", fontWeight:700, color:"#888780", fontSize:10, textTransform:"uppercase", letterSpacing:"0.05em", borderBottom:"1.5px solid #E8E6DF" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[["200A Panel Upgrade (labor)","1","$1,800","$1,800"],["Main breaker & breakers","1","$640","$640"],["Permit & inspection","1","$285","$285"]].map(([d,q,r,t])=>(
                  <tr key={d}>
                    <td style={{ padding:"8px 10px", color:"#2C2C2A", borderBottom:"1px solid #F1EFE8" }}>{d}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", color:"#888780", borderBottom:"1px solid #F1EFE8" }}>{q}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", color:"#888780", borderBottom:"1px solid #F1EFE8" }}>{r}</td>
                    <td style={{ padding:"8px 10px", textAlign:"right", fontWeight:600, color:"#2C2C2A", borderBottom:"1px solid #F1EFE8" }}>{t}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display:"flex", justifyContent:"flex-end" }}>
              <div style={{ background:navy, borderRadius:9, padding:"10px 20px", textAlign:"right" }}>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.6)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>Total Due</div>
                <div style={{ fontSize:22, fontWeight:900, color:"#fff" }}>$2,725</div>
              </div>
            </div>
          </div>
        </MockCard>
      )
    },
    {
      id:"projects", label:"Project Manager", icon:"🏗️",
      headline:"Track every active job end to end.",
      desc:"From 'bid accepted' to 'job complete' — manage crew notes, project stage, expenses, and job photos all in one place. Never lose track of where a job stands.",
      mock: (
        <MockCard>
          <MockHeader>BuildConnect Pro — Projects</MockHeader>
          <div style={{ padding:16 }}>
            {[
              { title:"200A Panel Upgrade", client:"Sarah Mitchell — Chula Vista", stage:"In Progress", pct:60, amount:"$2,725", color:navy },
              { title:"EV Charger Install", client:"James R. — Bonita", stage:"Not Started", pct:10, amount:"$950", color:"#854F0B" },
              { title:"Service Upgrade", client:"Linda T. — National City", stage:"Completed", pct:100, amount:"$3,100", color:green },
            ].map(p=>(
              <div key={p.title} style={{ border:"1.5px solid #E8E6DF", borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A", marginBottom:2 }}>{p.title}</div>
                    <div style={{ fontSize:11, color:"#888780" }}>{p.client}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:13, fontWeight:800, color:navy }}>{p.amount}</div>
                    <span style={{ fontSize:10, fontWeight:700, color:p.color, background:p.color==="#0F6E56"?"#E1F5EE":p.color==="#0C447C"?"#E6F1FB":"#FAEEDA", borderRadius:20, padding:"2px 8px" }}>{p.stage}</span>
                  </div>
                </div>
                <div style={{ background:"#F1EFE8", borderRadius:20, height:6, overflow:"hidden" }}>
                  <div style={{ width:`${p.pct}%`, height:"100%", background:p.color, borderRadius:20, transition:"width 0.3s" }} />
                </div>
              </div>
            ))}
          </div>
        </MockCard>
      )
    },
    {
      id:"messages", label:"Messages", icon:"💬",
      headline:"Direct messaging with every homeowner.",
      desc:"Message homeowners before, during, and after the job from inside your portal. All conversations are organized by project so nothing falls through the cracks.",
      mock: (
        <MockCard>
          <MockHeader>BuildConnect Pro — Messages</MockHeader>
          <div style={{ display:"flex", height:220 }}>
            {/* Thread list */}
            <div style={{ width:160, borderRight:"1.5px solid #E8E6DF", padding:"10px 0", overflowY:"auto" }}>
              {[["Sarah M.","Panel Upgrade","Just sent you a question","2m","true"],["James R.","EV Charger","Sounds great, see you Tue","1h","false"],["Linda T.","Service Upgrade","Invoice received, thanks!","3h","false"]].map(([n,p,msg,t,unread])=>(
                <div key={n} style={{ padding:"8px 12px", background:unread==="true"?"#E6F1FB":"transparent", borderLeft:unread==="true"?`3px solid ${navy}`:"3px solid transparent" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                    <div style={{ fontSize:12, fontWeight:unread==="true"?800:600, color:"#2C2C2A" }}>{n}</div>
                    <div style={{ fontSize:10, color:"#888780" }}>{t}</div>
                  </div>
                  <div style={{ fontSize:10, color:"#888780", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{msg}</div>
                </div>
              ))}
            </div>
            {/* Chat window */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", padding:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:navy, marginBottom:10, paddingBottom:8, borderBottom:"1px solid #F1EFE8" }}>Sarah M. — Panel Upgrade</div>
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                {[["Hi Mike, quick question — will you need to shut off power to the whole house?","client"],["Yes, we'll need about 4 hours of downtime. I'll coordinate with you the day before.","contractor"],["Perfect, that works for us. Any prep needed on our end?","client"]].map(([msg,from])=>(
                  <div key={msg} style={{ display:"flex", justifyContent:from==="contractor"?"flex-end":"flex-start" }}>
                    <div style={{ maxWidth:"75%", padding:"7px 11px", borderRadius:10, background:from==="contractor"?navy:"#F1EFE8", color:from==="contractor"?"#fff":"#2C2C2A", fontSize:11, lineHeight:1.5 }}>{msg}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <div style={{ flex:1, background:"#F8F7F4", borderRadius:8, padding:"7px 12px", fontSize:11, color:"#B4B2A9", border:"1.5px solid #E8E6DF" }}>Reply to Sarah...</div>
                <div style={{ padding:"7px 14px", borderRadius:8, background:navy, color:"#fff", fontSize:11, fontWeight:700 }}>Send</div>
              </div>
            </div>
          </div>
        </MockCard>
      )
    },
    {
      id:"profile", label:"Your Profile", icon:"👤",
      headline:"Your public profile. Your brand.",
      desc:"Build a professional profile that homeowners see when they browse contractors. Portfolio photos, verified credentials, reviews, and your bio — all in one place that you control.",
      mock: (
        <MockCard>
          <MockHeader>BuildConnect Pro — My Profile (Public View)</MockHeader>
          <div style={{ background:`linear-gradient(135deg, #082E56 0%, ${navy} 100%)`, padding:"20px 20px 0" }}>
            <div style={{ display:"flex", gap:14, alignItems:"center" }}>
              <div style={{ width:56, height:56, borderRadius:12, background:"#E6F1FB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:navy, border:"3px solid rgba(255,255,255,0.3)", flexShrink:0 }}>MS</div>
              <div>
                <div style={{ fontSize:16, fontWeight:900, color:"#fff" }}>Mike Sandoval</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", marginBottom:6 }}>Sandoval Electric · National City, CA</div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                  {["✓ Licensed","✓ Insured","✓ BG Checked"].map(b=>(
                    <span key={b} style={{ fontSize:10, fontWeight:700, color:"#B5F5D8", background:"rgba(15,110,86,0.3)", borderRadius:20, padding:"2px 8px" }}>{b}</span>
                  ))}
                </div>
              </div>
              <div style={{ marginLeft:"auto", textAlign:"right" }}>
                <div style={{ fontSize:18, fontWeight:900, color:amber }}>5.0</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)" }}>47 reviews</div>
              </div>
            </div>
            {/* Tabs */}
            <div style={{ display:"flex", gap:0, marginTop:14 }}>
              {["About","Portfolio","Reviews"].map((t,i)=>(
                <div key={t} style={{ padding:"7px 16px", fontSize:12, fontWeight:i===0?700:500, color:i===0?"#fff":"rgba(255,255,255,0.5)", borderBottom:i===0?`2px solid ${amber}`:"2px solid transparent", cursor:"pointer" }}>{t}</div>
              ))}
            </div>
          </div>
          <div style={{ padding:"14px 16px" }}>
            <div style={{ fontSize:12, color:"#5F5E5A", lineHeight:1.7, marginBottom:12 }}>San Diego native and C-10 licensed electrician specializing in panel upgrades, EV charger installation, and service upgrades. 22 years of clean, code-compliant work across South Bay.</div>
            <div style={{ display:"flex", gap:8 }}>
              <button type="button" style={{ flex:1, padding:"8px", borderRadius:8, border:"none", background:navy, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:font }}>Request a Bid &gt;</button>
              <button type="button" style={{ flex:1, padding:"8px", borderRadius:8, border:`1.5px solid #D3D1C7`, background:"#fff", color:"#2C2C2A", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:font }}>View Portfolio</button>
            </div>
          </div>
        </MockCard>
      )
    },
  ];

  return (
    <div style={{ fontFamily:font, background:"#082E56", minHeight:"100vh" }}>

      {/* Back nav */}
      <div style={{ padding:"20px 32px", borderBottom:"1px solid rgba(255,255,255,0.1)" }}>
        <button type="button" onClick={onBack}
          style={{ background:"none", border:"none", color:"rgba(255,255,255,0.55)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font, display:"flex", alignItems:"center", gap:6, padding:0 }}> ← Back to BuildConnect Pro
        </button>
      </div>

      {/* Hero */}
      <div style={{ padding:"60px 32px 52px", textAlign:"center", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize:10, fontWeight:700, color:amber, textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:14 }}>Contractor Portal Preview</div>
        <h1 style={{ fontSize:"clamp(30px,5vw,52px)", fontWeight:900, color:"#fff", letterSpacing:"-0.03em", lineHeight:1.1, marginBottom:16, maxWidth:720, margin:"0 auto 16px" }}>
          Everything you need to run your contracting business.
        </h1>
        <p style={{ fontSize:16, color:"rgba(255,255,255,0.6)", lineHeight:1.75, maxWidth:580, margin:"0 auto 32px" }}>
          Leads, bids, invoices, estimates, project tracking, expenses, scheduling, messaging, portfolio, reviews — all in one portal. Built for San Diego contractors.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <button type="button" onClick={onSignup}
            style={{ padding:"14px 32px", borderRadius:10, border:"none", background:amber, color:"#082E56", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:font }}>
            Join as a Contractor — Plans from Free
          </button>
          <button type="button" onClick={onViewPricing || onSignup}
            style={{ padding:"14px 24px", borderRadius:10, border:"1.5px solid rgba(255,255,255,0.25)", background:"transparent", color:"rgba(255,255,255,0.8)", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:font }}>
            View Pricing
          </button>
        </div>

        {/* Portal tab preview bar */}
        <div style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap", marginTop:36 }}>
          {features.map(f=>(
            <div key={f.id} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 16px", background:"rgba(255,255,255,0.07)", borderRadius:20, border:"1px solid rgba(255,255,255,0.12)", fontSize:13, color:"rgba(255,255,255,0.75)", fontWeight:500 }}>
              <span>{f.icon}</span> {f.label}
            </div>
          ))}
        </div>
      </div>

      {/* Feature sections */}
      {features.map((f, i) => (
        <div key={f.id} style={{ padding:"60px 32px", borderBottom:"1px solid rgba(255,255,255,0.06)", background: i%2===0?"transparent":"rgba(0,0,0,0.15)" }}>
          <div style={{ maxWidth:960, margin:"0 auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:48, alignItems:"center" }}>

            {/* Text — alternates left/right */}
            <div style={{ order: i%2===0 ? 0 : 1 }}>
              <PreviewSectionLabel>{f.icon} {f.label}</PreviewSectionLabel>
              <PreviewSectionTitle>{f.headline}</PreviewSectionTitle>
              <PreviewSectionDesc>{f.desc}</PreviewSectionDesc>
              <button type="button" onClick={onSignup}
                style={{ padding:"11px 24px", borderRadius:9, border:`1.5px solid rgba(255,255,255,0.25)`, background:"transparent", color:"rgba(255,255,255,0.8)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                Get Access &gt;
              </button>
            </div>

            {/* Mock UI */}
            <div style={{ order: i%2===0 ? 1 : 0 }}>
              {f.mock}
            </div>
          </div>
        </div>
      ))}

      {/* Bottom CTA */}
      <div style={{ padding:"72px 32px", textAlign:"center", background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)" }}>
        <div style={{ fontSize:10, fontWeight:700, color:amber, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:14 }}>Ready to get started?</div>
        <h2 style={{ fontSize:"clamp(26px,4vw,42px)", fontWeight:900, color:"#fff", letterSpacing:"-0.025em", marginBottom:14 }}>Stop paying for leads that go nowhere.</h2>
        <p style={{ fontSize:15, color:"rgba(255,255,255,0.6)", lineHeight:1.75, maxWidth:520, margin:"0 auto 32px" }}>
          Join the BuildConnect Pro network. Get quality leads, win more bids, and manage your entire business from one portal.
        </p>

        {/* Pricing reminder */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, maxWidth:640, margin:"0 auto 32px" }}>
          {[["Starter","Free forever","3 bids/month","5% commission per job"],["Professional","$89/month","Unlimited bids","3.5% commission per job"],["Elite","$199/month","Unlimited bids","0% commission — ever"]].map(([plan,price,bids,comm],i)=>(
            <div key={plan} style={{ background:i===2?"rgba(239,159,39,0.12)":"rgba(255,255,255,0.06)", border:i===2?`1.5px solid ${amber}`:"1px solid rgba(255,255,255,0.12)", borderRadius:12, padding:"16px 14px", textAlign:"center" }}>
              <div style={{ fontSize:11, fontWeight:700, color:i===2?amber:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{plan}</div>
              <div style={{ fontSize:20, fontWeight:900, color:"#fff", marginBottom:4 }}>{price}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginBottom:2 }}>{bids}</div>
              <div style={{ fontSize:11, fontWeight:700, color:i===2?amber:"rgba(255,255,255,0.45)" }}>{comm}</div>
            </div>
          ))}
        </div>

        <button type="button" onClick={onViewPricing || onSignup}
          style={{ padding:"15px 40px", borderRadius:10, border:"none", background:amber, color:"#082E56", fontSize:16, fontWeight:800, cursor:"pointer", fontFamily:font }}>
          Create Your Contractor Account &gt;
        </button>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:12 }}>Starter plan is free forever. No credit card required.</div>
      </div>
    </div>
  );
}

// — Shared top-level render helpers (moved out of components to prevent remounting) --
export const MockCard = ({ children, style={} }) => (
  <div style={{ background:"#fff", borderRadius:12, border:"1.5px solid #E8E6DF", overflow:"hidden", ...style }}>
    {children}
  </div>
);
export const MockHeader = ({ children }) => (
  <div style={{ background:"#F8F7F4", borderRadius:"12px 12px 0 0", padding:"10px 16px", borderBottom:"1.5px solid #E8E6DF", display:"flex", alignItems:"center", gap:6 }}>
    {["#EF9F27","#E8E6DF","#E8E6DF"].map((c,i)=><div key={i} style={{ width:9, height:9, borderRadius:"50%", background:c }} />)}
    <span style={{ fontSize:11, fontWeight:600, color:"#888780", marginLeft:6 }}>{children}</span>
  </div>
);
export const PreviewSectionLabel = ({ children }) => (
  <div style={{ fontSize:10, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>{children}</div>
);
export const PreviewSectionTitle = ({ children }) => (
  <h2 style={{ fontSize:"clamp(24px,3.5vw,36px)", fontWeight:900, color:"#fff", letterSpacing:"-0.025em", marginBottom:12, lineHeight:1.2 }}>{children}</h2>
);
export const PreviewSectionDesc = ({ children }) => (
  <p style={{ fontSize:15, color:"rgba(255,255,255,0.65)", lineHeight:1.75, marginBottom:28, maxWidth:480 }}>{children}</p>
);

export function SectionHeaderRow({ label, count, color }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
      <div style={{ fontSize:13, fontWeight:700, color, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
      <div style={{ flex:1, height:1, background:"#E8E6DF" }} />
      <span style={{ fontSize:12, color:"#888780" }}>{count} project{count!==1?"s":""}</span>
    </div>
  );
}

export function StarPickerWidget({ bidId, ratings, hovers, setRatings, setHovers }) {
  return (
    <div style={{ display:"flex", gap:6 }}>
      {[1,2,3,4,5].map(star => (
        <button key={star} type="button"
          onClick={()=>setRatings(r=>({...r,[bidId]:star}))}
          onMouseEnter={()=>setHovers(h=>({...h,[bidId]:star}))}
          onMouseLeave={()=>setHovers(h=>({...h,[bidId]:0}))}
          style={{ background:"none", border:"none", cursor:"pointer", padding:2, fontSize:32, lineHeight:1, transition:"transform 0.1s", transform:(hovers[bidId]||ratings[bidId])>=star?"scale(1.2)":"scale(1)" }}>
          <span style={{ color:(hovers[bidId]||ratings[bidId])>=star?"#EF9F27":"#D3D1C7" }}>★</span>
        </button>
      ))}
      {ratings[bidId] > 0 && (
        <span style={{ fontSize:14, color:"#5F5E5A", alignSelf:"center", marginLeft:4, fontWeight:600 }}>
          {["","Poor","Fair","Good","Great","Excellent!"][ratings[bidId]]}
        </span>
      )}
    </div>
  );
}

