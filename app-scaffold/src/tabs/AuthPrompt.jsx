import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";

export function AuthPrompt({ message, onLogin, onSignup, signupLabel }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  return (
    <div style={{ textAlign:"center", padding:"60px 24px", maxWidth:440, margin:"0 auto" }}>
      <div style={{ fontSize:44, marginBottom:16 }}></div>
      <h3 style={{ fontSize:20, fontWeight:800, color:"#0C447C", marginBottom:10, letterSpacing:"-0.02em" }}>Sign in required</h3>
      <p style={{ fontSize:14, color:"#5F5E5A", lineHeight:1.7, marginBottom:28 }}>{message}</p>
      <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
        <button type="button" onClick={onLogin}
          style={{ padding:"12px 28px", borderRadius:9, border:"none", background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font }}>
          Log In
        </button>
        <button type="button" onClick={onSignup}
          style={{ padding:"12px 28px", borderRadius:9, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:font }}>
          {signupLabel || "Create Account"}
        </button>
      </div>
    </div>
  );
}

// — Login Page ----------------------------------------------------------------
