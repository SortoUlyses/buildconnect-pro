import { useState, useEffect, useRef } from "react";
import { S, TRADES, URGENCY, BUDGET_RANGES, TRADE_BUDGET_RANGES, INV_STATUS, EST_STATUS, EXPENSE_CATEGORIES, PROJECT_STAGES } from './constants.js';
import { load, save, uid, timeAgo, fmt$, getDateRange, filterByDateRange, sameProject, matchProject } from './utils.js';
import { DEMO_CONTRACTORS, MATCHED_CONTRACTORS } from './demoData.js';
import { Btn, Badge, Field, Card, SectionTitle } from './components/ui.jsx';
import { supabase } from './lib/supabaseClient.js';
import { signOut } from './lib/auth.js';
import { leadFromDb, leadToDb, bidFromDb, bidToDb, threadFromDb, workOrderFromDb, contractorProfileFromDb, consumerProfileFromDb, invoiceFromDb, estimateFromDb, reviewFromDb, scheduleEventFromDb, expenseFromDb, contractorPhotoFromDb, projectFromDb, projectCrewFromDb, projectMaterialFromDb, projectExpenseRowFromDb, projectPermitFeeFromDb, projectSubcontractorFromDb, projectPermitFromDb, projectPhotoRowFromDb } from './lib/mappers.js';

