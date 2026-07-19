// Supabase returns snake_case columns; the app's components all expect the
// original camelCase field names (projectTitle, leadId, etc). These mappers
// translate in both directions so existing components don't need to change.

export const leadFromDb = row => ({
  id: row.id,
  consumerId: row.consumer_id,
  projectTitle: row.project_title,
  trade: row.trade,
  propertyType: row.property_type,
  budget: row.budget,
  urgency: row.urgency,
  description: row.description,
  name: row.name,
  email: row.email,
  phone: row.phone,
  city: row.city,
  state: row.state,
  address: row.address,
  zip: row.zip,
  sqft: row.sqft,
  company: row.company,
  status: row.status,
  createdAt: row.created_at,
});

export const leadToDb = lead => ({
  project_title: lead.projectTitle,
  trade: lead.trade,
  property_type: lead.propertyType,
  budget: lead.budget,
  urgency: lead.urgency,
  description: lead.description,
  name: lead.name,
  email: lead.email,
  phone: lead.phone,
  city: lead.city,
  state: lead.state,
  address: lead.address,
  zip: lead.zip,
  sqft: lead.sqft,
  company: lead.company,
});

export const bidFromDb = row => ({
  id: row.id,
  leadId: row.lead_id,
  contractorId: row.contractor_id,
  company: row.company,
  contact: row.contact,
  timeline: row.timeline,
  message: row.message,
  amount: row.amount,
  status: row.status,
  createdAt: row.created_at,
});

export const bidToDb = bid => ({
  lead_id: bid.leadId,
  company: bid.company,
  contact: bid.contact,
  timeline: bid.timeline,
  message: bid.message,
  amount: bid.amount,
});

// Assembles a message_threads row + its messages rows into the nested
// { id, leadId, name, project, unread, messages: [...] } shape the Messages
// UI already expects, framed from the current user's perspective — "from"
// and "unread" mean different things depending on whether you're the
// contractor or the consumer on this thread.
export const threadFromDb = (threadRow, msgRows, { selfId, isContractor, leadTitle, otherName }) => {
  const selfLabel = isContractor ? "me" : "client";
  const otherLabel = isContractor ? "client" : "contractor";
  const lastReadAt = isContractor ? threadRow.contractor_last_read_at : threadRow.consumer_last_read_at;
  const messages = msgRows.map(m => ({
    id: m.id,
    from: m.sender_id === selfId ? selfLabel : otherLabel,
    text: m.body,
    at: m.created_at,
  }));
  const unread = messages.some(m => m.from === otherLabel && (!lastReadAt || new Date(m.at) > new Date(lastReadAt)));
  return {
    id: threadRow.id,
    leadId: threadRow.lead_id,
    contractorId: threadRow.contractor_id,
    contractorKey: otherName,
    name: otherName,
    project: leadTitle,
    unread,
    messages,
  };
};

// work_orders rows don't store the project title / party names directly —
// those come from the lead and bid they're attached to, looked up at map time.
export const workOrderFromDb = (row, { projectTitle, trade, homeownerName, contractorName, contractorCompany }) => ({
  id: row.id,
  bidId: row.bid_id,
  projectTitle,
  trade,
  scope: row.scope,
  amount: row.amount,
  startDate: row.start_date,
  timeline: row.timeline,
  address: row.address,
  city: row.city,
  state: row.state,
  zip: row.zip,
  homeownerName,
  contractorName,
  contractorCompany,
  paymentSchedule: row.payment_schedule || [],
  homeownerSigned: row.homeowner_signed,
  homeownerSignedName: row.homeowner_signed_name,
  homeownerSignedAt: row.homeowner_signed_at,
  contractorSigned: row.contractor_signed,
  contractorSignedName: row.contractor_signed_name,
  contractorSignedAt: row.contractor_signed_at,
  createdAt: row.created_at,
});

// name/email live on the base `profiles` row; everything else is on the
// role-specific table. Both are needed to reconstruct the app's flat shape.
export const contractorProfileFromDb = (baseRow, contractorRow) => ({
  name: baseRow?.name || "",
  email: baseRow?.email || "",
  company: contractorRow?.company || "",
  phone: contractorRow?.phone || "",
  city: contractorRow?.city || "",
  state: contractorRow?.state || "",
  bio: contractorRow?.bio || "",
  trades: contractorRow?.trades || [],
  licensed: contractorRow?.licensed || false,
  insured: contractorRow?.insured || false,
  backgroundCheck: contractorRow?.background_check || false,
  website: contractorRow?.website || "",
  licenseNum: contractorRow?.license_num || "",
  insurance: contractorRow?.insurance || "",
  years: contractorRow?.years_experience || "",
  serviceArea: contractorRow?.service_area || "",
  photo: contractorRow?.photo_url || "",
});

