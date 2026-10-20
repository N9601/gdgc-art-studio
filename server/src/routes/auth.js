import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { endSession, requireLogin, startSession } from '../auth.js';
import { UNIQUE_VIOLATION } from '../db.js';
import { conflict, unauthorized } from '../errors.js';
import { assertValid, cleanText } from '../validate.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function authRoutes(pool) {
  const router = Router();

  // Sign-up always creates a customer. The studio account comes from the seed data.
  router.post('/signup', async (req, res) => {
    const name = cleanText(req.body?.name, { max: 80 });
    const email = cleanText(req.body?.email, { max: 200 })?.toLowerCase();
    const password = req.body?.password;
    assertValid({
      name: name ? null : 'Enter your name.',
      email: email && EMAIL_RE.test(email) ? null : 'Enter a valid email address.',
      password: typeof password === 'string' && password.length >= 8 && password.length <= 100
        ? null : 'Use a password of at least 8 characters.',
    });

    const passwordHash = await bcrypt.hash(password, 10);
    let user;
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'customer')
         RETURNING id, name, email, role`,
        [name, email, passwordHash],
      );
      user = rows[0];
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) throw conflict('An account with this email already exists. Try logging in.');
      throw err;
    }
    await startSession(pool, res, user.id);
    res.status(201).json({ user });
  });

  router.post('/login', async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const { rows } = await pool.query(
      'SELECT id, name, email, role, password_hash FROM users WHERE lower(email) = lower($1)',
      [email],
    );
    const found = rows[0];
    // Same message whether the email or the password is wrong, so emails can't be probed.
    if (!found || !(await bcrypt.compare(password, found.password_hash))) {
      throw unauthorized('Email or password is incorrect.');
    }
    await startSession(pool, res, found.id);
    const { password_hash, ...user } = found;
    res.json({ user });
  });

  router.post('/logout', async (req, res) => {
    await endSession(pool, req, res);
    res.status(204).end();
  });

  router.get('/me', requireLogin, (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}
