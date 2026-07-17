// — Storage keys --------------------------------------------------------------
export const S = {
  leads: "bcp_leads_v2",
  bids: "bcp_bids_v2",
  profile: "bcp_profile_v2",
  photos: "bcp_photos_v2",
  invoices: "bcp_invoices_v2",
  schedule: "bcp_schedule_v2",
  expenses: "bcp_expenses_v2",
  messages: "bcp_messages_v2",
  estimates: "bcp_estimates_v2",
  reviews: "bcp_reviews_v2",
  projects: "bcp_projects_v2",
  workOrders: "bcp_workorders_v1",
  consumerProfile: "bcp_consumer_v1",
  auth: "bcp_auth_v1",
};

// — Constants -----------------------------------------------------------------
export const TRADES = {
  HVAC:        { icon: "🌬️", color: "#0C447C", bg: "#E6F1FB" },
  Electrical:  { icon: "⚡", color: "#854F0B", bg: "#FAEEDA" },
  Flooring:    { icon: "🪵", color: "#3B6D11", bg: "#EAF3DE" },
  Roofing:     { icon: "🏠", color: "#533AB7", bg: "#EEEDFE" },
  Plumbing:    { icon: "🚰", color: "#0F6E56", bg: "#E1F5EE" },
  Framing:     { icon: "🔨", color: "#993C1D", bg: "#FAECE7" },
  Painting:    { icon: "🎨", color: "#993556", bg: "#FBEAF0" },
  Concrete:    { icon: "🧱", color: "#5F5E5A", bg: "#F1EFE8" },
  Landscaping: { icon: "🌳", color: "#3B6D11", bg: "#EAF3DE" },
  Demolition:  { icon: "🛠️", color: "#A32D2D", bg: "#FCEBEB" },
  Insulation:  { icon: "❄️", color: "#185FA5", bg: "#E6F1FB" },
  Windows:     { icon: "🪟", color: "#534AB7", bg: "#EEEDFE" },
  Asphalt:     { icon: "🛣️", color: "#3D3D3D", bg: "#EBEBEB" },
  Trucking:    { icon: "🚚", color: "#7A4A10", bg: "#F5E6D3" },
  Remodel:     { icon: "🏗️", color: "#1D6F6B", bg: "#DFF2F0" },
  Solar:       { icon: "☀️", color: "#B8860B", bg: "#FDF3D9" },
  Pool:        { icon: "🏊", color: "#0E7AA8", bg: "#DEF3FA" },
  Locksmith:   { icon: "🔑", color: "#6B5B3E", bg: "#F0E9DD" },
};

export const URGENCY = ["🚨 Emergency (ASAP)", "Urgent (within a week)", "Soon (2-4 weeks)", "Flexible (1-3 months)"];
export const BUDGET_RANGES = ["Under $5,000", "$5,000-$15,000", "$15,000-$50,000", "$50,000-$150,000", "$150,000+", "Not sure yet"];

