import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express from 'express';
import { loadUser } from './auth.js';
import { errorHandler } from './errors.js';
import authRoutes from './routes/auth.js';
import bookingRoutes from './routes/bookings.js';
import optionsRoutes from './routes/options.js';
import orderRoutes from './routes/orders.js';
import paintingRoutes from './routes/paintings.js';
import potteryRoutes from './routes/pottery.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const imagesDir = path.join(here, '..', 'public', 'images');
const clientDist = path.join(here, '..', '..', 'client', 'dist');

// Builds the Express app around a database pool (tests pass in their own pool).
export function createApp(pool) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // The seed paintings' pictures. Public, like images on any shop page.
  app.use('/images', express.static(imagesDir));

  // Every API request first finds out who is logged in (req.user), then each route
  // checks the role it needs: 401 if nobody is logged in, 403 for the wrong role.
  app.use('/api', loadUser(pool));
  app.use('/api/auth', authRoutes(pool));
  app.use('/api/options', optionsRoutes(pool));
  app.use('/api/paintings', paintingRoutes(pool));
  app.use('/api/orders', orderRoutes(pool));
  app.use('/api/bookings', bookingRoutes(pool));
  app.use('/api/pottery', potteryRoutes(pool));
  app.use('/api', (req, res) => res.status(404).json({ error: 'No such API route.' }));

  // After `npm run build`, the same server also serves the React app.
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(clientDist, 'index.html')) : next()));
  }

  app.use(errorHandler);
  return app;
}