import { ProfileTab } from './tabs/ProfileTab.jsx';
import { PhotosTab, CaptionEditor } from './tabs/PhotosTab.jsx';
import { InvoicesTab, InvoiceEditor, InvoicePreview, EMPTY_INV } from './tabs/InvoicesTab.jsx';
import { EstimatesTab, EstimateEditor, EstimatePreview, EMPTY_EST } from './tabs/EstimatesTab.jsx';
import { ExpensesTab, TaxSummaryModal, MonthlyReport, ReceiptScanner, EMPTY_EXP, REPORT_MONTHS, SCHEDULE_C_MAP } from './tabs/ExpensesTab.jsx';
import { MessagesTab } from './tabs/MessagesTab.jsx';
import { ReviewsTab } from './tabs/ReviewsTab.jsx';
import { ScheduleTab, DAYS, MONTHS, JOB_COLORS } from './tabs/ScheduleTab.jsx';
import { LeadCard } from './tabs/LeadCard.jsx';
import { ClientForm } from './tabs/ClientForm.jsx';
import { EMPTY_MANUAL_PROJECT, EMPTY_CREW_MEMBER, EMPTY_MATERIAL, calcWage, CrewSection, AddProjectModal, MaterialsSection, ProjectExpensesSection, PermitFeesSection, SubcontractorsSection, PermitsUploadSection, ProjectPhotosSection, ProjectManagerTab } from './tabs/ProjectManager.jsx';
import { DashboardTab } from './tabs/DashboardTab.jsx';
import { ContractorPortal } from './tabs/ContractorPortal.jsx';
import { Stars, AvailabilityCalendar, QuoteRequestForm, ContractorModal, ContractorDirectory } from './tabs/ContractorDirectory.jsx';
import { LandingSec, HomeLandingView } from './tabs/HomeLandingView.jsx';
import { MatchedContractorsView, ContractorProfileView, PriceComparisonBar } from './tabs/MatchedContractorsView.jsx';
import { DirectProjectSubmit } from './tabs/DirectProjectSubmit.jsx';
import { ConsumerMessageModal, ConsumerMessagesTab } from './tabs/ConsumerMessaging.jsx';
import { WorkOrderModal } from './tabs/WorkOrderModal.jsx';
import { BidComparisonView } from './tabs/BidComparisonView.jsx';
import { ContractorSignup } from './tabs/ContractorSignup.jsx';
import { ContractorPortalPreview, MockCard, MockHeader, PreviewSectionLabel, PreviewSectionTitle, PreviewSectionDesc, SectionHeaderRow, StarPickerWidget } from './tabs/ContractorPortalPreview.jsx';
import { ReminderCard } from './tabs/ReminderCard.jsx';
import { PriceTransparencyTool } from './tabs/PriceTransparencyTool.jsx';
import { MaintenanceClock } from './tabs/MaintenanceClock.jsx';
import { MyHomeRecord } from './tabs/MyHomeRecord.jsx';
import { ReportIssuePage } from './tabs/ReportIssuePage.jsx';
import { LeaveReviewPage } from './tabs/LeaveReviewPage.jsx';
import { ConsumerAccountPage } from './tabs/ConsumerAccountPage.jsx';
import { MyProjectsView } from './tabs/MyProjectsView.jsx';
import { JoinPage } from './tabs/JoinPage.jsx';
import { ConsumerSignup } from './tabs/ConsumerSignup.jsx';
import { AuthPrompt } from './tabs/AuthPrompt.jsx';
import { LoginPage } from './tabs/LoginPage.jsx';
export default function App() {
  // leads/bids now come from Supabase, scoped to the logged-in user via RLS — see the
  // load effect and handlers below, near the auth section.
  const [leads, setLeads] = useState([]);
  const [bids, setBids] = useState([]);
  // profile/consumerProfile now come from Supabase (see the loading effects near the auth section)
  const [profile, setProfile_] = useState({ name:"", company:"", email:"", phone:"", city:"", state:"", bio:"", trades:[], licensed:false, insured:false, backgroundCheck:false, website:"", licenseNum:"", insurance:"", years:"", serviceArea:"", photo:"" });
  // photos (portfolio before/after gallery) now come from Supabase (see the
  // loading effects near the auth section)
  const [photos, setPhotos] = useState([]);
  // invoices/estimates/schedule/expenses now come from Supabase (see the loading
  // effects near the auth section)
  const [invoices, setInvoices] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [expenses, setExpenses] = useState([]);
  // messages now come from Supabase (see the loading effects near the auth section)
  const [messages, setMessages] = useState([]);
  // reviews now come from Supabase (see the loading effects near the auth section)
  const [reviews, setReviews] = useState([]);
  // projects (and their crew/materials/expenses/permits/subcontractors/photos)
  // now come from Supabase (see the loading effects near the auth section) —
  // keyed by bid_id for bid-won projects, by the project's own id for manual
  // ones, exactly like the old localStorage version was, so every existing
  // `projects[bid.id]` lookup across the app keeps working unchanged.
  const [projects, setProjects] = useState({});
  // work orders now come from Supabase (see the loading effects near the auth section) — keyed by bidId
  const [workOrders, setWorkOrders] = useState({});
  const [view, setView] = useState("home");
  const [quickLeadPrefill, setQuickLeadPrefill] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);

  // — Auth ---------------------------------------------------------------------
  const [auth, setAuth] = useState(null);
  const [pendingLead, setPendingLead] = useState(null);

  const [consumerProfile, setConsumerProfile_] = useState({
    name:"", email:"", phone:"", company:"",
    notifBids: true, notifStatus: true, notifTips: false
  });

  // Track the real Supabase session. This replaces the old fake localStorage-only
  // auth — role/name come from the signup metadata the database trigger also reads.
  useEffect(() => {
    const deriveAuth = session => {
      if (!session?.user) return null;
      return {
        id: session.user.id,
        email: session.user.email,
        role: session.user.user_metadata?.role || "consumer",
        name: session.user.user_metadata?.name || "",
      };
    };

    supabase.auth.getSession().then(({ data: { session } }) => setAuth(deriveAuth(session)));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(deriveAuth(session));
    });

    return () => subscription.unsubscribe();
  }, []);

  // Called after a successful sign-in or sign-up to route to the right place
  const goAfterAuth = async role => {
    if (pendingLead) {
      const lead = pendingLead;
      setPendingLead(null);
      await addLead(lead);
      navigateTo("myLeads");
      return;
    }
    navigateTo(role === "contractor" ? "contractor_dashboard" : "home");
  };

  const handleLogout = async () => {
    await signOut();
    navigateTo("home");
  };

  // Load leads/bids whenever who's logged in changes. RLS scopes the results
  // automatically — a consumer gets their own leads, a contractor gets open
  // leads plus anything they've bid on, etc.
  useEffect(() => {
    if (!auth) { setLeads([]); setBids([]); return; }
    (async () => {
      const [{ data: leadRows, error: leadErr }, { data: bidRows, error: bidErr }] = await Promise.all([
        supabase.from("leads_directory").select("*").order("created_at", { ascending: false }),
        supabase.from("bids").select("*").order("created_at", { ascending: false }),
      ]);
      if (leadErr) console.error("Failed to load leads:", leadErr);
      if (bidErr) console.error("Failed to load bids:", bidErr);
      setLeads((leadRows || []).map(leadFromDb));
      setBids((bidRows || []).map(bidFromDb));
    })();
  }, [auth?.id]);

  // Load the logged-in user's profile — the base `profiles` row plus whichever
  // role-specific table applies. Runs once per login.
  useEffect(() => {
    if (!auth) return;
    (async () => {
      const { data: baseRow, error: baseErr } = await supabase.from("profiles").select("*").eq("id", auth.id).single();
      if (baseErr) { console.error("Failed to load profile:", baseErr); return; }
      if (auth.role === "contractor") {
        const { data: contractorRow, error } = await supabase.from("contractor_profiles").select("*").eq("id", auth.id).single();
        if (error) { console.error("Failed to load contractor profile:", error); return; }
        setProfile_(contractorProfileFromDb(baseRow, contractorRow));
      } else {
        const { data: consumerRow, error } = await supabase.from("consumer_profiles").select("*").eq("id", auth.id).single();
        if (error) { console.error("Failed to load consumer profile:", error); return; }
        setConsumerProfile_(consumerProfileFromDb(baseRow, consumerRow));
      }
    })();
  }, [auth?.id]);

  // Raw message_threads/messages rows, fetched once per login. Kept separate
  // from `messages` (below) so re-fetching only happens on login/logout, not
  // every time leads/bids change.
  const [rawThreads, setRawThreads] = useState([]);
  const [rawMessages, setRawMessages] = useState([]);
  useEffect(() => {
    if (!auth) { setRawThreads([]); setRawMessages([]); return; }
    (async () => {
      const { data: threadRows, error: threadErr } = await supabase.from("message_threads").select("*");
      if (threadErr) { console.error("Failed to load message threads:", threadErr); return; }
      const ids = (threadRows || []).map(t => t.id);
      const { data: msgRows, error: msgErr } = ids.length
        ? await supabase.from("messages").select("*").in("thread_id", ids).order("created_at", { ascending: true })
        : { data: [] };
      if (msgErr) console.error("Failed to load messages:", msgErr);
      setRawThreads(threadRows || []);
      setRawMessages(msgRows || []);
    })();
  }, [auth?.id]);

  // Re-derive the app-shaped `messages` (threads with embedded messages)
  // whenever the raw data or the lead/bid names needed to label them change.
  useEffect(() => {
    if (!auth) { setMessages([]); return; }
    const isContractor = auth.role === "contractor";
    const shaped = rawThreads.map(t => {
      const lead = leads.find(l => l.id === t.lead_id);
      const otherName = isContractor
        ? (lead?.name || "Homeowner")
        : (bids.find(b => b.leadId === t.lead_id && b.contractorId === t.contractor_id)?.company
           || bids.find(b => b.leadId === t.lead_id && b.contractorId === t.contractor_id)?.contact
           || "Contractor");
      return threadFromDb(t, rawMessages.filter(m => m.thread_id === t.id), {
        selfId: auth.id,
        isContractor,
        leadTitle: lead?.projectTitle || "Project",
        otherName,
      });
    });
    setMessages(shaped);
  }, [rawThreads, rawMessages, leads, bids, auth?.id]);

  // Raw work_orders rows — the accept_bid function creates these; loaded the
  // same way as threads/messages (raw fetch here, names derived below).
  const [rawWorkOrders, setRawWorkOrders] = useState([]);
  useEffect(() => {
    if (!auth) { setRawWorkOrders([]); return; }
    supabase.from("work_orders").select("*").then(({ data, error }) => {
      if (error) { console.error("Failed to load work orders:", error); return; }
      setRawWorkOrders(data || []);
    });
  }, [auth?.id]);

  useEffect(() => {
    const keyed = {};
    rawWorkOrders.forEach(row => {
      const bid = bids.find(b => b.id === row.bid_id);
      const lead = bid ? leads.find(l => l.id === bid.leadId) : null;
      keyed[row.bid_id] = workOrderFromDb(row, {
        projectTitle: lead?.projectTitle || lead?.trade || "Project",
        trade: lead?.trade || "",
        homeownerName: lead?.name || "Homeowner",
        contractorName: bid?.contact || bid?.company || "Contractor",
        contractorCompany: bid?.company || "",
      });
    });
    setWorkOrders(keyed);
  }, [rawWorkOrders, leads, bids]);

  // Invoices/estimates/schedule/expenses/photos, scoped by RLS the same way
  // leads/bids are — a contractor gets their own, loaded once per login.
  useEffect(() => {
    if (!auth) { setInvoices([]); setEstimates([]); setSchedule([]); setExpenses([]); setPhotos([]); return; }
    (async () => {
      const [
        { data: invRows, error: invErr },
        { data: estRows, error: estErr },
        { data: schedRows, error: schedErr },
        { data: expRows, error: expErr },
        { data: photoRows, error: photoErr },
      ] = await Promise.all([
        supabase.from("invoices").select("*").order("created_at", { ascending: false }),
        supabase.from("estimates").select("*").order("created_at", { ascending: false }),
        supabase.from("schedule_events").select("*").order("date", { ascending: true }),
        supabase.from("expenses").select("*").order("date", { ascending: false }),
        supabase.from("contractor_photos").select("*").eq("contractor_id", auth.id).order("position", { ascending: true }),
      ]);
      if (invErr) console.error("Failed to load invoices:", invErr);
      if (estErr) console.error("Failed to load estimates:", estErr);
      if (schedErr) console.error("Failed to load schedule:", schedErr);
      if (expErr) console.error("Failed to load expenses:", expErr);
      if (photoErr) console.error("Failed to load photos:", photoErr);
      setInvoices((invRows || []).map(invoiceFromDb));
      setEstimates((estRows || []).map(estimateFromDb));
      setSchedule((schedRows || []).map(scheduleEventFromDb));
      setExpenses((expRows || []).map(expenseFromDb));
      setPhotos((photoRows || []).map(contractorPhotoFromDb));
    })();
  }, [auth?.id]);

  // Raw reviews rows — reviews are publicly readable (RLS: "Anyone can view
  // reviews"), so we fetch once per login and then narrow down to only the
  // ones tied to a bid already present in local state (a contractor's own
  // bids, or a consumer's bids-on-their-leads) before deriving name/project.
  const [rawReviews, setRawReviews] = useState([]);
  useEffect(() => {
    if (!auth) { setRawReviews([]); return; }
    supabase.from("reviews").select("*").then(({ data, error }) => {
      if (error) { console.error("Failed to load reviews:", error); return; }
      setRawReviews(data || []);
    });
  }, [auth?.id]);

  useEffect(() => {
    const bidIds = new Set(bids.map(b => b.id));
    const shaped = rawReviews.filter(row => bidIds.has(row.bid_id)).map(row => {
      const bid = bids.find(b => b.id === row.bid_id);
      const lead = bid ? leads.find(l => l.id === bid.leadId) : null;
      return reviewFromDb(row, {
        name: lead?.name || "Homeowner",
        project: lead?.projectTitle || lead?.trade || "Project",
      });
    });
    setReviews(shaped);
  }, [rawReviews, leads, bids]);

  // Projects (contractor's own, plus a consumer's on their accepted bids —
  // both scoped by RLS on the same query) with all of their child rows
  // (crew/materials/expenses/permit fees/subcontractors/permits/photos),
  // reassembled into the same embedded-array shape the Project Manager UI
  // already expects. Loaded once per login.
  useEffect(() => {
    if (!auth) { setProjects({}); return; }
    (async () => {
      const { data: projRows, error: projErr } = await supabase.from("projects").select("*");
      if (projErr) { console.error("Failed to load projects:", projErr); return; }
      const ids = (projRows || []).map(r => r.id);
      if (ids.length === 0) { setProjects({}); return; }

      const [
        { data: crewRows, error: crewErr },
        { data: matRows, error: matErr },
        { data: projExpRows, error: projExpErr },
        { data: feeRows, error: feeErr },
        { data: subRows, error: subErr },
        { data: permitRows, error: permitErr },
        { data: photoRows, error: photoErr },
      ] = await Promise.all([
        supabase.from("project_crew").select("*").in("project_id", ids),
        supabase.from("project_materials").select("*").in("project_id", ids),
        supabase.from("project_expenses").select("*").in("project_id", ids),
        supabase.from("project_permit_fees").select("*").in("project_id", ids),
        supabase.from("project_subcontractors").select("*").in("project_id", ids),
        supabase.from("project_permits").select("*").in("project_id", ids),
        supabase.from("project_photos").select("*").in("project_id", ids),
      ]);
      [crewErr, matErr, projExpErr, feeErr, subErr, permitErr, photoErr].forEach(e => { if (e) console.error("Failed to load project detail rows:", e); });

      const groupBy = (rows, mapFn) => {
        const g = {};
        (rows || []).forEach(row => {
          if (!g[row.project_id]) g[row.project_id] = [];
          g[row.project_id].push(mapFn(row));
        });
        return g;
      };
      const crewByProject = groupBy(crewRows, projectCrewFromDb);
      const matByProject = groupBy(matRows, projectMaterialFromDb);
      const expByProject = groupBy(projExpRows, projectExpenseRowFromDb);
      const feeByProject = groupBy(feeRows, projectPermitFeeFromDb);
      const subByProject = groupBy(subRows, projectSubcontractorFromDb);
      const permitByProject = groupBy(permitRows, projectPermitFromDb);
      const photoByProject = groupBy(photoRows, projectPhotoRowFromDb);

      const keyed = {};
      (projRows || []).forEach(row => {
        keyed[row.bid_id || row.id] = projectFromDb(row, {
          crew: crewByProject[row.id],
          materials: matByProject[row.id],
          projectExpenses: expByProject[row.id],
          permitFees: feeByProject[row.id],
          subcontractors: subByProject[row.id],
          permits: permitByProject[row.id],
          projectPhotos: photoByProject[row.id],
        });
      });
      setProjects(keyed);
    })();
  }, [auth?.id]);

  const [compareLead, setCompareLead] = useState(null);
  const [msgModal, setMsgModal] = useState(null); // { lead, bid }
  const [directContractor, setDirectContractor] = useState(null);
  const [directContractors, setDirectContractors] = useState([]);
  const [estimatorPrefill, setEstimatorPrefill] = useState(null); // { jobType, budget, trade }
  const [matchedContext, setMatchedContext] = useState(null); // { trade, propertyType } — for back nav

  const openComparison = (lead) => setCompareLead(lead);
  const closeComparison = () => setCompareLead(null);

  // — Global notification system ----------------------------------------------
  const [notifications, setNotifications] = useState([]);
  const [showBell, setShowBell] = useState(false);
  const bellRef = useRef();

  const addNotification = (notif) => {
    setNotifications(prev => {
      const newNotif = { id: uid(), time: new Date().toISOString(), read: false, ...notif };
      const isUrgent = n => n.type === "urgent_lead" || n.type === "urgent_confirmed";
      const updated  = [newNotif, ...prev];
      return updated.sort((a, b) => (isUrgent(b)?1:0) - (isUrgent(a)?1:0));
    });
  };
  const dismissNotification = id => setNotifications(prev => prev.filter(n => n.id !== id));
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  const unreadCount = notifications.filter(n => !n.read).length;

  // Close bell on outside click
  useEffect(() => {
    const handler = e => { if (bellRef.current && !bellRef.current.contains(e.target)) setShowBell(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Contractor: track seen bid/lead IDs
  const seenAcceptedRef = useRef(new Set(bids.filter(b=>b.status==="accepted").map(b=>b.id)));
  const seenDeclinedRef = useRef(new Set(bids.filter(b=>b.status==="declined").map(b=>b.id)));
  const seenLeadsRef    = useRef(new Set(leads.map(l=>l.id)));
  const seenBidsOnLeadsRef = useRef(new Set());

  // Contractor: bid accepted
  useEffect(() => {
    const newlyAccepted = bids.filter(b => b.status==="accepted" && !seenAcceptedRef.current.has(b.id));
    newlyAccepted.forEach(bid => {
      const lead = leads.find(l=>l.id===bid.leadId)||{};
      addNotification({ type:"bid_won", title:"🎉 Bid Accepted", body:"Your bid of " + fmt$(bid.amount) + " for \"" + (lead.projectTitle||"a project") + "\" was accepted.", nav:"contractor_leads" });
      seenAcceptedRef.current.add(bid.id);
    });
  }, [bids]);

  // Contractor: bid declined
  useEffect(() => {
    const newlyDeclined = bids.filter(b => b.status==="declined" && !seenDeclinedRef.current.has(b.id));
    newlyDeclined.forEach(bid => {
      const lead = leads.find(l=>l.id===bid.leadId)||{};
      addNotification({ type:"bid_declined", title:"😔 Bid Not Selected", body:"Your bid for \"" + (lead.projectTitle||"a project") + "\" was not selected this time.", nav:"contractor_leads" });
      seenDeclinedRef.current.add(bid.id);
    });
  }, [bids]);

  // Contractor: new matching lead — split urgent vs standard
  const seenUrgentLeadsRef = useRef(new Set());
  useEffect(() => {
    const contractorTrades = new Set(profile?.trades||[]);
    const contractorCity = (profile?.city||"").toLowerCase();
    const newLeads = leads.filter(l => !seenLeadsRef.current.has(l.id));
    newLeads.forEach(l => {
      seenLeadsRef.current.add(l.id);
      const tradeMatch = contractorTrades.has(l.trade);
      const locMatch = contractorCity && (
        (l.city||"").toLowerCase().includes(contractorCity) ||
        contractorCity.includes((l.city||"").toLowerCase()) ||
        (l.state||"").toLowerCase() === (profile?.state||"").toLowerCase()
      );
      if (!tradeMatch || !locMatch) return;
      const isUrgent = l.urgency === "Emergency" || l.urgency === "Urgent";
      if (isUrgent && !seenUrgentLeadsRef.current.has(l.id)) {
        seenUrgentLeadsRef.current.add(l.id);
        addNotification({
          type: "urgent_lead",
          title: l.urgency === "Emergency" ? "⚠ Emergency Lead Nearby" : "⚠ Urgent Lead Nearby",
          body: "A " + l.urgency.toLowerCase() + " " + l.trade + " job in " + l.city + " needs a contractor fast — \"" + l.projectTitle + "\". Respond quickly to stand out.",
          nav: "contractor",
          urgency: l.urgency,
        });
      } else if (!isUrgent) {
        addNotification({
          type: "new_lead",
          title: "New Lead in Your Area",
          body: "A new " + l.trade + " job was posted in " + l.city + ", " + l.state + " — \"" + l.projectTitle + "\".",
          nav: "contractor",
        });
      }
    });
  }, [leads, profile]);

  // Contractor: invoice marked paid — payment received
  const seenPaidInvoicesRef = useRef(new Set(invoices.filter(i=>i.status==="paid").map(i=>i.id)));
  useEffect(() => {
    const newlyPaid = invoices.filter(i => i.status==="paid" && !seenPaidInvoicesRef.current.has(i.id));
    newlyPaid.forEach(inv => {
      const total = (inv.items||[]).reduce((s,it)=>s+(Number(it.qty)*Number(it.rate)||0),0);
      addNotification({
        type: "payment_received",
        title: "💰 Payment Received",
        body: (inv.client || "A client") + " paid invoice " + (inv.number ? "#"+inv.number : "") + " — " + fmt$(total) + ".",
        nav: "contractor_business",
      });
      seenPaidInvoicesRef.current.add(inv.id);
    });
  }, [invoices]);

  // Consumer: new bid received on their lead
  useEffect(() => {
    const myLeadIds = new Set(leads.map(l=>l.id));
    const newBids = bids.filter(b => myLeadIds.has(b.leadId) && b.status==="pending" && !seenBidsOnLeadsRef.current.has(b.id));
    newBids.forEach(bid => {
      const lead = leads.find(l=>l.id===bid.leadId)||{};
      addNotification({ type:"new_bid", title:"💬 New Bid Received", body:"A contractor submitted a bid for \"" + (lead.projectTitle||"your project") + "\". Review it in My Projects.", nav:"myLeads" });
      seenBidsOnLeadsRef.current.add(bid.id);
    });
  }, [bids]);

  // Consumer: confirm their urgent project was prioritized
  const seenUrgentConsumerRef = useRef(new Set());
  useEffect(() => {
    const urgentLeads = leads.filter(l =>
      (l.urgency === "Emergency" || l.urgency === "Urgent") &&
      !seenUrgentConsumerRef.current.has(l.id)
    );
    urgentLeads.forEach(l => {
      seenUrgentConsumerRef.current.add(l.id);
      addNotification({
        type: "urgent_confirmed",
        title: l.urgency === "Emergency" ? "⚠ Emergency Project Submitted" : "⚠ Urgent Project Submitted",
        body: "Your " + l.trade + " project \"" + l.projectTitle + "\" is marked " + l.urgency.toLowerCase() + ". Contractors in your area have been alerted and typically respond within " + (l.urgency==="Emergency"?"1-2 hours":"2-4 hours") + ".",
        nav: "myLeads",
      });
    });
  }, [leads]);

  const navigateTo = (newView, prefill = null) => {
    window.scrollTo(0, 0);
    setCurrentPage(null);
    if (newView === "direct-submit" && (prefill?.contractor || prefill?.contractors)) {
      setDirectContractor(prefill.contractor || null);
      setDirectContractors(prefill.contractors || (prefill.contractor ? [prefill.contractor] : []));
      setEstimatorPrefill(prefill.jobType || prefill.budget ? { jobType: prefill.jobType||"", budget: prefill.budget||"", trade: prefill.trade||"", propertyType: prefill.propertyType||"" } : null);
      if (!prefill.fromMatched) setMatchedContext(null);
      setView("direct-submit");
    } else {
      setDirectContractor(null);
      setDirectContractors([]);
      setMatchedContext(null);
      setView(newView);
      if (prefill) setQuickLeadPrefill(prefill);
    }
  };

  const openMatched = (trade, propertyType, jobType, budget) => {
    setCurrentPage({ type:"matched", data:{ trade, propertyType, jobType, budget }, from: view });
  };

  const openProfile = (contractor, from) => {
    setCurrentPage(prev => ({ type:"profile", data: contractor, from: from || prev }));
  };

  const goBack = () => {
    setCurrentPage(prev => {
      if (!prev) return null;
      if (prev.type === "profile" && prev.from?.type === "matched") return prev.from;
      return null;
    });
  };

  const setProfile = async p => {
    setProfile_(p); // optimistic local update
    if (!auth) return;
    const [{ error: baseErr }, { error: contractorErr }] = await Promise.all([
      supabase.from("profiles").update({ name: p.name, email: p.email }).eq("id", auth.id),
      supabase.from("contractor_profiles").update({
        company: p.company, phone: p.phone, city: p.city, state: p.state, bio: p.bio,
        trades: p.trades, licensed: p.licensed, insured: p.insured, background_check: p.backgroundCheck,
        website: p.website, license_num: p.licenseNum, insurance: p.insurance,
        years_experience: p.years, service_area: p.serviceArea, photo_url: p.photo,
      }).eq("id", auth.id),
    ]);
    if (baseErr) console.error("Failed to save profile:", baseErr);
    if (contractorErr) console.error("Failed to save contractor profile:", contractorErr);
  };

  const setConsumerProfile = async p => {
    setConsumerProfile_(p); // optimistic local update
    if (!auth) return;
    const [{ error: baseErr }, { error: consumerErr }] = await Promise.all([
      supabase.from("profiles").update({ name: p.name, email: p.email }).eq("id", auth.id),
      supabase.from("consumer_profiles").update({
        phone: p.phone, company: p.company,
        notif_bids: p.notifBids, notif_status: p.notifStatus, notif_tips: p.notifTips,
      }).eq("id", auth.id),
    ]);
    if (baseErr) console.error("Failed to save profile:", baseErr);
    if (consumerErr) console.error("Failed to save consumer profile:", consumerErr);
  };

  const addLead = async form => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { console.error("Failed to add lead: not signed in"); return null; }
    const { data, error } = await supabase.from("leads").insert({ ...leadToDb(form), consumer_id: session.user.id }).select().single();
    if (error) { console.error("Failed to add lead:", error); return null; }
    const l = leadFromDb(data);
    setLeads(prev => [l, ...prev]);
    return l;
  };

  const addBid = async bid => {
    const { data, error } = await supabase.from("bids").insert({ ...bidToDb(bid), contractor_id: auth.id }).select().single();
    if (error) { console.error("Failed to add bid:", error); return; }
    setBids(prev => [bidFromDb(data), ...prev]);
  };

  const acceptBid = async (bidId, leadId) => {
    // The database function handles the bid/lead status change plus creating the
    // project + work order rows atomically, and checks the caller actually owns
    // the lead before doing anything.
    const { error } = await supabase.rpc("accept_bid", { p_bid_id: bidId });
    if (error) { console.error("Failed to accept bid:", error); return; }

    // Mirror the same status change into local state for immediate UI feedback
    setBids(prev => prev.map(b => ({ ...b, status: b.leadId===leadId?(b.id===bidId?"accepted":"declined"):b.status })));
    setLeads(prev => prev.map(l => l.id===leadId?{...l,status:"awarded"}:l));

    // Pull in the real project + work order rows the database function just created
    const { data: newWorkOrder } = await supabase.from("work_orders").select("*").eq("bid_id", bidId).maybeSingle();
    if (newWorkOrder) setRawWorkOrders(prev => [...prev, newWorkOrder]);

    const { data: newProject } = await supabase.from("projects").select("*").eq("bid_id", bidId).maybeSingle();
    if (newProject) setProjects(prev => ({ ...prev, [bidId]: projectFromDb(newProject) }));
  };

  const declineBid = async (bidId) => {
    const { error } = await supabase.from("bids").update({ status: "declined" }).eq("id", bidId);
    if (error) { console.error("Failed to decline bid:", error); return; }
    setBids(prev => prev.map(b => b.id===bidId?{...b,status:"declined"}:b));
  };

  const signWorkOrder = async (bidId, role, fullName) => {
    const patch = role === "homeowner"
      ? { homeowner_signed: true, homeowner_signed_name: fullName, homeowner_signed_at: new Date().toISOString() }
      : { contractor_signed: true, contractor_signed_name: fullName, contractor_signed_at: new Date().toISOString() };
    const { data, error } = await supabase.from("work_orders").update(patch).eq("bid_id", bidId).select().single();
    if (error) { console.error("Failed to sign work order:", error); return; }
    setRawWorkOrders(prev => prev.map(row => row.bid_id === bidId ? data : row));
  };

  // Delete a lead and cascade — removes the lead, all associated bids, and any linked project
  const deleteLead = async leadId => {
    // Find bids linked to this lead
    const linkedBids = bids.filter(b => b.leadId === leadId);
    const hasAcceptedBid = linkedBids.some(b => b.status === "accepted");

    // Bids cascade-delete automatically in the database (leads -> bids has ON DELETE CASCADE)
    const { error } = await supabase.from("leads").delete().eq("id", leadId);
    if (error) { console.error("Failed to delete lead:", error); return; }

    setLeads(prev => prev.filter(l => l.id !== leadId));
    setBids(prev => prev.filter(b => b.leadId !== leadId));

    // Only remove linked projects if no bid was accepted --
    // if a contractor already won this job their project stays and
    // they must delete it themselves from the Projects tab. In practice this
    // is just local cleanup — a real projects row only exists once a bid is
    // accepted, so an unaccepted bid never had one to begin with.
    if (!hasAcceptedBid) {
      const linkedBidIds = linkedBids.map(b => b.id);
      if (linkedBidIds.length > 0) {
        setProjects(prev => {
          const u = { ...prev };
          linkedBidIds.forEach(id => delete u[id]);
          return u;
        });
      }
    }
  };

  const unreadMessageCount = messages.filter(t => t.unread).length;

  const NAV = auth?.role === "contractor" ? [
    { id:"contractor_dashboard", label:"Dashboard",    desc:"Overview & stats",    icon:"📊" },
    { id:"contractor_leads",     label:"Leads",         desc:"New opportunities",   icon:"📋", count: leads.filter(l=>l.status==="open").length },
    { id:"contractor_messages",  label:"Messages",      desc:"Conversations",       icon:"💬", count: unreadMessageCount },
    { id:"contractor_business",  label:"My Business",   desc:"Projects & billing",  icon:"🏗️" },
    { id:"contractor_profile",   label:"My Profile",    desc:"Profile & reviews",   icon:"👤" },
  ] : auth?.role === "consumer" ? [
    { id:"home",         label:"Home",              desc:"Welcome" },
    { id:"submit",       label:"Submit Project",    desc:"Get bids" },
    { id:"myLeads",      label:"My Projects",       desc:"Track bids" },
    { id:"messages",     label:"Messages",          desc:"Contractor conversations" },
    { id:"myHome",       label:"My Home",           desc:"Verified home record" },
    { id:"priceGuide",   label:"Price Guide",       desc:"What others paid" },
    { id:"account",      label:"My Account",        desc:"Profile & prefs" },
    { id:"directory",    label:"Find Contractors",  desc:"Browse pros" },
  ] : [
    { id:"home",         label:"Home",              desc:"Welcome" },
    { id:"submit",       label:"Submit Project",    desc:"Get free bids" },
    { id:"priceGuide",   label:"Price Guide",       desc:"What San Diego pays" },
    { id:"directory",    label:"Find Contractors",  desc:"Browse pros" },
  ];

  return (
    <div style={{ fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", minHeight:"100vh", background:"#F8F7F4" }}>
      <div style={{ background:"#0C447C" }}>
        <div style={{ maxWidth:960, margin:"0 auto", padding:"18px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
            <div onClick={()=>{ setCurrentPage(null); setView("home"); }} style={{ width:38, height:38, borderRadius:8, background:"#185FA5", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}>
              <span style={{ fontSize:14, fontWeight:900, color:"#FAEEDA", letterSpacing:"-0.04em", fontFamily:"inherit" }}>BC</span>
            </div>
            <div style={{ flex:1, cursor:"pointer" }} onClick={()=>{ setCurrentPage(null); setView("home"); }}>
              <div style={{ fontSize:20, fontWeight:800, color:"#fff", letterSpacing:"-0.02em" }}>BuildConnect Pro</div>
              <div style={{ fontSize:11, color:"#B5D4F4", fontStyle:"italic" }}>
                {auth ? `Signed in as ${auth.name}` : "Connecting owners with trusted contractors"}
              </div>
            </div>

            {/* Auth controls */}
            <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
              {!auth ? (
                <>
                  <button type="button" onClick={()=>navigateTo("login")}
                    style={{ padding:"7px 16px", borderRadius:8, border:"1.5px solid rgba(255,255,255,0.3)", background:"rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.85)", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                    Log In
                  </button>
                  <button type="button" onClick={()=>navigateTo("join")}
                    style={{ padding:"7px 16px", borderRadius:8, border:"none", background:"#EF9F27", color:"#082E56", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    Join
                  </button>
                </>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#fff" }}>{auth.name}</div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.05em" }}>{auth.role}</div>
                  </div>
                  <div style={{ width:30, height:30, borderRadius:"50%", background:"#EF9F27", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:900, color:"#082E56" }}>
                    {auth.name.split(" ").map(w=>w[0]).join("").slice(0,2)}
                  </div>
                  <button type="button" onClick={handleLogout}
                    style={{ padding:"6px 12px", borderRadius:8, border:"1.5px solid rgba(255,255,255,0.2)", background:"none", color:"rgba(255,255,255,0.6)", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                    Log Out
                  </button>
                </div>
              )}
            </div>

            {/* — Global notification bell — */}
            <div ref={bellRef} style={{ position:"relative", flexShrink:0 }}>
              <button onClick={()=>{ setShowBell(b=>!b); if(!showBell) markAllRead(); }}
                style={{ position:"relative", background:"rgba(255,255,255,0.1)", border:"1.5px solid rgba(255,255,255,0.2)", borderRadius:8, padding:"7px 14px", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:7, fontSize:13, color:"rgba(255,255,255,0.85)" }}>
                🔔
                {unreadCount > 0 && (
                  <span style={{ position:"absolute", top:-7, right:-7, background:"#A32D2D", color:"#fff", borderRadius:"50%", width:19, height:19, fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid #0C447C" }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {showBell && (
                <div style={{ position:"absolute", top:"calc(100% + 10px)", right:0, background:"#fff", border:"1.5px solid #D3D1C7", borderRadius:14, boxShadow:"0 12px 40px rgba(0,0,0,0.16)", width:340, zIndex:1000, overflow:"hidden" }}>
                  <div style={{ padding:"14px 16px", borderBottom:"1px solid #F1EFE8", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:14, fontWeight:700, color:"#2C2C2A" }}>Notifications</span>
                    <button onClick={()=>setNotifications([])} style={{ fontSize:11, color:"#888780", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit" }}>Clear all</button>
                  </div>
                  {notifications.length === 0 ? (
                    <div style={{ padding:"32px 16px", textAlign:"center", fontSize:13, color:"#888780" }}>You\'re all caught up.</div>
                  ) : notifications.slice(0,8).map(n => {
                    const isUrgent  = n.type === "urgent_lead";
                    const isConfirm = n.type === "urgent_confirmed";
                    const dotColor  =
                      n.type==="bid_won"           ? "#0F6E56" :
                      n.type==="bid_declined"      ? "#A32D2D" :
                      n.type==="new_bid"           ? "#EF9F27" :
                      n.type==="payment_received"  ? "#0F6E56" :
                      isUrgent || isConfirm        ? "#A32D2D" :
                      "#185FA5";
                    return (
                      <div key={n.id} style={{ padding:"12px 16px", borderBottom:"1px solid #F1EFE8", background: isUrgent?"#FFF5F5": isConfirm?"#FFF5F5": n.read?"#fff":"#F8F7F4", display:"flex", gap:10, alignItems:"flex-start" }}>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, flexShrink:0, marginTop:2 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:dotColor }} />
                          {(isUrgent || isConfirm) && (
                            <span style={{ fontSize:9, fontWeight:800, color:"#A32D2D", background:"#FCEBEB", borderRadius:4, padding:"1px 4px", letterSpacing:"0.03em", whiteSpace:"nowrap" }}>
                              {n.urgency?.toUpperCase() || "URGENT"}
                            </span>
                          )}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color: isUrgent||isConfirm?"#A32D2D":"#2C2C2A", marginBottom:2 }}>{n.title}</div>
                          <div style={{ fontSize:12, color:"#5F5E5A", lineHeight:1.5, marginBottom:n.nav?6:0 }}>{n.body}</div>
                          {n.nav && (
                            <button onClick={()=>{ navigateTo(n.nav); setShowBell(false); }}
                              style={{ fontSize:11, color:"#185FA5", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:600, padding:0 }}>
                              View →
                            </button>
                          )}
                        </div>
                        <button onClick={()=>dismissNotification(n.id)} style={{ background:"none", border:"none", fontSize:13, color:"#B4B2A9", cursor:"pointer", flexShrink:0, lineHeight:1 }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>navigateTo(n.id)} style={{ padding:"10px 18px", borderRadius:"8px 8px 0 0", border:"none", cursor:"pointer", fontFamily:"inherit", background: view===n.id?"#F8F7F4":"transparent", color: view===n.id?"#0C447C":"#B5D4F4", fontWeight: view===n.id?700:500, fontSize:13, transition:"all 0.15s" }}>{n.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Consumer message modal */}
      {msgModal && (
        <ConsumerMessageModal
          auth={auth}
          lead={msgModal.lead}
          bid={msgModal.bid}
          threads={messages}
          setThreads={setMessages}
          onClose={()=>setMsgModal(null)}
        />
      )}

      {/* Bid comparison full-page overlay */}
      {compareLead && (
        <BidComparisonView
          lead={compareLead}
          bids={bids}
          onAccept={(bidId, leadId) => { acceptBid(bidId, leadId); closeComparison(); }}
          onBack={closeComparison}
          onMessage={(bid) => setMsgModal({ lead: compareLead, bid })}
          onViewProfile={c => openProfile(c, null)}
        />
      )}

      {/* Full-page overlay views — matched contractors and contractor profile */}
      {currentPage?.type === "matched" && (
        <MatchedContractorsView
          trade={currentPage.data.trade}
          propertyType={currentPage.data.propertyType}
          jobType={currentPage.data.jobType}
          budget={currentPage.data.budget}
          onBack={goBack}
          onViewProfile={(c) => openProfile(c, currentPage)}
          onRequestBids={(selectedIds, trade, jobType, budget) => {
            const selectedContractors = MATCHED_CONTRACTORS.filter(c => selectedIds.includes(c.id));
            const ctx = currentPage?.data || null;
            setMatchedContext(ctx);
            setCurrentPage(null);
            navigateTo("direct-submit", { contractors: selectedContractors, trade, jobType, budget, propertyType: currentPage?.data?.propertyType||"", fromMatched: true });
          }}
        />
      )}
      {currentPage?.type === "profile" && (
        <ContractorProfileView
          contractor={currentPage.data}
          backLabel={
            currentPage.from?.type === "matched" ? "← Back to Matched Contractors" :
            view === "directory" ? "← Back to Find Contractors" :
            view === "home" ? "← Back to Home" :
            "Back"
          }
          onBack={goBack}
          onRequestBid={(c) => {
            setCurrentPage(null);
            navigateTo("direct-submit", { contractors: [c] });
          }}
        />
      )}

      {!currentPage && view === "home" ? (
        <HomeLandingView onNavigate={navigateTo} onOpenMatched={openMatched} onOpenProfile={c => openProfile(c, null)} />
      ) : !currentPage && view === "portal-preview" ? (
        <ContractorPortalPreview
          onSignup={()=>navigateTo("contractor-signup-from-preview")}
          onViewPricing={()=>navigateTo("contractor-signup-from-preview")}
          onBack={()=>navigateTo("home")}
        />
      ) : !currentPage ? (
      <div style={{ maxWidth:960, margin:"0 auto", padding:"28px 16px" }}>
        <div style={{ background:"#fff", borderRadius:"0 12px 12px 12px", border:"1.5px solid #D3D1C7", padding:"28px 32px" }}>
          {view==="direct-submit" && directContractors.length > 0 && (
            <DirectProjectSubmit
              contractors={directContractors}
              estimatorPrefill={estimatorPrefill}
              auth={auth}
              onNeedAuth={lead => { setPendingLead(lead); navigateTo("login"); }}
              onSubmit={lead => { addLead(lead); navigateTo("myLeads"); }}
              onBack={() => {
                if (matchedContext) {
                  // Came from the matched contractors flow — restore that page
                  setCurrentPage({ type:"matched", data: matchedContext, from: "home" });
                  setView("home");
                  setMatchedContext(null);
                } else {
                  // Came from Find Contractors directory
                  navigateTo("directory");
                }
              }}
              backLabel={matchedContext ? "Back to Contractor Selection" : "← Back to Find Contractors"}
            />
          )}
          {view==="join" && (
            <JoinPage
              onChoose={role => navigateTo(role === "contractor" ? "contractor-signup" : "consumer-signup")}
              onBack={dest => navigateTo(dest || "home")}
            />
          )}
          {view==="consumer-signup" && (
            <ConsumerSignup
              onComplete={() => goAfterAuth("consumer")}
              onBack={dest => navigateTo(dest || "join")}
            />
          )}
          {view==="login" && (
            <LoginPage
              onLogin={goAfterAuth}
              onBack={(dest)=>navigateTo(dest||"home")}
            />
          )}
          {view==="submit" && (
            <>
              <div style={{ display:"flex", gap:0, borderBottom:"1.5px solid #F1EFE8", marginBottom:28, paddingBottom:16 }}>
                {[["Free for homeowners","Free to submit, free to receive bids."],["Your privacy is protected","Contact info shared only after you accept a bid."],["Licensed contractors only","Every contractor is verified before joining the platform."]].map(([title, desc]) => (
                  <div key={title} style={{ flex:1, paddingRight:24, borderRight:"1.5px solid #F1EFE8", marginRight:24 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#0C447C", marginBottom:3 }}>{title}</div>
                    <div style={{ fontSize:12, color:"#2C2C2A" }}>{desc}</div>
                  </div>
                ))}
              </div>
              <ClientForm onSubmit={addLead} prefill={quickLeadPrefill} auth={auth} onNeedAuth={form => { setPendingLead(form); navigateTo("login"); }} />
            </>
          )}
          {view==="myLeads" && (
            auth ? (
            <MyProjectsView
              leads={leads} bids={bids} projects={projects} estimates={estimates}
              reviews={reviews} setReviews={setReviews} acceptBid={acceptBid}
              declineBid={declineBid} deleteLead={deleteLead} openComparison={openComparison}
              setMsgModal={setMsgModal} navigateTo={navigateTo}
              onViewContractorProfile={c => openProfile(c, null)}
              workOrders={workOrders} signWorkOrder={signWorkOrder}
            />
            ) : <AuthPrompt message="Log in to view your submitted projects and track incoming bids." onLogin={()=>navigateTo("login")} onSignup={()=>navigateTo("login")} />
          )}
          {view==="messages" && (
            auth ? (
              <ConsumerMessagesTab
                auth={auth}
                threads={messages} setThreads={setMessages}
                leads={leads} bids={bids}
              />
            ) : <AuthPrompt message="Log in to view your messages with contractors." onLogin={()=>navigateTo("login")} onSignup={()=>navigateTo("login")} />
          )}
          {(view==="contractor-signup" || view==="contractor-signup-from-preview") && (
            <ContractorSignup
              onComplete={() => goAfterAuth("contractor")}
              onBack={() => navigateTo(view==="contractor-signup-from-preview" ? "portal-preview" : "join")}
            />
          )}
          {view==="review" && (
            <LeaveReviewPage
              leads={leads}
              bids={bids}
              projects={projects}
              reviews={reviews}
              setReviews={setReviews}
              auth={auth}
              onLogin={()=>navigateTo("login")}
              onNavigate={navigateTo}
            />
          )}
          {view==="report" && (
            <ReportIssuePage
              leads={leads}
              bids={bids}
              auth={auth}
              onLogin={()=>navigateTo("login")}
              onNavigate={navigateTo}
            />
          )}
          {view==="priceGuide" && (
            <PriceTransparencyTool
              leads={leads}
              bids={bids}
              projects={projects}
              onNavigate={navigateTo}
            />
          )}
          {view==="myHome" && (
            auth ? (
              <MyHomeRecord
                leads={leads}
                bids={bids}
                projects={projects}
                reviews={reviews}
                consumerProfile={consumerProfile}
                onNavigate={navigateTo}
              />
            ) : <AuthPrompt message="Log in to view your Verified Home Record." onLogin={()=>navigateTo("login")} onSignup={()=>navigateTo("join")} />
          )}
          {view==="account" && (
            auth ? (
            <ConsumerAccountPage
              consumerProfile={consumerProfile} setConsumerProfile={setConsumerProfile}
              leads={leads} bids={bids} reviews={reviews} projects={projects} onNavigate={navigateTo}
            />
            ) : <AuthPrompt message="Log in to manage your account and preferences." onLogin={()=>navigateTo("login")} onSignup={()=>navigateTo("login")} />
          )}
          {view==="directory" && (
            <>
              <h2 style={{ fontSize:22, fontWeight:800, color:"#0C447C", margin:"0 0 4px", letterSpacing:"-0.02em" }}>Find Contractors Near You</h2>
              <p style={{ fontSize:14, color:"#2C2C2A", margin:"0 0 20px" }}>Browse verified, licensed contractors in your area. Click any profile to see their full portfolio and contact info.</p>
              <ContractorDirectory liveProfile={profile} livePhotos={photos} onSubmitProject={c => navigateTo("direct-submit", { contractors: [c] })} onJoinAsContractor={()=>navigateTo("contractor-signup")} onViewProfile={c => openProfile(c, null)} />
            </>
          )}
          {(view==="contractor_dashboard"||view==="contractor_leads"||view==="contractor_messages"||view==="contractor_business"||view==="contractor_profile") && (
            auth?.role === "contractor" ? (
              <ContractorPortal
                auth={auth}
                leads={leads} bids={bids} onBid={addBid} onAcceptBid={acceptBid}
                profile={profile} setProfile={setProfile}
                photos={photos} setPhotos={setPhotos}
                invoices={invoices} setInvoices={setInvoices}
                schedule={schedule} setSchedule={setSchedule}
                estimates={estimates} setEstimates={setEstimates}
                expenses={expenses} setExpenses={setExpenses}
                messages={messages} setMessages={setMessages}
                reviews={reviews} setReviews={setReviews}
                projects={projects} setProjects={setProjects}
                section={view.replace("contractor_", "")}
                navigateToSection={navigateTo}
                workOrders={workOrders} signWorkOrder={signWorkOrder}
              />
            ) : <AuthPrompt message="The Contractor Portal is for licensed contractors only." onLogin={()=>navigateTo("login")} onSignup={()=>navigateTo("contractor-signup")} signupLabel="Join as a Contractor" />
          )}
        </div>
      </div>
      ) : null}
    </div>
  );
}
