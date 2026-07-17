import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";

// — Messages / Inbox Tab ------------------------------------------------------
export function MessagesTab({ auth, threads, setThreads, leads, bids, pendingLeadMessage, onConsumePendingLeadMessage }) {
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newLeadId, setNewLeadId] = useState("");
  const [newText, setNewText] = useState("");

  // If a lead card sent us here with a pre-selected lead, open the new message form for it
  useEffect(() => {
    if (pendingLeadMessage) {
      setNewLeadId(pendingLeadMessage.id);
      setShowNew(true);
      onConsumePendingLeadMessage && onConsumePendingLeadMessage();
    }
  }, [pendingLeadMessage]);

  const active = threads.find(t => t.id === activeId);

  const openThread = async id => {
    setActiveId(id);
    setShowNew(false);
    setThreads(prev => prev.map(t => t.id===id?{...t,unread:false}:t));
    const { error } = await supabase.from("message_threads").update({ contractor_last_read_at: new Date().toISOString() }).eq("id", id);
    if (error) console.error("Failed to mark thread read:", error);
  };

  const sendMessage = async () => {
    if (!draft.trim() || !active) return;
    const body = draft.trim();
    setDraft("");
    const { data, error } = await supabase.from("messages").insert({ thread_id: active.id, sender_id: auth.id, body }).select().single();
    if (error) { console.error("Failed to send message:", error); return; }
    const msg = { id: data.id, from: "me", text: data.body, at: data.created_at };
    setThreads(prev => prev.map(t => t.id===active.id?{...t, messages:[...t.messages, msg]}:t));
  };

  const startNewThread = async () => {
    if (!newLeadId || !newText.trim()) { alert("Please select a lead and type a message."); return; }
    const lead = leads.find(l => l.id === newLeadId);
    if (!lead) return;
    const body = newText.trim();
    // Check if thread already exists for this lead
    const existing = threads.find(t => t.leadId === newLeadId);
    if (existing) {
      const { data, error } = await supabase.from("messages").insert({ thread_id: existing.id, sender_id: auth.id, body }).select().single();
      if (error) { console.error("Failed to send message:", error); return; }
      const msg = { id: data.id, from: "me", text: data.body, at: data.created_at };
      setThreads(prev => prev.map(t => t.id===existing.id?{...t, messages:[...t.messages, msg], unread:false}:t));
      setActiveId(existing.id);
    } else {
      const { data: threadRow, error: threadErr } = await supabase.from("message_threads").insert({ lead_id: newLeadId, contractor_id: auth.id }).select().single();
      if (threadErr) { console.error("Failed to create thread:", threadErr); return; }
      const { data: msgRow, error: msgErr } = await supabase.from("messages").insert({ thread_id: threadRow.id, sender_id: auth.id, body }).select().single();
      if (msgErr) { console.error("Failed to send message:", msgErr); return; }
      const thread = {
        id: threadRow.id,
        leadId: newLeadId,
        name: lead.name || "Homeowner",
        project: lead.projectTitle || "Project",
        unread: false,
        messages: [{ id: msgRow.id, from: "me", text: msgRow.body, at: msgRow.created_at }],
      };
      setThreads(prev => [thread, ...prev]);
      setActiveId(thread.id);
    }
    setShowNew(false);
    setNewLeadId("");
    setNewText("");
  };

  const deleteThread = async (id, e) => {
    e.stopPropagation();
    const { error } = await supabase.from("message_threads").delete().eq("id", id);
    if (error) { console.error("Failed to delete thread:", error); return; }
    setThreads(prev => prev.filter(t => t.id !== id));
    if (activeId === id) { setActiveId(null); setShowNew(false); }
  };

  // Leads that have been bid on — these are the ones a contractor would message
  const biddableleads = leads.filter(l => l.status === "open" || l.status === "awarded");

  return (
    <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:14, minHeight:420 }}>
      {/* Thread list */}
      <div style={{ border:"1.5px solid #D3D1C7", borderRadius:10, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"10px 12px", borderBottom:"1px solid #F1EFE8", background:"#F8F7F4" }}>
          <Btn onClick={()=>{setShowNew(true); setActiveId(null);}} variant="primary" style={{ width:"100%" }} small> New Message</Btn>
        </div>
        {threads.length === 0 ? (
          <div style={{ padding:"20px 14px", fontSize:13, color:"#2C2C2A", textAlign:"center" }}>No conversations yet.</div>
        ) : threads.map(t => {
          const last = t.messages[t.messages.length-1];
          return (
            <div key={t.id} onClick={()=>openThread(t.id)}
              style={{ padding:"12px 14px", borderBottom:"1px solid #F1EFE8", cursor:"pointer", background: activeId===t.id && !showNew?"#E6F1FB":"#fff", position:"relative" }}
              onMouseEnter={e=>{ const btn = e.currentTarget.querySelector(".del-btn"); if(btn) btn.style.opacity="1"; }}
              onMouseLeave={e=>{ const btn = e.currentTarget.querySelector(".del-btn"); if(btn) btn.style.opacity="0"; }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                <span style={{ fontSize:13, fontWeight: t.unread?800:700, color:"#2C2C2A" }}>{t.name}</span>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  {t.unread && <span style={{ width:8, height:8, borderRadius:"50%", background:"#185FA5", display:"inline-block" }} />}
                  <button className="del-btn" onClick={e=>deleteThread(t.id, e)}
                    style={{ opacity:0, background:"none", border:"none", fontSize:13, color:"#A32D2D", cursor:"pointer", padding:"0 2px", transition:"opacity 0.15s", lineHeight:1 }}>✕</button>
                </div>
              </div>
              <div style={{ fontSize:11, color:"#2C2C2A", marginBottom:3 }}>{t.project}</div>
              <div style={{ fontSize:12, color:"#2C2C2A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{last?.text}</div>
              <div style={{ fontSize:10, color:"#2C2C2A", marginTop:3 }}>{timeAgo(last?.at)}</div>
            </div>
          );
        })}
      </div>

      {/* Conversation / New message pane */}
      <div style={{ border:"1.5px solid #D3D1C7", borderRadius:10, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {showNew ? (
          <div style={{ padding:20, flex:1 }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#0C447C", marginBottom:16 }}>New Message</div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.04em" }}>Select Lead / Project</label>
              <select value={newLeadId} onChange={e=>setNewLeadId(e.target.value)}
                style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
                <option value="">Choose a lead...</option>
                {biddableleads.map(l => (
                  <option key={l.id} value={l.id}>{l.projectTitle} — {l.name || "Homeowner"} ({l.city})</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.04em" }}>Message</label>
              <textarea value={newText} onChange={e=>setNewText(e.target.value)} rows={5} autoFocus
                placeholder="Hi, I'd like to discuss your project. I have experience with this type of work and would love to schedule a walkthrough..."
                style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", fontSize:14, border:"1.5px solid #D3D1C7", borderRadius:8, fontFamily:"inherit", resize:"vertical", outline:"none" }} />
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <Btn onClick={startNewThread} variant="success">Send Message</Btn>
              <Btn onClick={()=>setShowNew(false)} variant="ghost">Cancel</Btn>
            </div>
          </div>
        ) : active ? (
          <>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid #F1EFE8", background:"#F8F7F4" }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#2C2C2A" }}>{active.name}</div>
              <div style={{ fontSize:12, color:"#2C2C2A" }}>{active.project}</div>
            </div>
            <div style={{ flex:1, padding:"16px", overflowY:"auto", display:"flex", flexDirection:"column", gap:10, maxHeight:320 }}>
              {active.messages.map(m => (
                <div key={m.id} style={{ alignSelf: m.from==="me"?"flex-end":"flex-start", maxWidth:"75%" }}>
                  <div style={{ background: m.from==="me"?"#185FA5":"#F1EFE8", color: m.from==="me"?"#fff":"#2C2C2A", borderRadius:12, padding:"8px 12px", fontSize:13, lineHeight:1.5 }}>{m.text}</div>
                  <div style={{ fontSize:10, color:"#2C2C2A", marginTop:3, textAlign: m.from==="me"?"right":"left" }}>{timeAgo(m.at)}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:8, padding:"12px 16px", borderTop:"1px solid #F1EFE8" }}>
              <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter" && sendMessage()} placeholder="Type a message..."
                style={{ flex:1, padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", outline:"none" }} />
              <Btn onClick={sendMessage} variant="primary" small>Send</Btn>
            </div>
          </>
        ) : (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flex:1, color:"#2C2C2A", fontSize:14, flexDirection:"column", gap:10 }}>
            <span style={{ fontSize:36 }}></span>
            <span>Select a conversation or start a new one</span>
          </div>
        )}
      </div>
    </div>
  );
}

