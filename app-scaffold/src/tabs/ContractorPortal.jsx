import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { ProfileTab } from "./ProfileTab.jsx";
import { PhotosTab } from "./PhotosTab.jsx";
import { InvoicesTab } from "./InvoicesTab.jsx";
import { EstimatesTab } from "./EstimatesTab.jsx";
import { ExpensesTab } from "./ExpensesTab.jsx";
import { MessagesTab } from "./MessagesTab.jsx";
import { ReviewsTab } from "./ReviewsTab.jsx";
import { ScheduleTab } from "./ScheduleTab.jsx";
import { LeadCard } from "./LeadCard.jsx";
import { ProjectManagerTab } from "./ProjectManager.jsx";
import { DashboardTab } from "./DashboardTab.jsx";

export function ContractorPortal({ auth, leads, bids, onBid, onAcceptBid, profile, setProfile, photos, setPhotos, invoices, setInvoices, schedule, setSchedule, estimates, setEstimates, expenses, setExpenses, messages, setMessages, reviews, setReviews, projects, setProjects, section, navigateToSection, workOrders, signWorkOrder }) {
  const [tab, setTab] = useState("dashboard"); // kept for legacy cross-nav compatibility
  const [businessTab, setBusinessTab] = useState("projects");
  const [profileTab, setProfileTab] = useState("profile");
  const [filter, setFilter] = useState({ trade:"", propertyType:"", search:"" });
  const [pendingProjectInvoice, setPendingProjectInvoice] = useState(null);
  const [pendingLeadMessage, setPendingLeadMessage] = useState(null);
  const [bidWonAlert, setBidWonAlert] = useState(null);
  const seenBidWonRef = useRef(new Set(bids.filter(b=>b.status==="accepted").map(b=>b.id)));

  // Show the bid-won celebration modal when a bid is accepted
  useEffect(() => {
    const newlyAccepted = bids.filter(b => b.status === "accepted" && !seenBidWonRef.current.has(b.id));
    if (newlyAccepted.length > 0) {
      const bid = newlyAccepted[0];
      const lead = leads.find(l => l.id === bid.leadId) || {};
      setBidWonAlert({ bid, lead });
      newlyAccepted.forEach(b => seenBidWonRef.current.add(b.id));
    }
  }, [bids, leads]);

  // Create a pre-filled invoice from the won bid and open Invoices tab
  const createInvoiceFromBid = (bid, lead) => {
    const newInv = {
      id: uid(),
      number: `INV-${Date.now().toString().slice(-5)}`,
      client: lead.name || "",
      email: lead.email || "",
      project: lead.projectTitle || "",
      projectKey: bid.id,
      date: new Date().toISOString().slice(0,10),
      due: "",
      status: "draft",
      notes: `From accepted bid — ${bid.company || ""}. ${bid.message || ""}`.trim(),
      items: [{ desc: lead.projectTitle || "Construction services", qty: 1, rate: bid.amount || "" }],
    };
    setInvoices(prev => { const u = [newInv, ...prev]; save(S.invoices, u); return u; });
    setBidWonAlert(null);
    setTab("invoices");
  };

  // Open Projects tab pre-filled from the won bid
  const openInProjects = (bid, lead) => {
    setBidWonAlert(null);
    setTab("projects");
  };

  const filtered = leads.filter(l => {
    if (filter.trade && l.trade !== filter.trade) return false;
    if (filter.propertyType && l.propertyType !== filter.propertyType) return false;
    if (filter.search && !l.projectTitle.toLowerCase().includes(filter.search.toLowerCase()) && !(l.city||"").toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  const stats = { total:leads.length, open:leads.filter(l=>l.status==="open").length, residential:leads.filter(l=>l.propertyType==="Residential").length, commercial:leads.filter(l=>l.propertyType==="Commercial").length };
  const unreadCount = messages.filter(m=>m.unread).length;
  const activeProjectsCount = bids.filter(b => b.status==="accepted" && (projects[b.id]?.stage||"not_started") !== "completed").length;

  const [leadsSubTab, setLeadsSubTab] = useState("new"); // "new" | "bids" | "saved"
  const [sortBy, setSortBy] = useState("date");
  const [savedLeadIds, setSavedLeadIds] = useState(new Set());

  const toggleSaveLead = id => setSavedLeadIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  // Which leads has this contractor already bid on
  const bidLeadIds = new Set(bids.map(b => b.leadId));
  const newLeads = filtered.filter(l => !bidLeadIds.has(l.id));
  const bidLeads = filtered.filter(l => bidLeadIds.has(l.id));
  const savedLeads = leads.filter(l => savedLeadIds.has(l.id));

  const URGENCY_ORDER = { "🚨 Emergency (ASAP)": 0, "Urgent (within a week)": 1, "Soon (2-4 weeks)": 2, "Flexible (1-3 months)": 3 };
  const BUDGET_ORDER = { "$150,000+": 0, "$50,000-$150,000": 1, "$15,000-$50,000": 2, "$5,000-$15,000": 3, "Under $5,000": 4, "Not sure yet": 5 };

  const sortLeads = list => {
    if (sortBy === "urgency") return [...list].sort((a,b) => (URGENCY_ORDER[a.urgency]??99) - (URGENCY_ORDER[b.urgency]??99));
    if (sortBy === "budget") return [...list].sort((a,b) => (BUDGET_ORDER[a.budget]??99) - (BUDGET_ORDER[b.budget]??99));
    return [...list].sort((a,b) => b.createdAt.localeCompare(a.createdAt)); // newest first (default)
  };

  // Track which invoices already have a corresponding project (manual OR bid-won)
  const bidWonTitles = new Set(
    bids.filter(b => b.status === "accepted").map(b => {
      const lead = leads.find(l => l.id === b.leadId);
      return lead?.projectTitle || "";
    }).filter(Boolean)
  );
  const manualProjectTitles = new Set(Object.values(projects).filter(p=>p.source==="manual").map(p=>p.projectTitle));
  const allLinkedTitles = new Set([...bidWonTitles, ...manualProjectTitles]);
  const projectLinkedInvoiceIds = new Set(invoices.filter(inv => inv.project && allLinkedTitles.has(inv.project)).map(inv=>inv.id));

  const sendInvoiceToProjects = inv => {
    setPendingProjectInvoice(inv);
    setTab("projects");
  };

  const BUSINESS_TABS = [
    { id:"projects",  label:" Projects",  count: activeProjectsCount },
    { id:"estimates", label:" Estimates", count: estimates.length },
    { id:"invoices",  label:" Invoices",  count: invoices.length },
    { id:"expenses",  label:"$ Expenses",  count: expenses.length },
    { id:"schedule",  label:" Schedule",  count: schedule.length },
  ];
  const PROFILE_TABS = [
    { id:"profile",  label:" Profile" },
    { id:"photos",   label:"photo Portfolio", count: photos.length },
    { id:"reviews",  label:"* Reviews",   count: reviews.length },
  ];

  const renderSubNav = (tabs, active, onChange) => (
    <div style={{ display:"flex", gap:0, marginBottom:24, borderBottom:"2px solid #F1EFE8", flexWrap:"wrap" }}>
      {tabs.map(t => (
        <button key={t.id} type="button" onClick={()=>onChange(t.id)}
          style={{ padding:"9px 18px", border:"none", background:"none", cursor:"pointer", fontSize:13, fontWeight:active===t.id?700:500, color:active===t.id?"#0C447C":"#5F5E5A", borderBottom:active===t.id?"3px solid #0C447C":"3px solid transparent", marginBottom:-2, fontFamily:"inherit", display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span style={{ fontSize:11, background:active===t.id?"#0C447C":"#D3D1C7", color:active===t.id?"#fff":"#2C2C2A", borderRadius:20, padding:"1px 7px", fontWeight:700 }}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );

  // Cross-section navigation helper — used by internal buttons like "Go to Messages"
  const goToSection = (s, subTab) => {
    if (navigateToSection) navigateToSection(s);
    if (subTab === "messages") setTab("messages");
    if (subTab === "projects")  setBusinessTab("projects");
    if (subTab === "invoices")  { setBusinessTab("invoices"); }
  };

  return (
    <div>
      {/*  Bid Won Modal */}
      {bidWonAlert && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:16, padding:32, width:"100%", maxWidth:420, boxSizing:"border-box", textAlign:"center" }}>
            <div style={{ fontSize:52, marginBottom:12 }}></div>
            <div style={{ fontSize:22, fontWeight:900, color:"#0C447C", marginBottom:6, letterSpacing:"-0.02em" }}>Bid Accepted!</div>
            <div style={{ fontSize:14, color:"#2C2C2A", marginBottom:4 }}>
              <strong>{bidWonAlert.lead.name || "A homeowner"}</strong> accepted your bid for
            </div>
            <div style={{ fontSize:16, fontWeight:700, color:"#0C447C", marginBottom:4 }}>"{bidWonAlert.lead.projectTitle}"</div>
            <div style={{ fontSize:20, fontWeight:900, color:"#0F6E56", marginBottom:20 }}>${Number(bidWonAlert.bid.amount).toLocaleString()}</div>
            <p style={{ fontSize:13, color:"#2C2C2A", marginBottom:22 }}>What would you like to do next?</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <button onClick={()=>createInvoiceFromBid(bidWonAlert.bid, bidWonAlert.lead)}
                style={{ background:"#0C447C", color:"#fff", border:"none", borderRadius:10, padding:"14px 10px", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:13 }}>
                 Create Invoice
                <div style={{ fontSize:11, fontWeight:400, marginTop:3, opacity:0.8 }}>Pre-filled & ready to send</div>
              </button>
              <button onClick={()=>openInProjects(bidWonAlert.bid, bidWonAlert.lead)}
                style={{ background:"#0F6E56", color:"#fff", border:"none", borderRadius:10, padding:"14px 10px", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:13 }}>
                 Open in Projects
                <div style={{ fontSize:11, fontWeight:400, marginTop:3, opacity:0.8 }}>Track crew, expenses & schedule</div>
              </button>
            </div>
            <button onClick={()=>setBidWonAlert(null)} style={{ background:"none", border:"none", fontSize:13, color:"#2C2C2A", cursor:"pointer", fontFamily:"inherit", textDecoration:"underline" }}>
              I'll do this later
            </button>
          </div>
        </div>
      )}

      {/* — Section: Dashboard — */}
      {section==="dashboard" && <DashboardTab
        leads={leads} bids={bids} projects={projects} invoices={invoices}
        expenses={expenses} estimates={estimates} schedule={schedule}
        messages={messages} reviews={reviews} profile={profile}
        notifications={[]} onClearNotif={()=>{}}
        onNavigate={s => {
          const sectionMap = { leads:"contractor_leads", projects:"contractor_business", invoices:"contractor_business", messages:"contractor_messages", schedule:"contractor_business", estimates:"contractor_business" };
          if (sectionMap[s] && navigateToSection) navigateToSection(sectionMap[s]);
          if (s==="projects")   setBusinessTab("projects");
          if (s==="invoices")   setBusinessTab("invoices");
          if (s==="schedule")   setBusinessTab("schedule");
          if (s==="estimates")  setBusinessTab("estimates");
        }}
      />}

      {/* — Section: Leads — */}
      {section==="leads" && (
        <div>
          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10, marginBottom:18 }}>
            {[["Total",stats.total,"#185FA5","#E6F1FB"],["Open",stats.open,"#0F6E56","#E1F5EE"],["Residential",stats.residential,"#534AB7","#EEEDFE"],["Commercial",stats.commercial,"#854F0B","#FAEEDA"]].map(([l,v,c,b])=>(
              <div key={l} style={{ background:b, borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:10, fontWeight:700, color:c, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:26, fontWeight:800, color:c }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Filters + sort */}
          <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
            <input placeholder="Search projects or city..." value={filter.search} onChange={e=>setFilter(f=>({...f,search:e.target.value}))} style={{ flex:1, minWidth:160, padding:"9px 14px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", outline:"none" }} />
            <select value={filter.propertyType} onChange={e=>setFilter(f=>({...f,propertyType:e.target.value}))} style={{ padding:"9px 14px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
              <option value="">All Properties</option>
              <option value="Residential">Residential</option>
              <option value="Commercial">Commercial</option>
            </select>
            <select value={filter.trade} onChange={e=>setFilter(f=>({...f,trade:e.target.value}))} style={{ padding:"9px 14px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
              <option value="">All Trades</option>{Object.keys(TRADES).map(t=><option key={t}>{t}</option>)}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ padding:"9px 14px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
              <option value="date">Sort: Newest First</option>
              <option value="urgency">Sort: Most Urgent</option>
              <option value="budget">Sort: Highest Budget</option>
            </select>
          </div>

          {/* New Leads / My Bids / Saved sub-tabs */}
          <div style={{ display:"flex", gap:0, marginBottom:18, borderBottom:"2px solid #F1EFE8" }}>
            {[["new", "New Opportunities", newLeads.length], ["bids", "My Bids", bidLeads.length], ["saved", "Saved", savedLeads.length]].map(([id, label, count]) => (
              <button key={id} onClick={()=>setLeadsSubTab(id)}
                style={{ padding:"8px 20px", border:"none", background:"none", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight: leadsSubTab===id?700:400, color: leadsSubTab===id?"#0C447C":"#888780", borderBottom: leadsSubTab===id?"3px solid #0C447C":"3px solid transparent", marginBottom:-2, display:"flex", alignItems:"center", gap:6 }}>
                {label}
                <span style={{ fontSize:11, background: leadsSubTab===id?"#0C447C":"#D3D1C7", color: leadsSubTab===id?"#fff":"#5F5E5A", borderRadius:20, padding:"1px 7px", fontWeight:700 }}>{count}</span>
              </button>
            ))}
          </div>

          {leadsSubTab === "new" && (
            sortLeads(newLeads).length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px", color:"#2C2C2A", border:"2px dashed #D3D1C7", borderRadius:12 }}>
                <p>No new leads match your filters. Adjust the filters above or check back later.</p>
              </div>
            ) : sortLeads(newLeads).map(lead =>
              <LeadCard key={lead.id} lead={lead} bids={bids} onBid={onBid} onAcceptBid={onAcceptBid} contractorMode={true} estimates={estimates} setEstimates={setEstimates} onMessageLead={lead=>{ setPendingLeadMessage(lead); if(navigateToSection) navigateToSection("contractor_messages"); }} saved={savedLeadIds.has(lead.id)} onToggleSave={toggleSaveLead} profile={profile} workOrders={workOrders} onSignWorkOrder={signWorkOrder} />
            )
          )}

          {leadsSubTab === "bids" && (
            sortLeads(bidLeads).length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px", color:"#2C2C2A", border:"2px dashed #D3D1C7", borderRadius:12 }}>
                <p>You haven't placed any bids yet.</p>
              </div>
            ) : sortLeads(bidLeads).map(lead => {
              const myBid = bids.find(b => b.leadId === lead.id);
              return (
                <div key={lead.id} style={{ marginBottom:14 }}>
                  <LeadCard lead={lead} bids={bids} onBid={onBid} onAcceptBid={onAcceptBid} contractorMode={true} estimates={estimates} setEstimates={setEstimates} onMessageLead={lead=>{ setPendingLeadMessage(lead); if(navigateToSection) navigateToSection("contractor_messages"); }} saved={savedLeadIds.has(lead.id)} onToggleSave={toggleSaveLead} workOrders={workOrders} onSignWorkOrder={signWorkOrder} />
                  {myBid && (
                    <div style={{ display:"flex", justifyContent:"flex-end", marginTop:6 }}>
                      <Badge text={myBid.status === "accepted" ? "Bid Accepted" : myBid.status === "declined" ? "Bid Declined" : "Bid Submitted"} color={myBid.status==="accepted"?"#0F6E56":myBid.status==="declined"?"#A32D2D":"#185FA5"} bg={myBid.status==="accepted"?"#E1F5EE":myBid.status==="declined"?"#FCEBEB":"#E6F1FB"} />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {leadsSubTab === "saved" && (
            savedLeads.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px", color:"#2C2C2A", border:"2px dashed #D3D1C7", borderRadius:12 }}>
                <p>No saved leads yet. Click "Save" on any lead to bookmark it here.</p>
              </div>
            ) : savedLeads.map(lead =>
              <LeadCard key={lead.id} lead={lead} bids={bids} onBid={onBid} onAcceptBid={onAcceptBid} contractorMode={true} estimates={estimates} setEstimates={setEstimates} onMessageLead={lead=>{ setPendingLeadMessage(lead); if(navigateToSection) navigateToSection("contractor_messages"); }} saved={savedLeadIds.has(lead.id)} onToggleSave={toggleSaveLead} workOrders={workOrders} onSignWorkOrder={signWorkOrder} />
            )
          )}
        </div>
      )}
      {tab==="projects" && <ProjectManagerTab bids={bids} leads={leads} projects={projects} setProjects={setProjects} invoices={invoices} expenses={expenses} setExpenses={setExpenses} schedule={schedule} pendingFromInvoice={pendingProjectInvoice} onConsumePendingInvoice={()=>setPendingProjectInvoice(null)} auth={auth} />}

      {/* — Section: Messages — */}
      {section==="messages" && <MessagesTab auth={auth} threads={messages} setThreads={setMessages} leads={leads} bids={bids} pendingLeadMessage={pendingLeadMessage} onConsumePendingLeadMessage={()=>setPendingLeadMessage(null)} />}

      {/* — Section: My Business — */}
      {section==="business" && (
        <>
          {renderSubNav(BUSINESS_TABS, businessTab, setBusinessTab)}
          {businessTab==="projects"  && <ProjectManagerTab bids={bids} leads={leads} projects={projects} setProjects={setProjects} invoices={invoices} expenses={expenses} setExpenses={setExpenses} schedule={schedule} pendingFromInvoice={pendingProjectInvoice} onConsumePendingInvoice={()=>setPendingProjectInvoice(null)} auth={auth} />}
          {businessTab==="estimates" && <EstimatesTab estimates={estimates} setEstimates={setEstimates} invoices={invoices} setInvoices={setInvoices} auth={auth} />}
          {businessTab==="invoices"  && <InvoicesTab invoices={invoices} setInvoices={setInvoices} onSendToProjects={sendInvoiceToProjects} projectLinkedInvoiceIds={projectLinkedInvoiceIds} auth={auth} />}
          {businessTab==="expenses"  && <ExpensesTab expenses={expenses} setExpenses={setExpenses} invoices={invoices} projects={projects} bids={bids} leads={leads} auth={auth} />}
          {businessTab==="schedule"  && <ScheduleTab schedule={schedule} setSchedule={setSchedule} projects={projects} setProjects={setProjects} bids={bids} leads={leads} auth={auth} />}
        </>
      )}

      {/* — Section: My Profile — */}
      {section==="profile" && (
        <>
          {renderSubNav(PROFILE_TABS, profileTab, setProfileTab)}
          {profileTab==="profile"  && <ProfileTab profile={profile} setProfile={setProfile} auth={auth} />}
          {profileTab==="photos"   && <PhotosTab photos={photos} setPhotos={setPhotos} auth={auth} />}
          {profileTab==="reviews"  && <ReviewsTab reviews={reviews} setReviews={setReviews} profile={profile} />}
        </>
      )}
    </div>
  );
}
