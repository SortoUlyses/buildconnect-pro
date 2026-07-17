import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { signUp } from "../lib/auth.js";

export function ContractorSignup({ onComplete, onBack }) {
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState("professional");
  const [form, setForm] = useState({
    name:"", company:"", email:"", phone:"",
    city:"", state:"CA", serviceArea:"",
    trades:[], years:"", licenseNum:"",
    licensed:false, insured:false, backgroundCheck:false,
    bio:"", website:"", insurance:"",
    password:"", confirmPassword:""
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const set = k => v => { setForm(f=>({...f,[k]:v})); setErrors(e=>({...e,[k]:undefined})); };

  const toggleTrade = t => set("trades")(
    form.trades.includes(t) ? form.trades.filter(x=>x!==t) : [...form.trades, t]
  );

  const STEPS = ["Choose Plan","Your Info","Trades & Area","Credentials","Your Bio","Billing"];

  const validate = s => {
    const e = {};
    if (s===2) {
      if (!form.name.trim()) e.name = "Full name is required.";
      if (!form.company.trim()) e.company = "Company name is required.";
      if (!form.email.trim()) e.email = "Email is required.";
      if (!form.phone.trim()) e.phone = "Phone number is required.";
      if (form.password.length < 6) e.password = "Password must be at least 6 characters.";
      if (form.password !== form.confirmPassword) e.confirmPassword = "Passwords don't match.";
    }
    if (s===3) {
      if (form.trades.length === 0) e.trades = "Select at least one trade.";
      if (!form.city.trim()) e.city = "City is required.";
    }
    if (s===4) {} // credentials optional
    if (s===5) {
      if (!form.bio.trim()) e.bio = "A short bio helps homeowners choose you.";
    }
    if (s===6 && plan !== "starter") {
      if (!billing.cardName.trim()) e.cardName = "Cardholder name is required.";
      if (billing.cardNumber.replace(/\s/g,"").length < 16) e.cardNumber = "Enter a valid 16-digit card number.";
      if (billing.expiry.length < 5) e.expiry = "Enter a valid expiry date (MM/YY).";
      if (billing.cvv.length < 3) e.cvv = "Enter a valid CVV.";
      if (!billing.zip.trim()) e.zip = "Billing ZIP is required.";
    }
    return e;
  };

  const [billing, setBilling] = useState({ cardName:"", cardNumber:"", expiry:"", cvv:"", zip:"" });
  const setBill = k => v => { setBilling(b=>({...b,[k]:v})); setErrors(e=>({...e,[k]:undefined})); };

  const submitSignup = async () => {
    setSubmitting(true);
    const { data, error: signUpError } = await signUp(form.email.trim(), form.password, {
      role: "contractor",
      name: form.name.trim(),
    });
    if (signUpError) {
      setSubmitting(false);
      setErrors({ email: signUpError.message || "Could not create account." });
      return;
    }

    // Fill in everything the signup trigger doesn't know about
    if (data.user) {
      await supabase.from("contractor_profiles").update({
        company: form.company || null,
        phone: form.phone || null,
        city: form.city || null,
        state: form.state || null,
        bio: form.bio || null,
        trades: form.trades,
        licensed: form.licensed,
        insured: form.insured,
        background_check: form.backgroundCheck,
        website: form.website || null,
        license_num: form.licenseNum || null,
        insurance: form.insurance || null,
        years_experience: form.years || null,
        service_area: form.serviceArea || null,
      }).eq("id", data.user.id);
    }
    setSubmitting(false);

    if (!data.session) {
      setErrors({ email: "Account created — check your email to confirm before signing in." });
      return;
    }
    onComplete();
  };

  // Card number — groups of 4 separated by spaces
  const fmtCard   = v => v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
  // Expiry — MM/YY
  const fmtExpiry = v => {
    const d = v.replace(/\D/g,"").slice(0,4);
    return d.length >= 3 ? d.slice(0,2)+"/"+d.slice(2) : d;
  };

  const [billingCycle, setBillingCycle] = useState("monthly");

  // Reset billing cycle to monthly if plan changes away from elite
  const selectPlan = (p) => {
    setPlan(p);
    if (p !== "elite") setBillingCycle("monthly");
  };

  const ELITE_ANNUAL_PRICE  = "$1,799";
  const ELITE_MONTHLY_PRICE = "$199";
  const ELITE_ANNUAL_SAVINGS = "$589"; // $199 x 12 = $2,388 - $1,799

  const PLAN_META = {
    starter:      { name:"Starter",      price:"Free", cycle:"",        color:"#5F5E5A", detail:"No payment required. Upgrade anytime." },
    professional: { name:"Professional", price:"$89",  cycle:"/month",  color:"#185FA5", detail:"3.5% commission. Billed monthly. Cancel anytime." },
    elite:        {
      name:"Elite",
      price:      billingCycle==="annual" ? ELITE_ANNUAL_PRICE : ELITE_MONTHLY_PRICE,
      cycle:      billingCycle==="annual" ? "/year"             : "/month",
      color:"#854F0B",
      detail:     billingCycle==="annual"
        ? `Billed annually — save ${ELITE_ANNUAL_SAVINGS}/year vs monthly. 0% commission.`
        : "0% commission on every project. Cancel anytime.",
    },
  };

  const next = () => {
    const e = validate(step);
    if (Object.keys(e).length) { setErrors(e); return; }
    setStep(s=>s+1);
  };

  const goBack = () => {
    setErrors({});
    if (step === 1) onBack();
    else setStep(s => s - 1);
  };

  const goToStep = (n) => {
    if (n < step) { setErrors({}); setStep(n); } // only allow going back
  };

  const inpStyle = border => ({ width:"100%", padding:"11px 14px", borderRadius:9, border:`1.5px solid ${border?"#A32D2D":"#D3D1C7"}`, fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box", background:"#fff" });
  const lblStyle = { display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 };
  const errStyle = { fontSize:12, color:"#A32D2D", marginTop:4 };

  const PLANS = [
    {
      id:"starter", name:"Starter", price:"Free", cycle:"forever", color:"#5F5E5A", bg:"#F8F7F4", border:"#D3D1C7",
      commission:"5% commission per completed project",
      commissionColor:"#854F0B",
      features:[
        "Profile listing in contractor directory",
        "Browse open leads in your trade & area",
        "Up to 3 bids per month",
        "Messaging with homeowners",
        "5 portfolio photos",
        "Basic invoicing (up to 5 invoices/month)",
        "Access to the contractor portal",
      ],
      cta:"Start Free", note:"No credit card required"
    },
    {
      id:"professional", name:"Professional", price:"$89", cycle:"per month", color:"#185FA5", bg:"#E6F1FB", border:"#185FA5", featured:true,
      commission:"3.5% commission — save vs Starter",
      commissionColor:"#185FA5",
      commissionBold:false,
      features:[
        "Unlimited bids on any lead",
        "Reduced commission: 3.5% (vs 5% on Starter)",
        "Full contractor portal & dashboard",
        "Unlimited invoices, estimates & project manager",
        "Crew management with California OT calculation",
        "AI receipt scanning + Schedule C tax export",
        "Digital work orders with e-signatures",
        "Expense tracking with full IRS Schedule C mapping",
        "Priority placement in contractor directory",
        "Unlimited portfolio photos",
        "Response rate & speed badge on profile",
        "Up to 3 team members",
      ],
      cta:"Start Professional", note:"Annual plan: $799/year — saves $269"
    },
    {
      id:"elite", name:"Elite", price:"$199", cycle:"per month", color:"#854F0B", bg:"#FAEEDA", border:"#EF9F27",
      commission:"0% commission — zero, forever",
      commissionColor:"#0F6E56",
      commissionBold:true,
      features:[
        "Everything in Professional",
        "0% commission on every completed project — forever",
        "Accountant-ready annual tax package (Schedule C PDF)",
        "Top placement in contractor directory — shown first",
        "Elite Verified badge on profile and all bids",
        "Priority bid visibility — homeowners see your bid first",
        "Maintenance Clock referrals — shown first when reminder fires for your trade",
        "Branded work orders with your company logo",
        "Unlimited team members",
        "Quarterly business performance summary",
        "Early access to all new features",
      ],
      cta:"Start Elite", note:"Annual plan: $1,799/year — saves $589"
    },
  ];

  return (
    <div style={{ fontFamily:font, maxWidth: step===1 ? 860 : 640, margin:"0 auto" }}>

      {/* Step indicator — dots are clickable to go back to any completed step */}
      <div style={{ display:"flex", alignItems:"center", marginBottom:28 }}>
        {STEPS.map((label, i) => {
          const n = i+1;
          const done = step > n;
          const active = step === n;
          const clickable = n < step;
          return (
            <div key={n} style={{ display:"flex", alignItems:"center", flex: i < STEPS.length-1 ? 1 : "none" }}>
              <div
                onClick={() => goToStep(n)}
                style={{ display:"flex", alignItems:"center", gap:6, cursor:clickable?"pointer":"default" }}
                title={clickable ? `← Go back to ${label}` : undefined}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:done?"#0F6E56":active?"#0C447C":"#D3D1C7", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff", flexShrink:0, transition:"background 0.2s", boxShadow:clickable?"0 0 0 2px rgba(15,110,86,0.2)":"none" }}>
                  {done?"v":n}
                </div>
                <span style={{ fontSize:11, fontWeight:active?700:500, color:active?"#0C447C":done?"#0F6E56":"#B4B2A9", whiteSpace:"nowrap", textDecoration:clickable?"underline":"none", textDecorationColor:"rgba(15,110,86,0.4)" }}>{label}</span>
              </div>
              {i < STEPS.length-1 && <div style={{ flex:1, height:2, background:step>n?"#0F6E56":"#E8E6DF", borderRadius:2, margin:"0 8px" }} />}
            </div>
          );
        })}
      </div>

      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Contractor Onboarding</div>
        <h2 style={{ fontSize:26, fontWeight:900, color:"#0C447C", margin:"0 0 8px", letterSpacing:"-0.02em" }}>
          {step===1 ? "Choose your plan." : "Join the BuildConnect Pro network."}
        </h2>
        <p style={{ fontSize:14, color:"#5F5E5A", margin:0, lineHeight:1.65 }}>
          {step===1
            ? "Consumers always use the platform free. Contractor plans unlock leads, bidding tools, and a full business portal."
            : "Get access to quality leads and everything you need to run your contracting business in one place."}
        </p>
      </div>

      {/* — STEP 1: CHOOSE PLAN — */}
      {step===1 && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:20 }}>
            {PLANS.map(p => (
              <div key={p.id} onClick={()=>selectPlan(p.id)}
                style={{ border:`2px solid ${plan===p.id?p.border:"#D3D1C7"}`, borderRadius:14, padding:"22px 20px", cursor:"pointer", background:plan===p.id?p.bg:"#fff", transition:"all 0.15s", position:"relative" }}>
                {p.featured && (
                  <div style={{ position:"absolute", top:-10, left:"50%", transform:"translateX(-50%)", background:"#185FA5", color:"#fff", fontSize:10, fontWeight:700, padding:"3px 12px", borderRadius:20, whiteSpace:"nowrap", letterSpacing:"0.04em" }}>
                    * Most Popular
                  </div>
                )}
                <div style={{ fontSize:10, fontWeight:700, color:p.color, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{p.id==="starter"?"Basic":p.id==="professional"?"Professional":"Premium"}</div>
                <div style={{ fontSize:18, fontWeight:800, color:"#2C2C2A", marginBottom:4 }}>{p.name}</div>
                <div style={{ fontSize:28, fontWeight:900, color:p.id==="starter"?"#2C2C2A":"#0C447C", letterSpacing:"-0.02em", lineHeight:1 }}>{p.price}</div>
                <div style={{ fontSize:11, color:"#888780", marginBottom:12 }}>{p.cycle}</div>

                {/* Commission badge */}
                <div style={{ background:p.commissionBold?"#E1F5EE":p.id==="professional"?"#E6F1FB":"#FFF8EC", border:`1.5px solid ${p.commissionBold?"#B5F5D8":p.id==="professional"?"#B5D4F4":"#F5C97A"}`, borderRadius:8, padding:"7px 10px", marginBottom: p.id==="professional"?6:14 }}>
                  <div style={{ fontSize:9, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 }}>Commission on completed jobs</div>
                  <div style={{ fontSize:12, fontWeight:800, color:p.commissionColor, display:"flex", alignItems:"center", gap:4 }}>
                    {p.commissionBold && <span></span>}
                    {p.commission}
                  </div>
                </div>
                {p.id==="professional" && (
                  <div style={{ fontSize:10, color:"#185FA5", fontWeight:600, marginBottom:12, padding:"5px 8px", background:"rgba(24,95,165,0.06)", borderRadius:6, lineHeight:1.5 }}>
                     On a $10K job, the 1.5% commission saving ($150) nearly pays for the plan on its own.
                  </div>
                )}

                <div style={{ borderTop:"1px solid #E8E6DF", paddingTop:12, display:"flex", flexDirection:"column", gap:6 }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display:"flex", alignItems:"flex-start", gap:7, fontSize:12, color:"#2C2C2A", lineHeight:1.4 }}>
                      <span style={{ color:p.color, fontWeight:700, flexShrink:0, marginTop:1 }}>✓</span>
                      {f}
                    </div>
                  ))}
                </div>
                {plan===p.id && (
                  <div style={{ marginTop:14, textAlign:"center", fontSize:11, fontWeight:700, color:p.color }}>✓ Selected</div>
                )}
                {/* Annual billing toggle — only shown when Elite is selected */}
                {p.id==="elite" && plan==="elite" && (
                  <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #F5C97A" }}
                    onClick={e=>e.stopPropagation()}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8, textAlign:"center" }}>Billing Cycle</div>
                    <div style={{ display:"flex", gap:0, borderRadius:9, border:"1.5px solid #D3D1C7" }}>
                      <button type="button" onClick={()=>setBillingCycle("monthly")}
                        style={{ flex:1, padding:"8px 0", border:"none", borderRadius:"8px 0 0 8px", background:billingCycle==="monthly"?"#0C447C":"#fff", color:billingCycle==="monthly"?"#fff":"#5F5E5A", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", borderRight:"1px solid #D3D1C7" }}>
                        Monthly<br />
                        <span style={{ fontSize:13, fontWeight:900 }}>$199/mo</span>
                      </button>
                      <button type="button" onClick={()=>setBillingCycle("annual")}
                        style={{ flex:1, padding:"8px 0", border:"none", borderRadius:"0 8px 8px 0", background:billingCycle==="annual"?"#0C447C":"#fff", color:billingCycle==="annual"?"#fff":"#5F5E5A", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", position:"relative" }}>
                        {billingCycle!=="annual" && (
                          <span style={{ position:"absolute", top:-11, left:"50%", transform:"translateX(-50%)", background:"#0F6E56", color:"#fff", fontSize:9, fontWeight:800, padding:"2px 8px", borderRadius:20, whiteSpace:"nowrap", boxShadow:"0 1px 4px rgba(0,0,0,0.15)" }}>Save {ELITE_ANNUAL_SAVINGS}</span>
                        )}
                        Annual<br />
                        <span style={{ fontSize:13, fontWeight:900 }}>{ELITE_ANNUAL_PRICE}/yr</span>
                      </button>
                    </div>
                    {billingCycle==="annual" && (
                      <div style={{ fontSize:11, color:"#0F6E56", fontWeight:600, textAlign:"center", marginTop:8, background:"#E1F5EE", borderRadius:8, padding:"6px 10px" }}>
                         You save {ELITE_ANNUAL_SAVINGS} compared to monthly billing
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Commission explainer */}
          <div style={{ background:"#0C447C", borderRadius:10, padding:"14px 18px", marginBottom:14, display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:24, flexShrink:0 }}></span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#fff", marginBottom:3 }}>How commission works</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.75)", lineHeight:1.6 }}>
                Starter and Professional plans include a flat 5% commission on each completed project — paid when the homeowner confirms completion. <strong style={{ color:"#EF9F27" }}>Elite members pay zero commission, ever.</strong> A contractor completing $10K/month in projects saves $500/month on Elite vs. Professional.
              </div>
            </div>
          </div>

          <div style={{ background:"#F8F7F4", borderRadius:10, border:"1px solid #E8E6DF", padding:"12px 16px", marginBottom:8, fontSize:13, color:"#5F5E5A", textAlign:"center" }}>
             Billing starts after your profile is complete. You can upgrade, downgrade, or cancel at any time from your account settings.
          </div>
        </div>
      )}

      {/* — STEP 2: YOUR INFO — */}
      {step===2 && (
        <div>
          {/* Selected plan reminder */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#E6F1FB", borderRadius:9, padding:"10px 16px", marginBottom:20, border:"1px solid #B5D4F4" }}>
            <div>
              <span style={{ fontSize:13, color:"#185FA5", fontWeight:600 }}>
                Plan: <strong>{PLANS.find(p=>p.id===plan)?.name}</strong>
                {plan==="elite"
                  ? billingCycle==="annual"
                    ? ` — ${ELITE_ANNUAL_PRICE}/year`
                    : ` — ${ELITE_MONTHLY_PRICE}/month`
                  : plan!=="starter" ? ` — ${PLANS.find(p=>p.id===plan)?.price}/mo` : " — Free"}
              </span>
              <span style={{ fontSize:11, color:PLANS.find(p=>p.id===plan)?.commissionColor, fontWeight:700, marginLeft:10 }}>
                · {PLANS.find(p=>p.id===plan)?.commission}
              </span>
              {plan==="elite" && billingCycle==="annual" && (
                <span style={{ fontSize:11, color:"#0F6E56", fontWeight:700, marginLeft:8 }}>. Saves {ELITE_ANNUAL_SAVINGS}/year</span>
              )}
            </div>
            <button type="button" onClick={()=>setStep(1)} style={{ fontSize:12, color:"#185FA5", background:"none", border:"none", cursor:"pointer", fontFamily:font, fontWeight:600, textDecoration:"underline" }}>Change</button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            <div>
              <label style={lblStyle}>Your Full Name <span style={{ color:"#A32D2D" }}>★</span></label>
              <input value={form.name} onChange={e=>set("name")(e.target.value)} placeholder="Mike Sandoval" style={inpStyle(errors.name)} />
              {errors.name && <div style={errStyle}>{errors.name}</div>}
            </div>
            <div>
              <label style={lblStyle}>Company Name <span style={{ color:"#A32D2D" }}>★</span></label>
              <input value={form.company} onChange={e=>set("company")(e.target.value)} placeholder="Sandoval Electric" style={inpStyle(errors.company)} />
              {errors.company && <div style={errStyle}>{errors.company}</div>}
            </div>
            <div>
              <label style={lblStyle}>Email Address <span style={{ color:"#A32D2D" }}>★</span></label>
              <input type="email" value={form.email} onChange={e=>set("email")(e.target.value)} placeholder="mike@sandovalelectric.com" style={inpStyle(errors.email)} />
              {errors.email && <div style={errStyle}>{errors.email}</div>}
            </div>
            <div>
              <label style={lblStyle}>Phone Number <span style={{ color:"#A32D2D" }}>★</span></label>
              <input type="tel" value={form.phone} onChange={e=>set("phone")(e.target.value)} placeholder="(619) 000-0000" style={inpStyle(errors.phone)} />
              {errors.phone && <div style={errStyle}>{errors.phone}</div>}
            </div>
            <div>
              <label style={lblStyle}>City</label>
              <input value={form.city} onChange={e=>set("city")(e.target.value)} placeholder="San Diego" style={inpStyle(false)} />
            </div>
            <div>
              <label style={lblStyle}>Website <span style={{ fontSize:10, fontWeight:400, textTransform:"none", letterSpacing:0 }}>-- optional</span></label>
              <input value={form.website} onChange={e=>set("website")(e.target.value)} placeholder="www.mycompany.com" style={inpStyle(false)} />
            </div>
            <div>
              <label style={lblStyle}>Password <span style={{ color:"#A32D2D" }}>★</span></label>
              <input type="password" value={form.password} onChange={e=>set("password")(e.target.value)} placeholder="At least 6 characters" style={inpStyle(errors.password)} />
              {errors.password && <div style={errStyle}>{errors.password}</div>}
            </div>
            <div>
              <label style={lblStyle}>Confirm Password <span style={{ color:"#A32D2D" }}>★</span></label>
              <input type="password" value={form.confirmPassword} onChange={e=>set("confirmPassword")(e.target.value)} placeholder="********" style={inpStyle(errors.confirmPassword)} />
              {errors.confirmPassword && <div style={errStyle}>{errors.confirmPassword}</div>}
            </div>
          </div>
        </div>
      )}

      {/* — STEP 3: TRADES & AREA — */}
      {step===3 && (
        <div>
          <div style={{ marginBottom:24 }}>
            <label style={{ ...lblStyle, marginBottom:10 }}>What trades do you work in? <span style={{ color:"#A32D2D" }}>★</span></label>
            <p style={{ fontSize:13, color:"#888780", marginBottom:14 }}>Select all that apply. You'll only receive leads in your selected trades.</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:8 }}>
              {Object.entries(TRADES).map(([key, t]) => {
                const selected = form.trades.includes(key);
                return (
                  <button type="button" key={key} onClick={()=>toggleTrade(key)}
                    style={{ padding:"10px 12px", borderRadius:9, border:`${selected?"2px solid #0C447C":"1.5px solid #D3D1C7"}`, background:selected?"#E6F1FB":"#fff", cursor:"pointer", fontFamily:font, textAlign:"left", display:"flex", alignItems:"center", gap:8, transition:"all 0.15s" }}>
                    <span style={{ fontSize:18 }}>{t.icon}</span>
                    <span style={{ fontSize:13, fontWeight:selected?700:500, color:selected?"#0C447C":"#2C2C2A" }}>{key}</span>
                    {selected && <span style={{ marginLeft:"auto", fontSize:11, color:"#0C447C" }}>✓</span>}
                  </button>
                );
              })}
            </div>
            {errors.trades && <div style={{ ...errStyle, marginTop:8 }}>{errors.trades}</div>}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div>
              <label style={lblStyle}>Primary City <span style={{ color:"#A32D2D" }}>★</span></label>
              <input value={form.city} onChange={e=>set("city")(e.target.value)} placeholder="San Diego" style={inpStyle(errors.city)} />
              {errors.city && <div style={errStyle}>{errors.city}</div>}
            </div>
            <div>
              <label style={lblStyle}>Years in Business</label>
              <input type="number" value={form.years} onChange={e=>set("years")(e.target.value)} placeholder="e.g. 12" style={inpStyle(false)} />
            </div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={lblStyle}>Service Area</label>
              <input value={form.serviceArea} onChange={e=>set("serviceArea")(e.target.value)} placeholder="e.g. San Diego, Chula Vista, National City, El Cajon" style={inpStyle(false)} />
            </div>
          </div>
        </div>
      )}

      {/* — STEP 4: CREDENTIALS — */}
      {step===4 && (
        <div>
          <p style={{ fontSize:14, color:"#5F5E5A", marginBottom:20, lineHeight:1.65 }}>
            These details build trust with homeowners. Contractors with verified credentials win significantly more bids.
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
            <div>
              <label style={lblStyle}>CSLB License Number</label>
              <input value={form.licenseNum} onChange={e=>set("licenseNum")(e.target.value)} placeholder="e.g. 1049821" style={inpStyle(false)} />
              <div style={{ fontSize:11, color:"#888780", marginTop:4 }}>California State License Board number</div>
            </div>
            <div>
              <label style={lblStyle}>Insurance Provider</label>
              <input value={form.insurance} onChange={e=>set("insurance")(e.target.value)} placeholder="e.g. State Farm General Liability" style={inpStyle(false)} />
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:20 }}>
            {[
              ["licensed","I am a licensed contractor (CSLB)","Homeowners filter by this — it significantly increases your bids received."],
              ["insured","I carry general liability insurance","Required for most commercial jobs and many residential projects."],
              ["backgroundCheck","I have passed a background check","Adds trust and unlocks premium placement in search results."],
            ].map(([key, label, note]) => (
              <label key={key} style={{ display:"flex", alignItems:"flex-start", gap:12, cursor:"pointer", padding:"13px 16px", background:form[key]?"#E6F1FB":"#F8F7F4", borderRadius:10, border:`1.5px solid ${form[key]?"#185FA5":"#E8E6DF"}`, transition:"all 0.15s" }}>
                <input type="checkbox" checked={form[key]} onChange={e=>set(key)(e.target.checked)} style={{ marginTop:2, accentColor:"#0C447C", width:16, height:16, flexShrink:0, cursor:"pointer" }} />
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:form[key]?"#0C447C":"#2C2C2A" }}>{label}</div>
                  <div style={{ fontSize:12, color:"#888780", marginTop:2 }}>{note}</div>
                </div>
              </label>
            ))}
          </div>
          <div style={{ background:"#FAEEDA", borderRadius:10, padding:"12px 16px", border:"1px solid #EF9F27" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#854F0B", marginBottom:4 }}> How verification works</div>
            <p style={{ fontSize:12, color:"#2C2C2A", margin:0, lineHeight:1.6 }}>
              By checking these boxes you confirm this information is accurate. BuildConnect Pro may verify your license number with the CSLB. Misrepresentation results in permanent account removal.
            </p>
          </div>
        </div>
      )}

      {/* — STEP 5: BIO — */}
      {step===5 && (
        <div>
          <p style={{ fontSize:14, color:"#5F5E5A", marginBottom:20, lineHeight:1.65 }}>
            Your bio is the first thing homeowners read. Tell them who you are, what you specialize in, and why they should pick you.
          </p>
          <div style={{ marginBottom:20 }}>
            <label style={lblStyle}>Your Bio <span style={{ color:"#A32D2D" }}>★</span></label>
            <textarea value={form.bio} onChange={e=>set("bio")(e.target.value)}
              placeholder={`e.g. "Licensed ${form.trades[0]||"contractor"} with ${form.years||"10"}+ years serving San Diego..."`}
              rows={5}
              style={{ width:"100%", padding:"12px 14px", borderRadius:9, border:`1.5px solid ${errors.bio?"#A32D2D":"#D3D1C7"}`, fontSize:14, fontFamily:font, outline:"none", resize:"vertical", lineHeight:1.65, boxSizing:"border-box" }}
            />
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
              {errors.bio && <div style={errStyle}>{errors.bio}</div>}
              <span style={{ fontSize:11, color:form.bio.length<50?"#A32D2D":"#888780", marginLeft:"auto" }}>{form.bio.length} chars {form.bio.length<50?"-- aim for 50+":""}</span>
            </div>
          </div>

          {/* Profile preview */}
          {form.bio.trim().length > 10 && (
            <div style={{ background:"#F8F7F4", borderRadius:12, border:"1.5px solid #E8E6DF", padding:"18px 20px", marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>Profile Preview</div>
              <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:12 }}>
                <div style={{ width:44, height:44, borderRadius:10, background:"#E6F1FB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:900, color:"#0C447C", flexShrink:0 }}>
                  {form.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()||"??"}
                </div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#2C2C2A" }}>{form.name||"Your Name"}</div>
                  <div style={{ fontSize:12, color:"#5F5E5A" }}>{form.company||"Company"} · {form.city||"City"}, CA</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                {form.trades.slice(0,4).map(t=>(
                  <span key={t} style={{ fontSize:11, fontWeight:600, color:TRADES[t]?.color||"#0C447C", background:TRADES[t]?.bg||"#E6F1FB", borderRadius:20, padding:"3px 9px" }}>{t}</span>
                ))}
                {form.licensed && <span style={{ fontSize:11, fontWeight:700, color:"#0F6E56", background:"#E1F5EE", borderRadius:20, padding:"3px 9px" }}>✓ Licensed</span>}
                {form.insured && <span style={{ fontSize:11, fontWeight:700, color:"#185FA5", background:"#E6F1FB", borderRadius:20, padding:"3px 9px" }}>✓ Insured</span>}
              </div>
              <p style={{ fontSize:13, color:"#2C2C2A", lineHeight:1.65, margin:0, fontStyle:"italic" }}>"{form.bio}"</p>
            </div>
          )}

          {/* Final plan summary */}
          <div style={{ background:"#E1F5EE", borderRadius:10, padding:"14px 16px", border:"1px solid #B5F5D8", marginBottom:4 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#0F6E56", marginBottom:6 }}>✓ Almost done!</div>
            <div style={{ fontSize:13, color:"#2C2C2A", lineHeight:1.6 }}>
              You're signing up for the <strong>{PLANS.find(p=>p.id===plan)?.name}</strong> plan
              {plan!=="starter" && <> at <strong>{PLANS.find(p=>p.id===plan)?.price}/month</strong></>}.
              {plan==="starter" ? " You can upgrade anytime from your portal." : " Billing begins once your profile is live. Cancel anytime."}
            </div>
          </div>
        </div>
      )}

      {/* — STEP 6: BILLING — */}
      {step===6 && (
        <div>
          {/* Demo mode banner */}
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"#FAEEDA", border:"1.5px solid #EF9F27", borderRadius:10, padding:"10px 16px", marginBottom:24 }}>
            <span style={{ fontSize:16 }}></span>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#854F0B" }}>Prototype Mode</div>
              <div style={{ fontSize:12, color:"#2C2C2A", lineHeight:1.5 }}>Stripe billing is not yet connected. No real payment will be taken. This form is a prototype for the full billing integration coming soon.</div>
            </div>
          </div>

          {plan === "starter" ? (
            /* — FREE PLAN — no payment needed — */
            <div>
              <div style={{ textAlign:"center", padding:"32px 20px", background:"#E1F5EE", borderRadius:14, border:"1.5px solid #B5F5D8", marginBottom:20 }}>
                <div style={{ fontSize:44, marginBottom:12 }}></div>
                <h3 style={{ fontSize:20, fontWeight:800, color:"#0F6E56", marginBottom:8, letterSpacing:"-0.01em" }}>No payment required</h3>
                <p style={{ fontSize:14, color:"#2C2C2A", lineHeight:1.65, maxWidth:380, margin:"0 auto" }}>
                  Your Starter account is completely free — always. You can upgrade to Professional or Elite at any time from your portal settings.
                </p>
              </div>

              {/* What's included summary */}
              <div style={{ background:"#F8F7F4", borderRadius:12, border:"1.5px solid #E8E6DF", padding:"18px 20px" }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:12 }}>What you get with Starter</div>
                {["Profile listing in contractor directory","Browse all open leads in your area","Up to 3 bids per month","Messaging with homeowners","5 portfolio photos","Basic invoicing (up to 5/month)","Access to the contractor portal"].map(f=>(
                  <div key={f} style={{ display:"flex", gap:9, alignItems:"center", fontSize:13, color:"#2C2C2A", marginBottom:7 }}>
                    <span style={{ color:"#0F6E56", fontWeight:700, flexShrink:0 }}>✓</span>{f}
                  </div>
                ))}
                <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #E8E6DF", fontSize:12, color:"#888780" }}>
                  Want unlimited bids and the full portal? Upgrade to Professional ($89/mo) or Elite ($199/mo) anytime from your account settings.
                </div>
              </div>
            </div>

          ) : (
            /* — PAID PLAN — billing form — */
            <div>
              {/* Order summary */}
              <div style={{ background:"#0C447C", borderRadius:12, padding:"20px 22px", marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.55)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Order Summary</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800, color:"#fff" }}>BuildConnect Pro {PLAN_META[plan]?.name}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginTop:2 }}>{PLAN_META[plan]?.detail}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:28, fontWeight:900, color:"#EF9F27", letterSpacing:"-0.02em" }}>{PLAN_META[plan]?.price}</div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>{PLAN_META[plan]?.cycle}</div>
                  </div>
                </div>
                <div style={{ borderTop:"1px solid rgba(255,255,255,0.15)", paddingTop:10, display:"flex", justifyContent:"space-between", fontSize:12, color:"rgba(255,255,255,0.6)" }}>
                  <span>First charge</span>
                  <span style={{ color:"#fff", fontWeight:600 }}>Today — {PLAN_META[plan]?.price}{PLAN_META[plan]?.cycle}</span>
                </div>
              </div>

              {/* Payment form */}
              <div style={{ background:"#fff", borderRadius:12, border:"1.5px solid #D3D1C7", padding:"22px" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
                  <span></span> Payment Details
                  <span style={{ marginLeft:"auto", display:"flex", gap:6 }}>
                    {["VISA","MC","AMEX"].map(n=>(
                      <span key={n} style={{ fontSize:9, fontWeight:800, color:"#888780", background:"#F1EFE8", border:"1px solid #D3D1C7", borderRadius:4, padding:"2px 6px", letterSpacing:"0.04em" }}>{n}</span>
                    ))}
                  </span>
                </div>

                {/* Cardholder name */}
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>
                    Cardholder Name
                  </label>
                  <input value={billing.cardName} onChange={e=>setBill("cardName")(e.target.value)} placeholder="Jane Smith"
                    style={{ width:"100%", padding:"11px 14px", borderRadius:9, border:`1.5px solid ${errors.cardName?"#A32D2D":"#D3D1C7"}`, fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box" }} />
                  {errors.cardName && <div style={{ fontSize:12, color:"#A32D2D", marginTop:4 }}>{errors.cardName}</div>}
                </div>

                {/* Card number */}
                <div style={{ marginBottom:14 }}>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>
                    Card Number
                  </label>
                  <div style={{ position:"relative" }}>
                    <input value={billing.cardNumber} onChange={e=>setBill("cardNumber")(fmtCard(e.target.value))} placeholder="1234 5678 9012 3456" maxLength={19}
                      style={{ width:"100%", padding:"11px 44px 11px 14px", borderRadius:9, border:`1.5px solid ${errors.cardNumber?"#A32D2D":"#D3D1C7"}`, fontSize:14, fontFamily:"monospace, inherit", outline:"none", boxSizing:"border-box", letterSpacing:"0.08em" }} />
                    <span style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)", fontSize:18 }}>
                      {billing.cardNumber.startsWith("4")?"":billing.cardNumber.startsWith("5")?"":billing.cardNumber.startsWith("3")?"":""}
                    </span>
                  </div>
                  {errors.cardNumber && <div style={{ fontSize:12, color:"#A32D2D", marginTop:4 }}>{errors.cardNumber}</div>}
                </div>

                {/* Expiry + CVV + ZIP */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:6 }}>
                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Expiry</label>
                    <input value={billing.expiry} onChange={e=>setBill("expiry")(fmtExpiry(e.target.value))} placeholder="MM/YY" maxLength={5}
                      style={{ width:"100%", padding:"11px 14px", borderRadius:9, border:`1.5px solid ${errors.expiry?"#A32D2D":"#D3D1C7"}`, fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box" }} />
                    {errors.expiry && <div style={{ fontSize:11, color:"#A32D2D", marginTop:3 }}>{errors.expiry}</div>}
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>CVV</label>
                    <input value={billing.cvv} onChange={e=>setBill("cvv")(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="***" maxLength={4}
                      style={{ width:"100%", padding:"11px 14px", borderRadius:9, border:`1.5px solid ${errors.cvv?"#A32D2D":"#D3D1C7"}`, fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box" }} />
                    {errors.cvv && <div style={{ fontSize:11, color:"#A32D2D", marginTop:3 }}>{errors.cvv}</div>}
                  </div>
                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Billing ZIP</label>
                    <input value={billing.zip} onChange={e=>setBill("zip")(e.target.value.replace(/\D/g,"").slice(0,5))} placeholder="92101" maxLength={5}
                      style={{ width:"100%", padding:"11px 14px", borderRadius:9, border:`1.5px solid ${errors.zip?"#A32D2D":"#D3D1C7"}`, fontSize:14, fontFamily:font, outline:"none", boxSizing:"border-box" }} />
                    {errors.zip && <div style={{ fontSize:11, color:"#A32D2D", marginTop:3 }}>{errors.zip}</div>}
                  </div>
                </div>
              </div>

              {/* Security note */}
              <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:14, fontSize:12, color:"#888780" }}>
                <span style={{ fontSize:14 }}></span>
                <span>Your payment information is encrypted and never stored on our servers. Powered by Stripe.</span>
              </div>

              {/* What happens next */}
              <div style={{ background:"#F8F7F4", borderRadius:10, border:"1px solid #E8E6DF", padding:"14px 16px", marginTop:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>What happens after you subscribe</div>
                {[
                  "Your contractor portal is activated immediately",
                  "You'll receive a receipt at "+form.email,
                  "Access to leads begins as soon as your profile goes live",
                  "Cancel or change your plan anytime from portal settings",
                ].map((line,i)=>(
                  <div key={i} style={{ display:"flex", gap:9, fontSize:12, color:"#2C2C2A", marginBottom:5 }}>
                    <span style={{ color:"#0C447C", fontWeight:700, flexShrink:0 }}>{i+1}.</span>{line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation — always visible, consistent on every step */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:28, paddingTop:20, borderTop:"1px solid #F1EFE8" }}>
        <button type="button" onClick={goBack}
          style={{ padding:"11px 22px", borderRadius:9, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:font }}>
          {step === 1 ? "Exit" : "Back"}
        </button>

        {step === 1 ? (
          <button type="button" onClick={()=>setStep(2)}
            style={{ padding:"12px 32px", borderRadius:9, border:"none", background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font }}
            onMouseEnter={e=>e.currentTarget.style.background="#185FA5"}
            onMouseLeave={e=>e.currentTarget.style.background="#0C447C"}>
            Continue with {PLANS.find(p=>p.id===plan)?.name} &gt;
          </button>
        ) : step < 6 ? (
          <button type="button" onClick={next}
            style={{ padding:"12px 32px", borderRadius:9, border:"none", background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font }}
            onMouseEnter={e=>e.currentTarget.style.background="#185FA5"}
            onMouseLeave={e=>e.currentTarget.style.background="#0C447C"}>
            Continue &gt;
          </button>
        ) : (
          <button type="button" disabled={submitting} onClick={()=>{
            const e = validate(6);
            if (Object.keys(e).length) { setErrors(e); return; }
            submitSignup();
          }}
            style={{ padding:"12px 32px", borderRadius:9, border:"none", background:submitting?"#B4B2A9":"#0F6E56", color:"#fff", fontSize:15, fontWeight:800, cursor:submitting?"not-allowed":"pointer", fontFamily:font }}
            onMouseEnter={e=>!submitting && (e.currentTarget.style.background="#0D5E49")}
            onMouseLeave={e=>!submitting && (e.currentTarget.style.background="#0F6E56")}>
            {submitting ? "Creating account..." : plan==="starter" ? "Create My Free Account ->"
              : plan==="elite" && billingCycle==="annual"
              ? `Start Elite Plan — ${ELITE_ANNUAL_PRICE}/year ->`
              : `Activate ${PLANS.find(p=>p.id===plan)?.name} Plan ->`}
          </button>
        )}
      </div>
      <div style={{ textAlign:"center", marginTop:12, fontSize:12, color:"#B4B2A9" }}>Step {step} of {STEPS.length}</div>
    </div>
  );
}

