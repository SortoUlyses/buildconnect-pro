import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { Stars } from "./ContractorDirectory.jsx";
import { supabase } from "../lib/supabaseClient.js";

// — Reviews & Ratings Tab -----------------------------------------------------
export function ReviewsTab({ reviews, setReviews, profile }) {
  const [replyId, setReplyId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [clientName, setClientName] = useState("");
  const [copied, setCopied] = useState(false);

  const avg = reviews.length ? reviews.reduce((s,r)=>s+r.rating,0)/reviews.length : 0;
  const breakdown = [5,4,3,2,1].map(star => ({ star, count: reviews.filter(r=>r.rating===star).length }));
  const maxCount = Math.max(1, ...breakdown.map(b=>b.count));

  const saveReply = async id => {
    const { error } = await supabase.from("reviews").update({ response: replyText }).eq("id", id);
    if (error) { console.error("Failed to save review reply:", error); return; }
    setReviews(prev => prev.map(r => r.id===id?{...r, response:replyText}:r));
    setReplyId(null); setReplyText("");
  };

  const companyName = profile?.company || profile?.name || "our company";
  const reviewMessage = `Hi ${clientName || "[Client Name]"},\n\nThank you for choosing ${companyName} for your recent project. It was a pleasure working with you.\n\nIf you were happy with the work, we'd really appreciate it if you could take a moment to leave us a review on BuildConnect Pro. Reviews help us grow and help other homeowners find trusted contractors.\n\nThank you for your time and support!\n\n${profile?.name || "Your Contractor"}\n${companyName}\n${profile?.phone || ""}`;

  const copyMessage = () => {
    navigator.clipboard.writeText(reviewMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div>
      {/* Review Request Modal */}
      {showRequestModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:14, padding:28, width:"100%", maxWidth:480, boxSizing:"border-box" }}>
            <div style={{ fontSize:16, fontWeight:800, color:"#0C447C", marginBottom:6 }}>Request a Review</div>
            <p style={{ fontSize:13, color:"#2C2C2A", marginBottom:14 }}>Personalise the message with your client's name, then copy it to send via text or email.</p>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.04em" }}>Client Name</label>
              <input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="Jane Smith" autoFocus
                style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", outline:"none" }} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.04em" }}>Message Preview</label>
              <textarea readOnly value={reviewMessage} rows={9}
                style={{ width:"100%", boxSizing:"border-box", padding:"10px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:13, fontFamily:"inherit", resize:"none", background:"#F8F7F4", color:"#2C2C2A", lineHeight:1.6 }} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <Btn onClick={copyMessage} variant={copied ? "success" : "primary"}>{copied ? "Copied!" : "Copy Message"}</Btn>
              <Btn onClick={() => { setShowRequestModal(false); setClientName(""); setCopied(false); }} variant="ghost">Close</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:20, marginBottom:24 }}>
        <div style={{ background:"#F8F7F4", borderRadius:12, padding:"20px", textAlign:"center" }}>
          <div style={{ fontSize:40, fontWeight:900, color:"#0C447C" }}>{avg.toFixed(1)}</div>
          <Stars rating={avg} />
          <div style={{ fontSize:12, color:"#2C2C2A", marginTop:6 }}>{reviews.length} review{reviews.length!==1?"s":""}</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", gap:6 }}>
          {breakdown.map(b => (
            <div key={b.star} style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:12, color:"#2C2C2A", width:36 }}>{b.star} star</span>
              <div style={{ flex:1, height:8, background:"#F1EFE8", borderRadius:4, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${(b.count/maxCount)*100}%`, background:"#EF9F27", borderRadius:4 }} />
              </div>
              <span style={{ fontSize:12, color:"#2C2C2A", width:24, textAlign:"right" }}>{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Request a review CTA */}
      <div style={{ background:"#E6F1FB", borderRadius:10, padding:"14px 18px", marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:700, color:"#0C447C" }}>Just finished a job?</div>
          <div style={{ fontSize:12, color:"#185FA5" }}>Generate a ready-to-send review request message for your client.</div>
        </div>
        <Btn onClick={()=>setShowRequestModal(true)} variant="primary" small>Request a Review</Btn>
      </div>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", border:"2px dashed #D3D1C7", borderRadius:12 }}>
          <p style={{ fontSize:15, color:"#2C2C2A" }}>No reviews yet. Completed jobs will show up here once clients leave feedback.</p>
        </div>
      ) : (
        <div>
          {reviews.map(r => (
        <Card key={r.id} style={{ margin:"0 0 12px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6, flexWrap:"wrap", gap:6 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:"#2C2C2A" }}>{r.name}</div>
              <div style={{ fontSize:12, color:"#2C2C2A" }}>{r.project}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <Stars rating={r.rating} />
              <div style={{ fontSize:11, color:"#2C2C2A" }}>{timeAgo(r.date)}</div>
            </div>
          </div>
          <p style={{ fontSize:14, color:"#2C2C2A", lineHeight:1.6, margin:"8px 0" }}>{r.text}</p>
          {r.response ? (
            <div style={{ background:"#F8F7F4", borderRadius:8, padding:"10px 14px", marginTop:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#0C447C", marginBottom:3, textTransform:"uppercase", letterSpacing:"0.05em" }}>Your Response</div>
              <div style={{ fontSize:13, color:"#2C2C2A" }}>{r.response}</div>
            </div>
          ) : replyId === r.id ? (
            <div style={{ marginTop:8 }}>
              <Field label="" value={replyText} onChange={setReplyText} as="textarea" rows={2} placeholder="Thank the client and address any feedback..." />
              <div style={{ display:"flex", gap:8 }}>
                <Btn onClick={()=>saveReply(r.id)} variant="success" small>Post Reply</Btn>
                <Btn onClick={()=>setReplyId(null)} variant="ghost" small>Cancel</Btn>
              </div>
            </div>
          ) : (
            <button onClick={()=>{setReplyId(r.id); setReplyText("");}} style={{ background:"none", border:"none", fontSize:12, color:"#185FA5", fontWeight:700, cursor:"pointer", fontFamily:"inherit", padding:0, marginTop:4 }}>Back Reply to this review</button>
          )}
        </Card>
          ))}
        </div>
      )}
    </div>
  );
}
