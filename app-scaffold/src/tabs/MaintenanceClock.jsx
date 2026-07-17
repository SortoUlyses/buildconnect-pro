import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { ReminderCard } from "./ReminderCard.jsx";

// — Maintenance Schedule Rules ------------------------------------------------
// Each trade maps to an array of reminder rules.
// { years, label, description, urgency: "routine"|"important"|"urgent" }
export const MAINTENANCE_SCHEDULE = {
  "HVAC": [
    { years:1,  label:"Annual HVAC Service",      desc:"Schedule a tune-up and filter replacement. Catching small issues early prevents costly breakdowns.", urgency:"routine"   },
    { years:3,  label:"Coil & Duct Inspection",   desc:"Have the evaporator coil and ductwork inspected for buildup, leaks, or mold growth.",               urgency:"routine"   },
    { years:7,  label:"Refrigerant Check",        desc:"Refrigerant levels degrade over time. A low-refrigerant system works harder and fails sooner.",      urgency:"important" },
    { years:12, label:"System Evaluation",        desc:"HVAC systems typically last 12-15 years. Get an assessment before a breakdown forces your hand.",     urgency:"important" },
    { years:15, label:"Consider Replacement",     desc:"At 15 years, replacement is often more cost-effective than continued repair. Start planning now.",    urgency:"urgent"    },
  ],
  "Roofing": [
    { years:2,  label:"Roof Inspection",          desc:"Inspect flashing, sealants, and field for cracking or shifting — especially after storm season.",     urgency:"routine"   },
    { years:5,  label:"Flashing & Sealant Check", desc:"Flashing is the most common source of roof leaks. Reseal penetrations around vents and chimneys.",   urgency:"important" },
    { years:10, label:"Full Roof Assessment",     desc:"Have a licensed roofer assess lifespan. Tile roofs last 25-50 years; shingles 20-30 years in SD.",   urgency:"important" },
    { years:20, label:"Replacement Planning",     desc:"Asphalt shingle roofs approaching end-of-life. Budget for replacement before leaks begin.",           urgency:"urgent"    },
  ],
  "Electrical": [
    { years:3,  label:"GFCI & Breaker Test",      desc:"Test all GFCI outlets and breakers. Faulty breakers are a fire hazard and often go unnoticed.",      urgency:"routine"   },
    { years:5,  label:"Panel Inspection",         desc:"Have a licensed electrician inspect your panel for signs of corrosion, burning, or loose connections.",urgency:"important" },
    { years:10, label:"Full Electrical Audit",    desc:"Homes over 10 years benefit from a full audit — especially if you've added EV chargers or solar.",    urgency:"important" },
  ],
  "Plumbing": [
    { years:2,  label:"Water Heater Flush",       desc:"Flush sediment from your water heater tank annually to extend lifespan and maintain efficiency.",      urgency:"routine"   },
    { years:5,  label:"Pipe Inspection",          desc:"Inspect exposed pipes and fittings for corrosion, especially in older homes with galvanized pipes.",   urgency:"routine"   },
    { years:10, label:"Sewer Line Scope",         desc:"Have your main sewer line scoped for root intrusion or buildup. Prevention is far cheaper than repair.",urgency:"important"},
    { years:15, label:"Water Heater Replacement", desc:"Most water heaters last 10-15 years. Replace before failure to avoid water damage.",                  urgency:"urgent"    },
  ],
  "Remodel": [
    { years:5,  label:"Caulk & Grout Inspection",desc:"Kitchen and bath caulk deteriorates in 5-7 years. Reapply to prevent water intrusion behind walls.",  urgency:"routine"   },
    { years:10, label:"Countertop & Fixture Check",desc:"Inspect countertops, under-sink plumbing, and fixtures for wear, staining, or leaks.",              urgency:"routine"   },
    { years:15, label:"Consider Refresh",         desc:"A 15-year-old kitchen or bath is approaching the end of its design life. A refresh adds real value.", urgency:"important" },
  ],
  "Flooring": [
    { years:5,  label:"Refinishing Assessment",   desc:"Hardwood floors typically need refinishing every 7-10 years. Check for scratches, dullness, or gaps.", urgency:"routine"   },
    { years:10, label:"Subfloor Inspection",      desc:"Inspect for soft spots, squeaks, or moisture damage, especially in bathrooms and kitchens.",           urgency:"important" },
  ],
  "Painting": [
    { years:5,  label:"Exterior Touch-Up",        desc:"San Diego's coastal air degrades exterior paint faster. Touch up peeling areas before moisture intrudes.",urgency:"routine" },
    { years:8,  label:"Full Repaint Assessment",  desc:"Most exterior paint jobs last 7-10 years in San Diego. Assess for full repaint to protect your siding.", urgency:"important"},
    { years:5,  label:"Interior Touch-Up",        desc:"High-traffic areas — hallways, kitchens, kids' rooms — typically need touch-up paint every 3-5 years.", urgency:"routine"  },
  ],
  "Concrete": [
    { years:3,  label:"Sealant Reapplication",    desc:"Concrete driveways and patios should be resealed every 2-3 years to prevent cracking and staining.",  urgency:"routine"   },
    { years:7,  label:"Crack Inspection",         desc:"Inspect for widening cracks or heaving. Addressing early prevents expensive replacement later.",        urgency:"important" },
  ],
  "Landscaping": [
    { years:2,  label:"Irrigation System Check",  desc:"Check drip lines, sprinkler heads, and timers. Inefficient irrigation is the #1 water waste in SD.",  urgency:"routine"   },
    { years:5,  label:"Tree & Plant Assessment",  desc:"Assess mature trees for dead limbs, root intrusion, or fire risk — important in San Diego hillside areas.",urgency:"important"},
  ],
  "Solar": [
    { years:1,  label:"Panel Cleaning",           desc:"Clean solar panels annually. Dust and bird droppings in San Diego reduce output by 15-25%.",           urgency:"routine"   },
    { years:5,  label:"Inverter Inspection",      desc:"Inverters typically last 10-15 years. Have yours inspected and firmware updated at the 5-year mark.",   urgency:"important" },
    { years:10, label:"System Performance Review",desc:"Compare current output to installation baseline. Significant degradation means panel or inverter issues.",urgency:"important"},
    { years:12, label:"Battery Health Check",     desc:"If you have battery storage, check capacity and cells at 12 years. Replacement planning should begin.", urgency:"urgent"    },
  ],
  "Windows": [
    { years:5,  label:"Seal & Weather Strip Check",desc:"Window seals fail over time — look for fogging between panes (seal failure) or drafts around frames.",urgency:"routine"   },
    { years:15, label:"Frame & Hardware Inspection",desc:"Check all frames, locks, and hinges for corrosion or failure, especially in coastal San Diego salt air.",urgency:"important"},
  ],
  "Pool": [
    { years:1,  label:"Annual Pool Service",      desc:"Check plaster, tile, coping, and equipment. Annual service prevents costly resurfacing.",               urgency:"routine"   },
    { years:5,  label:"Equipment Inspection",     desc:"Inspect pump, filter, heater, and automation. Replacing early avoids mid-summer failures.",            urgency:"important" },
    { years:10, label:"Plaster Assessment",       desc:"Pool plaster typically lasts 10-15 years. A professional assessment now avoids emergency resurfacing.", urgency:"urgent"    },
  ],
  "Insulation": [
    { years:10, label:"Insulation Inspection",    desc:"Check attic insulation for settling, moisture damage, or pest activity. Depleted insulation wastes energy significantly.", urgency:"routine" },
  ],
};

