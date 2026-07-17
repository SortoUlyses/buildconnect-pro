import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from "../constants.js";
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject, todayLocal } from "../utils.js";
import { Btn, Badge, Field, Card, SectionTitle } from "../components/ui.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { scheduleEventFromDb, scheduleEventToDb } from "../lib/mappers.js";


export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const JOB_COLORS = [
  "#185FA5", // Blue
  "#0F6E56", // Green
  "#A32D2D", // Red
  "#854F0B", // Amber
  "#533AB7", // Purple
  "#0E7AA8", // Teal
  "#7A4A10", // Brown
];

export function ScheduleTab({ schedule, setSchedule, projects, setProjects, bids, leads, auth }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showForm, setShowForm] = useState(false);
  const [editEvt, setEditEvt] = useState(null);
  const [form, setForm] = useState({ title: "", client: "", date: "", startTime: "08:00", endTime: "17:00", notes: "", color: JOB_COLORS[0], linkedProjectKey: "", repeat: "" });
  const [dismissedConflicts, setDismissedConflicts] = useState([]);

  // Auto-advance recurring events that have passed their date. Re-checks
  // whenever the loaded event count changes (e.g. right after they load from
  // Supabase), not just on mount.
  useEffect(() => {
    const todayStr = todayLocal();
    const needsAdvance = schedule.filter(e => e.repeat && e.date < todayStr);
    if (needsAdvance.length === 0) return;
    (async () => {
      const updates = needsAdvance.map(evt => {
        const d = new Date(evt.date + "T00:00:00");
        if (evt.repeat === "weekly") d.setDate(d.getDate() + 7);
        else if (evt.repeat === "monthly") d.setMonth(d.getMonth() + 1);
        return { id: evt.id, nextDate: d.toISOString().slice(0,10) };
      });
      await Promise.all(updates.map(u => supabase.from("schedule_events").update({ date: u.nextDate }).eq("id", u.id)));
      setSchedule(prev => {
        let updated = [...prev];
        updates.forEach(u => { updated = updated.map(e => e.id === u.id ? { ...e, date: u.nextDate } : e); });
        return updated;
      });
    })();
  }, [schedule.length]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // All projects for the linked project dropdown
  const allProjectsList = (() => {
    const bidProjs = (bids||[]).filter(b => b.status === "accepted").map(b => {
      const lead = (leads||[]).find(l => l.id === b.leadId) || {};
      const proj = (projects||{})[b.id] || {};
      return { key: b.id, title: lead.projectTitle || "Untitled Project", stage: proj.stage || "not_started" };
    });
    const manualProjs = Object.entries(projects||{})
      .filter(([k,v]) => v.source === "manual")
      .map(([k,v]) => ({ key: k, title: v.projectTitle || "Untitled Project", stage: v.stage || "not_started" }));
    return [...bidProjs, ...manualProjs].filter(p => p.stage !== "completed");
  })();

  // Build project date ranges for calendar display
  const allDatesBetween = (start, end) => {
    const dates = [];
    let d = new Date(start + "T00:00:00");
    const last = new Date(end + "T00:00:00");
    if (isNaN(d) || isNaN(last) || d > last) return dates;
    while (d <= last) {
      dates.push(d.toISOString().slice(0,10));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  const projectRanges = (() => {
    const bidProjects = (bids||[]).filter(b => b.status === "accepted").map(b => {
      const lead = (leads||[]).find(l => l.id === b.leadId) || {};
      const proj = (projects||{})[b.id] || {};
      return { key: b.id, title: lead.projectTitle || "Untitled Project", startDate: proj.startDate, targetDate: proj.targetDate };
    });
    const manualProjects = Object.entries(projects||{})
      .filter(([k,v]) => v.source === "manual")
      .map(([k,v]) => ({ key: k, title: v.projectTitle || "Untitled Project", startDate: v.startDate, targetDate: v.targetDate }));
    return [...bidProjects, ...manualProjects].filter(p => p.startDate && p.targetDate);
  })();

  const projectEventsByDate = {};
  projectRanges.forEach(p => {
    allDatesBetween(p.startDate, p.targetDate).forEach(ds => {
      if (!projectEventsByDate[ds]) projectEventsByDate[ds] = [];
      projectEventsByDate[ds].push(p);
    });
  });

  const eventsOnDay = (d) => {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return schedule.filter(e => e.date === ds);
  };
  const projectsOnDay = (d) => {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return projectEventsByDate[ds] || [];
  };

  const conflicts = (() => {
    const found = [];
    const seen = new Set();
    Object.entries(projectEventsByDate).forEach(([ds, projsOnDate]) => {
      if (projsOnDate.length > 1) {
        const key = `proj-overlap-${ds}-${projsOnDate.map(p=>p.key).sort().join(",")}`;
        if (!seen.has(key)) { seen.add(key); found.push({ id: key, date: ds, message: `${projsOnDate.map(p=>p.title).join(" and ")} overlap on ${ds}.` }); }
      }
      const scheduledOnDate = schedule.filter(e => e.date === ds);
      if (scheduledOnDate.length > 0 && projsOnDate.length > 0) {
        scheduledOnDate.forEach(evt => {
          projsOnDate.forEach(p => {
            const key = `proj-job-${ds}-${p.key}-${evt.id}`;
            if (!seen.has(key)) { seen.add(key); found.push({ id: key, date: ds, message: `"${evt.title}" is scheduled on ${ds} while ${p.title} is also active.` }); }
          });
        });
      }
    });
    return found.filter(c => !dismissedConflicts.includes(c.id));
  })();

  const openNew = (d) => {
    const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    setForm({ title: "", client: "", date: ds, startTime: "08:00", endTime: "17:00", notes: "", color: JOB_COLORS[0], linkedProjectKey: "", repeat: "" });
    setEditEvt(null);
    setShowForm(true);
  };

  const openEdit = (evt, e) => { e.stopPropagation(); setForm({ linkedProjectKey: "", repeat: "", ...evt }); setEditEvt(evt.id); setShowForm(true); };

  const saveEvt = async () => {
    if (!form.title || !form.date) { alert("Title and date required."); return; }
    if (editEvt) {
      const { data, error } = await supabase.from("schedule_events").update(scheduleEventToDb(form)).eq("id", editEvt).select().single();
      if (error) { console.error("Failed to update schedule event:", error); return; }
      const saved = scheduleEventFromDb(data);
      setSchedule(prev => prev.map(e => e.id === saved.id ? saved : e));
    } else {
      const { data, error } = await supabase.from("schedule_events").insert({ ...scheduleEventToDb(form), contractor_id: auth.id }).select().single();
      if (error) { console.error("Failed to create schedule event:", error); return; }
      setSchedule(prev => [scheduleEventFromDb(data), ...prev]);
    }
    setShowForm(false);
  };

  const deleteEvt = async id => {
    const { error } = await supabase.from("schedule_events").delete().eq("id", id);
    if (error) { console.error("Failed to delete schedule event:", error); return; }
    setSchedule(prev => prev.filter(e => e.id !== id));
    setShowForm(false);
  };

  // Mark a scheduled job complete — deletes the event and moves linked project to completed
  const markComplete = async (evt) => {
    const { error } = await supabase.from("schedule_events").delete().eq("id", evt.id);
    if (error) { console.error("Failed to delete schedule event:", error); return; }
    setSchedule(prev => prev.filter(e => e.id !== evt.id));
    if (evt.linkedProjectKey && typeof setProjects === "function") {
      const current = projects[evt.linkedProjectKey];
      const completedAt = new Date().toISOString();
      // Optimistic local update first, same pattern as ProjectManagerTab.updateProject.
      setProjects(prev => ({ ...prev, [evt.linkedProjectKey]: { ...(prev[evt.linkedProjectKey] || {}), stage: "completed", completedDate: completedAt } }));
      if (current?.id) {
        const { error: projErr } = await supabase.from("projects").update({ stage: "completed", completed_at: completedAt }).eq("id", current.id);
        if (projErr) console.error("Failed to mark project completed:", projErr);
      }
    }
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };

  const todayStr = todayLocal();
  const upcomingEvents = schedule.filter(e => e.date >= todayStr).map(e => ({ kind: "event", date: e.date, ...e }));
  const upcomingProjects = projectRanges.filter(p => p.targetDate >= todayStr).map(p => ({ kind: "project", date: p.startDate, ...p }));
  const upcoming = [...upcomingEvents, ...upcomingProjects].sort((a,b) => a.date.localeCompare(b.date)).slice(0, 8);

  return (
    <div>
      {/* Conflict notifications */}
      {conflicts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {conflicts.map(c => (
            <div key={c.id} style={{ display:"flex", alignItems:"flex-start", gap:10, background:"#FCEBEB", border:"1.5px solid #F3C6C6", borderRadius:10, padding:"10px 14px", marginBottom:8 }}>
              <span style={{ fontSize:16 }}>!</span>
              <div style={{ flex:1, fontSize:13, color:"#A32D2D" }}><strong>Scheduling conflict:</strong> {c.message}</div>
              <button onClick={()=>setDismissedConflicts(prev=>[...prev, c.id])} style={{ background:"none", border:"none", fontSize:16, color:"#A32D2D", cursor:"pointer", flexShrink:0 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 260px", gap: 20 }}>
        {/* Calendar */}
        <div style={{ minWidth:0, overflowX:"auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <button onClick={prevMonth} style={{ background: "none", border: "1.5px solid #D3D1C7", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>&lt;</button>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#0C447C" }}>{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} style={{ background: "none", border: "1.5px solid #D3D1C7", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 16 }}>{">"}</button>
          </div>
          <div style={{ display: "flex", gap: 14, marginBottom: 10, fontSize: 11, color: "#888780" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:10, height:10, borderRadius:3, background:"#185FA5", display:"inline-block" }} /> Scheduled job</div>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:10, height:10, borderRadius:3, background:"#0F6E56", border:"1px dashed #fff", display:"inline-block" }} /> Active project</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 2 }}>
            {DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#888780", padding: "6px 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} style={{ height: 92 }} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
              const isToday = ds === todayStr;
              const events = eventsOnDay(d);
              const dayProjects = projectsOnDay(d);
              const hasConflict = conflicts.some(c => c.date === ds);
              const allItems = [...dayProjects.map(p => ({ type: "project", key: p.key, title: p.title })), ...events.map(evt => ({ type: "event", key: evt.id, evt }))];
              const visibleItems = allItems.slice(0, 2);
              const hiddenCount = allItems.length - visibleItems.length;
              return (
                <div key={d} onClick={() => openNew(d)} style={{ height: 92, overflow: "hidden", border: hasConflict ? "2px solid #A32D2D" : isToday ? "2px solid #185FA5" : "1px solid #F1EFE8", borderRadius: 8, padding: "6px 5px", cursor: "pointer", background: isToday ? "#E6F1FB" : "#fff", transition: "background 0.1s", boxSizing: "border-box" }}
                  onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = "#F8F7F4"; }}
                  onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = "#fff"; }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? "#185FA5" : "#2C2C2A" }}>{d}</span>
                    {hasConflict && <span style={{ fontSize: 11 }}>!</span>}
                  </div>
                  {visibleItems.map(item => item.type === "project" ? (
                    <div key={`p-${item.key}`} title={item.title} style={{ fontSize: 9, fontWeight: 700, color: "#0F6E56", background: "#E1F5EE", border: "1px dashed #0F6E56", borderRadius: 4, padding: "1px 4px", marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {item.title}
                    </div>
                  ) : (
                    <div key={`e-${item.key}`} onClick={e => openEdit(item.evt, e)} style={{ fontSize: 10, fontWeight: 600, color: "#fff", background: item.evt.color || "#185FA5", borderRadius: 4, padding: "2px 4px", marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                      {item.evt.repeat ? "refresh " : ""}{item.evt.title}
                    </div>
                  ))}
                  {hiddenCount > 0 && <div style={{ fontSize: 9, fontWeight: 600, color: "#888780" }}>+{hiddenCount} more</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <SectionTitle>Upcoming Jobs</SectionTitle>
            <Btn onClick={() => { setForm({ title:"",client:"",date:todayStr,startTime:"08:00",endTime:"17:00",notes:"",color:JOB_COLORS[0],linkedProjectKey:"",repeat:"" }); setEditEvt(null); setShowForm(true); }} variant="primary" small>+ Add</Btn>
          </div>
          {upcoming.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "#888780", fontSize: 13 }}>No upcoming jobs scheduled.</div>
          ) : upcoming.map(item => item.kind === "project" ? (
            <div key={`proj-${item.key}`} style={{ background: "#E1F5EE", border: "1.5px dashed #0F6E56", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F6E56", marginBottom: 2 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "#5F5E5A" }}>{item.startDate} - {item.targetDate}</div>
            </div>
          ) : (
            <div key={item.id} style={{ background: "#fff", border: "1.5px solid #D3D1C7", borderRadius: 10, padding: "10px 12px", marginBottom: 8, borderLeft: `4px solid ${item.color || "#185FA5"}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A", marginBottom: 2 }}>
                {item.repeat ? <span style={{ fontSize: 11, color: "#185FA5", fontWeight: 700, marginRight: 4 }}>↻ {item.repeat === "weekly" ? "Weekly" : "Monthly"}</span> : null}
                {item.title}
              </div>
              <div style={{ fontSize: 12, color: "#888780" }}>{item.client && `${item.client} · `}{item.date}</div>
              <div style={{ fontSize: 11, color: "#B4B2A9", marginTop: 2 }}>{item.startTime} - {item.endTime}</div>
              {item.linkedProjectKey && (
                <div style={{ fontSize: 11, color: "#534AB7", marginTop: 4 }}>
                  {allProjectsList.find(p=>p.key===item.linkedProjectKey)?.title || "Linked project"}
                </div>
              )}
              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                <button onClick={e=>{openEdit(item,e);}} style={{ fontSize:11, padding:"3px 10px", borderRadius:6, border:"1.5px solid #D3D1C7", background:"#fff", cursor:"pointer", fontFamily:"inherit", color:"#444441" }}>Edit</button>
                <button onClick={()=>markComplete(item)} style={{ fontSize:11, padding:"3px 10px", borderRadius:6, border:"1.5px solid #0F6E56", background:"#E1F5EE", cursor:"pointer", fontFamily:"inherit", color:"#0F6E56", fontWeight:600 }}>Mark Complete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Event Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 28, width: "100%", maxWidth: 420, boxSizing: "border-box" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0C447C", marginBottom: 20 }}>{editEvt ? "Edit Job" : "Schedule New Job"}</div>
            <Field label="Job Title" value={form.title} onChange={v => setForm(f=>({...f,title:v}))} placeholder="Roof inspection" required />
            <Field label="Client Name" value={form.client} onChange={v => setForm(f=>({...f,client:v}))} placeholder="Jane Smith" />
            <Field label="Date" type="date" value={form.date} onChange={v => setForm(f=>({...f,date:v}))} required />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Start Time" type="time" value={form.startTime} onChange={v => setForm(f=>({...f,startTime:v}))} />
              <Field label="End Time" type="time" value={form.endTime} onChange={v => setForm(f=>({...f,endTime:v}))} />
            </div>
            {allProjectsList.length > 0 && (
              <Field label="Linked Project (optional)">
                <select value={form.linkedProjectKey} onChange={e=>setForm(f=>({...f,linkedProjectKey:e.target.value}))} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid #D3D1C7", fontSize:14, fontFamily:"inherit", background:"#fff" }}>
                  <option value="">No linked project</option>
                  {allProjectsList.map(p => <option key={p.key} value={p.key}>{p.title}</option>)}
                </select>
              </Field>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444441", marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>Color</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {JOB_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f=>({...f,color:c}))} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: form.color === c ? "3px solid #2C2C2A" : "3px solid transparent", cursor: "pointer" }} />
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444441", marginBottom: 8, letterSpacing: "0.04em", textTransform: "uppercase" }}>Repeat</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["", "Does not repeat"], ["weekly", "Weekly"], ["monthly", "Monthly"]].map(([val, label]) => (
                  <button key={val} onClick={() => setForm(f=>({...f,repeat:val}))}
                    style={{ padding: "6px 14px", borderRadius: 20, border: form.repeat === val ? "2px solid #185FA5" : "1.5px solid #D3D1C7", background: form.repeat === val ? "#E6F1FB" : "#fff", color: form.repeat === val ? "#185FA5" : "#5F5E5A", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Notes" value={form.notes} onChange={v => setForm(f=>({...f,notes:v}))} as="textarea" rows={2} placeholder="Address, access instructions, materials needed..." />
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <Btn onClick={saveEvt} variant="success">Save</Btn>
              <Btn onClick={() => setShowForm(false)} variant="ghost">Cancel</Btn>
              {editEvt && <Btn onClick={() => deleteEvt(editEvt)} variant="danger" small>Delete</Btn>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

