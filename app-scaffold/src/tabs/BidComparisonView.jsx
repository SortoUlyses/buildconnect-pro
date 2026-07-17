import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { MATCHED_CONTRACTORS } from "../demoData.js";

export function BidComparisonView({ lead, bids, onAccept, onBack, onMessage, onViewProfile }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const [viewMode, setViewMode] = useState("table"); // "table" | "cards"
  const pendingBids = bids.filter(b => b.leadId === lead.id && b.status !== "declined");
  const amounts = pendingBids.map(b => parseFloat(b.amount)||0).filter(a=>a>0);
  const lowestAmount = amounts.length ? Math.min(...amounts) : null;

  const fmt = v => {
    const n = parseFloat(v);
    if (!n) return "—";
    return "$" + n.toLocaleString("en-US", { minimumFractionDigits:0, maximumFractionDigits:0 });
  };

  const matchedProfile = (bid) =>
    MATCHED_CONTRACTORS.find(c =>
      c.name.toLowerCase().includes((bid.contact||"").toLowerCase().split(" ")[0]) ||
      (bid.company||"").toLowerCase().includes(c.company.toLowerCase().split(" ")[0])
    );

  const tagStyle = (bg, color) => ({
    display:"inline-block", fontSize:10, fontWeight:700, color,
    background:bg, borderRadius:20, padding:"3px 9px", letterSpacing:"0.04em"
  });

  // — Best Value calculation --------------------------------------------------
  // Score = normalized rating (0-1) minus normalized price position (0-1), weighted.
  // Highest-rated contractor among the lowest-priced cluster wins.
  const bidScores = pendingBids.map(bid => {
    const amount  = parseFloat(bid.amount) || 0;
    const profile = matchedProfile(bid);
    const rating  = profile?.rating || 0;
    const reviewCount = profile?.reviewCount || 0;
    return { bid, profile, amount, rating, reviewCount };
  });
  const validAmounts = bidScores.map(s=>s.amount).filter(a=>a>0);
  const minAmt = validAmounts.length ? Math.min(...validAmounts) : 0;
  const maxAmt = validAmounts.length ? Math.max(...validAmounts) : 0;
  const range  = maxAmt - minAmt || 1;

  let bestValueId = null;
  if (bidScores.length > 1 && bidScores.some(s=>s.rating>0)) {
    const scored = bidScores.map(s => {
      const priceScore  = s.amount > 0 ? 1 - ((s.amount - minAmt) / range) : 0; // 1 = cheapest
      const ratingScore = s.rating / 5; // 0-1
      // Weight: 55% rating, 45% price — favors quality but rewards good value
      const composite = (ratingScore * 0.55) + (priceScore * 0.45);
      return { ...s, composite };
    });
    scored.sort((a,b) => b.composite - a.composite);
    bestValueId = scored[0]?.bid.id;
  }

  return (
    <div style={{ fontFamily:font, minHeight:"100vh", background:"#F8F7F4" }}>

      {/* Header */}
      <div style={{ background:"#0C447C", padding:"20px 32px" }}>
        <div style={{ maxWidth:1040, margin:"0 auto" }}>
          <button type="button" onClick={onBack}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,0.7)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font, display:"flex", alignItems:"center", gap:6, marginBottom:16, padding:0 }}
            onMouseEnter={e=>e.currentTarget.style.color="#fff"}
            onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.7)"}>
            Back to My Projects
          </button>
          <div style={{ fontSize:11, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Bid Comparison</div>
          <h1 style={{ fontSize:24, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 }}>{lead.projectTitle || "Your Project"}</h1>
          <p style={{ fontSize:14, color:"rgba(255,255,255,0.65)" }}>
            {pendingBids.length} bid{pendingBids.length!==1?"s":""} received · {lead.trade} · {lead.city}, {lead.state} · Review and accept the one that\'s right for you
          </p>
        </div>
      </div>

      {/* No bids state */}
      {pendingBids.length === 0 && (
        <div style={{ maxWidth:1040, margin:"40px auto", padding:"0 16px", textAlign:"center" }}>
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", padding:"60px 24px" }}>
            <p style={{ fontSize:16, color:"#5F5E5A", marginBottom:16 }}>No bids have been received on this project yet.</p>
            <p style={{ fontSize:13, color:"#888780" }}>Check back soon — contractors in your area are reviewing your submission.</p>
          </div>
        </div>
      )}

      {/* Comparison columns */}
      {pendingBids.length > 0 && (
        <div style={{ maxWidth:1040, margin:"0 auto", padding:"28px 16px 60px" }}>

          {/* Best Value recommendation */}
          {bestValueId && (() => {
            const best = bidScores.find(s=>s.bid.id===bestValueId);
            const bestBid = best.bid;
            const isAlreadyAccepted = bestBid.status === "accepted";
            return (
              <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", borderRadius:14, padding:"18px 24px", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ fontSize:28 }}></div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:3 }}>🏆 Our Recommendation — Best Value</div>
                    <div style={{ fontSize:16, fontWeight:800, color:"#fff" }}>{bestBid.contact || bestBid.company || "Contractor"}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", marginTop:2 }}>
                      {best.rating > 0 ? `${best.rating.toFixed(1)}* rating` : "Strong bid"} {best.reviewCount > 0 ? `(${best.reviewCount} reviews)` : ""} · {fmt(best.amount)}
                      {best.amount === lowestAmount ? " · Lowest price" : " · Best rating-to-price balance"}
                    </div>
                  </div>
                </div>
                {!isAlreadyAccepted && (
                  <button type="button" onClick={() => onAccept(bestBid.id, lead.id)}
                    style={{ padding:"11px 22px", borderRadius:9, border:"none", background:"#EF9F27", color:"#082E56", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:font, whiteSpace:"nowrap" }}>
                    Accept This Bid &gt;
                  </button>
                )}
              </div>
            );
          })()}

          {/* View toggle */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:12 }}>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#5F5E5A" }}>
                <span style={tagStyle("#E1F5EE","#0F6E56")}>Lowest Price</span>
                <span>= best bid value</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#5F5E5A" }}>
                <span style={tagStyle("#FAEEDA","#854F0B")}> Best Value</span>
                <span>= our recommendation</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:0, borderRadius:9, border:"1.5px solid #D3D1C7", overflow:"hidden" }}>
              <button type="button" onClick={()=>setViewMode("table")}
                style={{ padding:"8px 16px", border:"none", background:viewMode==="table"?"#0C447C":"#fff", color:viewMode==="table"?"#fff":"#2C2C2A", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:font }}>
                = Table
              </button>
              <button type="button" onClick={()=>setViewMode("cards")}
                style={{ padding:"8px 16px", border:"none", background:viewMode==="cards"?"#0C447C":"#fff", color:viewMode==="cards"?"#fff":"#2C2C2A", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:font }}>
                # Cards
              </button>
            </div>
          </div>

          {/* — TABLE VIEW — */}
          {viewMode === "table" && (
            <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", overflow:"hidden", marginBottom:20 }}>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:760 }}>
                  <thead>
                    <tr style={{ background:"#0C447C" }}>
                      {["Contractor","Rating","License & Insurance","Years in Business","Timeline","Bid Amount",""].map(h=>(
                        <th key={h} style={{ padding:"12px 16px", textAlign:h==="Bid Amount"?"right":"left", fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.7)", textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bidScores.map((s, idx) => {
                      const { bid, profile, amount, rating, reviewCount } = s;
                      const isLowest = lowestAmount && amount === lowestAmount && amounts.filter(a=>a===lowestAmount).length===1;
                      const isBest = bid.id === bestValueId;
                      const isAccepted = bid.status === "accepted";
                      return (
                        <tr key={bid.id} style={{
                          background: isAccepted ? "#E1F5EE" : isBest ? "#FFF8EC" : idx%2===0 ? "#fff" : "#FAFAF8",
                          borderTop:"1px solid #F1EFE8",
                          borderLeft: isBest ? "4px solid #EF9F27" : "4px solid transparent",
                        }}>
                          {/* Contractor */}
                          <td style={{ padding:"14px 16px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                              {profile ? (
                                <div style={{ width:34, height:34, borderRadius:8, background:profile.avatarBg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:profile.avatarColor, flexShrink:0 }}>{profile.initials}</div>
                              ) : (
                                <div style={{ width:34, height:34, borderRadius:8, background:"#E6F1FB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:"#0C447C", flexShrink:0 }}>{(bid.company||"??").slice(0,2).toUpperCase()}</div>
                              )}
                              <div>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <span style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{bid.contact || bid.company || "Contractor"}</span>
                                  {isBest && <span style={{ fontSize:13 }}></span>}
                                </div>
                                <div style={{ fontSize:11, color:"#888780" }}>{bid.company || ""}</div>
                                {profile && onViewProfile && (
                                  <button type="button" onClick={()=>onViewProfile(profile)}
                                    style={{ fontSize:10, color:"#185FA5", background:"none", border:"none", cursor:"pointer", fontFamily:font, fontWeight:600, padding:0, textDecoration:"underline" }}>
                                    View Profile &gt;
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          {/* Rating */}
                          <td style={{ padding:"14px 16px" }}>
                            {rating > 0 ? (
                              <div>
                                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                                  <span style={{ color:"#EF9F27", fontSize:13 }}>★</span>
                                  <span style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{rating.toFixed(1)}</span>
                                </div>
                                <div style={{ fontSize:11, color:"#888780" }}>{reviewCount} review{reviewCount!==1?"s":""}</div>
                              </div>
                            ) : <span style={{ fontSize:12, color:"#B4B2A9" }}>No rating yet</span>}
                          </td>
                          {/* License & insurance */}
                          <td style={{ padding:"14px 16px" }}>
                            <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                              {profile ? (<>
                                {profile.licensed && <span style={{ fontSize:10, fontWeight:700, color:"#0F6E56" }}>✓ Licensed</span>}
                                {profile.insured  && <span style={{ fontSize:10, fontWeight:700, color:"#185FA5" }}>✓ Insured</span>}
                                {profile.backgroundCheck && <span style={{ fontSize:10, fontWeight:700, color:"#534AB7" }}>✓ Background Checked</span>}
                                {!profile.licensed && !profile.insured && <span style={{ fontSize:11, color:"#B4B2A9" }}>Not verified</span>}
                              </>) : <span style={{ fontSize:11, color:"#B4B2A9" }}>Not verified</span>}
                            </div>
                          </td>
                          {/* Years in business */}
                          <td style={{ padding:"14px 16px" }}>
                            <span style={{ fontSize:13, color:"#2C2C2A" }}>{profile?.years ? `${profile.years} yrs` : "—"}</span>
                          </td>
                          {/* Timeline */}
                          <td style={{ padding:"14px 16px" }}>
                            <span style={{ fontSize:13, color:"#2C2C2A" }}>{bid.timeline || "Not specified"}</span>
                          </td>
                          {/* Bid amount */}
                          <td style={{ padding:"14px 16px", textAlign:"right" }}>
                            <div style={{ fontSize:17, fontWeight:900, color:"#0C447C" }}>{fmt(amount)}</div>
                            {isLowest && <span style={{ ...tagStyle("#E1F5EE","#0F6E56"), marginTop:4, display:"inline-block" }}>Lowest</span>}
                          </td>
                          {/* Action */}
                          <td style={{ padding:"14px 16px" }}>
                            {isAccepted ? (
                              <span style={{ fontSize:11, fontWeight:700, color:"#0F6E56", whiteSpace:"nowrap" }}>✓ Accepted</span>
                            ) : (
                              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                <button type="button" onClick={()=>onAccept(bid.id, lead.id)}
                                  style={{ padding:"7px 14px", borderRadius:7, border:"none", background: isBest?"#EF9F27":"#0C447C", color: isBest?"#082E56":"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:font, whiteSpace:"nowrap" }}>
                                  Accept
                                </button>
                                {onMessage && (
                                  <button type="button" onClick={()=>onMessage(bid)}
                                    style={{ padding:"6px 14px", borderRadius:7, border:"1.5px solid #D3D1C7", background:"#fff", color:"#185FA5", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:font, whiteSpace:"nowrap" }}>
                                     Ask
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* — CARDS VIEW — */}
          {viewMode === "cards" && (
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${Math.min(pendingBids.length, 3)}, 1fr)`, gap:14 }}>
            {pendingBids.map((bid, idx) => {
              const amount = parseFloat(bid.amount)||0;
              const isLowest = lowestAmount && amount === lowestAmount && amounts.filter(a=>a===lowestAmount).length===1;
              const isAccepted = bid.status === "accepted";
              const profile = matchedProfile(bid);

              return (
                <div key={bid.id} style={{
                  background:"#fff",
                  border: isAccepted ? "2.5px solid #0F6E56" : "1.5px solid #D3D1C7",
                  borderRadius:16, overflow:"hidden",
                  boxShadow: isAccepted ? "0 0 0 4px rgba(15,110,86,0.1)" : "none",
                  display:"flex", flexDirection:"column"
                }}>

                  {/* Accepted banner */}
                  {isAccepted && (
                    <div style={{ background:"#0F6E56", padding:"8px 16px", fontSize:12, fontWeight:700, color:"#fff", textAlign:"center", letterSpacing:"0.03em" }}>
                      v BID ACCEPTED
                    </div>
                  )}

                  {/* Contractor identity */}
                  <div style={{ padding:"20px 20px 14px", borderBottom:"1px solid #F1EFE8" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                      {profile ? (
                        <div style={{ width:46, height:46, borderRadius:10, background:profile.avatarBg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:900, color:profile.avatarColor, flexShrink:0 }}>
                          {profile.initials}
                        </div>
                      ) : (
                        <div style={{ width:46, height:46, borderRadius:10, background:"#E6F1FB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:900, color:"#0C447C", flexShrink:0 }}>
                          {(bid.company||"??").slice(0,2).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:15, fontWeight:700, color:"#2C2C2A", marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {bid.contact || bid.company || "Contractor"}
                        </div>
                        <div style={{ fontSize:12, color:"#5F5E5A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {bid.company || ""}
                        </div>
                      </div>
                    </div>

                    {/* Profile badges if we have a match */}
                    {profile && (
                      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
                        {profile.licensed && <span style={{ fontSize:10, fontWeight:700, color:"#0F6E56", background:"#E1F5EE", borderRadius:20, padding:"2px 8px" }}>Licensed</span>}
                        {profile.insured  && <span style={{ fontSize:10, fontWeight:700, color:"#185FA5", background:"#E6F1FB", borderRadius:20, padding:"2px 8px" }}>Insured</span>}
                        {profile.backgroundCheck && <span style={{ fontSize:10, fontWeight:700, color:"#534AB7", background:"#EEEDFE", borderRadius:20, padding:"2px 8px" }}>Background Checked</span>}
                        <span style={{ fontSize:10, fontWeight:600, color:"#888780" }}>{profile.years} yrs exp · {profile.city}</span>
                      </div>
                    )}
                    {profile && onViewProfile && (
                      <button type="button" onClick={()=>onViewProfile(profile)}
                        style={{ fontSize:12, color:"#185FA5", background:"none", border:"none", cursor:"pointer", fontFamily:font, fontWeight:600, padding:0, textDecoration:"underline" }}>
                        View Full Profile &gt;
                      </button>
                    )}
                  </div>

                  {/* Key stats */}
                  <div style={{ padding:"16px 20px", borderBottom:"1px solid #F1EFE8" }}>

                    {/* Bid amount — hero number */}
                    <div style={{ marginBottom:16 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Bid Amount</div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span style={{ fontSize:28, fontWeight:900, color:"#0C447C", letterSpacing:"-0.02em" }}>{fmt(bid.amount)}</span>
                        {isLowest && <span style={tagStyle("#E1F5EE","#0F6E56")}>Lowest Price</span>}
                      </div>
                    </div>

                    {/* Timeline */}
                    <div style={{ marginBottom:12 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Timeline</div>
                      <div style={{ fontSize:14, fontWeight:600, color:"#2C2C2A" }}>{bid.timeline || "Not specified"}</div>
                    </div>

                    {/* Submitted */}
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Submitted</div>
                      <div style={{ fontSize:13, color:"#5F5E5A" }}>{bid.createdAt ? new Date(bid.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "—"}</div>
                    </div>
                  </div>

                  {/* Message / notes */}
                  <div style={{ padding:"16px 20px", flex:1, borderBottom:"1px solid #F1EFE8" }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Message from Contractor</div>
                    {bid.message ? (
                      <p style={{ fontSize:13, color:"#2C2C2A", lineHeight:1.7, margin:0 }}>
                        {bid.message.length > 220 ? bid.message.slice(0,220) + "..." : bid.message}
                      </p>
                    ) : (
                      <p style={{ fontSize:13, color:"#B4B2A9", fontStyle:"italic", margin:0 }}>No message included with this bid.</p>
                    )}
                  </div>

                  {/* Profile ratings if available */}
                  {profile && (
                    <div style={{ padding:"14px 20px", borderBottom:"1px solid #F1EFE8", display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ color:"#EF9F27", fontSize:13, letterSpacing:1 }}>
                        {"*".repeat(Math.floor(profile.rating))}{profile.rating%1>=0.5?"1/2":""}
                      </span>
                      <span style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{profile.rating.toFixed(1)}</span>
                      <span style={{ fontSize:12, color:"#888780" }}>({profile.reviewCount} reviews)</span>
                    </div>
                  )}

                  {/* Action */}
                  <div style={{ padding:"16px 20px" }}>
                    {isAccepted ? (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        <div style={{ textAlign:"center", fontSize:14, fontWeight:700, color:"#0F6E56" }}>
                          v You accepted this bid
                        </div>
                        {onMessage && (
                          <button type="button" onClick={() => onMessage(bid)}
                            style={{ display:"block", width:"100%", padding:"11px", borderRadius:10, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font }}>
                             Message Contractor
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        <button type="button" onClick={() => onAccept(bid.id, lead.id)}
                          style={{ display:"block", width:"100%", padding:"13px", borderRadius:10, border:"none", background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font, transition:"background 0.15s" }}
                          onMouseEnter={e=>e.currentTarget.style.background="#185FA5"}
                          onMouseLeave={e=>e.currentTarget.style.background="#0C447C"}>
                          Accept This Bid
                        </button>
                        {onMessage && (
                          <button type="button" onClick={() => onMessage(bid)}
                            style={{ display:"block", width:"100%", padding:"10px", borderRadius:10, border:"1.5px solid #D3D1C7", background:"#fff", color:"#185FA5", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font }}>
                             💬 Ask a question first
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
          )}

          {/* Bottom tip */}
          <div style={{ textAlign:"center", marginTop:28, padding:"16px 20px", background:"#fff", borderRadius:12, border:"1.5px solid #E8E6DF" }}>
            <p style={{ fontSize:13, color:"#5F5E5A", margin:0 }}>
              <strong style={{ color:"#2C2C2A" }}>Tip:</strong> Our "Best Value" pick balances rating and price — it's a recommendation, not a requirement. You can message any contractor before accepting their bid to ask questions. Accepting a bid notifies the contractor immediately and declines all other bids.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// — Contractor Signup / Onboarding -------------------------------------------
