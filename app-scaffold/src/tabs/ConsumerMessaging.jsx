import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";

export function ConsumerMessageModal({ auth, lead, bid, threads, setThreads, onClose }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const bottomRef = useRef();

  // Find the existing thread for this lead + this specific contractor
  const contractorKey = bid?.company || bid?.contact || "";
  const thread = threads.find(t => t.leadId === lead.id && t.contractorId === bid?.contractorId);
  const msgs = thread?.messages || [];

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:"smooth" });
  }, [msgs.length, thread]);

  const sendMessage = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText("");

    if (thread) {
      const { data, error } = await supabase.from("messages").insert({ thread_id: thread.id, sender_id: auth.id, body: trimmed }).select().single();
      if (error) { console.error("Failed to send message:", error); return; }
      const msg = { id: data.id, from:"client", text: data.body, at: data.created_at };
      setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, messages:[...t.messages, msg], unread:true } : t));
    } else {
      const { data: threadRow, error: threadErr } = await supabase.from("message_threads").insert({ lead_id: lead.id, contractor_id: bid.contractorId }).select().single();
      if (threadErr) { console.error("Failed to create thread:", threadErr); return; }
      const { data: msgRow, error: msgErr } = await supabase.from("messages").insert({ thread_id: threadRow.id, sender_id: auth.id, body: trimmed }).select().single();
      if (msgErr) { console.error("Failed to send message:", msgErr); return; }
      const newThread = {
        id: threadRow.id,
        leadId: lead.id,
        contractorId: bid.contractorId,
        contractorKey,
        name: lead.name || "Homeowner",
        project: lead.projectTitle || "Project",
        unread: true,
        messages: [{ id: msgRow.id, from:"client", text: msgRow.body, at: msgRow.created_at }],
      };
      setThreads(prev => [newThread, ...prev]);
    }
    setSent(true);
  };

  const handleKey = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const fmt = iso => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("en-US", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
  };

  const contractorName = bid?.company || bid?.contact || "Contractor";

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:2000, display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0 0 0 0" }}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:"#fff", borderRadius:"16px 16px 0 0", width:"100%", maxWidth:600, maxHeight:"82vh", display:"flex", flexDirection:"column", boxShadow:"0 -8px 40px rgba(0,0,0,0.18)" }}>

        {/* Header */}
        <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid #F1EFE8", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:16, fontWeight:800, color:"#0C447C", marginBottom:3, letterSpacing:"-0.01em" }}>{contractorName}</div>
              <div style={{ fontSize:12, color:"#5F5E5A" }}>Re: {lead.projectTitle}</div>
            </div>
            <button type="button" onClick={onClose}
              style={{ background:"#F1EFE8", border:"none", borderRadius:"50%", width:32, height:32, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#2C2C2A", flexShrink:0 }}>
              x
            </button>
          </div>
        </div>

        {/* Message thread */}
        <div style={{ flex:1, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:12 }}>
          {msgs.length === 0 && !sent && (
            <div style={{ textAlign:"center", padding:"32px 16px" }}>
              <div style={{ fontSize:32, marginBottom:12 }}></div>
              <div style={{ fontSize:14, fontWeight:600, color:"#2C2C2A", marginBottom:6 }}>Start a conversation</div>
              <div style={{ fontSize:13, color:"#888780", lineHeight:1.6 }}>Send {contractorName} a message about your {lead.trade} project. They'll see it in their Contractor Portal.</div>
            </div>
          )}
          {msgs.map(m => {
            const isMe = m.from === "client";
            return (
              <div key={m.id} style={{ display:"flex", flexDirection:"column", alignItems: isMe?"flex-end":"flex-start" }}>
                <div style={{ fontSize:10, color:"#B4B2A9", marginBottom:3, fontWeight:500 }}>
                  {isMe ? "You" : contractorName} · {fmt(m.at)}
                </div>
                <div style={{
                  maxWidth:"80%", padding:"10px 14px", borderRadius: isMe?"12px 12px 4px 12px":"12px 12px 12px 4px",
                  background: isMe?"#0C447C":"#F1EFE8",
                  color: isMe?"#fff":"#2C2C2A",
                  fontSize:14, lineHeight:1.6
                }}>
                  {m.text}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Reply box */}
        <div style={{ padding:"12px 16px 20px", borderTop:"1px solid #F1EFE8", flexShrink:0 }}>
          {sent && (
            <div style={{ fontSize:12, color:"#0F6E56", fontWeight:600, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
              <span>✓</span> Message sent — {contractorName} will see it in their portal.
            </div>
          )}
          <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
            <textarea
              value={text}
              onChange={e=>setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message... (Enter to send)"
              rows={2}
              style={{ flex:1, padding:"11px 14px", borderRadius:10, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", resize:"none", lineHeight:1.55, boxSizing:"border-box" }}
            />
            <button type="button" onClick={sendMessage} disabled={!text.trim()}
              style={{ padding:"11px 20px", borderRadius:10, border:"none", background: text.trim()?"#0C447C":"#D3D1C7", color:"#fff", fontSize:14, fontWeight:700, cursor: text.trim()?"pointer":"not-allowed", fontFamily:font, flexShrink:0, transition:"background 0.15s" }}>
              Send
            </button>
          </div>
          <div style={{ fontSize:11, color:"#B4B2A9", marginTop:8 }}>Press Enter to send · Shift+Enter for new line</div>
        </div>
      </div>
    </div>
  );
}


// — Consumer Messages Tab (inbox of all contractor conversations) ------------
export function ConsumerMessagesTab({ auth, threads, setThreads, leads, bids }) {
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState("");

  // Only show threads tied to a project this consumer actually submitted
  const myThreads = threads.filter(t => t.leadId && leads.some(l => l.id === t.leadId));
  const active = myThreads.find(t => t.id === activeId);

  const contractorLabel = t => {
    if (t.contractorKey) return t.contractorKey;
    const bid = bids.find(b => b.leadId === t.leadId);
    return bid?.company || bid?.contact || "Contractor";
  };

  const sendMessage = async () => {
    if (!draft.trim() || !active) return;
    const body = draft.trim();
    setDraft("");
    const { data, error } = await supabase.from("messages").insert({ thread_id: active.id, sender_id: auth.id, body }).select().single();
    if (error) { console.error("Failed to send message:", error); return; }
    const msg = { id: data.id, from:"client", text: data.body, at: data.created_at };
    setThreads(prev => prev.map(t => t.id===active.id ? { ...t, messages:[...t.messages, msg], unread:true } : t));
  };

  return (
    <div>
      <h2 style={{ fontSize:22, fontWeight:800, color:"#0C447C", margin:"0 0 4px", letterSpacing:"-0.02em" }}>Messages</h2>
      <p style={{ fontSize:14, color:"#2C2C2A", margin:"0 0 20px" }}>Conversations with contractors about your projects.</p>
      <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:14, minHeight:420 }}>
        <div style={{ border:"1.5px solid #D3D1C7", borderRadius:10, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          {myThreads.length === 0 ? (
            <div style={{ padding:"20px 14px", fontSize:13, color:"#2C2C2A", textAlign:"center" }}>No conversations yet. Message a contractor from any bid to start one.</div>
          ) : myThreads.map(t => {
            const last = t.messages[t.messages.length-1];
            return (
              <div key={t.id} onClick={()=>setActiveId(t.id)}
                style={{ padding:"12px 14px", borderBottom:"1px solid #F1EFE8", cursor:"pointer", background: activeId===t.id?"#E6F1FB":"#fff" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{contractorLabel(t)}</span>
                  {t.unread && <span style={{ width:8, height:8, borderRadius:"50%", background:"#185FA5", display:"inline-block" }} />}
                </div>
                <div style={{ fontSize:11, color:"#2C2C2A", marginBottom:3 }}>{t.project}</div>
                <div style={{ fontSize:12, color:"#2C2C2A", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{last?.text}</div>
                <div style={{ fontSize:10, color:"#2C2C2A", marginTop:3 }}>{timeAgo(last?.at)}</div>
              </div>
            );
          })}
        </div>

        <div style={{ border:"1.5px solid #D3D1C7", borderRadius:10, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {active ? (
            <>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid #F1EFE8", background:"#F8F7F4" }}>
                <div style={{ fontSize:14, fontWeight:800, color:"#2C2C2A" }}>{contractorLabel(active)}</div>
                <div style={{ fontSize:12, color:"#2C2C2A" }}>{active.project}</div>
              </div>
              <div style={{ flex:1, padding:"16px", overflowY:"auto", display:"flex", flexDirection:"column", gap:10, maxHeight:320 }}>
                {active.messages.map(m => (
                  <div key={m.id} style={{ alignSelf: m.from==="client"?"flex-end":"flex-start", maxWidth:"75%" }}>
                    <div style={{ background: m.from==="client"?"#185FA5":"#F1EFE8", color: m.from==="client"?"#fff":"#2C2C2A", borderRadius:12, padding:"8px 12px", fontSize:13, lineHeight:1.5 }}>{m.text}</div>
                    <div style={{ fontSize:10, color:"#2C2C2A", marginTop:3, textAlign: m.from==="client"?"right":"left" }}>{timeAgo(m.at)}</div>
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
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", flex:1, color:"#2C2C2A", fontSize:14 }}>Select a conversation to view messages</div>
          )}
        </div>
      </div>
    </div>
  );
}

