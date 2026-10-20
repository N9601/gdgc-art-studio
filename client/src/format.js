const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
export const money = (amount) => inr.format(amount);

// '2026-11-02' -> '2 Nov 2026' (read as a calendar date, so no time zone can shift it)
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const niceDate = (date) => dateFmt.format(new Date(`${date}T00:00:00Z`));

// Timestamps from the server, shown in local time.
const stampFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
export const niceTime = (iso) => stampFmt.format(new Date(iso));

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
