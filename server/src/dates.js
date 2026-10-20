// All date rules use the studio's calendar (India Standard Time) and plain 'YYYY-MM-DD' strings.

const DAY_MS = 24 * 60 * 60 * 1000;

// Today's date in India, e.g. '2026-10-20'.
export function todayIST(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

// True only for a real calendar date written as YYYY-MM-DD (so '2026-02-30' is rejected).
export function isDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Whole days from `from` to `to`; negative if `to` is earlier.
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function daysFromToday(date) {
  return daysBetween(todayIST(), date);
}

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
