import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { MaintenanceClock } from "./MaintenanceClock.jsx";

export function MyHomeRecord({ leads, bids, projects, reviews, consumerProfile, onNavigate }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const [homeTab, setHomeTab] = useState("record");

  const records = (leads || []).map(lead => {
    const acceptedBid = (bids || []).find(b => b.leadId === lead.id && b.status === "accepted");
    if (!acceptedBid) return null;
    const proj  = projects?.[acceptedBid.id];
    const stage = proj?.stage;
    return {
      id:          lead.id,
      title:       lead.projectTitle || lead.trade,
      trade:       lead.trade,
      contractor:  acceptedBid.company || "Contractor",
      amount:      Number(acceptedBid.amount) || 0,
      completedOn: proj?.completedDate || "",
      startDate:   proj?.startDate || "",
      isVerified:  stage === "completed",
      isInProgress:stage && stage !== "completed",
      bidId:       acceptedBid.id,
    };
  }).filter(Boolean);

  const verified    = records.filter(r => r.isVerified);
  const inProgress  = records.filter(r => r.isInProgress);
  const totalInvested = verified.reduce((s, r) => s + r.amount, 0);
  const fmtDate = s => { if (!s) return "—"; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" }); };

  // — PDF Generator ---------------------------------------------------------
  const generatePDF = () => {
    const now = new Date().toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
    const recordId = "BCP-" + Date.now().toString().slice(-8).toUpperCase();

    const rows = verified.map((r, i) => `
      <tr style="background:${i%2===0?"#fff":"#F8F7F4"}">
        <td style="padding:13px 16px;border-bottom:1px solid #E8E6DF">
          <div style="font-weight:700;color:#0C447C;margin-bottom:3px">${r.title}</div>
          <div style="font-size:12px;color:#888780">${r.trade}</div>
        </td>
        <td style="padding:13px 16px;border-bottom:1px solid #E8E6DF;font-size:13px;color:#2C2C2A">${r.contractor}</td>
        <td style="padding:13px 16px;border-bottom:1px solid #E8E6DF;font-size:14px;font-weight:800;color:#0C447C;text-align:right">${fmt$(r.amount)}</td>
        <td style="padding:13px 16px;border-bottom:1px solid #E8E6DF;font-size:13px;color:#2C2C2A">${fmtDate(r.completedOn)}</td>
        <td style="padding:13px 16px;border-bottom:1px solid #E8E6DF;text-align:center">
          <span style="background:#E1F5EE;color:#0F6E56;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px">✓ Verified</span>
        </td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>BuildConnect Pro — Verified Home Record ${recordId}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2C2C2A;background:#fff}
  @media print{.no-print{display:none!important};body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head><body>

<div style="background:linear-gradient(135deg,#082E56 0%,#0C447C 100%);padding:40px 48px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="width:42px;height:42px;background:#185FA5;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:900;color:#FAEEDA">BC</div>
        <div style="font-size:17px;font-weight:900;color:#fff">BuildConnect Pro</div>
      </div>
      <div style="font-size:30px;font-weight:900;color:#fff;letter-spacing:-0.03em;margin-bottom:6px">Verified Home Record</div>
      <div style="font-size:15px;color:rgba(255,255,255,0.65)">Property of ${consumerProfile?.name || "Homeowner"}</div>
    </div>
    <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:16px 20px;text-align:right">
      <div style="font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Record ID</div>
      <div style="font-size:15px;font-weight:700;color:#EF9F27;font-family:monospace;letter-spacing:0.05em">${recordId}</div>
      <div style="font-size:9px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-top:10px;margin-bottom:4px">Generated</div>
      <div style="font-size:13px;font-weight:600;color:#fff">${now}</div>
    </div>
  </div>
</div>

<div style="background:#F8F7F4;border-bottom:2px solid #E8E6DF;padding:0;display:flex">
  ${[["Projects Verified", String(verified.length)],["Total Invested", fmt$(totalInvested)],["Record Status","v Active & Verified"],["Issued To", consumerProfile?.name||"Homeowner"]]
    .map(([l,v],i)=>`<div style="flex:1;padding:18px 24px${i>0?";border-left:1.5px solid #D3D1C7":""}"><div style="font-size:10px;font-weight:700;color:#888780;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px">${l}</div><div style="font-size:17px;font-weight:900;color:#0C447C">${v}</div></div>`).join("")}
</div>

<div style="padding:24px 48px;border-bottom:1.5px solid #E8E6DF">
  <div style="background:#E6F1FB;border:1.5px solid #B5D4F4;border-radius:10px;padding:16px 20px">
    <div style="font-size:12px;font-weight:700;color:#0C447C;margin-bottom:6px"> About This Document</div>
    <div style="font-size:13px;color:#2C2C2A;line-height:1.75">This Verified Home Record documents all improvement projects completed through BuildConnect Pro. Each entry has been verified through a three-party confirmation process: the homeowner submitted the project, a licensed contractor performed and completed the work, and completion was confirmed within the BuildConnect Pro platform. This document may be presented to prospective buyers, real estate agents, insurance providers, appraisers, or lenders as evidence of verified home improvements made to this property.</div>
  </div>
</div>

<div style="padding:32px 48px">
  <div style="font-size:18px;font-weight:800;color:#0C447C;margin-bottom:4px">Verified Project History</div>
  <div style="font-size:13px;color:#888780;margin-bottom:20px">${verified.length} verified project${verified.length!==1?"s":""} · All amounts reflect the final accepted contractor bid</div>

  ${verified.length === 0
    ? `<div style="text-align:center;padding:48px;border:2px dashed #D3D1C7;border-radius:12px;color:#888780;font-size:14px">No verified projects on record yet.</div>`
    : `<table style="width:100%;border-collapse:collapse;border:1.5px solid #E8E6DF;border-radius:10px;overflow:hidden;font-family:inherit">
      <thead><tr style="background:#0C447C">
        <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.07em">Project &amp; Trade</th>
        <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.07em">Contractor</th>
        <th style="padding:12px 16px;text-align:right;font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.07em">Amount</th>
        <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.07em">Completed</th>
        <th style="padding:12px 16px;text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.07em">Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#F8F7F4;border-top:2px solid #D3D1C7">
        <td colspan="2" style="padding:16px;font-size:14px;font-weight:700;color:#2C2C2A">Total Verified Investment</td>
        <td style="padding:16px;text-align:right;font-size:22px;font-weight:900;color:#0C447C">${fmt$(totalInvested)}</td>
        <td colspan="2"></td>
      </tr></tfoot>
    </table>`}
</div>

<div style="padding:24px 48px;background:#F8F7F4;border-top:1.5px solid #E8E6DF">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:32px">
    <div style="font-size:11px;color:#888780;line-height:1.75;flex:1">
      BuildConnect Pro certifies that the projects listed above were submitted by the property owner, performed by the listed contractor, and verified as complete within the BuildConnect Pro platform. Contractor license numbers are on file and verified at onboarding. This document does not constitute a warranty of workmanship or guarantee of contractor quality beyond what is represented in BuildConnect Pro platform reviews. <strong>Record ID ${recordId} · Generated ${now} · buildconnectpro.com</strong>
    </div>
    <div style="text-align:center;flex-shrink:0">
      <div style="width:52px;height:52px;background:#0C447C;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#FAEEDA;margin:0 auto 6px">BC</div>
      <div style="font-size:10px;color:#888780;font-weight:700">BuildConnect Pro</div>
      <div style="font-size:9px;color:#B4B2A9">buildconnectpro.com</div>
    </div>
  </div>
</div>

<div class="no-print" style="padding:20px 48px;background:#0C447C;text-align:center">
  <button onclick="window.print()" style="padding:13px 36px;background:#EF9F27;color:#082E56;border:none;border-radius:9px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;margin-right:12px">print 🖨 Print / Save PDF</button>
  <button onclick="window.close()" style="padding:13px 24px;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);border-radius:9px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Close</button>
</div>

</body></html>`;

    const blob = new Blob([html], { type:"text/html" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  // — UI --------------------------------------------------------------------
  return (
    <div style={{ fontFamily:font }}>

      {/* Hero header */}
      <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", borderRadius:16, padding:"30px 32px", marginBottom:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16, marginBottom:22 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8 }}>home My Home</div>
            <h2 style={{ fontSize:26, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", margin:"0 0 8px" }}>
              {homeTab==="record" ? "Verified Home Record" : "Maintenance Clock"}
            </h2>
            <p style={{ fontSize:14, color:"rgba(255,255,255,0.65)", maxWidth:480, lineHeight:1.7, margin:0 }}>
              {homeTab==="record"
                ? "A permanent, verified record of every improvement made to your property — yours to share with buyers, realtors, or insurers."
                : "Your personal maintenance calendar, built automatically from your completed projects. Never get caught off guard by a system failure again."}
            </p>
          </div>
          {homeTab==="record" && verified.length > 0 && (
            <button type="button" onClick={generatePDF}
              style={{ padding:"13px 24px", borderRadius:10, border:"none", background:"#EF9F27", color:"#082E56", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:font, flexShrink:0, display:"flex", alignItems:"center", gap:8, alignSelf:"flex-start" }}>
              Download Download Record PDF
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderRadius:10, overflow:"hidden", gap:1, background:"rgba(255,255,255,0.08)" }}>
          {[
            ["Verified Projects", verified.length,            "#EF9F27"],
            ["In Progress",       inProgress.length,          "rgba(255,255,255,0.7)"],
            ["Total Invested",    fmt$(totalInvested),        "#EF9F27"],
            ["Status",            verified.length>0?"✓ Active":"Pending", verified.length>0?"#B5F5D8":"rgba(255,255,255,0.45)"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ padding:"14px 18px", background:"rgba(0,0,0,0.2)" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.45)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:5 }}>{label}</div>
              <div style={{ fontSize:20, fontWeight:900, color }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Tab switcher — inside header so it bleeds into content */}
        <div style={{ display:"flex", gap:6, marginTop:18 }}>
          {[
            { id:"record",  label:" Home Record",      desc:"Verified project history" },
            { id:"clock",   label:" Maintenance Clock",    desc:"Maintenance calendar" },
          ].map(t=>(
            <button key={t.id} type="button" onClick={()=>setHomeTab(t.id)}
              style={{ padding:"9px 20px", borderRadius:"9px 9px 0 0", border:"none", background:homeTab===t.id?"#fff":"rgba(255,255,255,0.12)", color:homeTab===t.id?"#0C447C":"rgba(255,255,255,0.7)", fontSize:13, fontWeight:homeTab===t.id?700:500, cursor:"pointer", fontFamily:font }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ background:"#fff", borderRadius:"0 12px 12px 12px", border:"1.5px solid #D3D1C7", padding:"24px", marginBottom:20 }}>

      {homeTab==="record" && (<>

      {/* Empty state */}
      {records.length === 0 && (
        <div style={{ textAlign:"center", padding:"64px 24px", background:"#F8F7F4", borderRadius:14, border:"1.5px solid #E8E6DF" }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🏠</div>
          <h3 style={{ fontSize:20, fontWeight:800, color:"#0C447C", marginBottom:10, letterSpacing:"-0.01em" }}>Your home record starts here</h3>
          <p style={{ fontSize:14, color:"#5F5E5A", lineHeight:1.75, maxWidth:460, margin:"0 auto 24px" }}>
            Every project you complete through BuildConnect Pro becomes a permanent verified entry. Over time this document proves everything you've invested in your property — and helps you sell it for more.
          </p>
          <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap", marginBottom:28 }}>
            {["Roof replacement","HVAC upgrade","Kitchen remodel","Electrical panel","Bathroom remodel","Pool installation"].map(ex=>(
              <span key={ex} style={{ fontSize:12, fontWeight:600, color:"#185FA5", background:"#E6F1FB", borderRadius:20, padding:"5px 14px" }}>{ex}</span>
            ))}
          </div>
        </div>
      )}

      {/* Verified projects table */}
      {verified.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#0F6E56", textTransform:"uppercase", letterSpacing:"0.07em" }}>✓ Verified Projects</div>
            <div style={{ flex:1, height:1, background:"#E8E6DF" }} />
            <span style={{ fontSize:12, color:"#888780" }}>{verified.length} project{verified.length!==1?"s":""} · {fmt$(totalInvested)} total</span>
          </div>

          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", overflow:"hidden" }}>
            {/* Column headers */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 1fr 1fr 100px", background:"#0C447C", padding:"11px 20px", gap:12 }}>
              {["Project","Contractor","Amount","Completed","Status"].map(h=>(
                <div key={h} style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.65)", textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</div>
              ))}
            </div>

            {verified.map((r, i) => (
              <div key={r.id} style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 1fr 1fr 100px", padding:"16px 20px", gap:12, alignItems:"center", borderBottom:i<verified.length-1?"1px solid #F1EFE8":"none", background:i%2===0?"#fff":"#FAFAF8" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:4 }}>{r.title}</div>
                  <span style={{ fontSize:10, fontWeight:600, color:TRADES[r.trade]?.color||"#0C447C", background:TRADES[r.trade]?.bg||"#E6F1FB", borderRadius:20, padding:"2px 9px" }}>{r.trade}</span>
                </div>
                <div style={{ fontSize:13, color:"#2C2C2A", fontWeight:500 }}>{r.contractor}</div>
                <div style={{ fontSize:16, fontWeight:900, color:"#0C447C" }}>{fmt$(r.amount)}</div>
                <div style={{ fontSize:12, color:"#5F5E5A" }}>{fmtDate(r.completedOn) || "—"}</div>
                <span style={{ fontSize:11, fontWeight:700, color:"#0F6E56", background:"#E1F5EE", borderRadius:20, padding:"4px 12px", textAlign:"center", display:"block" }}>✓ Verified</span>
              </div>
            ))}

            {/* Total */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1.5fr 1fr 1fr 100px", padding:"14px 20px", gap:12, alignItems:"center", background:"#F8F7F4", borderTop:"2px solid #E8E6DF" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A", gridColumn:"1/3" }}>Total Property Investment</div>
              <div style={{ fontSize:22, fontWeight:900, color:"#0C447C" }}>{fmt$(totalInvested)}</div>
              <div /><div />
            </div>
          </div>
        </div>
      )}

      {/* In progress */}
      {inProgress.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.07em" }}> In Progress</div>
            <div style={{ flex:1, height:1, background:"#E8E6DF" }} />
            <span style={{ fontSize:12, color:"#888780" }}>Appears as verified once complete</span>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {inProgress.map(r => (
              <div key={r.id} style={{ background:"#fff", border:"1.5px solid #E8E6DF", borderRadius:12, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:4 }}>{r.title}</div>
                  <div style={{ fontSize:13, color:"#5F5E5A" }}>{r.contractor} · {r.trade}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:16, fontWeight:800, color:"#2C2C2A", marginBottom:5 }}>{fmt$(r.amount)}</div>
                  <span style={{ fontSize:11, fontWeight:700, color:"#185FA5", background:"#E6F1FB", borderRadius:20, padding:"3px 12px" }}>In Progress</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What it means for your home value */}
      {verified.length > 0 && (
        <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", borderRadius:14, padding:"26px 28px" }}>
          <div style={{ fontSize:16, fontWeight:800, color:"#fff", marginBottom:8 }}> What this means for your home value</div>
          <p style={{ fontSize:13, color:"rgba(255,255,255,0.7)", lineHeight:1.8, marginBottom:18 }}>
            Documented, verified improvements increase buyer confidence and can directly impact your sale price. Homes with verified improvement histories sell for 2-5% more and spend fewer days on market. Your BuildConnect Pro Verified Home Record is transferable — share it with any realtor or buyer as proof of your investment.
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            {["Present to prospective buyers","Share with your real estate agent","Submit to your insurance company","Include in your home appraisal"].map(use=>(
              <div key={use} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"rgba(255,255,255,0.8)" }}>
                <span style={{ color:"#EF9F27", fontWeight:700, flexShrink:0 }}>✓</span>{use}
              </div>
            ))}
          </div>
        </div>
      )}

      </>)}

      {/* — LOYALTY CLOCK TAB — */}
      {homeTab==="clock" && (
        <MaintenanceClock records={records} onNavigate={onNavigate} />
      )}

      </div>{/* end tab content wrapper */}
    </div>
  );
}