export const consumerProfileFromDb = (baseRow, consumerRow) => ({
  name: baseRow?.name || "",
  email: baseRow?.email || "",
  phone: consumerRow?.phone || "",
  company: consumerRow?.company || "",
  notifBids: consumerRow?.notif_bids ?? true,
  notifStatus: consumerRow?.notif_status ?? true,
  notifTips: consumerRow?.notif_tips ?? false,
});

// Invoices/estimates keep a freeform "project" text label (the forms just
// collect a plain description, not a real project/lead reference), stored
// alongside the DB row's own id/number/items/etc.
export const invoiceFromDb = row => ({
  id: row.id,
  number: row.number,
  client: row.client,
  email: row.email,
  project: row.project || "",
  projectId: row.project_id || "",
  date: row.date,
  due: row.due,
  status: row.status,
  notes: row.notes,
  items: row.items && row.items.length ? row.items : [{ desc: "", qty: 1, rate: "" }],
  createdAt: row.created_at,
});

export const invoiceToDb = inv => ({
  number: inv.number,
  client: inv.client,
  email: inv.email,
  project: inv.project,
  project_id: inv.projectId || null,
  date: inv.date || null,
  due: inv.due || null,
  status: inv.status,
  notes: inv.notes,
  items: inv.items,
});

export const estimateFromDb = row => ({
  id: row.id,
  number: row.number,
  client: row.client,
  email: row.email,
  project: row.project || "",
  date: row.date,
  expires: row.expires,
  status: row.status,
  notes: row.notes,
  items: row.items && row.items.length ? row.items : [{ desc: "", qty: 1, rate: "" }],
  convertedInvoiceId: row.converted_invoice_id,
  createdAt: row.created_at,
});

export const estimateToDb = est => ({
  number: est.number,
  client: est.client,
  email: est.email,
  project: est.project,
  date: est.date || null,
  expires: est.expires || null,
  status: est.status,
  notes: est.notes,
  items: est.items,
});

// Reviews don't store the homeowner name / project title themselves — those
// are looked up from the lead/bid the review's bid_id points to, the same
// way threadFromDb derives its display fields.
export const reviewFromDb = (row, { name, project }) => ({
  id: row.id,
  bidId: row.bid_id,
  name,
  project,
  rating: row.rating,
  text: row.text,
  response: row.response || "",
  date: row.created_at,
});

export const scheduleEventFromDb = row => ({
  id: row.id,
  title: row.title,
  client: row.client || "",
  date: row.date,
  startTime: row.start_time || "",
  endTime: row.end_time || "",
  notes: row.notes || "",
  color: row.color || "",
  linkedProjectKey: row.linked_project_key || "",
  repeat: row.repeat || "",
});

export const scheduleEventToDb = evt => ({
  title: evt.title,
  client: evt.client,
  date: evt.date,
  start_time: evt.startTime,
  end_time: evt.endTime,
  notes: evt.notes,
  color: evt.color,
  linked_project_key: evt.linkedProjectKey || null,
  repeat: evt.repeat || null,
});

// project_key/source_id are loose text linkage columns — see the migration
// comment on public.expenses for why these aren't real foreign keys.
export const expenseFromDb = row => ({
  id: row.id,
  date: row.date,
  category: row.category,
  description: row.description,
  amount: row.amount,
  project: row.project || "",
  projectKey: row.project_key || "",
  sourceId: row.source_id || "",
  receipt: row.receipt || "",
  receiptPath: row.receipt_path || "",
  createdAt: row.created_at,
});

// PhotosTab renders `photo.src` everywhere, so this maps the DB's `url`
// column straight to that existing field name to keep the tab's JSX unchanged.
export const contractorPhotoFromDb = row => ({
  id: row.id,
  src: row.url,
  storagePath: row.storage_path,
  caption: row.caption || "",
  category: row.category,
  position: row.position,
  uploadedAt: row.created_at,
});

