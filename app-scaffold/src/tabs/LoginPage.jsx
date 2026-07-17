import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { signIn } from "../lib/auth.js";

export function LoginPage({ onLogin, onBack, prefillRole }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password."); return; }
    setLoading(true);
    const { data, error: signInError } = await signIn(email.trim(), password);
    setLoading(false);
    if (signInError) {
      setError(signInError.message || "Incorrect email or password.");
      return;
    }
    const role = data.user?.user_metadata?.role || "consumer";
    onLogin(role);
  };

  return (
    <div style={{ fontFamily:font, minHeight:"100vh", background:"linear-gradient(160deg, #082E56 0%, #0C447C 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <div style={{ width:"100%", maxWidth:420 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:52, height:52, borderRadius:12, background:"#185FA5", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", border:"2px solid rgba(255,255,255,0.2)" }}>
            <span style={{ fontSize:20, fontWeight:900, color:"#FAEEDA", letterSpacing:"-0.04em" }}>BC</span>
          </div>
          <div style={{ fontSize:22, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 }}>BuildConnect Pro</div>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.6)" }}>Sign in to your account</div>
        </div>

        {/* Card */}
        <div style={{ background:"#fff", borderRadius:16, padding:"28px 28px 24px", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>

          {/* Email */}
          <div style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Email Address</label>
            <input type="email" value={email} onChange={e=>{ setEmail(e.target.value); setError(""); }}
              onKeyDown={e=>e.key==="Enter"&&handleLogin()}
              placeholder="you@example.com" autoComplete="email"
              style={{ width:"100%", padding:"12px 14px", borderRadius:9, border:`1.5px solid ${error?"#A32D2D":"#D3D1C7"}`, fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box" }} />
          </div>

          {/* Password */}
          <div style={{ marginBottom:20 }}>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Password</label>
            <div style={{ position:"relative" }}>
              <input type={showPass?"text":"password"} value={password} onChange={e=>{ setPassword(e.target.value); setError(""); }}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                placeholder="********" autoComplete="current-password"
                style={{ width:"100%", padding:"12px 44px 12px 14px", borderRadius:9, border:`1.5px solid ${error?"#A32D2D":"#D3D1C7"}`, fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box" }} />
              <button type="button" onClick={()=>setShowPass(s=>!s)}
                style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#888780", fontFamily:font }}>
                {showPass?"Hide":"Show"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background:"#FCEBEB", border:"1px solid #F3C6C6", borderRadius:8, padding:"9px 14px", marginBottom:16, fontSize:13, color:"#A32D2D" }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="button" onClick={handleLogin} disabled={loading}
            style={{ display:"block", width:"100%", padding:"13px", borderRadius:10, border:"none", background:loading?"#B4B2A9":"#0C447C", color:"#fff", fontSize:15, fontWeight:800, cursor:loading?"not-allowed":"pointer", fontFamily:font, transition:"background 0.2s" }}>
            {loading ? "Signing in..." : "Sign In ->"}
          </button>

          <div style={{ textAlign:"center", marginTop:14, fontSize:13, color:"#888780" }}>
            Don't have an account?{" "}
            <button type="button" onClick={()=>onBack("join")}
              style={{ background:"none", border:"none", color:"#185FA5", fontWeight:700, cursor:"pointer", fontFamily:font, fontSize:13 }}>
              Create one
            </button>
          </div>
        </div>

        {/* Back */}
        <div style={{ textAlign:"center", marginTop:16 }}>
          <button type="button" onClick={()=>onBack("home")}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,0.5)", fontSize:13, cursor:"pointer", fontFamily:font }}>
            ← Back to BuildConnect Pro
          </button>
        </div>
      </div>
    </div>
  );
}

