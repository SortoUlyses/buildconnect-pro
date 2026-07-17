import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { MATCHED_CONTRACTORS } from "../demoData.js";


// Top-level helper — must be outside HomeLandingView to prevent scroll-reset on re-render
export const LandingSec = ({ children, bg="#fff", pad="60px 32px" }) => (
  <div style={{ background:bg, padding:pad }}>
    <div style={{ maxWidth:880, margin:"0 auto" }}>{children}</div>
  </div>
);

export function HomeLandingView({ onNavigate, onOpenMatched, onOpenProfile }) {
  // ALL hooks must be declared first
  const [estProp, setEstProp] = useState("");
  const [estTrade, setEstTrade] = useState("");
  const [estScope, setEstScope] = useState("");
  const [estResult, setEstResult] = useState(null);
  const [quickLead, setQuickLead] = useState({ trade:"", zip:"", name:"", phone:"" });
  const [quickSubmitted, setQuickSubmitted] = useState(false);

  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // Real 2025-2026 San Diego market data — sourced from local contractors and industry reports
  const EST_DATA = {
    residential: {
      "HVAC": {
        "Basic System":    { range:"$6,500 - $9,500",   timeline:"1-2 days",    includes:"New standard-efficiency unit, labor, permit, disposal of old system. Best for smaller homes under 1,500 sq ft.", note:"If ductwork needs repair, add $2,000-$5,000." },
        "Mid-Range":       { range:"$9,000 - $13,000",  timeline:"1-3 days",    includes:"Higher-efficiency unit (16+ SEER), labor, permit, duct inspection, thermostat. Typical 3-ton system for 1,500-2,500 sq ft home." },
        "High-Efficiency": { range:"$12,000 - $18,000+", timeline:"2-3 days",   includes:"Heat pump or multi-zone mini-split, high SEER2 rating, labor, permits. Qualifies for SDGE rebates and California energy credits." },
      },
      "Electrical": {
        "Panel Upgrade":   { range:"$3,500 - $6,500",   timeline:"1 day",       includes:"200-amp panel replacement, labor, city permit, inspection. Required for EV chargers, solar, or older homes on 100-amp service." },
        "Rewire / Outlets":{ range:"$4,000 - $12,000",  timeline:"2-5 days",    includes:"Partial or full home rewire, new circuits, GFCI outlets, labor and permits. Cost scales with home size." },
        "EV Charger":      { range:"$800 - $2,500",     timeline:"Half day",    includes:"Level 2 charger installation (240V), dedicated circuit, labor. Panel upgrade may be needed separately.", note:"Panel upgrade may add $3,500-$6,500 if not already 200-amp." },
      },
      "Plumbing": {
        "Repairs & Fixtures":  { range:"$500 - $3,500",    timeline:"Half-1 day",  includes:"Leak repairs, fixture replacements, drain cleaning, water heater service. Most common residential plumbing calls." },
        "Repipe (Partial)":    { range:"$4,000 - $9,000",  timeline:"2-4 days",    includes:"Partial copper or PEX repipe, labor, permits. Common in homes built before 1980 with galvanized pipes." },
        "Full Repipe":         { range:"$9,000 - $18,000", timeline:"3-7 days",    includes:"Whole-home PEX repipe, labor, permits, drywall patching. Eliminates rust, low pressure, and recurring leaks." },
      },
      "Roofing": {
        "Asphalt Shingle":  { range:"$12,000 - $22,000", timeline:"2-4 days",    includes:"Tear-off of existing roof, new 30-year architectural shingles, underlayment, flashing, permit. Most common San Diego residential choice." },
        "Tile Roof":        { range:"$22,000 - $45,000", timeline:"5-10 days",   includes:"Concrete or clay tile, high-strength underlayment, new flashing, labor and permit. Longer lifespan in San Diego's climate." },
        "Metal Roof":       { range:"$28,000 - $55,000", timeline:"5-8 days",    includes:"Standing seam or metal shingle, 50-year lifespan, fire-resistant. Popular in high fire-risk hillside neighborhoods." },
      },
      "Remodel": {
        "Kitchen (Minor)":  { range:"$25,000 - $45,000", timeline:"3-6 weeks",   includes:"Cabinet refacing, new countertops, appliances, lighting, paint. No layout changes. 87% cost recouped at resale per 2024 Remodeling Magazine." },
        "Kitchen (Full)":   { range:"$50,000 - $100,000", timeline:"6-12 weeks", includes:"New layout, custom cabinets, quartz/granite counters, appliances, flooring, permits. San Diego labor 23% above national avg." },
        "Bathroom":         { range:"$15,000 - $40,000", timeline:"2-5 weeks",   includes:"New tile, vanity, fixtures, shower/tub, lighting, ventilation. Full gut runs higher; cosmetic refresh on the low end." },
      },
      "Flooring": {
        "Luxury Vinyl (LVP)":  { range:"$4,000 - $9,000",  timeline:"1-3 days",  includes:"LVP material at $3-$5/sq ft, labor, subfloor prep. Water-resistant and popular in San Diego coastal homes." },
        "Hardwood":            { range:"$9,000 - $20,000",  timeline:"3-5 days",  includes:"Solid or engineered hardwood at $8-$15/sq ft installed. Refinishable and adds home value." },
        "Tile":                { range:"$6,000 - $16,000",  timeline:"3-7 days",  includes:"Porcelain or ceramic tile, labor, grout, subfloor prep. Common for kitchens, baths, and outdoor patios." },
      },
      "Painting": {
        "Interior (Full Home)":  { range:"$4,000 - $9,000",  timeline:"3-5 days",  includes:"Walls, ceilings, trim, 2 coats, prep and patching. 2,000 sq ft home. Premium paints for durability in San Diego's coastal air." },
        "Exterior":              { range:"$5,000 - $14,000",  timeline:"3-7 days",  includes:"Power wash, scrape, prime, 2 coats exterior paint, caulking. Stucco homes common in SD — may need texture repair." },
        "Single Room":           { range:"$500 - $1,800",     timeline:"Half-1 day", includes:"One room walls and ceiling, prep, 2 coats. Price varies with room size and ceiling height." },
      },
      "Concrete": {
        "Driveway":          { range:"$5,000 - $14,000",  timeline:"2-4 days",    includes:"Demo of old driveway, new concrete pour, rebar, sealing. Typical 2-car driveway 500-700 sq ft." },
        "Patio / Walkway":   { range:"$3,500 - $9,000",   timeline:"2-3 days",    includes:"New concrete patio or walkway, forms, pour, finish. Decorative stamped concrete adds 20-40%." },
        "Foundation Work":   { range:"$8,000 - $30,000",  timeline:"1-3 weeks",   includes:"Foundation crack repair, underpinning, stem wall work. Highly variable based on scope and soil conditions.", note:"Always get a structural engineer assessment before work begins." },
      },
      "Landscaping": {
        "Lawn & Plants":     { range:"$3,000 - $10,000",  timeline:"1-3 days",    includes:"Sod or drought-tolerant plants, basic irrigation, mulch. San Diego water costs make drought-tolerant design popular." },
        "Hardscape & Design":{ range:"$12,000 - $40,000", timeline:"1-3 weeks",   includes:"Pavers, retaining walls, built-in planters, lighting, irrigation design. Tiered yards add complexity." },
        "Full Backyard":     { range:"$30,000 - $80,000", timeline:"3-8 weeks",   includes:"Complete landscape design, hardscape, planting, irrigation, lighting. Pool-ready prep adds cost." },
      },
      "Solar": {
        "Small System (4-5 kW)":  { range:"$10,500 - $14,000",  timeline:"1-2 days install + 4-8 weeks permitting", includes:"12-15 panels, inverter, monitoring, labor, permits, SDG&E interconnection. Offsets ~60-75% of avg. usage.", note:"Federal residential ITC (30%) expired end of 2025. California SGIP battery rebates still available. NEM 3.0 export rates are lower — battery storage now recommended." },
        "Mid System (6-8 kW)":    { range:"$14,700 - $20,000",  timeline:"1-2 days install + 4-8 weeks permitting", includes:"18-24 panels, string or microinverters, monitoring, permits, interconnection. Average San Diego home offset." },
        "Large + Battery (9-12 kW)":{ range:"$22,000 - $38,000", timeline:"2-3 days install", includes:"Full home offset + Powerwall or Enphase battery backup, panels, labor, permits. Best for whole-home energy independence." },
      },
      "Pool": {
        "Basic In-Ground":    { range:"$75,000 - $95,000",   timeline:"10-16 weeks", includes:"Gunite construction, standard plaster, basic coping, filtration, pump, permit. Typical 400-500 sq ft pool.", note:"San Diego Coastal Commission setbacks may apply in some neighborhoods." },
        "Mid-Range":          { range:"$95,000 - $130,000",  timeline:"12-20 weeks", includes:"Pebble finish, tile, water features, upgraded LED lighting, heater, variable-speed pump, landscaping." },
        "Premium / Custom":   { range:"$130,000 - $200,000+", timeline:"16-30 weeks", includes:"Custom shape, spa, automation system, premium finishes, solar heating, outdoor kitchen integration." },
      },
      "Windows": {
        "1-5 Windows":       { range:"$1,500 - $6,000",   timeline:"Half-1 day",  includes:"Vinyl or fiberglass dual-pane windows, installation, haul-away. $400-$900 per window installed is typical in SD." },
        "Full Home (10-15 Windows)":{ range:"$8,000 - $20,000", timeline:"1-3 days", includes:"All windows, vinyl or fiberglass frames, Low-E glass, labor. May qualify for SDG&E energy rebates." },
        "Premium / Impact":  { range:"$18,000 - $40,000", timeline:"2-5 days",    includes:"Fiberglass or aluminum frames, hurricane/impact rated, Low-E glass. Popular in coastal and hillside San Diego." },
      },
      "Framing": {
        "Room Addition":     { range:"$25,000 - $60,000",  timeline:"4-8 weeks",   includes:"Framing, sheathing, structural work for 200-400 sq ft addition. Permits, foundation, MEP rough-in not included.", note:"Permit costs in San Diego average $3,000-$10,000 for additions." },
        "ADU / Garage Convert":{ range:"$80,000 - $150,000", timeline:"3-6 months", includes:"Full ADU conversion or new detached unit, framing, insulation, MEP, finishes, permits. SD allows ADUs on most R1 lots." },
        "New Construction":  { range:"$250,000 - $500,000+", timeline:"6-12 months", includes:"Custom new home framing, foundation, all structural work. SD labor costs run 23% above national average." },
      },
      "Insulation": {
        "Attic (Blown-In)":  { range:"$2,000 - $5,000",   timeline:"Half-1 day",  includes:"Blown-in fiberglass or cellulose to R-38+, labor. Most effective upgrade for SD homes — reduces cooling costs." },
        "Full Home":         { range:"$5,000 - $12,000",  timeline:"2-4 days",    includes:"Walls, attic, crawlspace insulation. Often done during remodel or re-roof. May qualify for SDG&E rebates." },
        "Spray Foam":        { range:"$8,000 - $18,000",  timeline:"2-3 days",    includes:"Closed-cell spray foam, highest R-value per inch, air sealing. Ideal for older San Diego homes with poor air sealing." },
      },
      "Demolition": {
        "Interior Demo":     { range:"$3,000 - $8,000",   timeline:"1-3 days",    includes:"Demo of walls, flooring, fixtures, debris hauling. Typical prep for kitchen or bath remodel." },
        "Structure Removal": { range:"$8,000 - $25,000",  timeline:"2-5 days",    includes:"Detached garage, shed, or pool demolition, permit, haul-away. Cost varies with structure size and access." },
        "Full House Demo":   { range:"$15,000 - $40,000", timeline:"1-2 weeks",   includes:"Complete structure demolition, debris removal, grading. Asbestos and lead testing may add $2,000-$5,000.", note:"San Diego requires demolition permit — average $500-$2,000." },
      },
      "Asphalt": {
        "Driveway Reseal":   { range:"$300 - $900",       timeline:"Half day",    includes:"Power clean, crack fill, asphalt sealer. 500-800 sq ft driveway. Recommended every 3-5 years." },
        "Driveway Replace":  { range:"$4,000 - $12,000",  timeline:"1-2 days",    includes:"Tear-out, new asphalt base and surface, compaction. Concrete is more popular in SD but asphalt is more affordable." },
        "Parking Lot":       { range:"$15,000 - $60,000", timeline:"2-5 days",    includes:"Commercial or HOA lot, crack repair, new asphalt layer or full replace, striping." },
      },
      "Locksmith": {
        "Rekey / Lock Change": { range:"$150 - $400",     timeline:"1-2 hours",   includes:"Rekey up to 5 locks, new keys cut. Standard for move-in or lost key situations." },
        "Smart Lock Install":  { range:"$300 - $900",     timeline:"2-4 hours",   includes:"Smart lock hardware, installation, app setup, existing deadbolt may be reused." },
        "Full Home Security":  { range:"$1,500 - $5,000", timeline:"Half-1 day",  includes:"All exterior locks, smart deadbolts, keypad entry, sliding door locks, garage door keyed entry." },
      },
      "Trucking": {
        "Single Load Hauling":  { range:"$300 - $800",     timeline:"Half day",    includes:"One truck load of debris or materials, fuel, dump fees. Common for cleanouts and post-demo." },
        "Project Hauling":      { range:"$1,500 - $5,000", timeline:"1-3 days",    includes:"Multi-load material delivery or debris removal throughout a project. Coordinated with general contractor." },
        "Site Prep & Grading":  { range:"$3,000 - $12,000", timeline:"1-3 days",   includes:"Excavation equipment, grading, soil compaction, haul-away. Required before pool, ADU, or landscaping." },
      },
    },
    commercial: {
      "HVAC": {
        "Small Office / Retail": { range:"$15,000 - $40,000",  timeline:"3-7 days",   includes:"Package rooftop unit or split system for under 2,000 sq ft commercial space, labor, permits, controls." },
        "Mid-Size Building":     { range:"$40,000 - $150,000", timeline:"1-3 weeks",  includes:"Multiple zones, VAV system, commercial-grade units, ductwork modifications, BMS controls, permits." },
        "Large Commercial":      { range:"$150,000 - $500,000+", timeline:"1-3 months", includes:"Full commercial HVAC system, chiller/boiler, BMS integration, all trades coordination, city permits." },
      },
      "Electrical": {
        "Tenant Improvement":    { range:"$15,000 - $50,000",  timeline:"1-2 weeks",  includes:"Panel upgrade, new circuits, lighting, outlets for commercial tenant space buildout. Permit required." },
        "Service Upgrade":       { range:"$20,000 - $80,000",  timeline:"3-10 days",  includes:"800A-2,000A service upgrade, new switchgear, coordination with SDG&E. Common for EV fleets, restaurants." },
        "Full Building Rewire":  { range:"$80,000 - $300,000", timeline:"2-6 months", includes:"Complete electrical infrastructure replacement, all panels, conduit, wiring, lighting, fire alarm integration." },
      },
      "Plumbing": {
        "Fixture & Drain":       { range:"$5,000 - $20,000",   timeline:"1-3 days",   includes:"Commercial restroom fixtures, floor drains, grease trap service. Standard retail or office work." },
        "Grease Trap & Kitchen": { range:"$10,000 - $40,000",  timeline:"3-7 days",   includes:"Restaurant grease interceptor, commercial kitchen plumbing, fire suppression hookups, health dept permits." },
        "Full System":           { range:"$40,000 - $150,000", timeline:"2-6 weeks",  includes:"Complete commercial plumbing system for new buildout or full renovation, all fixtures, backflow, permits." },
      },
      "Roofing": {
        "TPO / Flat Roof (Small)": { range:"$20,000 - $50,000",  timeline:"3-7 days",   includes:"TPO or modified bitumen membrane, insulation board, flashing, labor and permit for under 10,000 sq ft." },
        "Mid-Size Commercial":     { range:"$50,000 - $150,000", timeline:"1-3 weeks",  includes:"Full commercial re-roof, insulation upgrade, drains, skylights, 10-year warranty. 10,000-30,000 sq ft." },
        "Large Facility":          { range:"$150,000 - $500,000+", timeline:"3-8 weeks", includes:"Full TPO or built-up roof system, insulation, drainage redesign, energy code compliance for large buildings." },
      },
      "Remodel": {
        "Cosmetic Buildout":   { range:"$30,000 - $100,000",   timeline:"4-8 weeks",   includes:"Paint, flooring, lighting, basic millwork for existing commercial space. No structural or MEP changes." },
        "Tenant Improvement":  { range:"$100,000 - $400,000",  timeline:"2-4 months",  includes:"Full TI buildout, partition walls, HVAC, electrical, plumbing, storefront. Per-sq-ft cost $80-$200." },
        "Full Commercial Gut": { range:"$400,000 - $2,000,000+", timeline:"4-12 months", includes:"Complete gutting and rebuild of commercial space, all trades, ADA compliance, permits, inspections." },
      },
      "Solar": {
        "Small Commercial (25-50 kW)":  { range:"$55,000 - $110,000",  timeline:"1-2 weeks install", includes:"Commercial-grade panels, string inverters, monitoring, permits, SDG&E interconnection. Carport or rooftop." },
        "Mid Commercial (50-200 kW)":   { range:"$110,000 - $400,000", timeline:"2-4 weeks install",  includes:"Full commercial array, power optimizer, data monitoring, structural engineering, permits." },
        "Large System (200 kW+)":       { range:"$400,000 - $1,500,000+", timeline:"1-3 months",      includes:"Large-scale commercial or industrial solar, battery storage, utility coordination, PPA option available." },
      },
      "Pool": {
        "Commercial Pool (Basic)":    { range:"$150,000 - $300,000",   timeline:"4-6 months", includes:"Commercial-grade gunite, ADA-compliant entry, commercial filtration, health dept permits, fencing." },
        "Hotel / Resort Pool":        { range:"$300,000 - $750,000",   timeline:"4-8 months", includes:"Custom design, water features, spa, automated chemical system, full ADA, commercial equipment room." },
        "Aquatic Facility":           { range:"$750,000 - $3,000,000+", timeline:"6-18 months", includes:"Competition or community pool, full mechanical room, ADA, bleachers, locker rooms, permits." },
      },
      "Flooring": {
        "Carpet / VCT Office":     { range:"$8,000 - $30,000",   timeline:"2-5 days",    includes:"Commercial carpet or VCT tile, labor, adhesive, prep. Standard office or retail flooring." },
        "Polished Concrete":       { range:"$20,000 - $60,000",  timeline:"3-7 days",    includes:"Grinding, polishing, sealing of existing slab. Popular in San Diego restaurants and retail." },
        "Full Building Flooring":  { range:"$50,000 - $200,000", timeline:"1-3 weeks",   includes:"All flooring trades across full commercial building, demolition, prep, install, adhesives, transitions." },
      },
      "Painting": {
        "Office Interior":         { range:"$5,000 - $20,000",   timeline:"2-5 days",    includes:"Interior walls and ceilings, commercial-grade paint, prep, protection of fixtures and floors." },
        "Building Exterior":       { range:"$20,000 - $80,000",  timeline:"1-2 weeks",   includes:"Exterior commercial paint, lift rental, primer, 2 coats, caulking, masonry sealer where needed." },
        "Full Campus":             { range:"$80,000 - $300,000", timeline:"2-6 weeks",   includes:"Multiple buildings or full facility interior and exterior. Requires scaffolding for multi-story.", note:"Multi-story commercial painting requires OSHA-compliant fall protection and adds 15-25% to cost." },
      },
      "Concrete": {
        "Parking Lot Repair":    { range:"$10,000 - $40,000",  timeline:"2-4 days",    includes:"Crack sealing, overlay, or section replacement for commercial parking surface. Re-striping included." },
        "Parking Lot Replace":   { range:"$40,000 - $200,000", timeline:"1-2 weeks",   includes:"Full demo and repour of commercial parking lot, rebar, drainage, permits, striping." },
        "Structural / Slab":     { range:"$50,000 - $500,000+", timeline:"2-8 weeks",  includes:"Structural commercial slab, tilt-up panels, foundation, rebar, engineer drawings, permits." },
      },
      "Landscaping": {
        "Commercial Property":   { range:"$10,000 - $50,000",  timeline:"1-2 weeks",   includes:"Drought-tolerant design, irrigation, hardscape, signage area planting. HOA-compliant plant palettes." },
        "Office Campus":         { range:"$50,000 - $200,000", timeline:"3-8 weeks",   includes:"Full campus design, irrigation system, hardscape, trees, ongoing maintenance plan." },
        "Resort / Hotel":        { range:"$200,000 - $1,000,000+", timeline:"2-6 months", includes:"Custom landscape design, water features, turf alternatives, full irrigation, Coastal Commission review if applicable." },
      },
      "Windows": {
        "Storefront (Small)":    { range:"$8,000 - $25,000",   timeline:"1-3 days",    includes:"Aluminum storefront window system, install, glazing, hardware. Standard retail or office entry." },
        "Curtain Wall (Mid)":    { range:"$50,000 - $200,000", timeline:"2-4 weeks",   includes:"Unitized or stick-built curtain wall, thermal glass, structural supports, permits. Energy code compliant." },
        "Full Building Glazing": { range:"$200,000 - $1,000,000+", timeline:"1-4 months", includes:"Complete commercial window replacement or new install, structural engineering, permits, crane rental." },
      },
      "Insulation": {
        "Roof Insulation":       { range:"$8,000 - $30,000",   timeline:"2-4 days",    includes:"Polyiso or EPS board insulation for commercial roof system. Required per Title 24 for re-roofs." },
        "Wall / Interior":       { range:"$15,000 - $60,000",  timeline:"3-7 days",    includes:"Batt or spray foam insulation for commercial walls, Title 24 compliance, fire-rated assemblies." },
        "Full Building":         { range:"$40,000 - $150,000", timeline:"1-3 weeks",   includes:"Complete commercial building envelope insulation, Title 24 energy compliance documentation, permits." },
      },
      "Demolition": {
        "Interior Demo":         { range:"$10,000 - $40,000",  timeline:"3-7 days",    includes:"Commercial interior gut, debris hauling, abatement testing. Required before tenant improvement buildout." },
        "Building Demo":         { range:"$40,000 - $200,000", timeline:"2-4 weeks",   includes:"Full commercial building demolition, asbestos abatement, debris removal, grading, permits.", note:"All commercial demolitions in San Diego require asbestos and lead survey. Add $3,000-$10,000 for testing and abatement." },
      },
      "Asphalt": {
        "Parking Lot Seal":      { range:"$3,000 - $10,000",   timeline:"1-2 days",    includes:"Commercial lot crack fill, asphalt sealer, re-striping. Recommended every 3-5 years to extend life." },
        "Overlay / Resurface":   { range:"$15,000 - $60,000",  timeline:"2-4 days",    includes:"1.5-2\" asphalt overlay on existing lot, milling where needed, new striping and wheel stops." },
        "Full Replacement":      { range:"$50,000 - $200,000+", timeline:"3-7 days",   includes:"Full demo, grading, base rock, new asphalt surface, striping, ADA-compliant stalls and ramps." },
      },
      "Locksmith": {
        "Rekey / Access":        { range:"$500 - $2,000",      timeline:"Half-1 day",  includes:"Commercial rekey, master key system setup, access control card or fob programming." },
        "Access Control System": { range:"$3,000 - $15,000",   timeline:"1-3 days",    includes:"Keypad or card reader access control, door hardware, software, installation. Multiple doors." },
        "Full Security Buildout":{ range:"$10,000 - $50,000",  timeline:"3-7 days",    includes:"Full commercial security system, access control, CCTV, alarm integration, monitoring setup." },
      },
      "Trucking": {
        "Material Delivery":     { range:"$500 - $3,000",      timeline:"Half-1 day",  includes:"Commercial material delivery, crane-assisted if needed, drop-off coordination." },
        "Site Hauling":          { range:"$3,000 - $15,000",   timeline:"2-5 days",    includes:"Multi-load debris or material hauling throughout commercial project. Coordinated with GC schedule." },
        "Excavation & Grading":  { range:"$10,000 - $75,000",  timeline:"3-10 days",   includes:"Commercial site excavation, rough grading, compaction, haul-away. Required for new construction." },
      },
      "Framing": {
        "Small Commercial":      { range:"$50,000 - $150,000",  timeline:"4-8 weeks",  includes:"Steel stud framing for small commercial buildout, structural headers, sheathing, permits." },
        "Mid-Size Building":     { range:"$150,000 - $500,000", timeline:"2-4 months", includes:"Wood or steel framing for multi-tenant commercial building, structural engineering, seismic compliance." },
        "Large Construction":    { range:"$500,000 - $5,000,000+", timeline:"3-12 months", includes:"Major commercial framing, structural steel, seismic bracing, drawings, inspections, coordinated trades." },
      },
    }
  };

  const renderPrimary = (label, view) => (
    <button type="button" onClick={()=>onNavigate(view)}
      style={{ padding:"14px 28px", borderRadius:10, border:"none", background:"#EF9F27", color:"#082E56", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:font, transition:"all 0.15s" }}
      onMouseEnter={e=>e.currentTarget.style.background="#f5b03a"}
      onMouseLeave={e=>e.currentTarget.style.background="#EF9F27"}>
      {label}
    </button>
  );

  const renderGhost = (label, view) => (
    <button type="button" onClick={()=>onNavigate(view)}
      style={{ padding:"14px 28px", borderRadius:10, border:"1.5px solid rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.1)", color:"#fff", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:font }}>
      {label}
    </button>
  );

  const handleQuickSubmit = () => {
    if (!quickLead.trade || !quickLead.name || !quickLead.phone) return;
    onNavigate("submit", quickLead);
  };

  const ql = (k) => (v) => setQuickLead(q => ({ ...q, [k]: v }));

  const inp = (placeholder, value, onChange, type="text") => (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ flex:1, minWidth:140, padding:"13px 16px", borderRadius:9, border:"none", fontSize:14, fontFamily:font, outline:"none", color:"#2C2C2A", background:"#fff" }}
    />
  );

  return (
    <div style={{ fontFamily:font }}>

      {/* — HERO — */}
      <div style={{ background:"linear-gradient(160deg, #082E56 0%, #0C447C 60%, #1565A8 100%)", padding:"80px 32px 0", position:"relative", overflow:"hidden" }}>
        {/* Ambient glow */}
        <div style={{ position:"absolute", top:-80, right:-80, width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(239,159,39,0.1) 0%, transparent 70%)", pointerEvents:"none" }} />
        <div style={{ maxWidth:840, margin:"0 auto", position:"relative" }}>
          {/* Eyebrow */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(239,159,39,0.15)", border:"1px solid rgba(239,159,39,0.3)", borderRadius:20, padding:"5px 14px", marginBottom:28, fontSize:11, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.1em" }}>
            <span style={{ width:6, height:6, borderRadius:"50%", background:"#EF9F27", display:"inline-block" }} />
            San Diego's Trusted Contractor Network
          </div>

          {/* Headline */}
          <h1 style={{ fontSize:"clamp(38px, 6vw, 64px)", fontWeight:900, color:"#fff", letterSpacing:"-0.03em", lineHeight:1.05, marginBottom:20, maxWidth:680 }}>
            Great projects start<br />with <span style={{ color:"#EF9F27" }}>great connections.</span>
          </h1>

          {/* Subhead */}
          <p style={{ fontSize:18, color:"rgba(255,255,255,0.72)", maxWidth:520, marginBottom:40, lineHeight:1.75 }}>
            Tell us what you need. We'll connect you with licensed local contractors who compete for your business — organized bids, no spam calls, and you stay in control the whole time.
          </p>

          {/* — DIRECT LEAD BOX — */}
          <div style={{ background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(255,255,255,0.14)", borderRadius:16, padding:"24px 24px 20px", marginBottom:20, maxWidth:760, backdropFilter:"blur(4px)" }}>
            <p style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.85)", marginBottom:16, letterSpacing:"0.01em" }}>
              Get free bids from licensed San Diego contractors — takes 30 seconds
            </p>

            {/* Two-row layout — fields on top, button below on mobile, all inline on desktop */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
              <select value={quickLead.trade} onChange={e => ql("trade")(e.target.value)}
                style={{ padding:"13px 16px", borderRadius:9, border:"2px solid transparent", fontSize:14, fontFamily:font, color: quickLead.trade ? "#2C2C2A" : "#9CA3AF", background:"#fff", outline:"none", cursor:"pointer", width:"100%" }}>
                <option value="">Type of work needed...</option>
                {["HVAC","Electrical","Plumbing","Roofing","Remodel","Flooring","Painting","Concrete","Landscaping","Solar","Pool","Windows","Framing","Insulation","Demolition","Locksmith","Asphalt","Trucking"].map(t => <option key={t}>{t}</option>)}
              </select>

              <input type="text" placeholder="ZIP code" value={quickLead.zip} onChange={e => ql("zip")(e.target.value)} maxLength={5}
                style={{ padding:"13px 16px", borderRadius:9, border:"2px solid transparent", fontSize:14, fontFamily:font, color:"#2C2C2A", background:"#fff", outline:"none", width:"100%", boxSizing:"border-box" }} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:10 }}>
              <input type="text" placeholder="Your name" value={quickLead.name} onChange={e => ql("name")(e.target.value)}
                style={{ padding:"13px 16px", borderRadius:9, border:"2px solid transparent", fontSize:14, fontFamily:font, color:"#2C2C2A", background:"#fff", outline:"none", width:"100%", boxSizing:"border-box" }} />

              <input type="tel" placeholder="Phone number" value={quickLead.phone} onChange={e => ql("phone")(e.target.value)}
                style={{ padding:"13px 16px", borderRadius:9, border:"2px solid transparent", fontSize:14, fontFamily:font, color:"#2C2C2A", background:"#fff", outline:"none", width:"100%", boxSizing:"border-box" }} />

              <button type="button" onClick={handleQuickSubmit}
                style={{ padding:"13px 28px", borderRadius:9, border:"none", background:"#EF9F27", color:"#082E56", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:font, whiteSpace:"nowrap", opacity:(!quickLead.trade||!quickLead.name||!quickLead.phone)?0.45:1, transition:"opacity 0.2s, background 0.2s" }}
                onMouseEnter={e=>{ if(quickLead.trade&&quickLead.name&&quickLead.phone) e.currentTarget.style.background="#f5b03a"; }}
                onMouseLeave={e=>e.currentTarget.style.background="#EF9F27"}>
                Get Bids &gt;
              </button>
            </div>

            <p style={{ fontSize:11, color:"rgba(255,255,255,0.38)", marginTop:12 }}>
              By submitting you agree to receive bids from verified contractors. No spam, ever.
            </p>
          </div>

          {/* Secondary CTAs */}
          <div style={{ display:"flex", gap:14, alignItems:"center", marginBottom:56, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, color:"rgba(255,255,255,0.38)", fontStyle:"italic" }}>or</span>
            {renderGhost("Browse Contractors", "directory")}
            <button type="button" onClick={()=>onNavigate("contractor-signup")}
              style={{ background:"none", border:"none", color:"rgba(255,255,255,0.6)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font, textDecoration:"underline", padding:0 }}>
              Are you a contractor? See plans &gt;
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.1)", display:"grid", gridTemplateColumns:"repeat(3,1fr)" }}>
          {[["847+","Projects submitted"],["312","Licensed contractors"],["$4.2M","In bids placed"]].map(([num, label], i) => (
            <div key={label} style={{ padding:"22px 32px", textAlign:"center", borderRight: i<2?"1px solid rgba(255,255,255,0.1)":"none" }}>
              <div style={{ fontSize:34, fontWeight:900, color:"#EF9F27", letterSpacing:"-0.03em", lineHeight:1 }}>{num}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", marginTop:6, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* — PROCESS STRIP — */}
      <div style={{ background:"#F8F7F4", borderBottom:"1.5px solid #E8E6DF", padding:"16px 32px" }}>
        <div style={{ maxWidth:840, margin:"0 auto", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap", justifyContent:"center" }}>
          {[["1","Tell us about your project"],["2","Receive organized bids"],["3","Message contractors directly"],["4","Choose and get started"]].flatMap(([n, text], i, arr) => [
            <div key={n} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:"#2C2C2A" }}>
              <div style={{ width:26, height:26, borderRadius:"50%", background:"#0C447C", color:"#fff", fontSize:11, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{n}</div>
              <span style={{ fontWeight:500 }}>{text}</span>
            </div>,
            i < arr.length - 1 ? <span key={"sep"+i} style={{ color:"#C8C5BC", fontSize:14, fontWeight:300 }}>&gt;</span> : null
          ]).filter(Boolean)}
        </div>
      </div>

      {/* — TRUST STRIP — */}
      <div style={{ background:"#fff", borderBottom:"1.5px solid #E8E6DF", padding:"13px 32px" }}>
        <div style={{ maxWidth:840, margin:"0 auto", display:"flex", justifyContent:"center", gap:32, flexWrap:"wrap" }}>
          {["Free for homeowners","Info private until you accept a bid","Licensed contractors only","No spam calls — ever"].map(t => (
            <div key={t} style={{ display:"flex", alignItems:"center", gap:7, fontSize:13, fontWeight:500, color:"#5F5E5A" }}>
              <div style={{ width:17, height:17, borderRadius:"50%", background:"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#0F6E56", flexShrink:0 }}>✓</div>
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* — HOW IT WORKS — */}
      <LandingSec>
        <div style={{ fontSize:10, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>Simple Process</div>
        <h2 style={{ fontSize:"clamp(26px, 4vw, 38px)", fontWeight:800, color:"#0C447C", letterSpacing:"-0.025em", lineHeight:1.15, marginBottom:14 }}>From project idea to<br />accepted bid in 48 hours.</h2>
        <p style={{ fontSize:16, color:"#5F5E5A", maxWidth:500, lineHeight:1.75, marginBottom:44 }}>We built the process homeowners actually want — organized, private, and on your terms.</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(210px, 1fr))", gap:16 }}>
          {[
            ["01","Tell us what you need","Describe your project in two minutes — trade, property type, timeline, and budget. We'll set up your personal dashboard so you can track everything."],
            ["02","Receive organized bids","Licensed contractors review your project and submit detailed bids. No unsolicited calls — everything comes through your personal dashboard."],
            ["03","Compare and choose","See all bids side by side — amount, timeline, reviews, and credentials. Message any contractor directly before committing."],
            ["04","Track your project","Follow progress from start to finish. Leave a review once complete and unlock priority status on your next project."],
          ].map(([num, title, desc]) => (
            <div key={num} style={{ background:"#fff", border:"1.5px solid #E8E6DF", borderRadius:14, padding:"24px 22px" }}>
              <div style={{ fontSize:38, fontWeight:900, color:"#FAEEDA", letterSpacing:"-0.04em", lineHeight:1, marginBottom:16 }}>{num}</div>
              <h3 style={{ fontSize:15, fontWeight:700, color:"#0C447C", marginBottom:8, lineHeight:1.3 }}>{title}</h3>
              <p style={{ fontSize:13, color:"#6B6966", lineHeight:1.7, margin:0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </LandingSec>

      {/* — MEMBER PERKS — */}
      <LandingSec bg="#F8F7F4">
        <div style={{ fontSize:10, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>Member Benefits</div>
        <h2 style={{ fontSize:"clamp(26px, 4vw, 38px)", fontWeight:800, color:"#0C447C", letterSpacing:"-0.025em", lineHeight:1.15, marginBottom:14 }}>We reward homeowners<br />who come back.</h2>
        <p style={{ fontSize:16, color:"#5F5E5A", maxWidth:500, lineHeight:1.75, marginBottom:44 }}>Your account gets more valuable every time you use it.</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(210px, 1fr))", gap:16 }}>
          {[
            ["⭐","Priority Bid Access","Members with a verified review history get projects surfaced first — faster bids, better competition.","#E6F1FB","#185FA5","All members"],
            ["💬","Direct Messaging","Message contractors directly before accepting a bid — ask questions, share photos, get clarity.","#E1F5EE","#0F6E56","All members"],
            ["🗂️","Project History","Every project, bid, and contractor stored in your account. No more digging through emails.","#FAEEDA","#854F0B","All members"],
            ["🏅","Verified Reviewer","Leave a review after completion and earn status — contractors prioritize your future projects.","#EEEDFE","#534AB7","After first review"],
            ["🎁","Referral Rewards","Refer a neighbor who completes a project and you both earn a credit toward your next job.","#E1F5EE","#0F6E56","Coming soon"],
            ["🔔","Bid Alerts","Get notified the moment a contractor bids on your project. Stay informed at every step.","#FCEBEB","#A32D2D","All members"],
          ].map(([icon, title, desc, bg, color, tag]) => (
            <div key={title} style={{ background:"#fff", border:"1.5px solid #E8E6DF", borderRadius:14, padding:"22px 20px" }}>
              <div style={{ width:42, height:42, borderRadius:10, background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, marginBottom:14, flexShrink:0 }}>{icon}</div>
              <h3 style={{ fontSize:14, fontWeight:700, color:"#0C447C", marginBottom:6, lineHeight:1.3 }}>{title}</h3>
              <p style={{ fontSize:12, color:"#6B6966", lineHeight:1.7, marginBottom:12 }}>{desc}</p>
              <span style={{ fontSize:10, fontWeight:700, color, background:bg, borderRadius:20, padding:"3px 10px", letterSpacing:"0.03em" }}>{tag}</span>
            </div>
          ))}
        </div>
      </LandingSec>

      {/* — COMPARISON — */}
      <LandingSec>
        <div style={{ fontSize:10, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>Why BuildConnect Pro</div>
        <h2 style={{ fontSize:"clamp(26px, 4vw, 38px)", fontWeight:800, color:"#0C447C", letterSpacing:"-0.025em", marginBottom:44 }}>A better deal for homeowners.</h2>
        <div style={{ overflowX:"auto", borderRadius:12, border:"1.5px solid #E8E6DF" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:540 }}>
            <thead>
              <tr>
                <th style={{ padding:"14px 20px", textAlign:"left", fontSize:12, fontWeight:600, color:"#888780", borderBottom:"1.5px solid #E8E6DF", width:"38%", background:"#fff" }}></th>
                {[["BuildConnect Pro","#0C447C","#fff"],["Angi","#F8F7F4","#5F5E5A"],["Thumbtack","#F8F7F4","#5F5E5A"]].map(([name, bg, color]) => (
                  <th key={name} style={{ padding:"14px 20px", textAlign:"center", fontSize:13, fontWeight:700, borderBottom:"1.5px solid #E8E6DF", background:bg, color }}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["Free for homeowners","v","v","v"],
                ["Personal project dashboard","v","x","x"],
                ["No spam calls","v","x","x"],
                ["Contact info stays private","v","x","x"],
                ["Side-by-side bid comparison","v","Partial","x"],
                ["Direct contractor messaging","v","Partial","v"],
                ["Member rewards & perks","v","x","x"],
                ["Same lead sold to 5+ contractors","x","v","v"],
              ].map(([label, bcp, angi, tt], i) => {
                const isLast = i === 7;
                return (
                  <tr key={label}>
                    <td style={{ padding:"13px 20px", fontSize:13, fontWeight:500, color:"#2C2C2A", borderBottom: isLast?"none":"1px solid #F1EFE8", background:"#fff" }}>{label}</td>
                    {[bcp, angi, tt].map((val, j) => {
                      const isBC = j === 0;
                      const isGood = val==="v" && isBC;
                      const isBad = val==="x" && isBC;
                      const isGoodOther = val==="v" && !isBC && label==="Same lead sold to 5+ contractors";
                      return (
                        <td key={j} style={{ padding:"13px 20px", textAlign:"center", fontSize: val==="v"||val==="x"?18:12, fontWeight: val==="v"||val==="x"?700:600, borderBottom: isLast?"none":"1px solid #F1EFE8", background: isBC?"rgba(12,68,124,0.03)":"#fff", color: isGood?"#0F6E56" : isBad?"#A32D2D" : isGoodOther?"#A32D2D" : val==="x"?"#A32D2D" : val==="Partial"?"#854F0B" : "#2C2C2A" }}>{val==="v"?"✓":val==="x"?"✗":val}</td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </LandingSec>

      {/* — COST ESTIMATOR — */}
      <LandingSec bg="#0C447C" pad="72px 32px">
        <div style={{ fontSize:10, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>Free Tool</div>
        <h2 style={{ fontSize:"clamp(26px, 4vw, 38px)", fontWeight:800, color:"#fff", letterSpacing:"-0.025em", lineHeight:1.15, marginBottom:14 }}>What will your project cost?</h2>
        <p style={{ fontSize:16, color:"rgba(255,255,255,0.65)", maxWidth:500, lineHeight:1.75, marginBottom:40 }}>Real 2025-2026 San Diego market pricing, calibrated by property type and project scope. Not national averages.</p>
        <div style={{ background:"#fff", borderRadius:16, padding:32, maxWidth:640 }}>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            <div>
              <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Property Type</label>
              <select value={estProp} onChange={e=>{ setEstProp(e.target.value); setEstTrade(""); setEstScope(""); setEstResult(null); }}
                style={{ width:"100%", padding:"12px 14px", borderRadius:8, border:"1.5px solid #E8E6DF", fontSize:14, fontFamily:font, background:"#fff", color: estProp?"#2C2C2A":"#9CA3AF", outline:"none", cursor:"pointer" }}>
                <option value="">Select...</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", marginBottom:6, letterSpacing:"0.06em", textTransform:"uppercase" }}>Trade / Work Type</label>
              <select value={estTrade} onChange={e=>{ setEstTrade(e.target.value); setEstScope(""); setEstResult(null); }}
                style={{ width:"100%", padding:"12px 14px", borderRadius:8, border:"1.5px solid #E8E6DF", fontSize:14, fontFamily:font, background:"#fff", color: estTrade?"#2C2C2A":"#9CA3AF", outline:"none", cursor:"pointer" }}>
                <option value="">Select...</option>
                {["HVAC","Electrical","Plumbing","Roofing","Remodel","Flooring","Painting","Concrete","Landscaping","Solar","Pool","Windows","Framing","Insulation","Demolition","Asphalt","Locksmith","Trucking"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {estProp && estTrade && EST_DATA[estProp]?.[estTrade] && (
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", marginBottom:8, letterSpacing:"0.06em", textTransform:"uppercase" }}>Project Scope</label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                {Object.entries(EST_DATA[estProp][estTrade]).map(([scope, data]) => (
                  <button type="button" key={scope} onClick={()=>{ setEstScope(scope); setEstResult(data); }}
                    style={{ padding:"12px 10px", borderRadius:9, border: estScope===scope?"2px solid #0C447C":"1.5px solid #E8E6DF", background: estScope===scope?"#E6F1FB":"#fff", cursor:"pointer", textAlign:"left", fontFamily:font, transition:"border-color 0.15s" }}>
                    <div style={{ fontSize:11, fontWeight:600, color: estScope===scope?"#185FA5":"#888780", marginBottom:4 }}>{scope}</div>
                    <div style={{ fontSize:13, fontWeight:800, color: estScope===scope?"#0C447C":"#2C2C2A" }}>{data.range}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {estResult && (
            <div style={{ background:"#F8F7F4", borderRadius:12, padding:20, border:"1.5px solid #E8E6DF" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:14 }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Estimated Cost Range</div>
                  <div style={{ fontSize:24, fontWeight:900, color:"#0C447C", letterSpacing:"-0.02em" }}>{estResult.range}</div>
                </div>
                {estResult.timeline && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:"#888780", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:5 }}>Typical Timeline</div>
                    <div style={{ fontSize:15, fontWeight:700, color:"#2C2C2A" }}>{estResult.timeline}</div>
                  </div>
                )}
              </div>
              <div style={{ fontSize:13, color:"#5F5E5A", lineHeight:1.7, marginBottom:estResult.note?10:16 }}>
                <strong style={{ color:"#2C2C2A" }}>What's included: </strong>{estResult.includes}
              </div>
              {estResult.note && <div style={{ fontSize:12, color:"#854F0B", background:"#FAEEDA", borderRadius:8, padding:"9px 12px", marginBottom:16, lineHeight:1.6 }}>! {estResult.note}</div>}
              <button type="button" onClick={()=>onOpenMatched(estTrade, estProp, estScope, estResult?.range)}
                style={{ display:"block", width:"100%", padding:"13px", borderRadius:9, background:"#0C447C", color:"#fff", fontSize:14, fontWeight:700, fontFamily:font, border:"none", cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.background="#185FA5"}
                onMouseLeave={e=>e.currentTarget.style.background="#0C447C"}>
                See Licensed San Diego {estTrade} Contractors &gt;
              </button>
              <p style={{ fontSize:11, color:"#A0A0A0", textAlign:"center", marginTop:10 }}>Estimates based on 2025-2026 San Diego market data. Final cost depends on site conditions and scope.</p>
            </div>
          )}
        </div>
      </LandingSec>

      {/* — PRICE TRANSPARENCY TEASER — */}
      <LandingSec bg="#F8F7F4">
        <div style={{ fontSize:10, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}> Price Transparency</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:16, marginBottom:32 }}>
          <div>
            <h2 style={{ fontSize:"clamp(24px, 4vw, 36px)", fontWeight:900, color:"#0C447C", letterSpacing:"-0.025em", margin:"0 0 10px" }}>
              What did San Diego homeowners actually pay?
            </h2>
            <p style={{ fontSize:14, color:"#5F5E5A", lineHeight:1.75, maxWidth:520, margin:0 }}>
              Not estimates. Not surveys. Real amounts paid to licensed contractors on completed BuildConnect Pro projects — by trade, by scope, right here in San Diego.
            </p>
          </div>
          <button type="button" onClick={()=>onNavigate("priceGuide")}
            style={{ padding:"11px 24px", borderRadius:9, border:"1.5px solid #0C447C", background:"transparent", color:"#0C447C", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:font, whiteSpace:"nowrap", flexShrink:0 }}>
            See Full Price Guide &gt;
          </button>
        </div>

        {/* Sample cards from market data */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:12 }}>
          {[
            ["Electrical","Panel Upgrade",3200,4900,6800,203],
            ["Roofing","Asphalt Shingle",11200,16800,23500,143],
            ["HVAC","Mid-Range",8600,11200,13400,112],
            ["Painting","Exterior",4600,8900,14500,193],
            ["Plumbing","Full Repipe",8500,13200,18500,52],
            ["Flooring","Hardwood",8200,13800,21000,131],
          ].map(([trade,scope,low,avg,high,samples])=>(
            <div key={scope}
              onClick={()=>onNavigate("priceGuide")}
              style={{ background:"#fff", border:"1.5px solid #E8E6DF", borderRadius:12, padding:"14px 16px", cursor:"pointer", transition:"border-color 0.15s, box-shadow 0.15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor="#185FA5"; e.currentTarget.style.boxShadow="0 4px 14px rgba(12,68,124,0.08)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor="#E8E6DF"; e.currentTarget.style.boxShadow="none"; }}>
              <div style={{ fontSize:10, fontWeight:700, color:TRADES[trade]?.color||"#0C447C", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{trade}</div>
              <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A", marginBottom:8 }}>{scope}</div>
              {/* Mini bar */}
              <div style={{ display:"flex", height:5, borderRadius:10, overflow:"hidden", marginBottom:8 }}>
                <div style={{ flex:1, background:"#E1F5EE" }} />
                <div style={{ flex:2, background:"#E6F1FB" }} />
                <div style={{ flex:1, background:"#FAEEDA" }} />
              </div>
              <div style={{ fontSize:14, fontWeight:900, color:"#0C447C" }}>${low.toLocaleString()} - ${high.toLocaleString()}</div>
              <div style={{ fontSize:11, color:"#888780", marginTop:2 }}>Avg ${avg.toLocaleString()} · {samples} projects</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign:"center", marginTop:20, fontSize:12, color:"#888780" }}>
          Angi doesn't publish what homeowners actually paid. Thumbtack doesn't either. We do.
        </div>
      </LandingSec>

      {/* — FEATURED CONTRACTORS — */}
      <LandingSec>
        <div style={{ fontSize:10, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>Verified Professionals</div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", flexWrap:"wrap", gap:12, marginBottom:36 }}>
          <h2 style={{ fontSize:"clamp(26px, 4vw, 38px)", fontWeight:800, color:"#0C447C", letterSpacing:"-0.025em", margin:0 }}>Meet a few of our contractors.</h2>
          {renderGhost("Browse All Contractors", "directory")}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:14 }}>
          {["dc1","dc10","dc7","dc13"].map(id => {
            const c = MATCHED_CONTRACTORS.find(m => m.id === id);
            if (!c) return null;
            return (
              <div key={id}
                onClick={() => onOpenProfile && onOpenProfile(c)}
                style={{ background:"#fff", border:"1.5px solid #E8E6DF", borderRadius:14, padding:20, cursor:"pointer", transition:"box-shadow 0.2s, transform 0.2s, border-color 0.15s" }}
                onMouseEnter={e=>{ e.currentTarget.style.boxShadow="0 8px 28px rgba(12,68,124,0.1)"; e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.borderColor="#B5D4F4"; }}
                onMouseLeave={e=>{ e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.borderColor="#E8E6DF"; }}>
                <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:12 }}>
                  <div style={{ width:48, height:48, borderRadius:10, background:c.avatarBg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, fontWeight:900, color:c.avatarColor, flexShrink:0 }}>
                    {c.initials}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.name}</div>
                    <div style={{ fontSize:11, color:"#888780" }}>{c.city}, CA</div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:10 }}>
                  <span style={{ color:"#EF9F27", fontSize:13, letterSpacing:1 }}>{"*".repeat(Math.floor(c.rating))}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{c.rating.toFixed(1)}</span>
                  <span style={{ fontSize:11, color:"#888780" }}>({c.reviewCount})</span>
                </div>
                <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:12 }}>
                  {c.trades.slice(0,2).map(t=><span key={t} style={{ fontSize:10, fontWeight:600, color:TRADES[t]?.color||"#0C447C", background:TRADES[t]?.bg||"#E6F1FB", borderRadius:20, padding:"2px 8px" }}>{t}</span>)}
                  {c.licensed && <span style={{ fontSize:10, fontWeight:700, color:"#0F6E56", background:"#E1F5EE", borderRadius:20, padding:"2px 8px" }}>✓ Licensed</span>}
                </div>
                <p style={{ fontSize:12, color:"#5F5E5A", lineHeight:1.6, margin:"0 0 12px" }}>{c.bio.slice(0,90)}...</p>
                <div style={{ fontSize:12, color:"#185FA5", fontWeight:700 }}>View Profile &gt;</div>
              </div>
            );
          })}
        </div>
      </LandingSec>

      {/* — TESTIMONIALS — */}
      <LandingSec bg="#F8F7F4">
        <div style={{ fontSize:10, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>What Homeowners Say</div>
        <h2 style={{ fontSize:"clamp(26px, 4vw, 38px)", fontWeight:800, color:"#0C447C", letterSpacing:"-0.025em", marginBottom:44 }}>Real San Diego homeowners, real results.</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:16 }}>
          {[
            ["SK","#0C447C","Sarah K.","Chula Vista · HVAC Replacement","I submitted my HVAC project on a Tuesday and had four bids by Thursday morning. No pushy sales calls — just organized information I could actually use."],
            ["MR","#0F6E56","Marcus R.","Escondido · Full Roof Replacement","After Angi bombarded me with calls for three days straight, BuildConnect Pro was completely different. I felt in control the whole time. Great experience."],
            ["LP","#854F0B","Lisa P.","La Mesa · Kitchen Remodel","The cost estimator told me to expect $12,000-$18,000. My winning bid came in at $14,500. That transparency made all the difference going in."],
          ].map(([initials, bg, name, detail, text]) => (
            <div key={name} style={{ background:"#fff", border:"1.5px solid #E8E6DF", borderRadius:14, padding:24 }}>
              <div style={{ color:"#EF9F27", fontSize:14, letterSpacing:3, marginBottom:16 }}>*****</div>
              <p style={{ fontSize:14, color:"#2C2C2A", lineHeight:1.75, marginBottom:20, fontStyle:"italic" }}>"{text}"</p>
              <div style={{ display:"flex", alignItems:"center", gap:12, paddingTop:16, borderTop:"1px solid #F1EFE8" }}>
                <div style={{ width:38, height:38, borderRadius:"50%", background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#fff", flexShrink:0 }}>{initials}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{name}</div>
                  <div style={{ fontSize:11, color:"#888780", marginTop:2 }}>{detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </LandingSec>

      {/* — CONTRACTOR CTA SECTION — */}
      <LandingSec bg="#0C447C" pad="60px 32px">
        <div style={{ display:"flex", alignItems:"center", gap:40, flexWrap:"wrap", justifyContent:"space-between" }}>
          <div style={{ maxWidth:500 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#EF9F27", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>For Contractors</div>
            <h2 style={{ fontSize:"clamp(22px, 3vw, 32px)", fontWeight:900, color:"#fff", letterSpacing:"-0.02em", lineHeight:1.2, marginBottom:12 }}>
              Tired of paying for leads that go nowhere?
            </h2>
            <p style={{ fontSize:15, color:"rgba(255,255,255,0.7)", lineHeight:1.7, marginBottom:20 }}>
              BuildConnect Pro connects you with homeowners who are actively looking for your trade, in your area, with real budgets. Full business portal included — invoicing, estimates, scheduling, and more. Free to join.
            </p>
            <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:20 }}>
              {["Free to join","Quality verified leads","Full business portal","Your profile, your brand"].map(b=>(
                <div key={b} style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:"rgba(255,255,255,0.85)" }}>
                  <span style={{ color:"#EF9F27", fontWeight:700 }}>✓</span> {b}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, flexShrink:0 }}>
            <button type="button" onClick={()=>onNavigate("contractor-signup")}
              style={{ padding:"15px 32px", borderRadius:10, border:"none", background:"#EF9F27", color:"#082E56", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:font, whiteSpace:"nowrap" }}
              onMouseEnter={e=>e.currentTarget.style.background="#f5b03a"}
              onMouseLeave={e=>e.currentTarget.style.background="#EF9F27"}>
              Join as a Contractor — Plans from Free
            </button>
            <button type="button" onClick={()=>onNavigate("portal-preview")}
              style={{ padding:"12px 32px", borderRadius:10, border:"1.5px solid rgba(255,255,255,0.25)", background:"transparent", color:"rgba(255,255,255,0.8)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              Preview the Contractor Portal
            </button>
          </div>
        </div>
      </LandingSec>

      {/* — FEEDBACK BANNER — */}
      <div style={{ background:"#082E56", padding:"52px 32px" }}>
        <div style={{ maxWidth:840, margin:"0 auto", display:"flex", alignItems:"center", gap:40, flexWrap:"wrap", justifyContent:"space-between" }}>
          <div style={{ maxWidth:520 }}>
            <h3 style={{ fontSize:22, fontWeight:800, color:"#fff", marginBottom:10, letterSpacing:"-0.02em", lineHeight:1.3 }}>Had an experience with a contractor?<br />Tell us about it.</h3>
            <p style={{ fontSize:14, color:"rgba(255,255,255,0.6)", lineHeight:1.75 }}>Your feedback makes BuildConnect Pro better for every San Diego homeowner who comes after you. It takes two minutes and it matters.</p>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button type="button" onClick={()=>onNavigate("review")} style={{ padding:"12px 28px", borderRadius:9, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:font, background:"#EF9F27", color:"#082E56", border:"none" }}>Leave a Review</button>
            <button type="button" onClick={()=>onNavigate("report")} style={{ padding:"12px 28px", borderRadius:9, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:font, background:"transparent", color:"rgba(255,255,255,0.7)", border:"1.5px solid rgba(255,255,255,0.2)" }}>Report an Issue</button>
          </div>
        </div>
      </div>

      {/* — FINAL CTA — */}
      <div style={{ background:"linear-gradient(160deg, #0C447C 0%, #082E56 100%)", padding:"96px 32px", textAlign:"center", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(239,159,39,0.07) 0%, transparent 70%)", pointerEvents:"none" }} />
        <div style={{ maxWidth:580, margin:"0 auto", position:"relative" }}>
          <h2 style={{ fontSize:"clamp(32px, 5vw, 52px)", fontWeight:900, color:"#fff", letterSpacing:"-0.03em", lineHeight:1.1, marginBottom:16 }}>
            Ready to find your<br /><span style={{ color:"#EF9F27" }}>perfect contractor?</span>
          </h2>
          <p style={{ fontSize:17, color:"rgba(255,255,255,0.65)", marginBottom:40, lineHeight:1.75 }}>
            Tell us about your project and we'll connect you with the right people. It's completely free and takes about two minutes.
          </p>
          <div style={{ display:"flex", justifyContent:"center", gap:10, flexWrap:"wrap", marginBottom:36 }}>
            {["Free for homeowners","No spam calls","Bids within 48 hours","Licensed contractors only","Your info stays private"].map(b=>(
              <span key={b} style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:20, padding:"6px 16px", fontSize:12, color:"rgba(255,255,255,0.8)", fontWeight:500 }}>{b}</span>
            ))}
          </div>
          <button type="button" onClick={()=>onNavigate("submit")}
            style={{ padding:"18px 48px", borderRadius:12, border:"none", background:"#EF9F27", color:"#082E56", fontSize:16, fontWeight:800, cursor:"pointer", fontFamily:font, letterSpacing:"-0.01em" }}
            onMouseEnter={e=>e.currentTarget.style.background="#f5b03a"}
            onMouseLeave={e=>e.currentTarget.style.background="#EF9F27"}>
            Get Free Bids on My Project &gt;
          </button>
          <p style={{ marginTop:20, fontSize:12, color:"rgba(255,255,255,0.3)", fontStyle:"italic" }}>"Great projects start with great connections." — BuildConnect Pro</p>
        </div>
      </div>

    </div>
  );
}


// — Direct Project Submit (specific contractor/s) -----------------------------
