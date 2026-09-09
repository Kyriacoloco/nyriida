// Engagement stages in order, with what the trainee sees and what unlocks the next one.
export const ENGAGEMENT_STAGES = [
  { key: "deposit_pending", label: "Deposit pending",   next: "nda_pending",      nextLabel: "Move to NDA",           gate: "€500 deposit paid (Stripe confirms this automatically)" },
  { key: "nda_pending",     label: "NDA pending",       next: "docs_pending",     nextLabel: "Move to documents",     gate: "NDA signed on the portal (moves on its own)" },
  { key: "docs_pending",    label: "Documents pending", next: "review_pending",   nextLabel: "Move to review",        gate: "every required document uploaded (moves on its own)" },
  { key: "review_pending",  label: "Review pending",    next: "proposal",         nextLabel: "Move to proposal",      gate: "Call 2 recorded with a date" },
  { key: "proposal",        label: "Proposal",          next: "engaged",          nextLabel: "Move to engaged",       gate: "engagement letter signed and fee set (moves on its own)" },
  { key: "engaged",         label: "Engaged",           next: "valuation_active", nextLabel: "Start valuation",       gate: "Invoice 1 marked paid" },
  { key: "valuation_active",label: "Valuation active",  next: null },
  { key: "completed",       label: "Completed",         next: null },
  { key: "declined",        label: "Declined",          next: null },
];
export const stageIndex = (key) => ENGAGEMENT_STAGES.findIndex((s) => s.key === key);
export const stageLabel = (key) => ENGAGEMENT_STAGES.find((s) => s.key === key)?.label ?? key;
export const LIVE_STAGES = ENGAGEMENT_STAGES.slice(0, 7).map((s) => s.key);

export const APPROACHES = [
  { key: "dcf", label: "Income approach (DCF)" },
  { key: "cca", label: "Market approach: comparable companies" },
  { key: "pt",  label: "Market approach: precedent transactions" },
  { key: "nav", label: "Asset-based approach (NAV)" },
];

export const INVOICE_NAMES = { 0: "Deposit", 1: "Invoice 1 (on signing)", 2: "Invoice 2 (final report)" };

export const eur = (n) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n || 0));
export const money = (n, ccy = "EUR") => new Intl.NumberFormat("en-IE", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(Number(n || 0));
export const day = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
export const ago = (d) => {
  if (!d) return "";
  const h = (Date.now() - new Date(d).getTime()) / 36e5;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
};
