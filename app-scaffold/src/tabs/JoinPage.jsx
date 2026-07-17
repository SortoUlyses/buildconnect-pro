import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";

// — Join Page (role chooser) --------------------------------------------------
export function JoinPage({ onChoose, onBack }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  return (
    <div style={{ fontFamily:font, minHeight:"100vh", background:"linear-gradient(160deg, #082E56 0%, #0C447C 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <div style={{ width:"100%", maxWidth:680 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:52, height:52, borderRadius:12, background:"#185FA5", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", border:"2px solid rgba(255,255,255,0.2)" }}>
            <span style={{ fontSize:20, fontWeight:900, color:"#FAEEDA", letterSpacing:"-0.04em" }}>BC</span>
          </div>
          <div style={{ fontSize:24, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", marginBottom:6 }}>Join BuildConnect Pro</div>
          <div style={{ fontSize:15, color:"rgba(255,255,255,0.6)" }}>Who are you joining as?</div>
        </div>

        {/* Two cards */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>

          {/* Homeowner card */}
          <button type="button" onClick={()=>onChoose("consumer")}
            style={{ background:"#fff", border:"2px solid transparent", borderRadius:16, padding:"32px 24px", cursor:"pointer", textAlign:"left", fontFamily:font, transition:"all 0.2s" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="#0C447C"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,0.2)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
            <div style={{ fontSize:44, marginBottom:16 }}>🏠</div>
            <div style={{ fontSize:19, fontWeight:800, color:"#0C447C", marginBottom:8, letterSpacing:"-0.01em" }}>I'm a Homeowner</div>
            <div style={{ fontSize:13, color:"#5F5E5A", lineHeight:1.7, marginBottom:20 }}>
              Submit your project, receive organized bids from licensed contractors, and manage everything in one place. Always free.
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {["Free forever","No spam calls","Bids within 48 hours","Your info stays private"].map(f=>(
                <div key={f} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#2C2C2A" }}>
                  <span style={{ width:18, height:18, borderRadius:"50%", background:"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#0F6E56", fontWeight:700, flexShrink:0 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
            <div style={{ marginTop:22, display:"block", width:"100%", padding:"11px", borderRadius:9, background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, textAlign:"center" }}>
              Join as a Homeowner &gt;
            </div>
          </button>

          {/* Contractor card */}
          <button type="button" onClick={()=>onChoose("contractor")}
            style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", border:"2px solid rgba(239,159,39,0.4)", borderRadius:16, padding:"32px 24px", cursor:"pointer", textAlign:"left", fontFamily:font, transition:"all 0.2s", position:"relative" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor="#EF9F27"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,0.3)"; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor="rgba(239,159,39,0.4)"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="none"; }}>
            <div style={{ position:"absolute", top:14, right:14, background:"#EF9F27", color:"#082E56", fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:20, letterSpacing:"0.04em" }}>EARN MORE</div>
            <div style={{ fontSize:44, marginBottom:16 }}></div>
            <div style={{ fontSize:19, fontWeight:800, color:"#fff", marginBottom:8, letterSpacing:"-0.01em" }}>I'm a Contractor</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.7)", lineHeight:1.7, marginBottom:20 }}>
              Access quality local leads, win more bids, and manage your entire business — invoicing, scheduling, expenses, and more.
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
              {["Quality verified leads","Full business portal","Invoices & estimates","Plans from free"].map(f=>(
                <div key={f} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"rgba(255,255,255,0.85)" }}>
                  <span style={{ width:18, height:18, borderRadius:"50%", background:"rgba(239,159,39,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#EF9F27", fontWeight:700, flexShrink:0 }}>✓</span>
                  {f}
                </div>
              ))}
            </div>
            <div style={{ marginTop:22, display:"block", width:"100%", padding:"11px", borderRadius:9, background:"#EF9F27", color:"#082E56", fontSize:14, fontWeight:700, textAlign:"center" }}>
              Join as a Contractor &gt;
            </div>
          </button>
        </div>

        {/* Already have account */}
        <div style={{ textAlign:"center" }}>
          <span style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>Already have an account?{" "}</span>
          <button type="button" onClick={()=>onBack("login")}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,0.8)", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:font, textDecoration:"underline" }}>
            Sign in
          </button>
          <span style={{ fontSize:13, color:"rgba(255,255,255,0.3)", margin:"0 10px" }}>.</span>
          <button type="button" onClick={()=>onBack("home")}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer", fontFamily:font }}>
            Back to site
          </button>
        </div>
      </div>
    </div>
  );
}

// — Consumer Signup -----------------------------------------------------------
