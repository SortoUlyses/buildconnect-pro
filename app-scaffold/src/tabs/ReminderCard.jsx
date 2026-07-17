import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";

export function ReminderCard({ r, onNavigate, showProject=true }) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const urgencyStyle = u => ({
    routine:   { color:"#185FA5", bg:"#E6F1FB" },
    important: { color:"#854F0B", bg:"#FAEEDA" },
    urgent:    { color:"#A32D2D", bg:"#FCEBEB" },
  }[u] || { color:"#185FA5", bg:"#E6F1FB" });
  const s = urgencyStyle(r.urgency);
  const fmtDue = r => {
    if (r.isPast) {
      const mo = Math.abs(Math.round(r.daysLeft / 30));
      return mo < 1 ? "Overdue" : `${mo} month${mo!==1?"s":""} overdue`;
    }
    if (r.daysLeft < 30)  return `${r.daysLeft} days`;
    if (r.daysLeft < 365) return `${Math.round(r.daysLeft/30)} months`;
    const yrs = Math.round(r.yearsLeft * 10) / 10;
    return `${yrs} yr${yrs!==1?"s":""}`;
  };
  return (
    <div style={{ background:"#fff", border:`1.5px solid ${r.isPast?"#F3C6C6":"#E8E6DF"}`, borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
        <div style={{ flex:1 }}>
          {showProject && <div style={{ fontSize:10, fontWeight:700, color:"#888780", marginBottom:3 }}>{r.projectTitle} · {r.trade}</div>}
          <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:3 }}>{r.label}</div>
          <div style={{ fontSize:12, color:"#5F5E5A", lineHeight:1.6 }}>{r.desc}</div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0, marginLeft:14 }}>
          <div style={{ fontSize:11, fontWeight:800, color:r.isPast?"#A32D2D":r.isNear?"#854F0B":"#185FA5", background:r.isPast?"#FCEBEB":r.isNear?"#FAEEDA":"#E6F1FB", borderRadius:20, padding:"3px 10px", marginBottom:5, whiteSpace:"nowrap" }}>
            {r.isPast?"⚠ ":""}{fmtDue(r)}
          </div>
          <div style={{ fontSize:10, color:"#B4B2A9" }}>{r.due.toLocaleDateString("en-US",{month:"short",year:"numeric"})}</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <button type="button" onClick={()=>onNavigate("submit")}
          style={{ padding:"6px 14px", borderRadius:7, border:"none", background:"#0C447C", color:"#fff", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:font }}>
          Get Bids &gt;
        </button>
        <span style={{ fontSize:10, fontWeight:600, color:s.color, background:s.bg, borderRadius:20, padding:"4px 10px", alignSelf:"center", textTransform:"uppercase", letterSpacing:"0.04em" }}>
          {r.urgency}
        </span>
      </div>
    </div>
  );
}

