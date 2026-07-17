import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";

export function ConsumerAccountPage({ consumerProfile, setConsumerProfile, leads, bids, reviews, projects, onNavigate }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...consumerProfile });
  const [saved, setSaved] = useState(false);
  const set = k => v => setDraft(d => ({ ...d, [k]: v }));

  const initials = (consumerProfile.name || "?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  // Stats from shared state
  const myLeads = leads || [];
  const totalProjects = myLeads.length;
  const totalBids = bids.filter(b => myLeads.some(l => l.id === b.leadId)).length;
  const acceptedBids = bids.filter(b => myLeads.some(l => l.id === b.leadId) && b.status === "accepted").length;
  const completedProjects = bids.filter(b => myLeads.some(l => l.id === b.leadId) && b.status === "accepted" && projects?.[b.id]?.stage === "completed").length;
  const myReviews = (reviews || []).filter(r => myLeads.some(l => l.projectTitle === r.project || r.bidId));

  const handleSave = () => {
    setConsumerProfile(draft);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleNotif = key => {
    const updated = { ...consumerProfile, [key]: !consumerProfile[key] };
    setConsumerProfile(updated);
    setDraft(updated);
  };

  const inpStyle = { width:"100%", padding:"11px 14px", borderRadius:9, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box", background:"#fff" };
  const lblStyle = { display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 };

  return (
    <div style={{ fontFamily:font }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28, flexWrap:"wrap", gap:16 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:"#0C447C", margin:"0 0 4px", letterSpacing:"-0.02em" }}>My Account</h2>
          <p style={{ fontSize:14, color:"#5F5E5A", margin:0 }}>Manage your profile, preferences, and account activity.</p>
        </div>
        {saved && (
          <div style={{ background:"#E1F5EE", border:"1.5px solid #B5F5D8", borderRadius:9, padding:"8px 16px", fontSize:13, color:"#0F6E56", fontWeight:700 }}>
            v Changes saved
          </div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

        {/* — LEFT COLUMN — */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* Profile card */}
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", overflow:"hidden" }}>
            {/* Navy header with avatar */}
            <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", padding:"24px 24px 20px", display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ width:60, height:60, borderRadius:14, background:"#EF9F27", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:900, color:"#082E56", flexShrink:0, border:"3px solid rgba(255,255,255,0.3)" }}>
                {initials}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:18, fontWeight:800, color:"#fff", letterSpacing:"-0.01em", marginBottom:2 }}>
                  {consumerProfile.name || "Your Name"}
                </div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.65)" }}>
                  {consumerProfile.email || "Add your email"}
                </div>
              </div>
            </div>

            {/* Profile fields */}
            <div style={{ padding:"20px 24px" }}>
              {!editing ? (
                <>
                  {[
                    ["Name", consumerProfile.name || "—"],
                    ["Email", consumerProfile.email || "—"],
                    ["Phone", consumerProfile.phone || "—"],
                    ["Company", consumerProfile.company || "—"],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom:"1px solid #F1EFE8", fontSize:14 }}>
                      <span style={{ color:"#888780", fontWeight:500 }}>{label}</span>
                      <span style={{ color:"#2C2C2A", fontWeight:600, textAlign:"right", maxWidth:"60%", wordBreak:"break-word" }}>{value}</span>
                    </div>
                  ))}
                  <button type="button" onClick={()=>{ setDraft({...consumerProfile}); setEditing(true); }}
                    style={{ marginTop:16, width:"100%", padding:"10px", borderRadius:9, border:"1.5px solid #D3D1C7", background:"#fff", color:"#0C447C", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:font }}>
                    Edit Profile
                  </button>
                </>
              ) : (
                <>
                  <div style={{ marginBottom:12 }}>
                    <label style={lblStyle}>Full Name</label>
                    <input value={draft.name} onChange={e=>set("name")(e.target.value)} placeholder="Jane Smith" style={inpStyle} />
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <label style={lblStyle}>Email Address</label>
                    <input type="email" value={draft.email} onChange={e=>set("email")(e.target.value)} placeholder="jane@email.com" style={inpStyle} />
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <label style={lblStyle}>Phone Number</label>
                    <input type="tel" value={draft.phone} onChange={e=>set("phone")(e.target.value)} placeholder="(619) 000-0000" style={inpStyle} />
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <label style={lblStyle}>Company <span style={{ fontSize:10, fontWeight:400, textTransform:"none", letterSpacing:0 }}>-- optional</span></label>
                    <input value={draft.company} onChange={e=>set("company")(e.target.value)} placeholder="Optional" style={inpStyle} />
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button type="button" onClick={handleSave}
                      style={{ flex:1, padding:"11px", borderRadius:9, border:"none", background:"#0F6E56", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:font }}>
                      Save Changes
                    </button>
                    <button type="button" onClick={()=>setEditing(false)}
                      style={{ padding:"11px 18px", borderRadius:9, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font }}>
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Account stats */}
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", padding:"20px 24px" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:16 }}>Your Activity</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                ["Projects Submitted", totalProjects, "#185FA5", "#E6F1FB"],
                ["Bids Received", totalBids, "#854F0B", "#FAEEDA"],
                ["Projects Started", acceptedBids, "#534AB7", "#EEEDFE"],
                ["Completed", completedProjects, "#0F6E56", "#E1F5EE"],
              ].map(([label, val, color, bg]) => (
                <div key={label} style={{ background:bg, borderRadius:10, padding:"14px 16px" }}>
                  <div style={{ fontSize:24, fontWeight:900, color, letterSpacing:"-0.02em", marginBottom:2 }}>{val}</div>
                  <div style={{ fontSize:11, color, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.04em" }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #F1EFE8", display:"flex", justifyContent:"space-between", fontSize:13 }}>
              <span style={{ color:"#888780" }}>Reviews written</span>
              <span style={{ fontWeight:700, color:"#2C2C2A" }}>{myReviews.length}</span>
            </div>
          </div>
        </div>

        {/* — RIGHT COLUMN — */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* Notification preferences */}
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", padding:"20px 24px" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:16 }}>Notification Preferences</div>
            {[
              ["notifBids",   "🔔", "New Bid Received",      "Get notified the moment a contractor submits a bid on your project."],
              ["notifStatus", "📋", "Project Status Updates", "Know when your contractor updates the project stage — started, on hold, or completed."],
              ["notifTips",   "💡", "Platform Tips",          "Occasional tips on how to get the best bids and work with contractors effectively."],
            ].map(([key, icon, title, desc]) => (
              <div key={key} style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"14px 0", borderBottom:"1px solid #F1EFE8" }}>
                <div style={{ fontSize:20, flexShrink:0, marginTop:2 }}>{icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:3 }}>{title}</div>
                  <div style={{ fontSize:12, color:"#888780", lineHeight:1.55 }}>{desc}</div>
                </div>
                {/* Toggle */}
                <button type="button" onClick={()=>toggleNotif(key)}
                  style={{ width:44, height:24, borderRadius:12, border:"none", cursor:"pointer", background:consumerProfile[key]?"#0C447C":"#D3D1C7", position:"relative", flexShrink:0, transition:"background 0.2s", marginTop:2 }}>
                  <div style={{ width:18, height:18, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left:consumerProfile[key]?23:3, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
              </div>
            ))}
          </div>

          {/* Recent projects */}
          <div style={{ background:"#fff", borderRadius:14, border:"1.5px solid #D3D1C7", padding:"20px 24px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em" }}>Recent Projects</div>
              {myLeads.length > 0 && (
                <button type="button" onClick={()=>onNavigate("myLeads")}
                  style={{ fontSize:12, color:"#185FA5", background:"none", border:"none", cursor:"pointer", fontFamily:font, fontWeight:600 }}>View all</button>
              )}
            </div>
            {myLeads.length === 0 ? (
              <div style={{ textAlign:"center", padding:"24px 16px" }}>
                <div style={{ fontSize:32, marginBottom:10 }}></div>
                <div style={{ fontSize:14, fontWeight:600, color:"#2C2C2A", marginBottom:6 }}>No projects yet</div>
                <div style={{ fontSize:13, color:"#888780", marginBottom:16 }}>Submit your first project to get bids from licensed contractors.</div>
                <button type="button" onClick={()=>onNavigate("submit")}
                  style={{ padding:"10px 20px", borderRadius:9, border:"none", background:"#0C447C", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:font }}>
                  Submit a Project &gt;
                </button>
              </div>
            ) : (
              myLeads.slice(0,4).map(lead => {
                const leadBids = bids.filter(b=>b.leadId===lead.id);
                const accepted = leadBids.find(b=>b.status==="accepted");
                const stage = accepted ? (projects?.[accepted.id]?.stage || "not_started") : null;
                const stageInfo = stage ? PROJECT_STAGES[stage] : null;
                const pendingCount = leadBids.filter(b=>b.status==="pending").length;
                return (
                  <div key={lead.id} style={{ padding:"12px 0", borderBottom:"1px solid #F1EFE8", cursor:"pointer" }} onClick={()=>onNavigate("myLeads")}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {lead.projectTitle || lead.trade}
                        </div>
                        <div style={{ fontSize:12, color:"#888780" }}>
                          {lead.trade} · {lead.city || "San Diego"}
                          {pendingCount > 0 && !accepted && ` · ${pendingCount} bid${pendingCount!==1?"s":""} pending`}
                        </div>
                      </div>
                      <div style={{ flexShrink:0 }}>
                        {stageInfo ? (
                          <span style={{ fontSize:11, fontWeight:700, color:stageInfo.color, background:stageInfo.bg, borderRadius:20, padding:"3px 10px" }}>
                            {stageInfo.label}
                          </span>
                        ) : accepted ? (
                          <span style={{ fontSize:11, fontWeight:700, color:"#0F6E56", background:"#E1F5EE", borderRadius:20, padding:"3px 10px" }}>Awarded</span>
                        ) : pendingCount > 0 ? (
                          <span style={{ fontSize:11, fontWeight:700, color:"#854F0B", background:"#FAEEDA", borderRadius:20, padding:"3px 10px" }}>{pendingCount} Bid{pendingCount!==1?"s":""}</span>
                        ) : (
                          <span style={{ fontSize:11, fontWeight:700, color:"#5F5E5A", background:"#F1EFE8", borderRadius:20, padding:"3px 10px" }}>Waiting</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Privacy note */}
          <div style={{ background:"#F8F7F4", borderRadius:14, border:"1.5px solid #E8E6DF", padding:"18px 20px" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A", marginBottom:6 }}> Your Privacy</div>
            <p style={{ fontSize:13, color:"#5F5E5A", lineHeight:1.65, margin:0 }}>
              Your contact details are never shared with contractors until you formally accept their bid. BuildConnect Pro does not sell your data or contact information to third parties.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

