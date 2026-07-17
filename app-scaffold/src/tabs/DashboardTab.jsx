import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject, toLocalDateStr, todayLocal } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";

// — Dashboard Tab -------------------------------------------------------------
export function DashboardTab({ leads, bids, projects, invoices, expenses, estimates, schedule, messages, reviews, profile, onNavigate, notifications, onClearNotif }) {
  const today = new Date();
  const todayStr = todayLocal();
  const monthStart = toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
  const monthEnd = todayStr;
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const dayName = today.toLocaleDateString("en-US",{weekday:"long"});
  const dateFmt = today.toLocaleDateString("en-US",{month:"long",day:"numeric"});

  const invTotal = inv => (inv.items||[]).reduce((s,i)=>s+(Number(i.qty)*Number(i.rate)||0),0);

  // Monthly figures
  const monthInvoices   = invoices.filter(i => i.date >= monthStart && i.date <= monthEnd);
  const monthExpenses   = expenses.filter(e => e.date >= monthStart && e.date <= monthEnd);
  const monthRevenue    = monthInvoices.filter(i => i.status === "paid").reduce((s,i)=>s+invTotal(i),0);
  const monthExpenseTotal = monthExpenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const monthProfit     = monthRevenue - monthExpenseTotal;
  const MONTH_NAME      = today.toLocaleString("default", { month:"long" });

  // All projects
  const allProjects = [
    ...bids.filter(b=>b.status==="accepted").map(b=>{
      const lead = leads.find(l=>l.id===b.leadId)||{};
      const proj = projects[b.id]||{};
      return { title: lead.projectTitle||"Untitled", stage: proj.stage||"not_started", contractAmount: b.amount||0 };
    }),
    ...Object.values(projects).filter(p=>p.source==="manual").map(p=>({ title:p.projectTitle||"Untitled", stage:p.stage||"not_started", contractAmount:p.contractAmount||0 }))
  ];
  const activeProjects   = allProjects.filter(p=>p.stage!=="completed");
  const totalContractValue = activeProjects.reduce((s,p)=>s+(Number(p.contractAmount)||0),0);

  // Overdue invoices
  const overdueInvoices = invoices.filter(i => i.status==="overdue" || (i.status!=="paid" && i.status!=="draft" && i.due && i.due < todayStr));
  const overdueTotal    = overdueInvoices.reduce((s,i)=>s+invTotal(i),0);

  // Bids needing response (leads with no bid from me yet that are still open)
  const urgentLeads = leads.filter(l => l.status==="open" && l.urgency==="urgent");

  // Today's scheduled jobs
  const todayJobs = [...schedule].filter(e => e.date === todayStr).sort((a,b)=>(a.startTime||"").localeCompare(b.startTime||""));
  const weekJobs  = [...schedule].filter(e => e.date > todayStr && e.date <= toLocalDateStr(new Date(today.getTime()+6*86400000))).sort((a,b)=>a.date.localeCompare(b.date) || (a.startTime||"").localeCompare(b.startTime||""));

  // Unread / stats
  const unreadCount = messages.filter(m=>m.unread).length;
  const totalBidsN  = bids.length;
  const wonBids     = bids.filter(b=>b.status==="accepted").length;
  const winRate     = totalBidsN > 0 ? Math.round((wonBids/totalBidsN)*100) : 0;
  const avgRating   = reviews.length ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1) : "—";

  const recentInvoices = [...invoices].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,3).map(i=>({ type:"invoice", text:`Invoice ${i.number} — ${i.client||"No client"}`, sub: fmt$(invTotal(i)), date:i.date, color:"#185FA5" }));
  const recentExpenses = [...expenses].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,2).map(e=>({ type:"expense", text:`Expense: ${e.description}`, sub:fmt$(e.amount), date:e.date, color:"#A32D2D" }));
  const recentActivity = [...recentInvoices, ...recentExpenses].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).slice(0,5);

  const upcoming = [...schedule].filter(e=>e.date>=todayStr).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);

  const needsAttention = [
    ...overdueInvoices.map(i=>({ type:"invoice", label:`Invoice #${i.number||"?"} overdue`, sub:`${Math.floor((new Date(todayStr)-new Date(i.due||todayStr))/86400000)}d overdue`, amount:fmt$(invTotal(i)), color:"#A32D2D", bg:"#FCEBEB", action:"invoices" })),
    ...urgentLeads.map(l=>({ type:"lead", label:`Urgent lead — ${l.city||"San Diego"}`, sub:`${l.trade} · expires soon`, amount:l.budget||"", color:"#854F0B", bg:"#FAEEDA", action:"leads" })),
    ...(unreadCount>0 ? [{ type:"message", label:`${unreadCount} unread message${unreadCount!==1?"s":""}`, sub:"Homeowners waiting for reply", amount:"", color:"#185FA5", bg:"#E6F1FB", action:"messages" }] : []),
  ].slice(0,4);

  const greeting = today.getHours() < 12 ? "Good morning" : today.getHours() < 17 ? "Good afternoon" : "Good evening";
  const firstName = profile?.name?.split(" ")[0] || "";

  return (
    <div style={{ fontFamily:font }}>

      {/* — TODAY BRIEFING — */}
      <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", borderRadius:16, padding:"24px 28px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.55)", marginBottom:4 }}>{dayName}, {dateFmt}</div>
            <h2 style={{ fontSize:24, fontWeight:900, color:"#fff", margin:0, letterSpacing:"-0.02em" }}>
              {greeting}{firstName ? `, ${firstName}` : ""}.
            </h2>
          </div>
          <div style={{ display:"flex", gap:16 }}>
            {[
              [fmt$(monthRevenue), "Revenue this month", "#EF9F27", true],
              [activeProjects.length, "Active jobs", "rgba(255,255,255,0.75)", false],
              [fmt$(overdueTotal > 0 ? overdueTotal : 0), "Outstanding", overdueTotal>0?"#F09595":"rgba(255,255,255,0.4)", true],
            ].map(([v,l,c,clickable])=>(
              <div key={l} onClick={clickable?()=>onNavigate("invoices"):undefined}
                style={{ textAlign:"center", cursor: clickable?"pointer":"default" }}>
                <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.45)", marginTop:2 }}>{l}{clickable?" ›":""}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>

          {/* Today's jobs */}
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Today's jobs</div>
            {todayJobs.length === 0 ? (
              <div style={{ background:"rgba(255,255,255,0.07)", borderRadius:10, padding:"12px 14px", fontSize:13, color:"rgba(255,255,255,0.45)", fontStyle:"italic" }}>No jobs scheduled today</div>
            ) : todayJobs.map(job => (
              <div key={job.id} style={{ background:"rgba(255,255,255,0.1)", borderRadius:10, padding:"10px 14px", marginBottom:6 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#fff", marginBottom:2 }}>{job.title}</div>
                  <span style={{ fontSize:10, fontWeight:700, color:"#B5F5D8", background:"rgba(15,110,86,0.3)", borderRadius:20, padding:"2px 8px", whiteSpace:"nowrap", marginLeft:8 }}>On schedule</span>
                </div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)" }}>{job.startTime ? `${job.startTime} · ` : ""}{job.client||""}</div>
              </div>
            ))}
          </div>

          {/* Needs attention */}
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>
              {needsAttention.length > 0 ? "⚠ Needs attention" : "✓ All clear"}
            </div>
            {needsAttention.length === 0 ? (
              <div style={{ background:"rgba(15,110,86,0.2)", borderRadius:10, padding:"12px 14px", fontSize:13, color:"#B5F5D8", fontWeight:600 }}>No overdue items — great work!</div>
            ) : needsAttention.map((item, i) => (
              <button key={i} type="button" onClick={()=>onNavigate(item.action)}
                style={{ display:"block", width:"100%", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"9px 14px", marginBottom:6, textAlign:"left", cursor:"pointer", fontFamily:font }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>{item.label}</div>
                  {item.amount && <div style={{ fontSize:12, fontWeight:800, color:"#EF9F27" }}>{item.amount}</div>}
                </div>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", marginTop:2 }}>{item.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* This week */}
        {weekJobs.length > 0 && (
          <div style={{ marginTop:16, paddingTop:16, borderTop:"1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.45)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>This week</div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {weekJobs.slice(0,3).map(job => (
                <div key={job.id} style={{ display:"flex", alignItems:"center", gap:10, fontSize:12 }}>
                  <span style={{ color:"rgba(255,255,255,0.4)", width:28, flexShrink:0 }}>{new Date(job.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"})}</span>
                  <span style={{ color:"rgba(255,255,255,0.7)", flex:1 }}>{job.title}</span>
                  {job.startTime && <span style={{ color:"rgba(255,255,255,0.4)" }}>{job.startTime}</span>}
                </div>
              ))}
              {weekJobs.length > 3 && <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2 }}>+{weekJobs.length-3} more this week</div>}
            </div>
          </div>
        )}
      </div>

      {/* — MONTHLY SUMMARY — */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:12, marginBottom:20 }}>
        {[
          ["Revenue This Month", fmt$(monthRevenue), "#0F6E56", "#E1F5EE", `${monthInvoices.filter(i=>i.status==="paid").length} paid invoices`],
          ["Expenses This Month", fmt$(monthExpenseTotal), "#A32D2D", "#FCEBEB", `${monthExpenses.length} expenses logged`],
          ["Net Profit This Month", fmt$(monthProfit), monthProfit>=0?"#185FA5":"#A32D2D", monthProfit>=0?"#E6F1FB":"#FCEBEB", monthProfit>=0?"Profitable month":"Expenses exceed revenue"],
          ["Active Contract Value", fmt$(totalContractValue), "#854F0B", "#FAEEDA", `${activeProjects.length} active project${activeProjects.length!==1?"s":""}`],
        ].map(([label,val,color,bg,sub])=>(
          <div key={label} style={{ background:bg, borderRadius:12, padding:"18px 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, color, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:26, fontWeight:900, color }}>{val}</div>
            <div style={{ fontSize:12, color, marginTop:4, opacity:0.75 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>

        {/* Overdue invoices */}
        <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:12, padding:"20px 22px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A" }}>Overdue Invoices</div>
            <button type="button" onClick={()=>onNavigate("invoices")} style={{ fontSize:12, color:"#185FA5", background:"none", border:"none", cursor:"pointer", fontFamily:font, fontWeight:600 }}>View all</button>
          </div>
          {overdueInvoices.length === 0 ? (
            <div style={{ textAlign:"center", padding:"20px 0", color:"#0F6E56", fontSize:13, fontWeight:600 }}>No overdue invoices v</div>
          ) : (<>
            <div style={{ background:"#FCEBEB", borderRadius:8, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#A32D2D", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Total Outstanding</div>
              <div style={{ fontSize:22, fontWeight:900, color:"#A32D2D" }}>{fmt$(overdueTotal)}</div>
            </div>
            {overdueInvoices.slice(0,3).map(inv => {
              const days = Math.floor((new Date(todayStr)-new Date(inv.due||todayStr))/86400000);
              return (
                <div key={inv.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #F1EFE8" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#2C2C2A" }}>{inv.client||"No client"}</div>
                    <div style={{ fontSize:11, color:"#A32D2D" }}>{days>0?`${days}d overdue`:"Due today"}</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#A32D2D" }}>{fmt$(invTotal(inv))}</div>
                </div>
              );
            })}
          </>)}
        </div>

        {/* Active projects summary */}
        <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:12, padding:"20px 22px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A" }}>Active Projects</div>
            <button type="button" onClick={()=>onNavigate("projects")} style={{ fontSize:12, color:"#185FA5", background:"none", border:"none", cursor:"pointer", fontFamily:font, fontWeight:600 }}>View all</button>
          </div>
          {activeProjects.length === 0 ? (
            <div style={{ textAlign:"center", padding:"20px 0", color:"#2C2C2A", fontSize:13 }}>No active projects</div>
          ) : (<>
            {Object.entries(PROJECT_STAGES).filter(([k])=>k!=="completed").map(([k,s]) => {
              const count = activeProjects.filter(p=>p.stage===k).length;
              return count > 0 ? (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #F1EFE8" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:s.color }} />
                    <span style={{ fontSize:13, color:"#2C2C2A" }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:s.color }}>{count}</span>
                </div>
              ) : null;
            })}
            {activeProjects.slice(0,3).map((p,i) => (
              <div key={i} style={{ fontSize:12, color:"#2C2C2A", padding:"6px 0", borderBottom:"1px solid #F1EFE8" }}>
                <span style={{ fontWeight:600 }}>{p.title}</span>
                <span style={{ color:"#888780", marginLeft:8 }}>{fmt$(p.contractAmount)}</span>
              </div>
            ))}
          </>)}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>

        {/* Upcoming schedule */}
        <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:12, padding:"20px 22px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A" }}>Upcoming Schedule</div>
            <button type="button" onClick={()=>onNavigate("schedule")} style={{ fontSize:12, color:"#185FA5", background:"none", border:"none", cursor:"pointer", fontFamily:font, fontWeight:600 }}>View calendar</button>
          </div>
          {upcoming.length === 0 ? (
            <div style={{ textAlign:"center", padding:"20px 0", color:"#2C2C2A", fontSize:13 }}>No upcoming jobs scheduled</div>
          ) : upcoming.map(evt => (
            <div key={evt.id} style={{ display:"flex", gap:12, alignItems:"center", padding:"8px 0", borderBottom:"1px solid #F1EFE8" }}>
              <div style={{ width:4, borderRadius:2, alignSelf:"stretch", background:evt.color||"#185FA5", flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#2C2C2A" }}>{evt.title}</div>
                <div style={{ fontSize:11, color:"#2C2C2A" }}>{evt.date}{evt.startTime?` · ${evt.startTime}`:""}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Performance */}
        <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:12, padding:"20px 22px" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:14 }}>Performance</div>
          {[
            ["Bid Win Rate", `${winRate}%`, winRate>=50?"#0F6E56":"#854F0B", winRate>=50?"#E1F5EE":"#FAEEDA"],
            ["Bids Placed / Won", `${wonBids} / ${totalBidsN}`, "#185FA5", "#E6F1FB"],
            ["Open Leads", leads.filter(l=>l.status==="open").length, "#534AB7", "#EEEDFE"],
            ["Average Rating", avgRating, "#854F0B", "#FAEEDA"],
            ["Unread Messages", unreadCount, unreadCount>0?"#A32D2D":"#2C2C2A", unreadCount>0?"#FCEBEB":"#F8F7F4"],
          ].map(([label, val, color, bg]) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #F1EFE8" }}>
              <span style={{ fontSize:13, color:"#2C2C2A" }}>{label}</span>
              <span style={{ fontSize:14, fontWeight:800, color, background:bg, borderRadius:20, padding:"2px 10px" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:12, padding:"20px 22px" }}>
        <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:14 }}>Recent Activity</div>
        {recentActivity.length === 0 ? (
          <div style={{ textAlign:"center", padding:"16px 0", color:"#2C2C2A", fontSize:13 }}>No recent activity yet.</div>
        ) : recentActivity.map((item, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 0", borderBottom:"1px solid #F1EFE8" }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:item.color, flexShrink:0 }} />
            <div style={{ flex:1, fontSize:13, color:"#2C2C2A" }}>{item.text}</div>
            <div style={{ fontSize:13, fontWeight:700, color:item.color }}>{item.sub}</div>
            <div style={{ fontSize:11, color:"#888780", minWidth:70, textAlign:"right" }}>{item.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