// — Maintenance Clock / Maintenance Calendar -------------------------------------
export function MaintenanceClock({ records, onNavigate }) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const today = new Date();

  const reminders = records
    .filter(r => r.isVerified && r.trade)
    .flatMap(r => {
      const rules = MAINTENANCE_SCHEDULE[r.trade] || [];
      const base  = r.completedOn ? new Date(r.completedOn) : new Date(today.getFullYear() - 1, 0, 1);
      if (isNaN(base)) return [];
      return rules.map(rule => {
        const due = new Date(base);
        due.setFullYear(due.getFullYear() + rule.years);
        const msLeft   = due - today;
        const daysLeft = Math.round(msLeft / (1000 * 60 * 60 * 24));
        const yearsLeft = msLeft / (1000 * 60 * 60 * 24 * 365);
        return {
          id:        `${r.id}-${rule.years}`,
          projectTitle: r.title,
          trade:     r.trade,
          label:     rule.label,
          desc:      rule.desc,
          urgency:   rule.urgency,
          due,
          daysLeft,
          yearsLeft,
          isPast:    daysLeft < 0,
          isNear:    daysLeft >= 0 && daysLeft <= 180,
          isSoon:    daysLeft > 180 && daysLeft <= 365,
        };
      });
    })
    .sort((a, b) => a.due - b.due);

  const overdue  = reminders.filter(r => r.isPast);
  const near     = reminders.filter(r => r.isNear);
  const upcoming = reminders.filter(r => !r.isPast && !r.isNear);

  const urgencyDot = u => ({ routine:"#185FA5", important:"#EF9F27", urgent:"#A32D2D" }[u] || "#185FA5");

  if (reminders.length === 0) {
    return (
      <div style={{ textAlign:"center", padding:"48px 24px", background:"#F8F7F4", borderRadius:14, border:"1.5px solid #E8E6DF", fontFamily:font }}>
        <div style={{ fontSize:48, marginBottom:14 }}></div>
        <div style={{ fontSize:16, fontWeight:800, color:"#0C447C", marginBottom:8 }}>Your Maintenance Clock starts with your first completed project</div>
        <p style={{ fontSize:14, color:"#5F5E5A", lineHeight:1.7, maxWidth:420, margin:"0 auto 20px" }}>
          Complete a project through BuildConnect Pro and we'll automatically build you a personalised maintenance calendar — reminders for every system in your home, for years to come.
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily:font }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg, #082E56 0%, #0C447C 100%)", borderRadius:14, padding:"24px 28px", marginBottom:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8 }}> Maintenance Clock</div>
            <h3 style={{ fontSize:22, fontWeight:900, color:"#fff", letterSpacing:"-0.02em", margin:"0 0 6px" }}>Your home maintenance calendar</h3>
            <p style={{ fontSize:13, color:"rgba(255,255,255,0.65)", lineHeight:1.65, margin:0, maxWidth:480 }}>
              Built automatically from your completed projects. Every system in your home has a lifespan — we track it so you never get caught off guard.
            </p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, flexShrink:0 }}>
            {[
              [overdue.length,  "Overdue",   "#FCEBEB", "#A32D2D"],
              [near.length,     "Due Soon",  "#FAEEDA", "#854F0B"],
              [upcoming.length, "Upcoming",  "rgba(255,255,255,0.1)", "rgba(255,255,255,0.7)"],
            ].map(([count,label,bg,color])=>(
              <div key={label} style={{ background:bg, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
                <div style={{ fontSize:22, fontWeight:900, color }}>{count}</div>
                <div style={{ fontSize:10, color, fontWeight:600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overdue */}
      {overdue.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#A32D2D", textTransform:"uppercase", letterSpacing:"0.06em" }}>! Overdue</div>
            <div style={{ flex:1, height:1, background:"#F3C6C6" }} />
            <span style={{ fontSize:11, color:"#A32D2D" }}>{overdue.length} item{overdue.length!==1?"s":""}</span>
          </div>
          {overdue.map(r=><ReminderCard key={r.id} r={r} onNavigate={onNavigate} />)}
        </div>
      )}

      {/* Due within 6 months */}
      {near.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#854F0B", textTransform:"uppercase", letterSpacing:"0.06em" }}> Due Within 6 Months</div>
            <div style={{ flex:1, height:1, background:"#F5C97A" }} />
            <span style={{ fontSize:11, color:"#854F0B" }}>{near.length} item{near.length!==1?"s":""}</span>
          </div>
          {near.map(r=><ReminderCard key={r.id} r={r} onNavigate={onNavigate} />)}
        </div>
      )}

      {/* All upcoming — grouped by project */}
      {upcoming.length > 0 && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.06em" }}> Upcoming Schedule</div>
            <div style={{ flex:1, height:1, background:"#E8E6DF" }} />
            <span style={{ fontSize:11, color:"#888780" }}>{upcoming.length} future reminder{upcoming.length!==1?"s":""}</span>
          </div>

          {/* Timeline view */}
          <div style={{ position:"relative", paddingLeft:24 }}>
            <div style={{ position:"absolute", left:8, top:0, bottom:0, width:2, background:"#E8E6DF", borderRadius:2 }} />
            {upcoming.map((r, i) => {
              const dotColor = urgencyDot(r.urgency);
              const badgeColor = r.urgency==="urgent" ? "#A32D2D" : r.urgency==="important" ? "#854F0B" : "#185FA5";
              const badgeBg    = r.urgency==="urgent" ? "#FCEBEB" : r.urgency==="important" ? "#FAEEDA" : "#E6F1FB";
              const dueLabel = r.isPast
                ? (Math.abs(Math.round(r.daysLeft/30)) < 1 ? "Overdue" : `${Math.abs(Math.round(r.daysLeft/30))} mo overdue`)
                : r.daysLeft < 30  ? `${r.daysLeft} days`
                : r.daysLeft < 365 ? `${Math.round(r.daysLeft/30)} months`
                : `${Math.round(r.yearsLeft*10)/10} yrs`;
              return (
                <div key={r.id} style={{ position:"relative", marginBottom:14 }}>
                  <div style={{ position:"absolute", left:-20, top:14, width:12, height:12, borderRadius:"50%", background:dotColor, border:"2px solid #fff", boxShadow:"0 0 0 2px "+dotColor+"40" }} />
                  <div style={{ background:"#fff", border:"1.5px solid #E8E6DF", borderRadius:12, padding:"13px 16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <div style={{ fontSize:10, color:"#888780", fontWeight:600 }}>{r.projectTitle} · {r.trade}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:badgeColor, background:badgeBg, borderRadius:20, padding:"2px 9px" }}>{dueLabel}</div>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A", marginBottom:3 }}>{r.label}</div>
                    <div style={{ fontSize:12, color:"#5F5E5A", lineHeight:1.55 }}>{r.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer note */}
      <div style={{ background:"#F8F7F4", borderRadius:12, border:"1px solid #E8E6DF", padding:"14px 18px", marginTop:20, fontSize:12, color:"#5F5E5A", lineHeight:1.7 }}>
        <strong style={{ color:"#0C447C" }}> Your maintenance history stays with BuildConnect Pro.</strong>{" "}
        Every reminder, every project, every timeline — permanently stored so you never lose track of what's been done to your home.
        The longer you're on the platform, the more valuable your history becomes.
      </div>
    </div>
  );
}