// Rebuilds a project into the same "embedded arrays" shape ProjectManagerTab
// already expects (p.crew, p.materials, etc — matching EMPTY_MANUAL_PROJECT),
// so its render code doesn't need to change. `children` groups are the
// already-mapped rows from each child table, passed in by the caller.
export const projectFromDb = (row, children = {}) => ({
  id: row.id,
  source: row.source,
  bidId: row.bid_id,
  projectTitle: row.project_title,
  trade: row.trade || "",
  propertyType: row.property_type || "Residential",
  clientName: row.client_name || "",
  clientPhone: row.client_phone || "",
  clientEmail: row.client_email || "",
  city: row.city || "",
  state: row.state || "",
  description: row.description || "",
  contractAmount: row.contract_amount ?? "",
  stage: row.stage || "not_started",
  notes: row.notes || "",
  startDate: row.start_date || "",
  targetDate: row.target_date || "",
  completedDate: row.completed_at || "",
  crew: children.crew || [],
  materials: children.materials || [],
  projectExpenses: children.projectExpenses || [],
  permitFees: children.permitFees || [],
  subcontractors: children.subcontractors || [],
  permits: children.permits || [],
  projectPhotos: children.projectPhotos || [],
  createdAt: row.created_at,
});

export const projectToDb = p => ({
  project_title: p.projectTitle,
  trade: p.trade || null,
  property_type: p.propertyType || null,
  client_name: p.clientName || null,
  client_phone: p.clientPhone || null,
  client_email: p.clientEmail || null,
  city: p.city || null,
  state: p.state || null,
  description: p.description || null,
  contract_amount: p.contractAmount === "" ? null : p.contractAmount,
  stage: p.stage,
  notes: p.notes || null,
  start_date: p.startDate || null,
  target_date: p.targetDate || null,
});

export const projectCrewFromDb = row => ({ id: row.id, name: row.name, role: row.role || "", startTime: row.start_time || "", hours: row.hours ?? "", hourlyRate: row.hourly_rate ?? "", overtimeHours: row.overtime_hours ?? "", doubleHours: row.double_hours ?? "", useOT: row.use_ot || false });
export const projectCrewToDb = c => ({ name: c.name, role: c.role || null, start_time: c.startTime || null, hours: c.hours === "" ? null : c.hours, hourly_rate: c.hourlyRate === "" ? null : c.hourlyRate, overtime_hours: c.overtimeHours === "" ? null : c.overtimeHours, double_hours: c.doubleHours === "" ? null : c.doubleHours, use_ot: !!c.useOT });

export const projectMaterialFromDb = row => ({ id: row.id, item: row.item, quantity: row.quantity ?? "", cost: row.cost ?? "" });
export const projectMaterialToDb = m => ({ item: m.item, quantity: m.quantity === "" ? null : m.quantity, cost: m.cost === "" ? null : m.cost });

// Distinct from expenseFromDb/expenseToDb (the global `expenses` table) —
// this is the project's own itemized list, which ProjectExpensesSection also
// mirrors into the global table via expenses.source_id.
export const projectExpenseRowFromDb = row => ({ id: row.id, description: row.description, amount: row.amount, date: row.date || "" });
export const projectExpenseRowToDb = e => ({ description: e.description, amount: e.amount, date: e.date || null });

export const projectPermitFeeFromDb = row => ({ id: row.id, permitType: row.permit_type, fee: row.fee, date: row.date || "" });
export const projectPermitFeeToDb = p => ({ permit_type: p.permitType, fee: p.fee, date: p.date || null });

export const projectSubcontractorFromDb = row => ({ id: row.id, name: row.name, trade: row.trade || "", phone: row.phone || "", email: row.email || "", cost: row.cost ?? "" });
export const projectSubcontractorToDb = s => ({ name: s.name, trade: s.trade || null, phone: s.phone || null, email: s.email || null, cost: s.cost === "" ? null : s.cost });

export const projectPermitFromDb = row => ({ id: row.id, name: row.name, src: row.url, storagePath: row.storage_path, isImage: row.is_image, uploadedAt: row.created_at });
export const projectPhotoRowFromDb = row => ({ id: row.id, src: row.url, storagePath: row.storage_path, uploadedAt: row.created_at });

export const expenseToDb = exp => ({
  date: exp.date,
  category: exp.category,
  description: exp.description,
  amount: exp.amount,
  project: exp.project || null,
  project_key: exp.projectKey || null,
  source_id: exp.sourceId || null,
  receipt: exp.receipt || null,
  receipt_path: exp.receiptPath || null,
});
