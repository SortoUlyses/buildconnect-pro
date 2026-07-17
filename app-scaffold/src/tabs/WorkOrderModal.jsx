import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";

export function WorkOrderModal({ workOrder, role, onSign, onClose }) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const [fullName,  setFullName]  = useState("");
  const [agreed,    setAgreed]    = useState(false);
  const [signMode,  setSignMode]  = useState(null);
  const [dsLoading, setDsLoading] = useState(false);

  if (!workOrder) return null;
  const wo         = workOrder;
  const mySigned   = role === "homeowner" ? wo.homeownerSigned  : wo.contractorSigned;
  const theirSigned= role === "homeowner" ? wo.contractorSigned : wo.homeownerSigned;
  const myRole     = role === "homeowner" ? "Homeowner" : "Contractor";
  const theirRole  = role === "homeowner" ? "Contractor" : "Homeowner";
  const bothSigned = wo.homeownerSigned && wo.contractorSigned;
  const fmtDt = s => { if(!s) return "—"; const d=new Date(s); return isNaN(d)?s:d.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}); };
  const canPlatformSign = agreed && fullName.trim().length > 1;

  // TODO: replace with real DocuSign Supabase edge function call
  const launchDocuSign = async () => {
    setDsLoading(true);
    await new Promise(res => setTimeout(res, 1500));
    setDsLoading(false);
    setSignMode("ds_active");
  };

  const downloadPDF = () => {
    const rows = (wo.paymentSchedule||[]).map(p =>
      "<tr><td style=\"padding:9px 12px\">" + p.label + "</td>" +
      "<td style=\"padding:9px 12px;text-align:center\">" + p.pct + "%</td>" +
      "<td style=\"padding:9px 12px;text-align:right;font-weight:700\">" + fmt$(p.amount||0) + "</td></tr>"
    ).join("");
    const html = "<!DOCTYPE html><html><body style=\"font-family:sans-serif;padding:40px\">" +
      "<h2 style=\"color:#0C447C\">Work Order — " + wo.projectTitle + "</h2>" +
      "<p><strong>Contractor:</strong> " + wo.contractorName + " &amp; <strong>Homeowner:</strong> " + wo.homeownerName + "</p>" +
      "<p style=\"margin-top:12px\"><strong>Scope:</strong> " + wo.scope + "</p>" +
      "<p style=\"margin-top:12px\"><strong>Amount:</strong> " + fmt$(wo.amount) + " &nbsp; <strong>Start:</strong> " + fmtDt(wo.startDate) + " &nbsp; <strong>Timeline:</strong> " + (wo.timeline||"TBD") + "</p>" +
      "<table style=\"width:100%;margin-top:16px;border-collapse:collapse\"><thead><tr style=\"background:#0C447C\">" +
      "<th style=\"padding:9px 12px;color:#fff;text-align:left\">Milestone</th><th style=\"padding:9px 12px;color:#fff;text-align:center\">%</th><th style=\"padding:9px 12px;color:#fff;text-align:right\">Amount</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table>" +
      "<p style=\"margin-top:20px;font-size:11px;color:#888\">CA B&P Code §7159 requires a formal contract for projects over $500.</p>" +
      "<div style=\"text-align:center;margin-top:20px\"><button onclick=\"window.print()\" style=\"padding:12px 28px;background:#EF9F27;color:#082E56;border:none;border-radius:8px;font-size:14px;font-weight:800;cursor:pointer\">Print / Save PDF</button></div>" +
      "</body></html>";
    window.open(URL.createObjectURL(new Blob([html],{type:"text/html"})),"_blank");
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1200, padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:600, maxHeight:"92vh", overflowY:"auto", boxSizing:"border-box" }}>
        <div style={{ background:"linear-gradient(135deg,#082E56,#0C447C)", borderRadius:"18px 18px 0 0", padding:"22px 28px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}> 📋 Digital Work Order</div>
              <div style={{ fontSize:19, fontWeight:900, color:"#fff" }}>{wo.projectTitle}</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginTop:3 }}>{wo.trade} · Auto-generated from accepted bid</div>
            </div>
            <button onClick={onClose} type="button" style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"rgba(255,255,255,0.6)", padding:0 }}>✕</button>
          </div>
          {bothSigned && (
            <div style={{ marginTop:14, background:"rgba(15,110,86,0.25)", border:"1px solid rgba(181,245,216,0.4)", borderRadius:9, padding:"8px 14px", fontSize:12, fontWeight:700, color:"#B5F5D8" }}>
              ✓ Fully executed — both parties have signed
            </div>
          )}
        </div>
        <div style={{ padding:"22px 28px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:18 }}>
            <div style={{ background:"#F8F7F4", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#888780", textTransform:"uppercase", marginBottom:5 }}>Homeowner</div>
              <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{wo.homeownerName}</div>
              <div style={{ fontSize:11, color:"#888780" }}>{wo.city}, {wo.state}</div>
            </div>
            <div style={{ background:"#F8F7F4", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#888780", textTransform:"uppercase", marginBottom:5 }}>Contractor</div>
              <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{wo.contractorName}</div>
              <div style={{ fontSize:11, color:"#888780" }}>{wo.contractorCompany}</div>
            </div>
          </div>
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#0C447C", marginBottom:8 }}>Scope of Work</div>
            <div style={{ background:"#fff", border:"1.5px solid #E8E6DF", borderRadius:10, padding:"14px 16px", fontSize:13, color:"#2C2C2A", lineHeight:1.7, maxHeight:120, overflowY:"auto" }}>{wo.scope}</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:18 }}>
            <div style={{ background:"#E6F1FB", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#185FA5", textTransform:"uppercase", marginBottom:4 }}>Contract Amount</div>
              <div style={{ fontSize:16, fontWeight:900, color:"#185FA5" }}>{fmt$(wo.amount)}</div>
            </div>
            <div style={{ background:"#FAEEDA", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#854F0B", textTransform:"uppercase", marginBottom:4 }}>Projected Start</div>
              <div style={{ fontSize:13, fontWeight:800, color:"#854F0B" }}>{fmtDt(wo.startDate)}</div>
            </div>
            <div style={{ background:"#E1F5EE", borderRadius:10, padding:"12px 14px" }}>
              <div style={{ fontSize:9, fontWeight:700, color:"#0F6E56", textTransform:"uppercase", marginBottom:4 }}>Timeline</div>
              <div style={{ fontSize:13, fontWeight:800, color:"#0F6E56" }}>{wo.timeline||"TBD"}</div>
            </div>
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#0C447C", marginBottom:8 }}>Payment Schedule</div>
            <div style={{ border:"1.5px solid #E8E6DF", borderRadius:10, overflow:"hidden" }}>
              {(wo.paymentSchedule||[]).map((p,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderTop:i>0?"1px solid #F1EFE8":"none", background:i%2===0?"#fff":"#FAFAF8" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#2C2C2A" }}>{p.label}</div>
                    <div style={{ fontSize:11, color:"#888780" }}>{p.pct}% of total</div>
                  </div>
                  <div style={{ fontSize:15, fontWeight:800, color:"#0C447C" }}>{fmt$(p.amount)}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
            {[
              { label:"Homeowner Signature", signed:wo.homeownerSigned, name:wo.homeownerSignedName, date:wo.homeownerSignedAt },
              { label:"Contractor Signature", signed:wo.contractorSigned, name:wo.contractorSignedName, date:wo.contractorSignedAt },
            ].map(sig => (
              <div key={sig.label} style={{ background:sig.signed?"#E1F5EE":"#F8F7F4", border:"1.5px solid "+(sig.signed?"#B5F5D8":"#E8E6DF"), borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:9, fontWeight:700, color:"#888780", textTransform:"uppercase", marginBottom:5 }}>{sig.label}</div>
                {sig.signed
                  ? <div><div style={{ fontSize:14, fontWeight:700, color:"#0F6E56", fontStyle:"italic" }}>{sig.name}</div><div style={{ fontSize:10, color:"#888780", marginTop:2 }}>✓ Signed {fmtDt(sig.date)}</div></div>
                  : <div style={{ fontSize:12, color:"#B4B2A9" }}>Awaiting signature</div>}
              </div>
            ))}
          </div>

          {mySigned ? (
            <div style={{ background:"#E1F5EE", border:"1.5px solid #B5F5D8", borderRadius:12, padding:"14px 18px", marginBottom:16, textAlign:"center" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#0F6E56" }}>✓ You have signed this work order</div>
              {!theirSigned && <div style={{ fontSize:12, color:"#5F5E5A", marginTop:4 }}>Waiting on {role==="homeowner"?wo.contractorName:wo.homeownerName} ({theirRole}) to sign.</div>}
            </div>
          ) : signMode === null ? (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#2C2C2A", marginBottom:12, textAlign:"center" }}>How would you like to sign?</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <button type="button" onClick={launchDocuSign}
                  style={{ padding:"16px 14px", borderRadius:12, border:"2px solid #1A73C7", background:"#fff", cursor:"pointer", fontFamily:font, textAlign:"center" }}>
                  <div style={{ fontSize:20, fontWeight:900, marginBottom:6 }}>
                    <span style={{ color:"#FFB900" }}>docu</span><span style={{ color:"#1A73C7" }}>sign</span>
                  </div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#1A73C7", marginBottom:3 }}>Sign with DocuSign</div>
                  <div style={{ fontSize:10, color:"#888780", lineHeight:1.4 }}>Industry-standard legal e-signature with audit trail.</div>
                </button>
                <button type="button" onClick={()=>setSignMode("platform")}
                  style={{ padding:"16px 14px", borderRadius:12, border:"1.5px solid #D3D1C7", background:"#fff", cursor:"pointer", fontFamily:font, textAlign:"center" }}>
                  <div style={{ fontSize:20, marginBottom:6 }}></div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#2C2C2A", marginBottom:3 }}>Sign within BuildConnect Pro</div>
                  <div style={{ fontSize:10, color:"#888780", lineHeight:1.4 }}>Quick digital confirmation stored in your account.</div>
                </button>
              </div>
            </div>
          ) : dsLoading ? (
            <div style={{ background:"#F0F7FF", border:"2px solid #1A73C7", borderRadius:12, padding:"24px 20px", textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:20, fontWeight:900, color:"#1A73C7", marginBottom:8 }}>
                <span style={{ color:"#FFB900" }}>docu</span><span>sign</span>
              </div>
              <div style={{ fontSize:13, color:"#1A73C7", fontWeight:600 }}>Preparing your signing session...</div>
              <div style={{ fontSize:11, color:"#888780", marginTop:4 }}>Generating secure document envelope</div>
            </div>
          ) : signMode === "ds_active" ? (
            <div style={{ border:"2px solid #1A73C7", borderRadius:12, overflow:"hidden", marginBottom:16 }}>
              <div style={{ background:"#1A73C7", padding:"10px 16px", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:14, fontWeight:900, color:"#FFB900" }}>docu</span>
                <span style={{ fontSize:14, fontWeight:900, color:"#fff" }}>sign</span>
                <span style={{ fontSize:11, color:"rgba(255,255,255,0.7)", marginLeft:8 }}>Secure Signing Session</span>
              </div>
              <div style={{ background:"#F8F9FA", padding:"18px" }}>
                <div style={{ background:"#fff", border:"1px solid #D3D1C7", borderRadius:8, padding:"14px", marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#888780", marginBottom:6 }}>BuildConnect Pro Work Order — {wo.projectTitle}</div>
                  <div style={{ fontSize:13, color:"#2C2C2A", marginBottom:8 }}>{wo.contractorName} &amp; {wo.homeownerName} · {fmt$(wo.amount)}</div>
                  <div style={{ display:"flex", gap:6 }}>
                    <span style={{ fontSize:10, fontWeight:700, color:"#0F6E56", background:"#E1F5EE", borderRadius:20, padding:"2px 9px" }}>✓ Verified</span>
                    <span style={{ fontSize:10, fontWeight:700, color:"#185FA5", background:"#E6F1FB", borderRadius:20, padding:"2px 9px" }}>Tamper-sealed</span>
                    <span style={{ fontSize:10, fontWeight:700, color:"#854F0B", background:"#FAEEDA", borderRadius:20, padding:"2px 9px" }}>Audit trail</span>
                  </div>
                </div>
                <div style={{ fontSize:11, color:"#1A73C7", fontWeight:700, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ background:"#FFB900", color:"#fff", borderRadius:"50%", width:18, height:18, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:900 }}>{">"}</span>
                  Sign Here — {myRole}
                </div>
                <input type="text" value={fullName} onChange={e=>setFullName(e.target.value)}
                  placeholder="Type your full legal name to sign"
                  style={{ width:"100%", padding:"10px 12px", borderRadius:7, border:"2px solid #1A73C7", fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box", marginBottom:8 }} />
                <div style={{ fontSize:10, color:"#888780", marginBottom:14 }}>By clicking Sign Document you agree that your electronic signature is the legal equivalent of your handwritten signature on this work order.</div>
                <button type="button" onClick={()=>{ onSign(fullName.trim()||myRole); setSignMode("done"); }} disabled={!fullName.trim()}
                  style={{ display:"block", width:"100%", padding:"13px", borderRadius:9, border:"none", background:fullName.trim()?"#1A73C7":"#D3D1C7", color:"#fff", fontSize:14, fontWeight:800, cursor:fullName.trim()?"pointer":"not-allowed", fontFamily:font, marginBottom:8 }}>
                  Sign Document
                </button>
                <button type="button" onClick={()=>setSignMode(null)}
                  style={{ display:"block", width:"100%", padding:"9px", borderRadius:9, border:"1.5px solid #D3D1C7", background:"transparent", color:"#888780", fontSize:12, cursor:"pointer", fontFamily:font }}>
                  ← Choose a different signing method
                </button>
              </div>
            </div>
          ) : signMode === "platform" ? (
            <div style={{ background:"#FFF8EC", border:"1.5px solid #EF9F27", borderRadius:12, padding:"16px 18px", marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#854F0B", marginBottom:10 }}>Sign as {myRole} — BuildConnect Pro</div>
              <input type="text" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Type your full legal name"
                style={{ width:"100%", padding:"10px 14px", borderRadius:9, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box", marginBottom:12 }} />
              <label style={{ display:"flex", alignItems:"flex-start", gap:10, cursor:"pointer", marginBottom:14 }}>
                <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ width:18, height:18, marginTop:1, accentColor:"#0C447C", flexShrink:0 }} />
                <span style={{ fontSize:12, color:"#2C2C2A", lineHeight:1.6 }}>I have reviewed the scope of work, contract amount, projected start date, and payment schedule, and I agree to these terms as the {myRole.toLowerCase()} on this project.</span>
              </label>
              <button type="button" onClick={()=>{ if(canPlatformSign) onSign(fullName.trim()); }} disabled={!canPlatformSign}
                style={{ display:"block", width:"100%", padding:"13px", borderRadius:10, border:"none", background:canPlatformSign?"#0F6E56":"#D3D1C7", color:"#fff", fontSize:14, fontWeight:800, cursor:canPlatformSign?"pointer":"not-allowed", fontFamily:font, marginBottom:8 }}>
                ✓ Sign Work Order
              </button>
              <button type="button" onClick={()=>setSignMode(null)}
                style={{ display:"block", width:"100%", padding:"9px", borderRadius:9, border:"1.5px solid #D3D1C7", background:"transparent", color:"#888780", fontSize:12, cursor:"pointer", fontFamily:font }}>
                ← Go back
              </button>
            </div>
          ) : null}

          <button type="button" onClick={downloadPDF}
            style={{ display:"block", width:"100%", padding:"11px", borderRadius:9, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font, marginBottom:10 }}>
            ⬇ Download as PDF
          </button>
          <div style={{ fontSize:10, color:"#B4B2A9", lineHeight:1.6, textAlign:"center" }}>
            California B&P Code §7159 requires a formal contract for projects over $500. DocuSign requires backend activation by your developer.
          </div>
        </div>
      </div>
    </div>
  );
}


