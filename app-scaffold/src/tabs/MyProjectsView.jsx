import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { LeadCard } from "./LeadCard.jsx";
import { PriceComparisonBar } from "./MatchedContractorsView.jsx";
import { SectionHeaderRow } from "./ContractorPortalPreview.jsx";

export function MyProjectsView({ leads, bids, projects, estimates, reviews, setReviews, acceptBid, declineBid, deleteLead, openComparison, setMsgModal, navigateTo, onViewContractorProfile, workOrders, signWorkOrder }) {
  const [projectsTab, setProjectsTab] = useState("active");

  const classify = lead => {
    const acceptedBid = bids.find(b => b.leadId === lead.id && b.status === "accepted");
    if (!acceptedBid) return "active";
    const stage = projects?.[acceptedBid.id]?.stage;
    return stage === "completed" ? "completed" : "active";
  };

  const activeLeads    = leads.filter(l => classify(l) === "active");
  const completedLeads = leads.filter(l => classify(l) === "completed");
  const takingBids     = activeLeads.filter(l => !bids.some(b => b.leadId === l.id && b.status === "accepted"));
  const inProgress     = activeLeads.filter(l =>  bids.some(b => b.leadId === l.id && b.status === "accepted"));

  const renderLead = lead => {
    const hasAccepted   = bids.some(b => b.leadId === lead.id && b.status === "accepted");
    const leadBids      = bids.filter(b => b.leadId === lead.id && b.status !== "declined");
    const hasMultiple   = leadBids.length >= 2;
    return (
      <div key={lead.id} style={{ marginBottom:14 }}>
        <LeadCard
          lead={lead} bids={bids} onBid={()=>{}} onAcceptBid={acceptBid} onDeclineBid={declineBid}
          contractorMode={false} estimates={estimates}
          onMessageBid={(l,b)=>setMsgModal({lead:l,bid:b})}
          projects={projects} reviews={reviews} setReviews={setReviews}
          onViewContractorProfile={onViewContractorProfile}
          workOrders={workOrders} onSignWorkOrder={signWorkOrder}
        />
        <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"center", gap:10, marginTop:6, flexWrap:"wrap" }}>
          {hasAccepted && (
            <span style={{ fontSize:12, color:"#854F0B" }}>The contractor's project will not be deleted — they must remove it from their portal.</span>
          )}
          {hasMultiple && !hasAccepted && (
            <button type="button" onClick={()=>openComparison(lead)}
              style={{ background:"#0C447C", border:"none", borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
              ⚖ Compare {leadBids.length} Bids
            </button>
          )}
          <button type="button" onClick={()=>deleteLead(lead.id)}
            style={{ background:"#FCEBEB", border:"1.5px solid #F3C6C6", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:600, color:"#A32D2D", cursor:"pointer", fontFamily:"inherit" }}>
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:22, fontWeight:800, color:"#0C447C", margin:"0 0 4px", letterSpacing:"-0.02em" }}>My Projects</h2>
        <p style={{ fontSize:14, color:"#5F5E5A", margin:0 }}>Track your submitted projects, review bids, and follow job progress.</p>
      </div>

      {/* No projects at all */}
      {leads.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", background:"#F8F7F4", borderRadius:14, border:"1.5px solid #E8E6DF" }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🏠</div>
          <div style={{ fontSize:16, fontWeight:700, color:"#2C2C2A", marginBottom:8 }}>No projects yet</div>
          <p style={{ fontSize:14, color:"#888780", marginBottom:20, lineHeight:1.6 }}>Submit your first project and start receiving bids from licensed San Diego contractors.</p>
          <button type="button" onClick={()=>navigateTo("submit")}
            style={{ padding:"12px 24px", borderRadius:9, border:"none", background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            Submit Your First Project &gt;
          </button>
        </div>
      ) : (
        <>
          {/* Sub-tabs */}
          <div style={{ display:"flex", gap:6, marginBottom:24, background:"#F1EFE8", borderRadius:12, padding:4 }}>
            {[
              { id:"active",    label:"Active",    count:activeLeads.length,    color:"#185FA5" },
              { id:"completed", label:"Completed", count:completedLeads.length, color:"#0F6E56" },
            ].map(t => (
              <button key={t.id} type="button" onClick={()=>setProjectsTab(t.id)}
                style={{ flex:1, padding:"10px 16px", borderRadius:9, border:"none", cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:projectsTab===t.id?700:500, transition:"all 0.15s",
                  background:projectsTab===t.id?"#fff":"transparent",
                  color:projectsTab===t.id?t.color:"#888780",
                  boxShadow:projectsTab===t.id?"0 1px 4px rgba(0,0,0,0.08)":"none",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {t.label}
                {t.count > 0 && (
                  <span style={{ background:projectsTab===t.id?t.color:"#D3D1C7", color:"#fff", borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:800 }}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* — ACTIVE — */}
          {projectsTab==="active" && (
            activeLeads.length === 0 ? (
              <div style={{ textAlign:"center", padding:"52px 20px", background:"#F8F7F4", borderRadius:14, border:"1.5px solid #E8E6DF" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🏗️</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#2C2C2A", marginBottom:8 }}>No active projects</div>
                <p style={{ fontSize:14, color:"#888780", marginBottom:20, lineHeight:1.6 }}>All your projects are completed. Ready to start something new?</p>
                <button type="button" onClick={()=>navigateTo("submit")}
                  style={{ padding:"11px 24px", borderRadius:9, border:"none", background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  Submit a New Project &gt;
                </button>
              </div>
            ) : (
              <>
                {takingBids.length > 0 && (
                  <div style={{ marginBottom:28 }}>
                    <SectionHeaderRow label="Taking Bids" count={takingBids.length} color="#854F0B" />
                    <p style={{ fontSize:13, color:"#888780", marginBottom:14, lineHeight:1.55 }}>
                      These projects are live and contractors are reviewing them. Accept a bid when you're ready.
                    </p>
                    {takingBids.map(renderLead)}
                  </div>
                )}
                {inProgress.length > 0 && (
                  <div>
                    <SectionHeaderRow label="In Progress" count={inProgress.length} color="#185FA5" />
                    <p style={{ fontSize:13, color:"#888780", marginBottom:14, lineHeight:1.55 }}>
                      You've accepted a bid. Track your contractor's progress below.
                    </p>
                    {inProgress.map(renderLead)}
                  </div>
                )}
              </>
            )
          )}

          {/* — COMPLETED — */}
          {projectsTab==="completed" && (
            completedLeads.length === 0 ? (
              <div style={{ textAlign:"center", padding:"52px 20px", background:"#F8F7F4", borderRadius:14, border:"1.5px solid #E8E6DF" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🏆</div>
                <div style={{ fontSize:16, fontWeight:700, color:"#2C2C2A", marginBottom:8 }}>No completed projects yet</div>
                <p style={{ fontSize:14, color:"#888780", lineHeight:1.6 }}>Projects move here once your contractor marks the job as complete.</p>
              </div>
            ) : (
              <>
                <div style={{ background:"#E1F5EE", borderRadius:10, border:"1px solid #B5F5D8", padding:"11px 16px", marginBottom:20, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:16 }}>✓</span>
                  <span style={{ fontSize:13, color:"#0F6E56", fontWeight:500 }}>
                    <strong>{completedLeads.length} project{completedLeads.length!==1?"s":""} completed.</strong>{" "}
                    Don't forget to leave a review — it helps other homeowners find great contractors.
                  </span>
                </div>
        {completedLeads.map(lead => {
        const accepted = bids.find(b=>b.leadId===lead.id&&b.status==="accepted");
        return (
          <div key={lead.id} style={{ marginBottom:18 }}>
            {renderLead(lead)}
            <PriceComparisonBar
              trade={lead.trade}
              propertyType={lead.propertyType||"Residential"}
              scope={lead.jobType||""}
              amount={accepted?.amount}
            />
          </div>
        );
      })}
              </>
            )
          )}
        </>
      )}
    </>
  );
}
