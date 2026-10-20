import { createApp } from './app.js';
import { createPool } from './db.js';

const pool = createPool();
const app = createApp(pool);
// API_PORT (not the generic PORT) so a PORT set by another tool can't move the API by accident.
const port = Number(process.env.API_PORT) || 4000;

app.listen(port, () => {
  console.log(`Art studio API running on http://localhost:${port}`);
});
