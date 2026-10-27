// Entirely fictional fixtures. No identifiers correspond to production records.
function freeze(value) {
  Object.values(value).forEach(item => { if (item && typeof item === "object") freeze(item); });
  return Object.freeze(value);
}

export const demoLinks = freeze([
  { id: "sample-launch", name: "Autumn collection", slug: "autumn", destination: "https://example.com/collections/autumn", clicks: 8420, scans: 980, status: "Active", type: "Branded", channel: "Social", created: "Oct 12, 2026" },
  { id: "sample-newsletter", name: "The weekly newsletter", slug: "weekly", destination: "https://example.com/newsletter", clicks: 6210, scans: 240, status: "Active", type: "Standard", channel: "Email", created: "Oct 13, 2026" },
  { id: "sample-event", name: "Design meetup", slug: "meetup", destination: "https://example.com/events/design", clicks: 3850, scans: 810, status: "Active", type: "QR campaign", channel: "Print", created: "Oct 14, 2026" },
  { id: "sample-guide", name: "Partner resource guide", slug: "partner-guide", destination: "https://example.com/resources/guide", clicks: 2140, scans: 0, status: "Expired", type: "Protected", channel: "Partners", created: "Oct 10, 2026" },
]);
export const demoUsers = freeze([
  { id: "sample-user-1", name: "Mira Shah", email: "mira@example.com", role: "User", plan: "Pro", status: "Active", joined: "Oct 12, 2026" },
  { id: "sample-user-2", name: "Noah Park", email: "noah@example.com", role: "User", plan: "Starter", status: "Active", joined: "Oct 13, 2026" },
  { id: "sample-user-3", name: "Alex Morgan", email: "alex@example.com", role: "Admin", plan: "Business", status: "Active", joined: "Oct 10, 2026" },
  { id: "sample-user-4", name: "Leah Chen", email: "leah@example.com", role: "User", plan: "Free", status: "Pending", joined: "Oct 18, 2026" },
  { id: "sample-user-5", name: "Sam Rivera", email: "sam@example.com", role: "User", plan: "Free", status: "Suspended", joined: "Oct 15, 2026" },
  { id: "sample-user-6", name: "Arun Das", email: "arun@example.com", role: "User", plan: "Pro", status: "Active", joined: "Oct 17, 2026" },
]);
export const demoPayments = freeze([
  { id: "DEMO-1048", email: "mira@example.com", plan: "Pro", amount: 1299, status: "Paid", date: "Oct 18, 2026" },
  { id: "DEMO-1047", email: "noah@example.com", plan: "Starter", amount: 499, status: "Paid", date: "Oct 17, 2026" },
  { id: "DEMO-1046", email: "alex@example.com", plan: "Business", amount: 2499, status: "Paid", date: "Oct 16, 2026" },
  { id: "DEMO-1045", email: "arun@example.com", plan: "Pro", amount: 1299, status: "Pending", date: "Oct 16, 2026" },
]);
export const demoAudit = freeze([
  { id: "sample-audit-1", time: "Oct 18 · 14:32", actor: "alex@example.com", action: "Plan updated", target: "Pro plan", detail: "Sample link quota changed after confirmation.", status: "Completed" },
  { id: "sample-audit-2", time: "Oct 18 · 13:18", actor: "alex@example.com", action: "Refund requested", target: "DEMO-1047", detail: "Sample refund queued for an additional approval.", status: "Review" },
  { id: "sample-audit-3", time: "Oct 17 · 16:40", actor: "alex@example.com", action: "Account suspended", target: "sam@example.com", detail: "Example moderation event; no real account was changed.", status: "Completed" },
  { id: "sample-audit-4", time: "Oct 17 · 09:12", actor: "alex@example.com", action: "Admin signed in", target: "Admin console", detail: "Illustration of an authenticated administrative session.", status: "Completed" },
]);
export const clickSeries = freeze([1950, 2650, 2400, 3200, 2870, 3480, 4070]);
export const demoGeography = freeze([{ label: "India", value: 42 }, { label: "United States", value: 28 }, { label: "United Kingdom", value: 18 }, { label: "Other", value: 12 }]);
export const demoDevices = freeze([{ label: "Mobile", value: 68 }, { label: "Desktop", value: 27 }, { label: "Tablet", value: 5 }]);
export const demoSources = freeze([{ label: "Social", value: 46 }, { label: "Direct", value: 29 }, { label: "Email", value: 18 }, { label: "Other", value: 7 }]);

export const totalClicks = demoLinks.reduce((sum, link) => sum + link.clicks, 0);
export const totalScans = demoLinks.reduce((sum, link) => sum + link.scans, 0);
export const paidRevenue = demoPayments.filter(payment => payment.status === "Paid").reduce((sum, payment) => sum + payment.amount, 0);
export function filterRecords(records, query, status = "All") {
  const search = query.trim().toLowerCase();
  return records.filter(record => (status === "All" || record.status === status) && Object.values(record).some(value => String(value).toLowerCase().includes(search)));
}
