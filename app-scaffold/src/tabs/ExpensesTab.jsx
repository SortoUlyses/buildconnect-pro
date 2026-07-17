import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { expenseFromDb, expenseToDb } from "../lib/mappers.js";
import { uploadContractorPhoto, deleteContractorPhoto } from "../lib/storage.js";

// — Expenses & Job Costing Tab ------------------------------------------------
export const EMPTY_EXP = () => ({ id: uid(), date: new Date().toISOString().slice(0,10), category: "Materials", description: "", amount: "", project: "", receipt: "", receiptPath: "" });

// — Monthly Expense Report (printable) ----------------------------------------
export const REPORT_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// — Schedule C mapping for contractor expenses --------------------------------
export const SCHEDULE_C_MAP = {
  Materials:     { line:"Line 38",  title:"Materials & Supplies",    note:"Raw materials, lumber, pipe, wire, paint, concrete, etc." },
  Labor:         { line:"Line 26",  title:"Wages Paid",              note:"Wages paid to employees. Separate from subcontractors." },
  Subcontractor: { line:"Line 11",  title:"Contract Labor",          note:"Payments to subcontractors. Issue 1099-NEC if over $600/year." },
  Equipment:     { line:"Line 13",  title:"Depreciation / Sec. 179", note:"Tools & equipment under $2,500 may be fully deductible this year." },
  Permits:       { line:"Line 23",  title:"Taxes & Licenses",        note:"Permits, licensing fees, CSLB renewal, and local business taxes." },
  Fuel:          { line:"Line 9",   title:"Car & Truck Expenses",    note:"Fuel, maintenance, and vehicle expenses for job-related travel." },
  Other:         { line:"Line 27a", title:"Other Expenses",          note:"Any ordinary and necessary business expense not listed above." },
};

