export const load = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
export const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// — Tiny helpers --------------------------------------------------------------
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const timeAgo = iso => {
  const d = Math.floor((Date.now() - new Date(iso)) / 60000);
  return d < 60 ? `${d}m ago` : d < 1440 ? `${Math.floor(d/60)}h ago` : `${Math.floor(d/1440)}d ago`;
};
export const fmt$ = n => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Formats a Date using its LOCAL date parts (not UTC), so "today" always matches
// the calendar day the user is actually experiencing, regardless of timezone or
// what time of day it is. Use this instead of `date.toISOString().slice(0,10)`
// anywhere a date is compared against "today" (toISOString() converts to UTC,
// which can silently roll over to the next or previous calendar day).
export const toLocalDateStr = date => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
export const todayLocal = () => toLocalDateStr(new Date());

export const getDateRange = range => {
  const now = new Date();
  const today = todayLocal();
  if (range === "month") {
    const start = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    return { start, end: today };
  }
  if (range === "quarter") {
    const start = toLocalDateStr(new Date(now.getFullYear(), now.getMonth() - 2, 1));
    return { start, end: today };
  }
  if (range === "year") {
    const start = toLocalDateStr(new Date(now.getFullYear(), 0, 1));
    return { start, end: today };
  }
  return null; // "all" — no filter
};

export const filterByDateRange = (items, dateField, range) => {
  const r = getDateRange(range);
  if (!r) return items;
  return items.filter(item => {
    const d = item[dateField];
    return d && d >= r.start && d <= r.end;
  });
};
// Compares two project names ignoring case and extra whitespace, so a project created
// from an invoice still matches that invoice even with minor text differences.
export const sameProject = (a, b) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase() && (a || "").trim() !== "";

// Matches an invoice/expense to a project by its stable key when available,
// falling back to the old title-text match for records created before projectKey existed.
export const matchProject = (item, key, title) => item.projectKey ? item.projectKey === key : sameProject(item.project, title);
