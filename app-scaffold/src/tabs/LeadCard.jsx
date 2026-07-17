import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { WorkOrderModal } from "./WorkOrderModal.jsx";
import { MATCHED_CONTRACTORS } from "../demoData.js";

export function LeadCard({ lead, bids, onBid, contractorMode, onAcceptBid, onDeclineBid, estimates, setEstimates, onMessageLead, saved, onToggleSave, onMessageBid, projects, reviews, setReviews, profile, onViewContractorProfile, workOrders, onSignWorkOrder }) {
  const [expanded, setExpanded] = useState(false);
  const [bidForm, setBidForm] = useState({
    timeline:"", message:"",
    company: profile?.company || "",
    contact: profile?.phone || profile?.email || ""
  });
  const [bidding, setBidding] = useState(false);
  const [bidSubmitted, setBidSubmitted] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [estItems, setEstItems] = useState([{ id:uid(), desc:"", qty:1, rate:"" }]);
  const [estNotes, setEstNotes] = useState("");
  const [estSubmitted, setEstSubmitted] = useState(false);
  const [viewEstId, setViewEstId] = useState(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [confirmDeclineId, setConfirmDeclineId] = useState(null);
  const [openWorkOrderId, setOpenWorkOrderId] = useState(null);
  const trade = TRADES[lead.trade] || {};
  const leadBids = bids.filter(b => b.leadId === lead.id);

  // Estimate attached to this lead (contractor-created, consumer-visible)
  const leadEstimate = estimates ? estimates.find(e => e.leadId === lead.id) : null;

  const submitBid = () => {
    if (!bidForm.timeline || !bidForm.message || !bidForm.company || !bidForm.contact) {
      alert("Please complete all bid fields."); return;
    }
    // Require at least one valid line item
    const validItems = estItems.filter(i => i.desc.trim() && i.rate);
    if (validItems.length === 0) {
      alert("Please add at least one line item to your estimate. Homeowners need to understand what they're paying for."); return;
    }
    // The bid amount is simply the cost breakdown total — no separate entry
    const bidAmount = estTotal(validItems);
    // Save the estimate first
    const est = {
      id: uid(),
      leadId: lead.id,
      number: `EST-${Date.now().toString().slice(-5)}`,
      client: lead.name || "",
      email: lead.email || "",
      project: lead.projectTitle || "",
      date: new Date().toISOString().slice(0,10),
      expires: "",
      status: "sent",
      notes: estNotes,
      items: estItems,
    };
    if (typeof setEstimates === "function") {
      setEstimates(prev => { const u = [est,...prev]; save(S.estimates,u); return u; });
    }
    // Then submit the bid
    onBid({ ...bidForm, amount: bidAmount, leadId: lead.id });
    setBidSubmitted(true); setBidding(false);
  };

  const submitEstimate = () => {
    if (estItems.every(i => !i.desc && !i.rate)) { alert("Please add at least one line item."); return; }
    const est = {
      id: uid(),
      leadId: lead.id,
      number: `EST-${Date.now().toString().slice(-5)}`,
      client: lead.name || "",
      email: lead.email || "",
      project: lead.projectTitle || "",
      date: new Date().toISOString().slice(0,10),
      expires: "",
      status: "sent",
      notes: estNotes,
      items: estItems,
    };
    if (typeof setEstimates === "function") {
      setEstimates(prev => { const u = [est, ...prev]; save(S.estimates, u); return u; });
    }
    setEstimating(false);
    setEstSubmitted(true);
  };

  const estTotal = items => items.reduce((s,i) => s + (Number(i.qty) * Number(i.rate) || 0), 0);
  const setItem = (id, key, val) => setEstItems(prev => prev.map(i => i.id === id ? { ...i, [key]: val } : i));
  const addItem = () => setEstItems(prev => [...prev, { id:uid(), desc:"", qty:1, rate:"" }]);
  const removeItem = id => setEstItems(prev => prev.filter(i => i.id !== id));

  return (
    <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:12, overflow:"hidden", marginBottom:14 }}>
      <div style={{ padding:"16px 20px", cursor:"pointer" }} onClick={() => setExpanded(e=>!e)}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, flex:1 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:trade.bg||"#F1EFE8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{trade.icon||""}</div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                <span style={{ fontSize:15, fontWeight:700, color:"#2C2C2A" }}>{lead.projectTitle}</span>
                <Badge text={lead.status === "awarded" ? "Awarded" : "Open for Bids"} color={lead.status==="awarded"?"#185FA5":"#0F6E56"} bg={lead.status==="awarded"?"#E6F1FB":"#E1F5EE"} />
                {leadEstimate && <Badge text=" Estimate Attached" color="#534AB7" bg="#EEEDFE" />}
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                <Badge text={lead.trade} color={trade.color||"#5F5E5A"} bg={trade.bg||"#F1EFE8"} />
                <Badge text={lead.propertyType} color={lead.propertyType==="Commercial"?"#854F0B":"#0F6E56"} bg={lead.propertyType==="Commercial"?"#FAEEDA":"#E1F5EE"} />
                <span style={{ fontSize:12, color:"#2C2C2A" }}>📍 {lead.city}, {lead.state}</span>
                <span style={{ fontSize:12, color:"#2C2C2A" }}> {timeAgo(lead.createdAt)}</span>
              </div>
            </div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#185FA5" }}>{lead.budget}</div>
            <div style={{ fontSize:12, color:"#2C2C2A" }}>{leadBids.length} bid{leadBids.length!==1?"s":""}</div>
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop:"1px solid #F1EFE8", padding:"16px 20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
            {[["⚡ Urgency",lead.urgency||"—"],["📐 Size",lead.sqft?`${lead.sqft} sq ft`:"—"],["💵 Budget",lead.budget||"—"]].map(([k,v])=>(
              <div key={k} style={{ background:"#F1EFE8", borderRadius:8, padding:"10px 12px" }}>
                <div style={{ fontSize:11, color:"#2C2C2A", marginBottom:2, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.04em" }}>{k}</div>
                <div style={{ fontSize:13, fontWeight:600, color:"#2C2C2A" }}>{v}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize:14, color:"#2C2C2A", lineHeight:1.6, marginBottom:14 }}>{lead.description}</p>

          {/* — Contractor: bid + estimate buttons — */}
          {contractorMode && !bidSubmitted && lead.status==="open" && !estimating && (
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom: bidding ? 0 : 0 }}>
              {!bidding && <Btn onClick={()=>{ setBidding(true); }} variant="primary"> Place Bid</Btn>}
              {!bidding && (estSubmitted || leadEstimate) && <Badge text="Estimate Attached" color="#534AB7" bg="#EEEDFE" />}
              {!bidding && onToggleSave && (
                <Btn onClick={()=>onToggleSave(lead.id)} variant={saved ? "success" : "ghost"}>
                  {saved ? "Saved" : "Save"}
                </Btn>
              )}
              {!bidding && onMessageLead && <Btn onClick={()=>onMessageLead(lead)} variant="ghost">Message Client</Btn>}
            </div>
          )}

          {/* — Unified bid + estimate form — */}
          {contractorMode && !bidSubmitted && lead.status==="open" && bidding && (
            <div style={{ background:"#F1EFE8", borderRadius:10, padding:16, marginTop:10 }}>
              <div style={{ fontSize:15, fontWeight:800, color:"#0C447C", marginBottom:4 }}>Submit Your Bid</div>
              <p style={{ fontSize:12, color:"#5F5E5A", marginBottom:14, lineHeight:1.5 }}>
                A detailed cost breakdown is <strong>required</strong> with every bid — homeowners need to understand exactly what they're paying for. Bids with itemized estimates win more jobs.
              </p>

              {/* Bid details */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                <Field label="Company" value={bidForm.company} onChange={v=>setBidForm(f=>({...f,company:v}))} placeholder="ABC Construction" required />
                <Field label="Contact" value={bidForm.contact} onChange={v=>setBidForm(f=>({...f,contact:v}))} placeholder="email or phone" required />
                <Field label="Timeline" value={bidForm.timeline} onChange={v=>setBidForm(f=>({...f,timeline:v}))} placeholder="3 weeks" required />
              </div>
              <Field label="Proposal Notes" value={bidForm.message} onChange={v=>setBidForm(f=>({...f,message:v}))} as="textarea" rows={3} placeholder="Describe your approach, experience, and what sets you apart..." required />

              {/* Estimate builder — required */}
              <div style={{ marginTop:14, paddingTop:14, borderTop:"2px dashed #D3D1C7" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:"#0C447C" }}> Cost Breakdown</div>
                  <span style={{ fontSize:10, fontWeight:700, color:"#A32D2D", background:"#FCEBEB", borderRadius:20, padding:"2px 8px", letterSpacing:"0.04em" }}>REQUIRED</span>
                </div>
                <p style={{ fontSize:12, color:"#5F5E5A", marginBottom:12, lineHeight:1.5 }}>
                  Break down your costs by line item — labor, materials, permits, etc. This becomes the estimate the homeowner sees alongside your bid.
                </p>

                <div style={{ overflowX:"auto", borderRadius:10, border:"1.5px solid #D3D1C7", marginBottom:10, background:"#fff" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", minWidth:380 }}>
                    <thead>
                      <tr style={{ background:"#F8F7F4" }}>
                        <th style={{ padding:"9px 12px", textAlign:"left", fontSize:10, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1.5px solid #D3D1C7" }}>Description</th>
                        <th style={{ padding:"9px 12px", textAlign:"center", fontSize:10, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1.5px solid #D3D1C7", width:70 }}>Qty</th>
                        <th style={{ padding:"9px 12px", textAlign:"right", fontSize:10, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1.5px solid #D3D1C7", width:100 }}>Rate ($)</th>
                        <th style={{ padding:"9px 12px", textAlign:"right", fontSize:10, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1.5px solid #D3D1C7", width:100 }}>Total</th>
                        <th style={{ width:36, borderBottom:"1.5px solid #D3D1C7" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {estItems.map((item, idx) => (
                        <tr key={item.id} style={{ borderTop:idx>0?"1px solid #F1EFE8":"none" }}>
                          <td style={{ padding:0 }}>
                            <input value={item.desc} onChange={e=>setItem(item.id,"desc",e.target.value)} placeholder="Labor, materials, permit..."
                              style={{ border:"none", padding:"10px 12px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", background:"transparent" }} />
                          </td>
                          <td style={{ padding:0, borderLeft:"1px solid #F1EFE8" }}>
                            <input type="number" value={item.qty} onChange={e=>setItem(item.id,"qty",e.target.value)}
                              style={{ border:"none", padding:"10px 12px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", textAlign:"center", background:"transparent" }} />
                          </td>
                          <td style={{ padding:0, borderLeft:"1px solid #F1EFE8" }}>
                            <input type="number" value={item.rate} onChange={e=>setItem(item.id,"rate",e.target.value)} placeholder="0.00"
                              style={{ border:"none", padding:"10px 12px", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box", textAlign:"right", background:"transparent" }} />
                          </td>
                          <td style={{ padding:"10px 12px", textAlign:"right", fontSize:13, fontWeight:600, color:"#2C2C2A", borderLeft:"1px solid #F1EFE8", whiteSpace:"nowrap" }}>
                            {fmt$(Number(item.qty)*Number(item.rate)||0)}
                          </td>
                          <td style={{ padding:"6px", borderLeft:"1px solid #F1EFE8", textAlign:"center" }}>
                            <button type="button" onClick={()=>removeItem(item.id)} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:"#A32D2D", lineHeight:1 }}>✕</button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={5} style={{ padding:"8px 12px", borderTop:"1px solid #F1EFE8" }}>
                          <button type="button" onClick={addItem} style={{ background:"none", border:"none", fontSize:13, color:"#185FA5", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>+ Add Line Item</button>
                        </td>
                      </tr>
                      <tr style={{ background:"#0C447C" }}>
                        <td colSpan={3} style={{ padding:"11px 14px", fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.75)", textAlign:"right", textTransform:"uppercase", letterSpacing:"0.06em" }}>
                          Your Bid Amount
                        </td>
                        <td style={{ padding:"11px 14px", textAlign:"right", fontSize:18, fontWeight:900, color:"#fff", whiteSpace:"nowrap" }}>{fmt$(estTotal(estItems))}</td>
                        <td style={{ background:"#0C447C" }}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <Field label="Notes (optional)" value={estNotes} onChange={setEstNotes} as="textarea" rows={2} placeholder="Assumptions, exclusions, payment terms, validity period..." />
              </div>

              <div style={{ display:"flex", gap:10, marginTop:14 }}>
                <Btn onClick={submitBid} variant="success">Submit Bid & Estimate</Btn>
                <Btn onClick={()=>setBidding(false)} variant="ghost">Cancel</Btn>
              </div>
            </div>
          )}

          {/* Estimate builder is now integrated into the bid form above */}

          {bidSubmitted && contractorMode && <div style={{ background:"#E1F5EE", borderRadius:8, padding:"12px 16px", fontSize:14, color:"#0F6E56", fontWeight:700, marginTop:10 }}>✓ Bid submitted!</div>}
          {estSubmitted && contractorMode && <div style={{ background:"#EEEDFE", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#534AB7", fontWeight:700, marginTop:8 }}> Estimate sent to client!</div>}

          {/* — Bids list (both sides) — */}
          {leadBids.length > 0 && (
            <div style={{ marginTop:16 }}>
              <SectionTitle>📋 Bids ({leadBids.length})</SectionTitle>
              {leadBids.map(bid => {
                const bidEst = estimates ? estimates.find(e => e.leadId === lead.id) : null;
                const showingEst = viewEstId === bid.id;
                return (
                  <div key={bid.id} style={{ background:"#fff", border: bid.status==="accepted"?"2px solid #0F6E56":"1.5px solid #D3D1C7", borderRadius:10, padding:"12px 14px", marginBottom:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                        <span style={{ fontSize:14, fontWeight:700 }}>{bid.company}</span>
                        {!contractorMode && (() => {
                          const matched = MATCHED_CONTRACTORS.find(c =>
                            c.company.toLowerCase().includes((bid.company||"").toLowerCase().split(" ")[0]) ||
                            (bid.company||"").toLowerCase().includes(c.company.toLowerCase().split(" ")[0]) ||
                            c.name.toLowerCase().includes((bid.contact||"").toLowerCase().split(" ")[0])
                          );
                          return matched ? (<>
                            {matched.rating && <span style={{ fontSize:12, color:"#854F0B" }}>⭐ {matched.rating} ({matched.reviewCount} reviews)</span>}
                            {matched.responseTime && <span style={{ fontSize:12, color:"#0F6E56" }}>⚡ {matched.responseTime}</span>}
                            {onViewContractorProfile && <button type="button" onClick={()=>onViewContractorProfile(matched)} style={{ fontSize:11, color:"#185FA5", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:600, padding:0, textDecoration:"underline" }}>View Profile</button>}
                          </>) : null;
                        })()}
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontSize:16, fontWeight:800, color:"#0F6E56" }}>${Number(bid.amount).toLocaleString()}</span>
                        <Badge text={bid.status} color={bid.status==="accepted"?"#0F6E56":bid.status==="declined"?"#A32D2D":"#854F0B"} bg={bid.status==="accepted"?"#E1F5EE":bid.status==="declined"?"#FCEBEB":"#FAEEDA"} />
                      </div>
                    </div>
                    <p style={{ fontSize:13, color:"#2C2C2A", margin:"0 0 8px", lineHeight:1.5 }}>{bid.message}</p>

                    {/* — 📋 Digital Work Order banner (accepted bids, both roles) — */}
                    {bid.status === "accepted" && workOrders && workOrders[bid.id] && (() => {
                      const wo = workOrders[bid.id];
                      const role = contractorMode ? "contractor" : "homeowner";
                      const mySigned = role === "homeowner" ? wo.homeownerSigned : wo.contractorSigned;
                      const bothSigned = wo.homeownerSigned && wo.contractorSigned;
                      return (
                        <div style={{
                          background: bothSigned ? "#E1F5EE" : mySigned ? "#E6F1FB" : "#FFF8EC",
                          border:`1.5px solid ${bothSigned?"#B5F5D8":mySigned?"#B5D4F4":"#EF9F27"}`,
                          borderRadius:10, padding:"11px 14px", margin:"0 0 10px",
                          display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10
                        }}>
                          <div>
                            <div style={{ fontSize:12, fontWeight:800, color: bothSigned?"#0F6E56":mySigned?"#185FA5":"#854F0B" }}>
                              {bothSigned ? "✓ Work order fully signed" : mySigned ? "✓ You signed — waiting on the other party" : " 📋 Digital Work Order ready to review"}
                            </div>
                            <div style={{ fontSize:11, color:"#5F5E5A", marginTop:2 }}>
                              {bothSigned ? "Scope, payment schedule, and start date are confirmed by both parties." : "Review the scope of work, payment schedule, and start date, then sign."}
                            </div>
                          </div>
                          <button type="button" onClick={()=>setOpenWorkOrderId(bid.id)}
                            style={{ padding:"8px 16px", borderRadius:8, border:"none", background: bothSigned?"#0F6E56":mySigned?"#185FA5":"#EF9F27", color: bothSigned||mySigned?"#fff":"#082E56", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                            {mySigned ? "View Work Order" : "Review & Sign ->"}
                          </button>
                        </div>
                      );
                    })()}

                    {/* — Project progress tracker (consumer only, accepted bids) — */}
                    {!contractorMode && bid.status === "accepted" && (() => {
                      const proj = projects?.[bid.id];
                      const stage = proj?.stage || "not_started";
                      const STAGES = ["not_started","in_progress","on_hold","completed"];
                      const currentIdx = STAGES.indexOf(stage);
                      const stageInfo = PROJECT_STAGES[stage] || PROJECT_STAGES.not_started;
                      const STAGE_ICONS = { not_started:"", in_progress:"", on_hold:"", completed:"v" };
                      return (
                        <div style={{ background:"#F8F7F4", borderRadius:10, padding:"14px 16px", margin:"10px 0 10px", border:"1.5px solid #E8E6DF" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                            <span style={{ fontSize:12, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em" }}>Project Status</span>
                            <span style={{ fontSize:12, fontWeight:700, color:stageInfo.color, background:stageInfo.bg, borderRadius:20, padding:"3px 10px" }}>
                              {STAGE_ICONS[stage]} {stageInfo.label}
                            </span>
                          </div>

                          {/* Progress bar steps */}
                          <div style={{ display:"flex", alignItems:"center", gap:0 }}>
                            {STAGES.filter(s => s !== "on_hold").map((s, i, arr) => {
                              const sInfo = PROJECT_STAGES[s];
                              const isCurrent = s === stage || (stage === "on_hold" && s === "in_progress");
                              const isDone = STAGES.indexOf(s) < currentIdx && stage !== "on_hold";
                              const isOnHold = stage === "on_hold";
                              return (
                                <div key={s} style={{ display:"flex", alignItems:"center", flex: i < arr.length-1 ? 1 : "none" }}>
                                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                                    <div style={{
                                      width:28, height:28, borderRadius:"50%", flexShrink:0,
                                      display:"flex", alignItems:"center", justifyContent:"center",
                                      background: isDone ? "#0F6E56" : isCurrent && !isOnHold ? sInfo.color : isCurrent && isOnHold ? "#854F0B" : "#E8E6DF",
                                      border: isCurrent ? `2px solid ${isOnHold?"#854F0B":sInfo.color}` : "2px solid transparent",
                                      fontSize:11, fontWeight:800, color:"#fff",
                                      boxShadow: isCurrent ? `0 0 0 3px ${isOnHold?"rgba(133,79,11,0.15)":sInfo.color+"26"}` : "none",
                                      transition:"all 0.3s"
                                    }}>
                                      {isDone ? "v" : i+1}
                                    </div>
                                    <span style={{ fontSize:10, fontWeight: isCurrent?700:500, color: isCurrent?(isOnHold?"#854F0B":sInfo.color):"#B4B2A9", whiteSpace:"nowrap", letterSpacing:"0.01em" }}>
                                      {sInfo.label}{isOnHold && isCurrent ? " (Hold)" : ""}
                                    </span>
                                  </div>
                                  {i < arr.length-1 && (
                                    <div style={{ flex:1, height:3, background: isDone?"#0F6E56":"#E8E6DF", borderRadius:2, margin:"0 6px", marginBottom:18, transition:"background 0.3s" }} />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* On hold note */}
                          {stage === "on_hold" && (
                            <div style={{ marginTop:10, fontSize:12, color:"#854F0B", background:"#FAEEDA", borderRadius:7, padding:"7px 11px", lineHeight:1.5 }}>
                               Your contractor has paused this project. Message them for an update.
                            </div>
                          )}

                          {/* Dates if set */}
                          {(proj?.startDate || proj?.targetDate) && (
                            <div style={{ display:"flex", gap:16, marginTop:10, paddingTop:10, borderTop:"1px solid #E8E6DF" }}>
                              {proj.startDate && <div style={{ fontSize:11, color:"#888780" }}>Started: <strong style={{ color:"#2C2C2A" }}>{proj.startDate}</strong></div>}
                              {proj.targetDate && <div style={{ fontSize:11, color:"#888780" }}>Est. completion: <strong style={{ color:"#2C2C2A" }}>{proj.targetDate}</strong></div>}
                            </div>
                          )}

                          {/* — Review prompt (completed projects only) — */}
                          {stage === "completed" && setReviews && (() => {
                            const alreadyReviewed = (reviews||[]).some(r => r.bidId === bid.id);
                            if (alreadyReviewed || reviewSubmitted) return (
                              <div style={{ marginTop:10, background:"#E1F5EE", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#0F6E56", fontWeight:600 }}>
                                v Thanks for your review — it helps your community find great contractors.
                              </div>
                            );
                            return (
                              <div style={{ marginTop:12 }}>
                                {!reviewOpen ? (
                                  <button type="button" onClick={()=>setReviewOpen(true)}
                                    style={{ width:"100%", padding:"12px 16px", borderRadius:10, border:"2px dashed #EF9F27", background:"#FFFBF2", cursor:"pointer", fontFamily:"inherit", textAlign:"left", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                                    <div>
                                      <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:2 }}>
                                        How did it go? Leave {bid.company || "the contractor"} a review.
                                      </div>
                                      <div style={{ fontSize:12, color:"#888780" }}>Takes 30 seconds · Helps other homeowners in San Diego</div>
                                    </div>
                                    <span style={{ fontSize:22, marginLeft:12 }}>★</span>
                                  </button>
                                ) : (
                                  <div style={{ background:"#FFFBF2", border:"2px solid #EF9F27", borderRadius:12, padding:"18px 18px 16px" }}>
                                    <div style={{ fontSize:15, fontWeight:800, color:"#2C2C2A", marginBottom:4 }}>
                                      Leave a review for {bid.company || "your contractor"}
                                    </div>
                                    <div style={{ fontSize:12, color:"#888780", marginBottom:14 }}>Re: {lead.projectTitle}</div>

                                    {/* Star picker */}
                                    <div style={{ marginBottom:14 }}>
                                      <div style={{ fontSize:11, fontWeight:700, color:"#444441", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Your Rating</div>
                                      <div style={{ display:"flex", gap:6 }}>
                                        {[1,2,3,4,5].map(star => (
                                          <button key={star} type="button"
                                            onClick={()=>setReviewRating(star)}
                                            onMouseEnter={()=>setReviewHover(star)}
                                            onMouseLeave={()=>setReviewHover(0)}
                                            style={{ background:"none", border:"none", cursor:"pointer", padding:2, fontSize:28, lineHeight:1, transition:"transform 0.1s", transform: (reviewHover||reviewRating)>=star?"scale(1.15)":"scale(1)" }}>
                                            <span style={{ color:(reviewHover||reviewRating)>=star?"#EF9F27":"#D3D1C7" }}>★</span>
                                          </button>
                                        ))}
                                        {reviewRating > 0 && (
                                          <span style={{ fontSize:13, color:"#5F5E5A", alignSelf:"center", marginLeft:6 }}>
                                            {["","Poor","Fair","Good","Great","Excellent!"][reviewRating]}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Text */}
                                    <div style={{ marginBottom:14 }}>
                                      <div style={{ fontSize:11, fontWeight:700, color:"#444441", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Your Experience</div>
                                      <textarea
                                        value={reviewText}
                                        onChange={e=>setReviewText(e.target.value)}
                                        placeholder={`Tell others about your experience with ${bid.company||"this contractor"}. What went well? Anything to be aware of?`}
                                        rows={3}
                                        style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", outline:"none", resize:"none", lineHeight:1.6, boxSizing:"border-box" }}
                                      />
                                    </div>

                                    <div style={{ display:"flex", gap:8 }}>
                                      <button type="button"
                                        onClick={()=>{
                                          if (!reviewRating) return;
                                          const rev = {
                                            id: uid(),
                                            bidId: bid.id,
                                            name: lead.name || "Homeowner",
                                            project: lead.projectTitle || lead.trade,
                                            rating: reviewRating,
                                            text: reviewText.trim() || `Great ${lead.trade} work.`,
                                            date: new Date().toISOString().slice(0,10),
                                            response: ""
                                          };
                                          setReviews(prev=>{ const u=[...prev,rev]; save(S.reviews,u); return u; });
                                          setReviewSubmitted(true);
                                          setReviewOpen(false);
                                        }}
                                        disabled={!reviewRating}
                                        style={{ flex:1, padding:"11px", borderRadius:9, border:"none", background:reviewRating?"#0F6E56":"#D3D1C7", color:"#fff", fontSize:14, fontWeight:700, cursor:reviewRating?"pointer":"not-allowed", fontFamily:"inherit" }}>
                                        Submit Review
                                      </button>
                                      <button type="button" onClick={()=>setReviewOpen(false)}
                                        style={{ padding:"11px 18px", borderRadius:9, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                      <span style={{ fontSize:12, color:"#2C2C2A" }}> {bid.timeline}</span>
                      <div style={{ display:"flex", gap:8 }}>
                        {bidEst && (
                          <Btn onClick={()=>setViewEstId(showingEst ? null : bid.id)} variant="ghost" small>
                             {showingEst ? "Hide Estimate" : "View Estimate"}
                          </Btn>
                        )}
                        {!contractorMode && onMessageBid && (
                          <Btn onClick={()=>onMessageBid(lead, bid)} variant="ghost" small> Message</Btn>
                        )}
                        {!contractorMode && bid.status==="pending" && (
                          <>
                            <Btn onClick={() => onAcceptBid(bid.id, lead.id)} variant="success" small>✓ Accept</Btn>
                            {onDeclineBid && (
                              <Btn onClick={() => setConfirmDeclineId(bid.id)} variant="danger" small>x Decline</Btn>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* — Inline estimate breakdown — */}
                    {showingEst && bidEst && (
                      <div style={{ marginTop:14, borderTop:"1px solid #F1EFE8", paddingTop:14 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                          <div style={{ fontSize:13, fontWeight:800, color:"#534AB7" }}> Estimate {bidEst.number}</div>
                          <div style={{ fontSize:11, color:"#888780" }}>Issued {bidEst.date || "—"}</div>
                        </div>

                        {/* Scrollable table wrapper */}
                        <div style={{ overflowX:"auto", borderRadius:10, border:"1.5px solid #D3D1C7", marginBottom:14 }}>
                          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:360 }}>
                            <thead>
                              <tr style={{ background:"#F8F7F4" }}>
                                <th style={{ padding:"9px 14px", textAlign:"left", fontSize:10, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1.5px solid #D3D1C7" }}>Description</th>
                                <th style={{ padding:"9px 14px", textAlign:"center", fontSize:10, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1.5px solid #D3D1C7", width:60 }}>Qty</th>
                                <th style={{ padding:"9px 14px", textAlign:"right", fontSize:10, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1.5px solid #D3D1C7", width:90 }}>Rate</th>
                                <th style={{ padding:"9px 14px", textAlign:"right", fontSize:10, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1.5px solid #D3D1C7", width:90 }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bidEst.items.filter(i => i.desc || i.rate).map((item, idx, arr) => (
                                <tr key={idx} style={{ background: idx%2===0?"#fff":"#FAFAF8" }}>
                                  <td style={{ padding:"10px 14px", fontSize:13, color:"#2C2C2A", borderBottom: idx<arr.length-1?"1px solid #F1EFE8":"none", lineHeight:1.5 }}>{item.desc || "—"}</td>
                                  <td style={{ padding:"10px 14px", textAlign:"center", fontSize:13, color:"#2C2C2A", borderBottom: idx<arr.length-1?"1px solid #F1EFE8":"none" }}>{item.qty}</td>
                                  <td style={{ padding:"10px 14px", textAlign:"right", fontSize:13, color:"#2C2C2A", borderBottom: idx<arr.length-1?"1px solid #F1EFE8":"none", whiteSpace:"nowrap" }}>{fmt$(item.rate)}</td>
                                  <td style={{ padding:"10px 14px", textAlign:"right", fontSize:13, fontWeight:600, color:"#2C2C2A", borderBottom: idx<arr.length-1?"1px solid #F1EFE8":"none", whiteSpace:"nowrap" }}>{fmt$(Number(item.qty)*Number(item.rate)||0)}</td>
                                </tr>
                              ))}
                              {/* Total row */}
                              <tr style={{ background:"#0C447C" }}>
                                <td colSpan={3} style={{ padding:"11px 14px", fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.75)", textAlign:"right", letterSpacing:"0.04em", textTransform:"uppercase" }}>Estimated Total</td>
                                <td style={{ padding:"11px 14px", textAlign:"right", fontSize:16, fontWeight:900, color:"#fff", whiteSpace:"nowrap" }}>{fmt$(bidEst.items.reduce((s,i)=>s+(Number(i.qty)*Number(i.rate)||0),0))}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {bidEst.notes && (
                          <div style={{ background:"#F8F7F4", borderRadius:8, padding:"10px 14px", border:"1px solid #E8E6DF" }}>
                            <div style={{ fontSize:10, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:5 }}>Notes</div>
                            <p style={{ fontSize:13, color:"#2C2C2A", lineHeight:1.65, margin:0 }}>{bidEst.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

        {/* — Decline confirmation modal — */}
        {confirmDeclineId && (() => {
          const declineBidObj = leadBids.find(b => b.id === confirmDeclineId);
          if (!declineBidObj) return null;
          const amt = parseFloat(declineBidObj.amount) || 0;
          return (
            <div onClick={()=>setConfirmDeclineId(null)}
              style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100, padding:20 }}>
              <div onClick={e=>e.stopPropagation()}
                style={{ background:"#fff", borderRadius:16, padding:28, width:"100%", maxWidth:420, boxSizing:"border-box" }}>
                <div style={{ fontSize:38, marginBottom:14, textAlign:"center" }}>!</div>
                <div style={{ fontSize:17, fontWeight:800, color:"#2C2C2A", textAlign:"center", marginBottom:8 }}>
                  Decline this bid?
                </div>
                <p style={{ fontSize:14, color:"#5F5E5A", textAlign:"center", lineHeight:1.65, marginBottom:18 }}>
                  You're about to decline <strong style={{ color:"#2C2C2A" }}>{declineBidObj.contact || declineBidObj.company || "this contractor"}</strong>'s bid of <strong style={{ color:"#2C2C2A" }}>{fmt$(amt)}</strong>. This can't be undone — once declined, the contractor won't be able to revise this offer and it disappears from your comparison.
                </p>
                <div style={{ display:"flex", gap:10 }}>
                  <button type="button" onClick={()=>setConfirmDeclineId(null)}
                    style={{ flex:1, padding:"12px", borderRadius:10, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    Keep Reviewing
                  </button>
                  <button type="button" onClick={()=>{ onDeclineBid(confirmDeclineId); setConfirmDeclineId(null); }}
                    style={{ flex:1, padding:"12px", borderRadius:10, border:"none", background:"#A32D2D", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    Yes, Decline
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* — 📋 Digital Work Order modal — */}
        {openWorkOrderId && workOrders && workOrders[openWorkOrderId] && (
          <WorkOrderModal
            workOrder={workOrders[openWorkOrderId]}
            role={contractorMode ? "contractor" : "homeowner"}
            onSign={(fullName) => { if (onSignWorkOrder) onSignWorkOrder(openWorkOrderId, contractorMode?"contractor":"homeowner", fullName); }}
            onClose={()=>setOpenWorkOrderId(null)}
          />
        )}
    </div>
  );
}

