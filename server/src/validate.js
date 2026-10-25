import { badRequest, notFound } from './errors.js';

// Throws one 400 listing every problem, if there are any.
// Usage: assertValid({ email: email ? null : 'Enter your email.' })
export function assertValid(problems) {
  const fields = Object.fromEntries(Object.entries(problems).filter(([, message]) => message));
  if (Object.keys(fields).length > 0) {
    throw badRequest(Object.values(fields)[0], fields);
  }
}

// A trimmed string between min and max characters, or null if it isn't one.
export function cleanText(value, { min = 1, max }) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

export function isIntBetween(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

// Ids are Postgres INT (SERIAL) columns, so nothing above this can exist.
export const MAX_ID = 2_147_483_647;

// Turns the :id in a URL into a number. An id that can't exist (not plain digits, or too big
// for the column) is a 404, the same as an id that isn't there.
export function parseId(value) {
  const id = /^\d{1,10}$/.test(value) ? Number(value) : NaN;
  if (!isIntBetween(id, 1, MAX_ID)) throw notFound();
  return id;
}
