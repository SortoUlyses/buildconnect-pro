import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { StarPickerWidget } from "./ContractorPortalPreview.jsx";
import { Stars } from "./ContractorDirectory.jsx";
import { supabase } from "../lib/supabaseClient.js";

export function LeaveReviewPage({ leads, bids, projects, reviews, setReviews, auth, onLogin, onNavigate }) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const [submitted, setSubmitted] = useState({}); // bidId -> true
  const [ratings,   setRatings]   = useState({}); // bidId -> 1-5
  const [hovers,    setHovers]    = useState({}); // bidId -> 1-5
  const [texts,     setTexts]     = useState({}); // bidId -> string

  // Completed projects that haven't been reviewed yet
  const reviewable = (leads || []).map(lead => {
    const accepted = (bids || []).find(b => b.leadId === lead.id && b.status === "accepted");
    if (!accepted) return null;
    const stage = projects?.[accepted.id]?.stage;
    if (stage !== "completed") return null;
    const alreadyReviewed = (reviews || []).some(r => r.bidId === accepted.id);
    return { lead, bid: accepted, alreadyReviewed };
  }).filter(Boolean);

  const pending   = reviewable.filter(r => !r.alreadyReviewed && !submitted[r.bid.id]);
  const done      = reviewable.filter(r => r.alreadyReviewed  ||  submitted[r.bid.id]);

  const submitReview = async (lead, bid) => {
    const rating = ratings[bid.id];
    if (!rating) return;
    const text = (texts[bid.id] || "").trim() || `Great ${lead.trade} work.`;
    const { data, error } = await supabase.from("reviews").insert({ bid_id: bid.id, rating, text }).select().single();
    if (error) { console.error("Failed to submit review:", error); return; }
    const rev = {
      id:      data.id,
      bidId:   bid.id,
      name:    lead.name || "Homeowner",
      project: lead.projectTitle || lead.trade,
      rating:  data.rating,
      text:    data.text,
      date:    data.created_at,
      response:"",
    };
    setReviews(prev => [...prev, rev]);
    setSubmitted(s => ({ ...s, [bid.id]: true }));
  };

  // Not logged in
  if (!auth) return (
    <div style={{ fontFamily:font }}>
      <div style={{ textAlign:"center", padding:"60px 24px", background:"#F8F7F4", borderRadius:14, border:"1.5px solid #E8E6DF" }}>
        <div style={{ fontSize:44, marginBottom:14 }}>★</div>
        <h3 style={{ fontSize:20, fontWeight:800, color:"#0C447C", marginBottom:10 }}>Sign in to leave a review</h3>
        <p style={{ fontSize:14, color:"#5F5E5A", lineHeight:1.7, maxWidth:440, margin:"0 auto 24px" }}>
          Log in to review the contractors who worked on your projects. Your feedback helps other San Diego homeowners find great contractors.
        </p>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button type="button" onClick={()=>onLogin()}
            style={{ padding:"12px 28px", borderRadius:9, border:"none", background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font }}>
            Log In to Review
          </button>
          <button type="button" onClick={()=>onNavigate("join")}
            style={{ padding:"12px 28px", borderRadius:9, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:font }}>
            Create Account
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily:font }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", borderRadius:14, padding:"26px 30px", marginBottom:24 }}>
        <div style={{ fontSize:10, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8 }}>* Reviews</div>
        <h2 style={{ fontSize:24, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", margin:"0 0 6px" }}>Leave a contractor review</h2>
        <p style={{ fontSize:14, color:"rgba(255,255,255,0.65)", margin:0, lineHeight:1.65 }}>
          Your feedback helps other San Diego homeowners find great contractors — and keeps contractors accountable.
        </p>
      </div>

      {/* No completed projects */}
      {reviewable.length === 0 && (
        <div style={{ textAlign:"center", padding:"56px 24px", background:"#F8F7F4", borderRadius:14, border:"1.5px solid #E8E6DF" }}>
          <div style={{ fontSize:44, marginBottom:14 }}>🏡</div>
          <h3 style={{ fontSize:18, fontWeight:800, color:"#0C447C", marginBottom:8 }}>No completed projects yet</h3>
          <p style={{ fontSize:14, color:"#5F5E5A", lineHeight:1.7, maxWidth:420, margin:"0 auto 22px" }}>
            Reviews are available once a contractor marks your project complete. Submit your first project to get started.
          </p>
          <button type="button" onClick={()=>onNavigate("submit")}
            style={{ padding:"11px 24px", borderRadius:9, border:"none", background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font }}>
            Submit a Project &gt;
          </button>
        </div>
      )}

      {/* Pending reviews */}
      {pending.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#854F0B", textTransform:"uppercase", letterSpacing:"0.06em" }}>Awaiting Your Review</div>
            <div style={{ flex:1, height:1, background:"#E8E6DF" }} />
            <span style={{ fontSize:12, color:"#888780" }}>{pending.length} project{pending.length!==1?"s":""}</span>
          </div>
          {pending.map(({ lead, bid }) => (
            <div key={bid.id} style={{ background:"#fff", border:"2px solid #EF9F27", borderRadius:14, padding:"22px 24px", marginBottom:14 }}>
              {/* Project identity */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:"#2C2C2A", marginBottom:3 }}>{lead.projectTitle || lead.trade}</div>
                  <div style={{ fontSize:13, color:"#5F5E5A" }}>{bid.company || "Contractor"} · {lead.trade} · Completed</div>
                </div>
                <div style={{ fontSize:16, fontWeight:800, color:"#0C447C" }}>{fmt$(bid.amount)}</div>
              </div>

              {/* Stars */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#444441", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>Your Rating <span style={{ color:"#A32D2D" }}>★</span></div>
                <StarPickerWidget bidId={bid.id} ratings={ratings} hovers={hovers} setRatings={setRatings} setHovers={setHovers} />
              </div>

              {/* Text */}
              <div style={{ marginBottom:18 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#444441", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Your Experience</div>
                <textarea value={texts[bid.id]||""} onChange={e=>setTexts(t=>({...t,[bid.id]:e.target.value}))}
                  placeholder={`Tell others about your experience with ${bid.company||"this contractor"}. What went well? Would you hire them again?`}
                  rows={3}
                  style={{ width:"100%", padding:"11px 14px", borderRadius:9, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", resize:"vertical", lineHeight:1.6, boxSizing:"border-box" }} />
              </div>

              <button type="button" onClick={()=>submitReview(lead, bid)} disabled={!ratings[bid.id]}
                style={{ padding:"12px 28px", borderRadius:9, border:"none", background:ratings[bid.id]?"#0F6E56":"#D3D1C7", color:"#fff", fontSize:14, fontWeight:700, cursor:ratings[bid.id]?"pointer":"not-allowed", fontFamily:font, transition:"background 0.15s" }}>
                Submit Review &gt;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Already reviewed */}
      {done.length > 0 && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#0F6E56", textTransform:"uppercase", letterSpacing:"0.06em" }}>✓ Already Reviewed</div>
            <div style={{ flex:1, height:1, background:"#E8E6DF" }} />
          </div>
          {done.map(({ lead, bid }) => {
            const rev = (reviews || []).find(r => r.bidId === bid.id);
            return (
              <div key={bid.id} style={{ background:"#E1F5EE", border:"1.5px solid #B5F5D8", borderRadius:12, padding:"16px 20px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:2 }}>{lead.projectTitle || lead.trade}</div>
                  <div style={{ fontSize:13, color:"#5F5E5A" }}>{bid.company || "Contractor"}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ color:"#EF9F27", fontSize:18, letterSpacing:2 }}>{"*".repeat(rev?.rating||5)}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:"#0F6E56" }}>✓ Reviewed</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      {reviewable.length > 0 && (
        <div style={{ marginTop:20, background:"#F8F7F4", borderRadius:10, border:"1px solid #E8E6DF", padding:"13px 18px", fontSize:12, color:"#888780", lineHeight:1.65 }}>
          Reviews are visible to other homeowners browsing contractor profiles on BuildConnect Pro. Your contact information is never shared. Only your first name and project type are shown publicly.
        </div>
      )}
    </div>
  );
}

