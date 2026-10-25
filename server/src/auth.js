import crypto from 'node:crypto';
import { forbidden, unauthorized } from './errors.js';

export const SESSION_COOKIE = 'sid';
const SESSION_DAYS = 7;

// The cookie holds a random token. The database only stores its SHA-256 hash,
// so a leaked sessions table cannot be used to log in as anyone.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// The session token from the cookie. Cookies are user input (cookie-parser even turns values
// starting with "j:" into JSON), so anything that isn't a string counts as no session.
const readToken = (req) => {
  const token = req.cookies[SESSION_COOKIE];
  return typeof token === 'string' && token ? token : null;
};

export async function startSession(pool, res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [hashToken(token), userId, expires],
  );
  // httpOnly: page JavaScript can't read it. sameSite=lax: other sites can't send it with POSTs.
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', expires, path: '/' });
}

export async function endSession(pool, req, res) {
  const token = readToken(req);
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

// Middleware for every /api request: if the cookie belongs to a live session, sets req.user.
export function loadUser(pool) {
  return async (req, res, next) => {
    req.user = null;
    const token = readToken(req);
    if (token) {
      const { rows } = await pool.query(
        `SELECT u.id, u.name, u.email, u.role
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [hashToken(token)],
      );
      req.user = rows[0] ?? null;
    }
    next();
  };
}

// Route guard: 401 if not logged in, 403 if logged in with a role that isn't allowed.
// requireRole() with no roles just requires a login.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) throw unauthorized();
    if (roles.length > 0 && !roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

export const requireLogin = requireRole();
export const customerOnly = requireRole('customer');
export const studioOnly = requireRole('studio');