export const TRADE_BUDGET_RANGES = {
  "Locksmith": {
    Residential: ["Under $500", "$500-$1,500", "$1,500-$5,000", "$5,000+", "Not sure yet"],
    Commercial:  ["Under $1,000", "$1,000-$5,000", "$5,000-$15,000", "$15,000+", "Not sure yet"],
  },
  "Painting": {
    Residential: ["Under $2,000", "$2,000-$5,000", "$5,000-$15,000", "$15,000-$30,000", "$30,000+", "Not sure yet"],
    Commercial:  ["Under $10,000", "$10,000-$30,000", "$30,000-$75,000", "$75,000-$200,000", "$200,000+", "Not sure yet"],
  },
  "Insulation": {
    Residential: ["Under $2,000", "$2,000-$5,000", "$5,000-$15,000", "$15,000+", "Not sure yet"],
    Commercial:  ["Under $10,000", "$10,000-$30,000", "$30,000-$100,000", "$100,000+", "Not sure yet"],
  },
  "Landscaping": {
    Residential: ["Under $3,000", "$3,000-$10,000", "$10,000-$30,000", "$30,000-$75,000", "$75,000+", "Not sure yet"],
    Commercial:  ["Under $10,000", "$10,000-$50,000", "$50,000-$150,000", "$150,000-$500,000", "$500,000+", "Not sure yet"],
  },
  "Flooring": {
    Residential: ["Under $3,000", "$3,000-$10,000", "$10,000-$25,000", "$25,000-$50,000", "$50,000+", "Not sure yet"],
    Commercial:  ["Under $15,000", "$15,000-$50,000", "$50,000-$150,000", "$150,000-$400,000", "$400,000+", "Not sure yet"],
  },
  "Concrete": {
    Residential: ["Under $5,000", "$5,000-$15,000", "$15,000-$40,000", "$40,000-$100,000", "$100,000+", "Not sure yet"],
    Commercial:  ["Under $25,000", "$25,000-$75,000", "$75,000-$250,000", "$250,000-$750,000", "$750,000+", "Not sure yet"],
  },
  "Asphalt": {
    Residential: ["Under $3,000", "$3,000-$10,000", "$10,000-$30,000", "$30,000+", "Not sure yet"],
    Commercial:  ["Under $15,000", "$15,000-$50,000", "$50,000-$200,000", "$200,000+", "Not sure yet"],
  },
  "Trucking": {
    Residential: ["Under $1,000", "$1,000-$5,000", "$5,000-$15,000", "$15,000+", "Not sure yet"],
    Commercial:  ["Under $5,000", "$5,000-$25,000", "$25,000-$75,000", "$75,000+", "Not sure yet"],
  },
  "Demolition": {
    Residential: ["Under $5,000", "$5,000-$15,000", "$15,000-$40,000", "$40,000-$100,000", "$100,000+", "Not sure yet"],
    Commercial:  ["Under $25,000", "$25,000-$100,000", "$100,000-$300,000", "$300,000-$1,000,000", "$1,000,000+", "Not sure yet"],
  },
  "Windows": {
    Residential: ["Under $5,000", "$5,000-$15,000", "$15,000-$40,000", "$40,000-$80,000", "$80,000+", "Not sure yet"],
    Commercial:  ["Under $25,000", "$25,000-$75,000", "$75,000-$250,000", "$250,000-$750,000", "$750,000+", "Not sure yet"],
  },
  "Plumbing": {
    Residential: ["Under $3,000", "$3,000-$10,000", "$10,000-$30,000", "$30,000-$75,000", "$75,000+", "Not sure yet"],
    Commercial:  ["Under $25,000", "$25,000-$75,000", "$75,000-$300,000", "$300,000-$750,000", "$750,000+", "Not sure yet"],
  },
  "Electrical": {
    Residential: ["Under $3,000", "$3,000-$10,000", "$10,000-$30,000", "$30,000-$75,000", "$75,000+", "Not sure yet"],
    Commercial:  ["Under $25,000", "$25,000-$100,000", "$100,000-$300,000", "$300,000-$750,000", "$750,000+", "Not sure yet"],
  },
  "HVAC": {
    Residential: ["Under $5,000", "$5,000-$15,000", "$15,000-$40,000", "$40,000-$100,000", "$100,000+", "Not sure yet"],
    Commercial:  ["Under $50,000", "$50,000-$150,000", "$150,000-$400,000", "$400,000-$1,000,000", "$1,000,000+", "Not sure yet"],
  },
  "Roofing": {
    Residential: ["Under $10,000", "$10,000-$25,000", "$25,000-$60,000", "$60,000-$150,000", "$150,000+", "Not sure yet"],
    Commercial:  ["Under $50,000", "$50,000-$150,000", "$150,000-$400,000", "$400,000-$1,000,000", "$1,000,000+", "Not sure yet"],
  },
  "Framing": {
    Residential: ["Under $15,000", "$15,000-$50,000", "$50,000-$150,000", "$150,000-$400,000", "$400,000+", "Not sure yet"],
    Commercial:  ["Under $100,000", "$100,000-$400,000", "$400,000-$1,000,000", "$1,000,000-$5,000,000", "$5,000,000+", "Not sure yet"],
  },
  "Solar": {
    Residential: ["Under $10,000", "$10,000-$25,000", "$25,000-$60,000", "$60,000-$150,000", "$150,000+", "Not sure yet"],
    Commercial:  ["Under $50,000", "$50,000-$200,000", "$200,000-$500,000", "$500,000-$2,000,000", "$2,000,000+", "Not sure yet"],
  },
  "Pool": {
    Residential: ["Under $30,000", "$30,000-$75,000", "$75,000-$150,000", "$150,000-$300,000", "$300,000+", "Not sure yet"],
    Commercial:  ["Under $100,000", "$100,000-$300,000", "$300,000-$750,000", "$750,000-$2,000,000", "$2,000,000+", "Not sure yet"],
  },
  "Remodel": {
    Residential: ["Under $15,000", "$15,000-$50,000", "$50,000-$150,000", "$150,000-$400,000", "$400,000+", "Not sure yet"],
    Commercial:  ["Under $50,000", "$50,000-$200,000", "$200,000-$750,000", "$750,000-$3,000,000", "$3,000,000+", "Not sure yet"],
  },
};
export const INV_STATUS = { draft: { label: "Draft", color: "#854F0B", bg: "#FAEEDA" }, sent: { label: "Sent", color: "#185FA5", bg: "#E6F1FB" }, paid: { label: "Paid", color: "#0F6E56", bg: "#E1F5EE" }, overdue: { label: "Overdue", color: "#A32D2D", bg: "#FCEBEB" } };
export const EST_STATUS = { draft: { label: "Draft", color: "#854F0B", bg: "#FAEEDA" }, sent: { label: "Sent", color: "#185FA5", bg: "#E6F1FB" }, approved: { label: "Approved", color: "#0F6E56", bg: "#E1F5EE" }, declined: { label: "Declined", color: "#A32D2D", bg: "#FCEBEB" }, expired: { label: "Expired", color: "#888780", bg: "#F1EFE8" } };
export const EXPENSE_CATEGORIES = {
  Materials:     { icon: "", color: "#854F0B", bg: "#FAEEDA" },
  Labor:         { icon: "", color: "#185FA5", bg: "#E6F1FB" },
  Subcontractor: { icon: "", color: "#534AB7", bg: "#EEEDFE" },
  Equipment:     { icon: "", color: "#1D6F6B", bg: "#DFF2F0" },
  Permits:       { icon: "", color: "#5F5E5A", bg: "#F1EFE8" },
  Fuel:          { icon: "fuel", color: "#993C1D", bg: "#FAECE7" },
  Other:         { icon: "", color: "#993556", bg: "#FBEAF0" },
};
export const PROJECT_STAGES = {
  not_started: { label: "Not Started", color: "#5F5E5A", bg: "#F1EFE8" },
  in_progress: { label: "In Progress", color: "#185FA5", bg: "#E6F1FB" },
  on_hold:     { label: "On Hold", color: "#854F0B", bg: "#FAEEDA" },
  completed:   { label: "Completed", color: "#0F6E56", bg: "#E1F5EE" },
};