// — Tax Summary Export --------------------------------------------------------
export function TaxSummaryModal({ expenses, invoices, profile, onClose }) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const yearExp  = expenses.filter(e => e.date?.startsWith(String(year)));
  const yearInv  = (invoices||[]).filter(i => i.date?.startsWith(String(year)));
  const invTotal = inv => (inv.items||[]).reduce((s,i)=>s+(Number(i.qty)*Number(i.rate)||0),0);
  const totalRev = yearInv.reduce((s,i)=>s+invTotal(i), 0);

  const byCategory = {};
  Object.keys(EXPENSE_CATEGORIES).forEach(cat => { byCategory[cat] = []; });
  yearExp.forEach(e => { const cat = e.category||"Other"; if (!byCategory[cat]) byCategory[cat]=[]; byCategory[cat].push(e); });

  const catTotal    = cat => byCategory[cat]?.reduce((s,e)=>s+(Number(e.amount)||0),0) || 0;
  const grandTotal  = Object.keys(byCategory).reduce((s,cat)=>s+catTotal(cat), 0);
  const netProfit   = totalRev - grandTotal;
  const receiptCount = yearExp.filter(e=>!!e.receipt).length;

  const downloadCSV = () => {
    const rows = [
      ["Date","Category","Schedule C Line","Description","Project","Amount","Has Receipt"],
      ...yearExp.map(e=>[
        e.date||"", e.category||"", SCHEDULE_C_MAP[e.category]?.line||"Line 27a",
        `"${(e.description||"").replace(/"/g,'""')}"`,
        `"${(e.project||"").replace(/"/g,'""')}"`,
        (Number(e.amount)||0).toFixed(2), e.receipt?"Yes":"No",
      ].join(","))
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows],{type:"text/csv"}));
    a.download = `BuildConnectPro_Expenses_${year}.csv`;
    a.click();
  };

  const downloadPDF = () => {
    const catRows = Object.entries(byCategory)
      .filter(([,exps])=>exps.length>0)
      .map(([cat,exps])=>{
        const total = exps.reduce((s,e)=>s+(Number(e.amount)||0),0);
        const sc    = SCHEDULE_C_MAP[cat]||{line:"Line 27a",title:cat,note:""};
        const cfg   = EXPENSE_CATEGORIES[cat]||{};
        const rows  = exps.map((e,i)=>`<tr style="background:${i%2===0?"#fff":"#F8F7F4"}">
          <td style="padding:7px 12px;font-size:12px">${e.date||""}</td>
          <td style="padding:7px 12px;font-size:12px">${e.description||""}</td>
          <td style="padding:7px 12px;font-size:12px;color:#888780">${e.project||"—"}</td>
          <td style="padding:7px 12px;font-size:12px;text-align:right;font-weight:600">$${(Number(e.amount)||0).toFixed(2)}</td>
          <td style="padding:7px 12px;font-size:12px;text-align:center">${e.receipt?"v":""}</td></tr>`).join("");
        return `<div style="margin-bottom:24px;page-break-inside:avoid">
          <div style="background:#0C447C;padding:10px 14px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center">
            <div><div style="font-size:10px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.06em">${sc.line} — Schedule C</div>
            <div style="font-size:14px;font-weight:800;color:#fff">${cfg.icon||""} ${sc.title}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px">${sc.note}</div></div>
            <div style="text-align:right"><div style="font-size:11px;color:rgba(255,255,255,0.5)">${exps.length} item${exps.length!==1?"s":""}</div>
            <div style="font-size:20px;font-weight:900;color:#EF9F27">$${total.toFixed(2)}</div></div>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1.5px solid #E8E6DF;border-top:none">
            <thead><tr style="background:#F8F7F4">
              ${["Date","Description","Project","Amount","🧾 Receipt"].map(h=>`<th style="padding:7px 12px;font-size:10px;font-weight:700;color:#888780;text-align:left;border-bottom:1px solid #E8E6DF">${h}</th>`).join("")}
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr style="background:#F1EFE8"><td colspan="3" style="padding:8px 12px;font-size:12px;font-weight:700">Category Total</td>
            <td style="padding:8px 12px;font-size:14px;font-weight:900;color:#0C447C;text-align:right">$${total.toFixed(2)}</td><td></td></tr></tfoot>
          </table></div>`;
      }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>BuildConnect Pro — ${year} Tax Summary</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2C2C2A;padding:40px 48px}
@media print{body{padding:20px 24px}.no-print{display:none!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div style="background:linear-gradient(135deg,#082E56,#0C447C);padding:28px 32px;border-radius:12px;margin-bottom:28px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div><div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="width:34px;height:34px;background:#185FA5;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:#FAEEDA">BC</div>
      <div style="font-size:15px;font-weight:800;color:#fff">BuildConnect Pro</div></div>
      <div style="font-size:26px;font-weight:900;color:#fff;letter-spacing:-0.02em;margin-bottom:4px">Tax Year ${year} — Expense Summary</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.6)">${profile?.name||"Contractor"}${profile?.company?` · ${profile.company}`:""} · ${profile?.city||"San Diego"}, CA</div>
      ${profile?.licenseNum?`<div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:2px">CSLB: ${profile.licenseNum}</div>`:""}
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:3px">Generated ${new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
      <div style="font-size:10px;color:rgba(255,255,255,0.35)">FOR TAX PREPARER — NOT A TAX RETURN</div>
    </div>
  </div>
</div>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
  ${[["Total Revenue",`$${totalRev.toFixed(2)}`,"#0F6E56","#E1F5EE"],["Total Expenses",`$${grandTotal.toFixed(2)}`,"#A32D2D","#FCEBEB"],["Net Profit",`$${netProfit.toFixed(2)}`,netProfit>=0?"#185FA5":"#A32D2D",netProfit>=0?"#E6F1FB":"#FCEBEB"],["Receipts Saved",`${receiptCount}/${yearExp.length}`,"#854F0B","#FAEEDA"]]
    .map(([l,v,c,bg])=>`<div style="background:${bg};border-radius:10px;padding:14px 16px"><div style="font-size:10px;font-weight:700;color:${c};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">${l}</div><div style="font-size:20px;font-weight:900;color:${c}">${v}</div></div>`).join("")}
</div>
<div style="background:#FAEEDA;border:1.5px solid #EF9F27;border-radius:10px;padding:14px 18px;margin-bottom:28px">
  <div style="font-size:12px;font-weight:700;color:#854F0B;margin-bottom:4px"> Schedule C Reference (Form 1040, Schedule C — Self-Employed Contractors)</div>
  <div style="font-size:12px;color:#2C2C2A;line-height:1.7">Each category below maps to the corresponding IRS Schedule C line. Share with your CPA. Do not file this document as a tax return. Verify all amounts against original receipts.</div>
</div>
${catRows}
<div style="background:#0C447C;border-radius:10px;padding:16px 20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center">
  <div><div style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:3px">Total Deductible Expenses — Tax Year ${year}</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.55)">Transfer to Schedule C, Part II — Total Expenses</div></div>
  <div style="font-size:28px;font-weight:900;color:#EF9F27">$${grandTotal.toFixed(2)}</div>
</div>
<div style="border-top:1.5px solid #E8E6DF;padding-top:14px;font-size:11px;color:#888780;line-height:1.65">
  This document was generated by BuildConnect Pro for informational purposes only and does not constitute tax advice. Consult a licensed CPA before filing. BuildConnect Pro is not responsible for tax filing outcomes.
</div>
<div class="no-print" style="text-align:center;padding:20px;margin-top:20px;background:#0C447C;border-radius:10px">
  <button onclick="window.print()" style="padding:12px 28px;background:#EF9F27;color:#082E56;border:none;border-radius:8px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;margin-right:10px">print 🖨 Print / Save PDF</button>
  <button onclick="window.close()" style="padding:12px 18px;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.2);border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit">Close</button>
</div>
</body></html>`;
    window.open(URL.createObjectURL(new Blob([html],{type:"text/html"})),"_blank");
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:16, padding:28, width:"100%", maxWidth:560, boxSizing:"border-box", maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:"#0C447C" }}>Tax Summary Export</div>
            <div style={{ fontSize:12, color:"#888780", marginTop:2 }}>Formatted for Schedule C — ready to hand to your CPA</div>
          </div>
          <button type="button" onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#888780" }}>✕</button>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Tax Year</label>
          <div style={{ display:"flex", gap:8 }}>
            {years.map(y=>(
              <button key={y} type="button" onClick={()=>setYear(y)}
                style={{ flex:1, padding:"10px 0", borderRadius:9, border:`${year===y?"2px solid #0C447C":"1.5px solid #D3D1C7"}`, background:year===y?"#E6F1FB":"#fff", color:year===y?"#0C447C":"#2C2C2A", fontSize:14, fontWeight:year===y?800:500, cursor:"pointer", fontFamily:font }}>
                {y}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
          {[["Total Revenue",fmt$(totalRev),"#0F6E56","#E1F5EE"],["Total Expenses",fmt$(grandTotal),"#A32D2D","#FCEBEB"],["Est. Net Profit",fmt$(netProfit),netProfit>=0?"#185FA5":"#A32D2D",netProfit>=0?"#E6F1FB":"#FCEBEB"],["Receipts Documented",`${receiptCount} / ${yearExp.length}`,"#854F0B","#FAEEDA"]].map(([l,v,c,bg])=>(
            <div key={l} style={{ background:bg, borderRadius:10, padding:"12px 16px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:c, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{l}</div>
              <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
            </div>
          ))}
        </div>

        {yearExp.length === 0 ? (
          <div style={{ textAlign:"center", padding:"32px 20px", background:"#F8F7F4", borderRadius:12, marginBottom:20, border:"1.5px solid #E8E6DF" }}>
            <div style={{ fontSize:32, marginBottom:10 }}></div>
            <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A", marginBottom:6 }}>No expenses logged for {year}</div>
            <div style={{ fontSize:13, color:"#888780" }}>Add expenses in the Expenses tab to see your tax summary.</div>
          </div>
        ) : (
          <div style={{ border:"1.5px solid #E8E6DF", borderRadius:12, overflow:"hidden", marginBottom:20 }}>
            <div style={{ background:"#0C447C", padding:"10px 16px", display:"grid", gridTemplateColumns:"1fr auto auto auto", gap:8 }}>
              {["Category / Schedule C Line","Items","Receipts","Total"].map((h,i)=>(
                <div key={h} style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.65)", textTransform:"uppercase", letterSpacing:"0.06em", textAlign:i>0?"center":"left" }}>{h}</div>
              ))}
            </div>
            {Object.entries(byCategory).filter(([,e])=>e.length>0).map(([cat,exps],idx)=>{
              const total = exps.reduce((s,e)=>s+(Number(e.amount)||0),0);
              const sc    = SCHEDULE_C_MAP[cat]||{line:"Line 27a",title:cat};
              const cfg   = EXPENSE_CATEGORIES[cat]||{};
              return (
                <div key={cat} style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", padding:"12px 16px", borderTop:"1px solid #F1EFE8", background:idx%2===0?"#fff":"#FAFAF8", alignItems:"center", gap:12 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{cfg.icon} {sc.title}</div>
                    <div style={{ fontSize:11, color:"#888780" }}>{sc.line} · Schedule C</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#2C2C2A", textAlign:"center" }}>{exps.length}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:exps.filter(e=>e.receipt).length===exps.length?"#0F6E56":"#854F0B", textAlign:"center" }}>
                    {exps.filter(e=>e.receipt).length}/{exps.length}
                  </div>
                  <div style={{ fontSize:14, fontWeight:800, color:"#0C447C", textAlign:"right" }}>{fmt$(total)}</div>
                </div>
              );
            })}
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto auto", padding:"12px 16px", background:"#0C447C", gap:12, alignItems:"center" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>Total Deductible Expenses</div>
              <div style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.6)", textAlign:"center" }}>{yearExp.length}</div>
              <div style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,0.6)", textAlign:"center" }}>{receiptCount}/{yearExp.length}</div>
              <div style={{ fontSize:16, fontWeight:900, color:"#EF9F27", textAlign:"right" }}>{fmt$(grandTotal)}</div>
            </div>
          </div>
        )}

        {yearExp.length > 0 && receiptCount < yearExp.length && (
          <div style={{ background:"#FAEEDA", border:"1.5px solid #EF9F27", borderRadius:10, padding:"11px 16px", marginBottom:16, fontSize:13, color:"#854F0B" }}>
            ! <strong>{yearExp.length - receiptCount} expense{yearExp.length-receiptCount!==1?"s":""}</strong> missing receipts. The IRS requires documentation for expenses over $75.
          </div>
        )}

        <div style={{ background:"#F8F7F4", borderRadius:10, border:"1px solid #E8E6DF", padding:"11px 16px", marginBottom:20, fontSize:12, color:"#5F5E5A", lineHeight:1.65 }}>
          <strong style={{ color:"#0C447C" }}>For your CPA:</strong> Each category is mapped to the corresponding Schedule C line. The PDF includes all line-item detail, receipt confirmation, and project associations. Not a tax document — verify all figures before filing.
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button type="button" onClick={downloadPDF} disabled={yearExp.length===0}
            style={{ flex:2, padding:"13px", borderRadius:10, border:"none", background:yearExp.length===0?"#D3D1C7":"#0C447C", color:"#fff", fontSize:14, fontWeight:800, cursor:yearExp.length===0?"not-allowed":"pointer", fontFamily:font }}>
            Export PDF for CPA
          </button>
          <button type="button" onClick={downloadCSV} disabled={yearExp.length===0}
            style={{ flex:1, padding:"13px", borderRadius:10, border:"1.5px solid #D3D1C7", background:"#fff", color:yearExp.length===0?"#B4B2A9":"#2C2C2A", fontSize:13, fontWeight:700, cursor:yearExp.length===0?"not-allowed":"pointer", fontFamily:font }}>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}

export function MonthlyReport({ invoices, expenses, invTotal, onBack }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const inMonth = isoDate => {
    if (!isoDate) return false;
    const d = new Date(isoDate);
    return d.getFullYear() === year && d.getMonth() === month;
  };

  const monthInvoices = invoices.filter(i => inMonth(i.date));
  const monthExpenses = expenses.filter(e => inMonth(e.date));

  const totalRevenue = monthInvoices.reduce((s,i)=>s+invTotal(i), 0);
  const totalCost = monthExpenses.reduce((s,e)=>s+(Number(e.amount)||0), 0);
  const netProfit = totalRevenue - totalCost;

  // Group by job/project name
  const projectNames = [...new Set([...monthInvoices.map(i=>i.project||"Unassigned"), ...monthExpenses.map(e=>e.project||"Unassigned")])];
  const jobs = projectNames.map(name => {
    const inv = monthInvoices.filter(i => sameProject(i.project||"Unassigned", name));
    const exp = monthExpenses.filter(e => sameProject(e.project||"Unassigned", name));
    const revenue = inv.reduce((s,i)=>s+invTotal(i),0);
    const cost = exp.reduce((s,e)=>s+(Number(e.amount)||0),0);
    return { name, invoiceCount: inv.length, expenseCount: exp.length, revenue, cost, profit: revenue-cost };
  }).sort((a,b)=>b.revenue-a.revenue);

  // By category breakdown for the month
  const byCategory = {};
  monthExpenses.forEach(e => { byCategory[e.category] = (byCategory[e.category]||0) + (Number(e.amount)||0); });

  const prevMonth = () => { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const handlePrint = () => window.print();

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #monthly-report-print, #monthly-report-print * { visibility: visible; }
          #monthly-report-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <Btn onClick={onBack} variant="ghost" small>Back Back to Expenses</Btn>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={prevMonth} style={{ background:"none", border:"1.5px solid #D3D1C7", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:16 }}>&lt;</button>
          <span style={{ fontSize:15, fontWeight:800, color:"#0C447C", minWidth:140, textAlign:"center" }}>{REPORT_MONTHS[month]} {year}</span>
          <button onClick={nextMonth} style={{ background:"none", border:"1.5px solid #D3D1C7", borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:16 }}>{">"}</button>
        </div>
        <Btn onClick={handlePrint} variant="primary" small>print Download PDF</Btn>
      </div>

      <div id="monthly-report-print" style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:12, padding:"32px 36px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", borderBottom:"2px solid #0C447C", paddingBottom:20, marginBottom:24 }}>
          <div>
            <div style={{ fontSize:24, fontWeight:900, color:"#0C447C", letterSpacing:"-0.02em" }}>Monthly Expense Report</div>
            <div style={{ fontSize:14, color:"#2C2C2A", marginTop:2 }}>{REPORT_MONTHS[month]} {year}</div>
          </div>
          <div style={{ fontSize:12, color:"#2C2C2A" }}>Generated {new Date().toLocaleDateString()}</div>
        </div>

        {/* Summary tiles */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:14, marginBottom:28 }}>
          <div style={{ background:"#E1F5EE", borderRadius:10, padding:"16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#0F6E56", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Total Revenue</div>
            <div style={{ fontSize:24, fontWeight:800, color:"#0F6E56" }}>{fmt$(totalRevenue)}</div>
            <div style={{ fontSize:11, color:"#2C2C2A", marginTop:4 }}>{monthInvoices.length} invoice{monthInvoices.length!==1?"s":""}</div>
          </div>
          <div style={{ background:"#FCEBEB", borderRadius:10, padding:"16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#A32D2D", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Total Expenses</div>
            <div style={{ fontSize:24, fontWeight:800, color:"#A32D2D" }}>{fmt$(totalCost)}</div>
            <div style={{ fontSize:11, color:"#2C2C2A", marginTop:4 }}>{monthExpenses.length} expense{monthExpenses.length!==1?"s":""}</div>
          </div>
          <div style={{ background: netProfit>=0?"#E6F1FB":"#FCEBEB", borderRadius:10, padding:"16px" }}>
            <div style={{ fontSize:11, fontWeight:700, color: netProfit>=0?"#185FA5":"#A32D2D", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>Net Profit</div>
            <div style={{ fontSize:24, fontWeight:800, color: netProfit>=0?"#185FA5":"#A32D2D" }}>{fmt$(netProfit)}</div>
            <div style={{ fontSize:11, color:"#2C2C2A", marginTop:4 }}>{netProfit>=0?"Profitable month":"Loss this month"}</div>
          </div>
        </div>

        {/* Jobs summary table */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#444441", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Summary by Job</div>
          {jobs.length === 0 ? (
            <p style={{ fontSize:13, color:"#2C2C2A" }}>No invoices or expenses recorded for this month.</p>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ background:"#F1EFE8" }}>
                {["Job / Project","Invoices","Expenses","Revenue","Cost","Profit"].map((h,i)=>(
                  <th key={h} style={{ padding:"8px 10px", fontSize:11, fontWeight:700, color:"#2C2C2A", textTransform:"uppercase", letterSpacing:"0.04em", textAlign: i===0?"left":"right" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.name} style={{ borderBottom:"1px solid #F1EFE8" }}>
                    <td style={{ padding:"9px 10px", fontSize:13, color:"#2C2C2A", fontWeight:600 }}>{j.name}</td>
                    <td style={{ padding:"9px 10px", fontSize:13, color:"#2C2C2A", textAlign:"right" }}>{j.invoiceCount}</td>
                    <td style={{ padding:"9px 10px", fontSize:13, color:"#2C2C2A", textAlign:"right" }}>{j.expenseCount}</td>
                    <td style={{ padding:"9px 10px", fontSize:13, color:"#0F6E56", textAlign:"right", fontWeight:600 }}>{fmt$(j.revenue)}</td>
                    <td style={{ padding:"9px 10px", fontSize:13, color:"#A32D2D", textAlign:"right", fontWeight:600 }}>{fmt$(j.cost)}</td>
                    <td style={{ padding:"9px 10px", fontSize:13, textAlign:"right", fontWeight:800, color: j.profit>=0?"#0F6E56":"#A32D2D" }}>{fmt$(j.profit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:"2px solid #D3D1C7" }}>
                  <td style={{ padding:"10px", fontSize:13, fontWeight:800, color:"#2C2C2A" }}>Total</td>
                  <td></td><td></td>
                  <td style={{ padding:"10px", fontSize:13, fontWeight:800, color:"#0F6E56", textAlign:"right" }}>{fmt$(totalRevenue)}</td>
                  <td style={{ padding:"10px", fontSize:13, fontWeight:800, color:"#A32D2D", textAlign:"right" }}>{fmt$(totalCost)}</td>
                  <td style={{ padding:"10px", fontSize:13, fontWeight:800, textAlign:"right", color: netProfit>=0?"#0F6E56":"#A32D2D" }}>{fmt$(netProfit)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Expense category breakdown */}
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#444441", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Expenses by Category</div>
          {Object.keys(byCategory).length === 0 ? (
            <p style={{ fontSize:13, color:"#2C2C2A" }}>No expenses this month.</p>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
              {Object.entries(byCategory).map(([cat,amt]) => {
                const c = EXPENSE_CATEGORIES[cat] || {};
                return (
                  <div key={cat} style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"6px 10px", background:"#F8F7F4", borderRadius:6 }}>
                    <span style={{ color:"#2C2C2A" }}>{c.icon} {cat}</span>
                    <span style={{ fontWeight:700, color:"#2C2C2A" }}>{fmt$(amt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Invoice & expense detail listing */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#444441", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Invoices This Month</div>
            {monthInvoices.length === 0 ? <p style={{ fontSize:12, color:"#2C2C2A" }}>None.</p> : monthInvoices.map(i=>(
              <div key={i.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid #F1EFE8" }}>
                <span style={{ color:"#2C2C2A" }}>{i.number} · {i.client||"—"}</span>
                <span style={{ fontWeight:700, color:"#0F6E56" }}>{fmt$(invTotal(i))}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"#444441", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Expenses This Month</div>
            {monthExpenses.length === 0 ? <p style={{ fontSize:12, color:"#2C2C2A" }}>None.</p> : monthExpenses.map(e=>(
              <div key={e.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"5px 0", borderBottom:"1px solid #F1EFE8" }}>
                <span style={{ color:"#2C2C2A" }}>{e.description}</span>
                <span style={{ fontWeight:700, color:"#A32D2D" }}>{fmt$(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// — Receipt Scanner (AI-powered) ----------------------------------------------
export function ReceiptScanner({ onSave, onClose, activeJobsList, auth }) {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  const fileRef = useRef();
  const [image,    setImage]    = useState(null);    // base64 data URL
  const [scanning, setScanning] = useState(false);
  const [result,   setResult]   = useState(null);    // parsed receipt data
  const [error,    setError]    = useState("");
  const [project,  setProject]  = useState("");
  const [customProject, setCustomProject] = useState("");
  const [selected, setSelected] = useState({});      // itemIdx -> boolean

  const [isPdf, setIsPdf] = useState(false);

  const loadImage = e => {
    const file = e.target.files[0];
    if (!file) return;
    const pdf = file.type === "application/pdf";
    setIsPdf(pdf);
    const reader = new FileReader();
    reader.onload = ev => { setImage(ev.target.result); setResult(null); setError(""); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const scan = async () => {
    if (!image) return;
    setScanning(true); setError("");
    try {
      let messageContent;

      if (isPdf) {
        // Send as document type for PDFs
        const base64 = image.split(",")[1];
        messageContent = [
          { type:"document", source:{ type:"base64", media_type:"application/pdf", data: base64 } },
          { type:"text", text: `You are reading a contractor expense receipt or invoice PDF. Extract all information and return ONLY a valid JSON object with no markdown or explanation:
{
  "merchant": "store or vendor name",
  "date": "YYYY-MM-DD or empty string if unclear",
  "items": [
    { "description": "specific item or service name", "amount": 0.00 }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "category": "one of exactly: Materials, Tools, Fuel, Equipment, Subcontractors, Other"
}
List every individual line item. If tax is shown separately, include it. Return ONLY the JSON object.` }
        ];
      } else {
        // Send as image type for photos
        const mediaType = image.startsWith("data:image/png") ? "image/png"
                        : image.startsWith("data:image/webp") ? "image/webp"
                        : "image/jpeg";
        const base64 = image.split(",")[1];
        messageContent = [
          { type:"image", source:{ type:"base64", media_type: mediaType, data: base64 } },
          { type:"text", text: `You are reading a contractor expense receipt. Extract all information and return ONLY a valid JSON object with no markdown or explanation:
{
  "merchant": "store or vendor name",
  "date": "YYYY-MM-DD or empty string if unclear",
  "items": [
    { "description": "specific item or service name", "amount": 0.00 }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "category": "one of exactly: Materials, Tools, Fuel, Equipment, Subcontractors, Other"
}
List every individual line item from the receipt. If tax is shown separately, include it as a separate item. Return ONLY the JSON object.` }
        ];
      }

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role:"user", content: messageContent }]
        })
      });

      const data  = await response.json();
      const text  = data.content?.[0]?.text || "{}";
      const clean = text.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(clean);

      // Default: all items selected
      const sel = {};
      (parsed.items||[]).forEach((_,i) => { sel[i] = true; });
      if (parsed.tax > 0) sel["tax"] = true;
      setSelected(sel);
      setResult(parsed);
    } catch(err) {
      setError("Could not read this receipt. Try a clearer, well-lit photo — or add the expense manually.");
    }
    setScanning(false);
  };

  const confirm = async () => {
    if (!result) return;
    const date = result.date || new Date().toISOString().slice(0,10);
    const proj = project === "__custom__" ? customProject : project;
    const cat  = result.category || "Materials";

    // Upload the receipt image once — every expense generated from this
    // receipt shares the same file, so there's no reason to store the base64
    // data itself on each row.
    const blob = await (await fetch(image)).blob();
    const ext = isPdf ? "pdf" : (blob.type.split("/")[1] || "jpg");
    const file = new File([blob], `receipt.${ext}`, { type: blob.type });
    const { url: receiptUrl, path: receiptPath, error: uploadErr } = await uploadContractorPhoto(file, auth.id, "receipts");
    if (uploadErr) { setError("Couldn't save the receipt image. Please try again."); return; }

    const expenses = [];

    (result.items||[]).forEach((item, i) => {
      if (!selected[i]) return;
      expenses.push({
        id: uid(), date, category: cat,
        description: `${item.description}${result.merchant ? ` — ${result.merchant}` : ""}`,
        amount: String(Number(item.amount).toFixed(2)),
        project: proj, receipt: receiptUrl, receiptPath,
      });
    });

    if (selected["tax"] && result.tax > 0) {
      expenses.push({
        id: uid(), date, category: cat,
        description: `Tax — ${result.merchant || "🧾 Receipt"}`,
        amount: String(Number(result.tax).toFixed(2)),
        project: proj, receipt: receiptUrl, receiptPath,
      });
    }

    if (expenses.length === 0) {
      // Fallback: save as single total
      expenses.push({
        id: uid(), date, category: cat,
        description: result.merchant || "🧾 Receipt",
        amount: String(Number(result.total||0).toFixed(2)),
        project: proj, receipt: receiptUrl, receiptPath,
      });
    }

    onSave(expenses);
  };

  const inpStyle = { padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:font, outline:"none", width:"100%", boxSizing:"border-box" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:16, padding:28, width:"100%", maxWidth:540, boxSizing:"border-box", maxHeight:"90vh", overflowY:"auto" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:800, color:"#0C447C" }}>🧾 Scan Receipt with AI</div>
            <div style={{ fontSize:12, color:"#888780", marginTop:2 }}>Upload a photo — AI reads and itemizes it automatically</div>
          </div>
          <button type="button" onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#888780" }}>✕</button>
        </div>

        {/* Upload zone */}
        <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={loadImage} style={{ display:"none" }} />
        {!image ? (
          <div onClick={()=>fileRef.current?.click()}
            style={{ border:"2.5px dashed #D3D1C7", borderRadius:12, padding:"40px 24px", textAlign:"center", cursor:"pointer", background:"#F8F7F4", marginBottom:20, transition:"border-color 0.2s" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#185FA5"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="#D3D1C7"}>
            <div style={{ fontSize:44, marginBottom:10 }}></div>
            <div style={{ fontSize:15, fontWeight:700, color:"#0C447C", marginBottom:6 }}>Tap to upload or take a photo</div>
            <div style={{ fontSize:13, color:"#888780" }}>JPG, PNG, or PDF · Best results with a clear, flat, well-lit receipt</div>
          </div>
        ) : (
          <div style={{ marginBottom:20 }}>
            <div style={{ position:"relative", marginBottom:12 }}>
              {isPdf ? (
                <div style={{ width:"100%", height:200, borderRadius:10, border:"1.5px solid #E8E6DF", background:"#F8F7F4", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <span style={{ fontSize:40 }}></span>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0C447C" }}>PDF Receipt Uploaded</div>
                  <div style={{ fontSize:11, color:"#888780" }}>Ready to scan</div>
                </div>
              ) : (
                <img src={image} alt="🧾 Receipt" style={{ width:"100%", maxHeight:280, objectFit:"contain", borderRadius:10, border:"1.5px solid #E8E6DF", background:"#F8F7F4" }} />
              )}
              <button type="button" onClick={()=>{ setImage(null); setResult(null); setError(""); setIsPdf(false); }}
                style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.55)", border:"none", borderRadius:"50%", width:28, height:28, color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>✕</button>
            </div>
            {!result && !scanning && (
              <button type="button" onClick={scan}
                style={{ display:"block", width:"100%", padding:"12px", borderRadius:10, border:"none", background:"#0C447C", color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:font }}>
                * Read Receipt with AI
              </button>
            )}
            {scanning && (
              <div style={{ textAlign:"center", padding:"16px", background:"#E6F1FB", borderRadius:10 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#185FA5" }}> Reading your receipt...</div>
                <div style={{ fontSize:12, color:"#888780", marginTop:4 }}>Extracting line items, amounts, and merchant info</div>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background:"#FCEBEB", border:"1.5px solid #F3C6C6", borderRadius:9, padding:"11px 14px", marginBottom:16, fontSize:13, color:"#A32D2D" }}>{error}</div>
        )}

        {/* Results */}
        {result && (
          <div>
            {/* Merchant + date summary */}
            <div style={{ background:"#0C447C", borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:"#fff" }}>{result.merchant || "🧾 Receipt"}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", marginTop:2 }}>
                  {result.date || "Date not detected"} · {result.category}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Total</div>
                <div style={{ fontSize:20, fontWeight:900, color:"#EF9F27" }}>${Number(result.total||0).toFixed(2)}</div>
              </div>
            </div>

            {/* Line items — checkboxes */}
            <div style={{ fontSize:12, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>
              Select items to save as expenses
            </div>
            <div style={{ border:"1.5px solid #E8E6DF", borderRadius:10, overflow:"hidden", marginBottom:16 }}>
              {(result.items||[]).map((item, i) => (
                <label key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", borderBottom:"1px solid #F1EFE8", cursor:"pointer", background:selected[i]?"#F8FAFF":"#fff" }}>
                  <input type="checkbox" checked={!!selected[i]} onChange={e=>setSelected(s=>({...s,[i]:e.target.checked}))}
                    style={{ accentColor:"#0C447C", width:16, height:16, flexShrink:0 }} />
                  <span style={{ flex:1, fontSize:13, color:"#2C2C2A" }}>{item.description}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"#0C447C" }}>${Number(item.amount||0).toFixed(2)}</span>
                </label>
              ))}
              {result.tax > 0 && (
                <label style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", cursor:"pointer", background:selected["tax"]?"#F8FAFF":"#fff" }}>
                  <input type="checkbox" checked={!!selected["tax"]} onChange={e=>setSelected(s=>({...s,tax:e.target.checked}))}
                    style={{ accentColor:"#0C447C", width:16, height:16, flexShrink:0 }} />
                  <span style={{ flex:1, fontSize:13, color:"#2C2C2A", fontStyle:"italic" }}>Sales Tax</span>
                  <span style={{ fontSize:13, fontWeight:700, color:"#0C447C" }}>${Number(result.tax).toFixed(2)}</span>
                </label>
              )}
            </div>

            {/* Project selector */}
            <div style={{ marginBottom:20 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#5F5E5A", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>
                Associate with a Project <span style={{ fontSize:10, fontWeight:400, textTransform:"none", letterSpacing:0 }}>-- optional</span>
              </label>
              <select value={project} onChange={e=>setProject(e.target.value)} style={{ ...inpStyle, color:project?"#2C2C2A":"#9CA3AF", marginBottom: project==="__custom__"?10:0 }}>
                <option value="">No project — general expense</option>
                {activeJobsList.length > 0 && (
                  <>
                    <option disabled>-- Active Jobs --</option>
                    {activeJobsList.map(j=><option key={j} value={j}>{j}</option>)}
                  </>
                )}
                <option value="__custom__">Enter manually...</option>
              </select>
              {project === "__custom__" && (
                <input value={customProject} onChange={e=>setCustomProject(e.target.value)}
                  placeholder="e.g. Smith Kitchen Remodel" style={inpStyle} />
              )}
            </div>

            {/* Selected count summary */}
            <div style={{ background:"#E1F5EE", borderRadius:9, padding:"10px 14px", marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:13, color:"#0F6E56", fontWeight:600 }}>
                {Object.values(selected).filter(Boolean).length} item{Object.values(selected).filter(Boolean).length!==1?"s":""} selected
              </span>
              <span style={{ fontSize:15, fontWeight:900, color:"#0C447C" }}>
                ${(result.items||[]).reduce((s,item,i)=>s+(selected[i]?Number(item.amount||0):0),0).toFixed(2)}
                {selected["tax"]&&result.tax>0 ? ` + $${Number(result.tax).toFixed(2)} tax` : ""}
              </span>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button type="button" onClick={confirm}
                style={{ flex:2, padding:"12px", borderRadius:10, border:"none", background:"#0F6E56", color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:font }}>
                Save {Object.values(selected).filter(Boolean).length} Expense{Object.values(selected).filter(Boolean).length!==1?"s":""}
              </button>
              <button type="button" onClick={()=>{ setResult(null); setError(""); }}
                style={{ flex:1, padding:"12px", borderRadius:10, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:font }}>
                Re-scan
              </button>
            </div>
          </div>
        )}

        {!image && !result && (
          <button type="button" onClick={onClose}
            style={{ display:"block", width:"100%", padding:"11px", borderRadius:10, border:"1.5px solid #D3D1C7", background:"#fff", color:"#2C2C2A", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:font, marginTop:8 }}>
            Cancel — Add Manually Instead
          </button>
        )}
      </div>
    </div>
  );
}

// — Expenses Tab -------------------------------------------------------------
export function ExpensesTab({ expenses, setExpenses, invoices, projects, bids, leads, auth }) {
  const [showForm,    setShowForm]    = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showTaxSummary, setShowTaxSummary] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_EXP());
  const [catFilter, setCatFilter] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [jobFilter, setJobFilter] = useState("");
  const [receiptOnly, setReceiptOnly] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [linkedInvoice, setLinkedInvoice] = useState(null);
  const [viewReceipt, setViewReceipt] = useState(null);
  const receiptRef = useRef();

  // Build active jobs list from bid-won projects and manually added projects
  const activeJobsList = [
    ...((bids||[]).filter(b => b.status === "accepted").map(b => {
      const lead = (leads||[]).find(l => l.id === b.leadId) || {};
      const proj = (projects||{})[b.id] || {};
      return proj.stage !== "completed" ? (lead.projectTitle || "") : null;
    }).filter(Boolean)),
    ...Object.values(projects||{}).filter(p => p.source === "manual" && p.stage !== "completed").map(p => p.projectTitle || "")
  ].filter(Boolean).sort();

  const openNew = () => { setForm(EMPTY_EXP()); setEditId(null); setLinkedInvoice(null); setShowForm(true); };
  const openEdit = exp => {
    const isActiveJob = activeJobsList.includes(exp.project || "");
    const project = exp.project && !isActiveJob ? "__custom__" : (exp.project || "");
    setForm({ receipt: "", ...exp, project, _customProject: exp.project || "" });
    setEditId(exp.id);
    setLinkedInvoice(null);
    setShowForm(true);
  };
  const openForInvoice = inv => { setForm({ ...EMPTY_EXP(), project: inv.project || "" }); setEditId(null); setLinkedInvoice(inv); setShowForm(true); };

  const saveExp = async () => {
    if (!form.description || !form.amount) { alert("Please enter a description and amount."); return; }
    const cleanForm = { ...form };
    if (cleanForm.project === "__custom__") cleanForm.project = cleanForm._customProject || "";
    delete cleanForm._customProject;
    if (editId) {
      const { data, error } = await supabase.from("expenses").update(expenseToDb(cleanForm)).eq("id", editId).select().single();
      if (error) { console.error("Failed to update expense:", error); return; }
      const saved = expenseFromDb(data);
      setExpenses(prev => prev.map(e => e.id === saved.id ? saved : e));
    } else {
      const { data, error } = await supabase.from("expenses").insert({ ...expenseToDb(cleanForm), contractor_id: auth.id }).select().single();
      if (error) { console.error("Failed to create expense:", error); return; }
      setExpenses(prev => [expenseFromDb(data), ...prev]);
    }
    setShowForm(false);
  };

  const deleteExp = async id => {
    const exp = expenses.find(e => e.id === id);
    if (exp?.receiptPath) await deleteContractorPhoto(exp.receiptPath);
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) { console.error("Failed to delete expense:", error); return; }
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const jobNames = [...new Set(expenses.map(e => e.project).filter(Boolean))].sort();
  const filtered = filterByDateRange(
    expenses.filter(e =>
      (!catFilter || e.category === catFilter) &&
      (!jobFilter || sameProject(e.project, jobFilter)) &&
      (!receiptOnly || !!e.receipt)
    ),
    "date", dateRange
  );
  const totalExpenses = expenses.reduce((s,e) => s + (Number(e.amount)||0), 0);

  // Invoice revenue helpers
  const invTotal = inv => (inv.items || []).reduce((s, i) => s + (Number(i.qty) * Number(i.rate) || 0), 0);
  const totalRevenue = invoices.reduce((s,i)=>s+invTotal(i), 0);

  // Category breakdown
  const byCategory = {};
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category]||0) + (Number(e.amount)||0); });
  const maxCat = Math.max(1, ...Object.values(byCategory));

  // Job costing: group by project name across invoices (revenue) and expenses (cost)
  const projectNames = [...new Set([...invoices.map(i=>i.project).filter(Boolean), ...expenses.map(e=>e.project).filter(Boolean)])];
  const jobCosting = projectNames.map(name => {
    const revenue = invoices.filter(i => sameProject(i.project, name)).reduce((s,i)=>s+invTotal(i), 0);
    const cost = expenses.filter(e => sameProject(e.project, name)).reduce((s,e)=>s+(Number(e.amount)||0), 0);
    return { name, revenue, cost, profit: revenue - cost };
  });

  if (showReport) return <MonthlyReport invoices={invoices} expenses={expenses} invTotal={invTotal} onBack={()=>setShowReport(false)} />;

  return (
    <div>
      {/* Tax Summary modal */}
      {showTaxSummary && (
        <TaxSummaryModal
          expenses={expenses}
          invoices={invoices}
          profile={null}
          onClose={()=>setShowTaxSummary(false)}
        />
      )}
      {/* Receipt Scanner modal */}
      {showScanner && (
        <ReceiptScanner
          activeJobsList={activeJobsList}
          auth={auth}
          onSave={async newExpenses => {
            const { data, error } = await supabase.from("expenses").insert(newExpenses.map(e => ({ ...expenseToDb(e), contractor_id: auth.id }))).select();
            if (error) { console.error("Failed to save scanned expenses:", error); return; }
            setExpenses(prev => [...(data || []).map(expenseFromDb), ...prev]);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
      {/* Receipt lightbox */}
      {viewReceipt && (
        <div onClick={()=>setViewReceipt(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ position:"relative", maxWidth:"90vw", maxHeight:"90vh" }}>
            <img src={viewReceipt} alt="🧾 Receipt" style={{ maxWidth:"100%", maxHeight:"85vh", objectFit:"contain", borderRadius:8 }} />
            <button onClick={()=>setViewReceipt(null)}
              style={{ position:"absolute", top:-12, right:-12, width:32, height:32, borderRadius:"50%", background:"#fff", border:"none", cursor:"pointer", fontSize:16, fontWeight:700, color:"#2C2C2A", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
          </div>
        </div>
      )}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999, padding:20 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#fff", borderRadius:14, padding:28, width:"100%", maxWidth:420, boxSizing:"border-box" }}>
            <div style={{ fontSize:16, fontWeight:800, color:"#0C447C", marginBottom:6 }}>{editId ? "Edit Expense" : linkedInvoice ? "Add Expense to Job" : "Add Expense"}</div>
            {linkedInvoice && (
              <div style={{ background:"#E6F1FB", borderRadius:8, padding:"10px 12px", marginBottom:14, fontSize:12, color:"#0C447C" }}>
                 Linked to invoice <strong>{linkedInvoice.number}</strong>{linkedInvoice.project ? <> for <strong>{linkedInvoice.project}</strong></> : null} · this expense will count against that job's cost in Job Costing.
              </div>
            )}
            {!linkedInvoice && <div style={{ marginBottom:14 }} />}
            <Field label="Date" type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))} />
            <Field label="Category">
              <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
                {Object.entries(EXPENSE_CATEGORIES).map(([k,c])=><option key={k} value={k}>{c.icon} {k}</option>)}
              </select>
            </Field>
            <Field label="Description" value={form.description} onChange={v=>setForm(f=>({...f,description:v}))} placeholder="e.g. Lumber for framing" required />
            <Field label="Amount ($)" type="number" value={form.amount} onChange={v=>setForm(f=>({...f,amount:v}))} placeholder="0.00" required />
            <Field label="Project / Job">
              <select value={form.project} onChange={e => setForm(f=>({...f, project: e.target.value}))}
                style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff", color: form.project ? "#2C2C2A" : "#888780" }}>
                <option value="">Select a job (optional)</option>
                {activeJobsList.length > 0 && (
                  <>
                    <option disabled>-- Active Jobs --</option>
                    {activeJobsList.map(j => <option key={j} value={j}>{j}</option>)}
                  </>
                )}
                <option disabled>-- Or type a custom job --</option>
                <option value="__custom__">Enter manually...</option>
              </select>
            </Field>
            {form.project === "__custom__" && (
              <Field label="Custom Job Name" value={form._customProject||""} onChange={v=>setForm(f=>({...f, _customProject:v, project:v}))} placeholder="e.g. Smith Kitchen Remodel" />
            )}

            {/* Receipt photo upload */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, color:"#444441", marginBottom:6, letterSpacing:"0.04em", textTransform:"uppercase" }}>Receipt Photo (optional)</label>
              <input ref={receiptRef} type="file" accept="image/*" onChange={async e => {
                const file = e.target.files[0];
                e.target.value = "";
                if (!file) return;
                setUploadingReceipt(true);
                const { url, path, error } = await uploadContractorPhoto(file, auth.id, "receipts");
                setUploadingReceipt(false);
                if (error) { console.error("Failed to upload receipt:", error); alert("Couldn't upload that photo. Please try again."); return; }
                setForm(f=>({...f, receipt: url, receiptPath: path }));
              }} style={{ display:"none" }} />
              {uploadingReceipt ? (
                <div style={{ padding:"8px 16px", fontSize:13, color:"#888780" }}>Uploading...</div>
              ) : form.receipt ? (
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <img src={form.receipt} alt="🧾 Receipt" onClick={()=>setViewReceipt(form.receipt)}
                    style={{ width:64, height:64, objectFit:"cover", borderRadius:8, border:"1.5px solid #D3D1C7", cursor:"pointer" }} />
                  <div>
                    <div style={{ fontSize:12, color:"#2C2C2A", marginBottom:4 }}>Receipt attached</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={()=>receiptRef.current?.click()} style={{ fontSize:12, color:"#185FA5", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:600, padding:0 }}>Replace</button>
                      <button onClick={()=>setForm(f=>({...f,receipt:"",receiptPath:""}))} style={{ fontSize:12, color:"#A32D2D", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:600, padding:0 }}>Remove</button>
                    </div>
                  </div>
                </div>
              ) : (
                <button onClick={()=>receiptRef.current?.click()}
                  style={{ padding:"8px 16px", borderRadius:8, border:"1.5px dashed #D3D1C7", background:"#F8F7F4", fontSize:13, color:"#2C2C2A", cursor:"pointer", fontFamily:"inherit", width:"100%", textAlign:"center" }}>
                  Upload Receipt Photo
                </button>
              )}
            </div>

            <div style={{ display:"flex", gap:8, marginTop:4 }}>
              <Btn onClick={saveExp} variant="success">Save</Btn>
              <Btn onClick={()=>setShowForm(false)} variant="ghost">Cancel</Btn>
              {editId && <Btn onClick={()=>{deleteExp(editId); setShowForm(false);}} variant="danger" small>Delete</Btn>}
            </div>
          </div>
        </div>
      )}

      {/* Revenue vs Expense snapshot */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:10, marginBottom:14 }}>
        <div style={{ background:"#E1F5EE", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#0F6E56", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Total Invoiced (Revenue)</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#0F6E56" }}>{fmt$(totalRevenue)}</div>
        </div>
        <div style={{ background:"#FCEBEB", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#A32D2D", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Total Expenses</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#A32D2D" }}>{fmt$(totalExpenses)}</div>
        </div>
        <div style={{ background:"#E6F1FB", borderRadius:10, padding:"14px 16px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#185FA5", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>Net Profit</div>
          <div style={{ fontSize:22, fontWeight:800, color:"#185FA5" }}>{fmt$(totalRevenue - totalExpenses)}</div>
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:20 }}>
        <Btn onClick={()=>setShowReport(true)} variant="primary"> View Monthly Report</Btn>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
        {/* Total + category breakdown */}
        <Card style={{ margin:0 }}>
          <SectionTitle>Expenses by Category</SectionTitle>
          {Object.entries(byCategory).length === 0 ? (
            <p style={{ fontSize:13, color:"#2C2C2A", margin:0 }}>No expenses logged yet.</p>
          ) : Object.entries(byCategory).map(([cat,amt])=>{
            const c = EXPENSE_CATEGORIES[cat] || {};
            return (
              <div key={cat} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                  <span style={{ color:"#2C2C2A" }}>{c.icon} {cat}</span>
                  <span style={{ fontWeight:700, color:"#2C2C2A" }}>{fmt$(amt)}</span>
                </div>
                <div style={{ height:6, background:"#F1EFE8", borderRadius:4, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${(amt/maxCat)*100}%`, background:c.color||"#888780", borderRadius:4 }} />
                </div>
              </div>
            );
          })}
        </Card>

        {/* Job costing */}
        <Card style={{ margin:0 }}>
          <SectionTitle>Job Costing (Revenue vs. Cost)</SectionTitle>
          {jobCosting.length === 0 ? (
            <p style={{ fontSize:13, color:"#2C2C2A", margin:0 }}>Add an invoice and expense with a matching project name to see profitability per job.</p>
          ) : jobCosting.map(j => (
            <div key={j.name} style={{ marginBottom:12, paddingBottom:10, borderBottom:"1px solid #F1EFE8" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#2C2C2A", marginBottom:4 }}>{j.name}</div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#2C2C2A" }}>
                <span>Revenue: <strong style={{ color:"#0F6E56" }}>{fmt$(j.revenue)}</strong></span>
                <span>Cost: <strong style={{ color:"#A32D2D" }}>{fmt$(j.cost)}</strong></span>
              </div>
              <div style={{ fontSize:13, fontWeight:800, marginTop:4, color: j.profit>=0?"#0F6E56":"#A32D2D" }}>
                {j.profit>=0?"Profit":"Loss"}: {fmt$(Math.abs(j.profit))}
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Invoices loaded in (revenue ledger) */}
      <div style={{ marginBottom:24 }}>
        <SectionTitle>Invoices (Revenue Ledger)</SectionTitle>
        <p style={{ fontSize:12, color:"#2C2C2A", marginTop:-6, marginBottom:10 }}>Click an invoice to log an expense against that job and track its true cost.</p>
        {invoices.length === 0 ? (
          <div style={{ textAlign:"center", padding:"24px 16px", border:"2px dashed #D3D1C7", borderRadius:10, color:"#2C2C2A", fontSize:13, marginBottom:8 }}>
            No invoices yet. Create one in the Invoices tab to see it reflected here.
          </div>
        ) : invoices.map(inv => {
          const s = INV_STATUS[inv.status] || INV_STATUS.draft;
          const matchedExpenses = expenses.filter(e => sameProject(e.project, inv.project));
          const jobCost = matchedExpenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
          return (
            <div key={inv.id} style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:10, padding:"10px 16px", marginBottom:6 }}>
              <div onClick={()=>openForInvoice(inv)} style={{ display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}>
                <div style={{ width:32, height:32, borderRadius:8, background:"#E1F5EE", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}></div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"#2C2C2A" }}>{inv.number}</span>
                    <Badge text={s.label} color={s.color} bg={s.bg} />
                  </div>
                  <div style={{ fontSize:12, color:"#2C2C2A" }}>{inv.client || "No client"} · {inv.project || "No project"} · {inv.date}</div>
                </div>
                {jobCost > 0 && (
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:11, color:"#A32D2D", fontWeight:600 }}>-{fmt$(jobCost)} cost</div>
                    <div style={{ fontSize:10, color:"#2C2C2A" }}>{matchedExpenses.length} expense{matchedExpenses.length!==1?"s":""} logged</div>
                  </div>
                )}
                <div style={{ fontSize:15, fontWeight:800, color:"#0F6E56" }}>+{fmt$(invTotal(inv))}</div>
                <div style={{ fontSize:18, color:"#2C2C2A" }}>+</div>
              </div>
              {matchedExpenses.length > 0 && (
                <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid #F1EFE8" }}>
                  {matchedExpenses.map(e => (
                    <div key={e.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"3px 0" }}>
                      <span style={{ color:"#2C2C2A" }}>&gt; {e.description} <span style={{ color:"#2C2C2A" }}>({e.project})</span></span>
                      <span style={{ color:"#A32D2D", fontWeight:600 }}>{fmt$(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
        <SectionTitle>Expense Log</SectionTitle>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[["all","All Time"],["month","This Month"],["quarter","Last 3 Months"],["year","This Year"]].map(([key, label]) => (
            <button key={key} onClick={() => setDateRange(key)}
              style={{ padding:"6px 14px", borderRadius:20, border: dateRange===key ? "2px solid #185FA5" : "1.5px solid #D3D1C7", background: dateRange===key ? "#E6F1FB" : "#fff", color: dateRange===key ? "#185FA5" : "#5F5E5A", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:10 }}>
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{ padding:"9px 14px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
          <option value="">All Categories</option>
          {Object.entries(EXPENSE_CATEGORIES).map(([k,c])=><option key={k} value={k}>{c.icon} {k}</option>)}
        </select>
        <select value={jobFilter} onChange={e=>setJobFilter(e.target.value)} style={{ padding:"9px 14px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
          <option value="">All Jobs</option>
          {jobNames.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
        <button onClick={()=>setReceiptOnly(r=>!r)}
          style={{ padding:"9px 16px", borderRadius:8, border: receiptOnly?"2px solid #185FA5":"1.5px solid #D3D1C7", background: receiptOnly?"#E6F1FB":"#fff", color: receiptOnly?"#185FA5":"#2C2C2A", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          {receiptOnly ? "Receipts Only v" : "Receipts Only"}
        </button>
        <Btn onClick={()=>setShowScanner(true)} variant="ghost">🧾 Scan Receipt</Btn>
        <Btn onClick={()=>setShowTaxSummary(true)} variant="ghost"> Tax Summary</Btn>
        <Btn onClick={openNew} variant="primary">+ Add Expense</Btn>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", border:"2px dashed #D3D1C7", borderRadius:12 }}>
          <p style={{ fontSize:15, color:"#2C2C2A", marginBottom:16 }}>{expenses.length === 0 ? "No expenses logged yet. Track materials, labor, and other job costs." : "No expenses match your filters."}</p>
          {expenses.length === 0 && (
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <Btn onClick={()=>setShowScanner(true)}>🧾 Scan Receipt</Btn>
              <Btn onClick={openNew} variant="ghost">+ Add Manually</Btn>
            </div>
          )}
        </div>
      ) : (
        <div>
          {filtered.map(exp => {
            const c = EXPENSE_CATEGORIES[exp.category] || {};
            return (
              <div key={exp.id} style={{ background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:10, padding:"12px 16px", marginBottom:8, display:"flex", alignItems:"center", gap:14 }}>
                <div onClick={()=>openEdit(exp)} style={{ display:"flex", alignItems:"center", gap:14, flex:1, cursor:"pointer" }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:c.bg||"#F1EFE8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{c.icon||""}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#2C2C2A" }}>{exp.description}</div>
                    <div style={{ fontSize:12, color:"#2C2C2A" }}>{exp.category}{exp.project?` · ${exp.project}`:""} · {exp.date}</div>
                  </div>
                  <div style={{ fontSize:16, fontWeight:800, color:"#A32D2D" }}>{fmt$(exp.amount)}</div>
                </div>
                {exp.receipt && (
                  <img src={exp.receipt} alt="🧾 Receipt" onClick={()=>setViewReceipt(exp.receipt)}
                    style={{ width:40, height:40, objectFit:"cover", borderRadius:6, border:"1.5px solid #D3D1C7", cursor:"pointer", flexShrink:0 }}
                    title="Click to view receipt" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

