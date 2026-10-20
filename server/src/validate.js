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

// Turns the :id in a URL into a number. A non-numeric id can't exist, so it is a 404.
export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw notFound();
  return id;
}
