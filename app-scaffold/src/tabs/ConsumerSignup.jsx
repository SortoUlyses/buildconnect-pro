import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { signUp } from "../lib/auth.js";

export function ConsumerSignup({ onComplete, onBack }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const [form, setForm] = useState({ name:"", email:"", phone:"", city:"", state:"CA", password:"", confirmPassword:"" });
  const [errors, setErrors] = useState({});
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const set = k => v => { setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:undefined})); };

  const submit = async () => {
    const e = {};
    if (!form.name.trim())                              e.name = "Name is required.";
    if (!form.email.trim())                             e.email = "Email is required.";
    if (form.password.length < 6)                       e.password = "Password must be at least 6 characters.";
    if (form.password !== form.confirmPassword)         e.confirmPassword = "Passwords don't match.";
    if (Object.keys(e).length) { setErrors(e); return; }

    setSubmitting(true);
    const { data, error: signUpError } = await signUp(form.email.trim(), form.password, {
      role: "consumer",
      name: form.name.trim(),
    });
    if (signUpError) {
      setSubmitting(false);
      setErrors({ email: signUpError.message || "Could not create account." });
      return;
    }

    // Fill in the phone/city fields the signup trigger doesn't know about
    if (data.user) {
      await supabase.from("consumer_profiles").update({
        phone: form.phone || null,
        city: form.city || null,
        state: form.state || null,
      }).eq("id", data.user.id);
    }
    setSubmitting(false);

    if (!data.session) {
      // Email confirmation is required — no active session yet
      setErrors({ email: "Account created — check your email to confirm before signing in." });
      return;
    }
    onComplete();
  };

  const inpStyle = err => ({ width:"100%", padding:"12px 14px", borderRadius:9, border:`1.5px solid ${err?"#A32D2D":"#D3D1C7"}`, fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box", background:"#fff" });
  const lbl = { display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 };
  const err_ = { fontSize:12, color:"#A32D2D", marginTop:4 };

  return (
    <div style={{ fontFamily:font, minHeight:"100vh", background:"linear-gradient(160deg, #082E56 0%, #0C447C 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <div style={{ width:"100%", maxWidth:440 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:52, height:52, borderRadius:12, background:"#185FA5", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", border:"2px solid rgba(255,255,255,0.2)" }}>
            <span style={{ fontSize:20, fontWeight:900, color:"#FAEEDA", letterSpacing:"-0.04em" }}>BC</span>
          </div>
          <div style={{ fontSize:22, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", marginBottom:4 }}>Create your account</div>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.6)" }}>Free for homeowners — always</div>
        </div>

        {/* Form card */}
        <div style={{ background:"#fff", borderRadius:16, padding:"28px 28px 24px", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={lbl}>Full Name <span style={{ color:"#A32D2D" }}>★</span></label>
              <input value={form.name} onChange={e=>set("name")(e.target.value)} placeholder="Jane Smith" style={inpStyle(errors.name)} />
              {errors.name && <div style={err_}>{errors.name}</div>}
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={lbl}>Email Address <span style={{ color:"#A32D2D" }}>★</span></label>
              <input type="email" value={form.email} onChange={e=>set("email")(e.target.value)} placeholder="jane@email.com" style={inpStyle(errors.email)} />
              {errors.email && <div style={err_}>{errors.email}</div>}
            </div>
            <div>
              <label style={lbl}>Phone <span style={{ fontSize:9, fontWeight:400, textTransform:"none" }}>optional</span></label>
              <input type="tel" value={form.phone} onChange={e=>set("phone")(e.target.value)} placeholder="(619) 000-0000" style={inpStyle(false)} />
            </div>
            <div>
              <label style={lbl}>City <span style={{ fontSize:9, fontWeight:400, textTransform:"none" }}>optional</span></label>
              <input value={form.city} onChange={e=>set("city")(e.target.value)} placeholder="San Diego" style={inpStyle(false)} />
            </div>
          </div>

          <div style={{ borderTop:"1px solid #F1EFE8", paddingTop:14, marginBottom:12 }}>
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>Password <span style={{ color:"#A32D2D" }}>★</span></label>
              <div style={{ position:"relative" }}>
                <input type={showPass?"text":"password"} value={form.password} onChange={e=>set("password")(e.target.value)} placeholder="At least 6 characters"
                  style={{ ...inpStyle(errors.password), paddingRight:56 }} />
                <button type="button" onClick={()=>setShowPass(s=>!s)}
                  style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#888780", fontFamily:font }}>
                  {showPass?"Hide":"Show"}
                </button>
              </div>
              {errors.password && <div style={err_}>{errors.password}</div>}
            </div>
            <div>
              <label style={lbl}>Confirm Password <span style={{ color:"#A32D2D" }}>★</span></label>
              <input type="password" value={form.confirmPassword} onChange={e=>set("confirmPassword")(e.target.value)} placeholder="********"
                style={inpStyle(errors.confirmPassword)} />
              {errors.confirmPassword && <div style={err_}>{errors.confirmPassword}</div>}
            </div>
          </div>

          <button type="button" onClick={submit} disabled={submitting}
            style={{ display:"block", width:"100%", padding:"13px", borderRadius:10, border:"none", background:submitting?"#B4B2A9":"#0C447C", color:"#fff", fontSize:15, fontWeight:800, cursor:submitting?"not-allowed":"pointer", fontFamily:font }}>
            {submitting ? "Creating account..." : "Create Free Account >"}
          </button>

          <div style={{ textAlign:"center", marginTop:14, fontSize:13, color:"#888780" }}>
            Already have an account?{" "}
            <button type="button" onClick={()=>onBack("login")}
              style={{ background:"none", border:"none", color:"#185FA5", fontWeight:700, cursor:"pointer", fontFamily:font, fontSize:13 }}>
              Sign in
            </button>
          </div>
        </div>

        <div style={{ textAlign:"center", marginTop:16 }}>
          <button type="button" onClick={()=>onBack("join")}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer", fontFamily:font }}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

// — Auth Prompt (inline gate for protected pages) -----------------------------
