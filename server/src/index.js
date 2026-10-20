import { createApp } from './app.js';
import { createPool } from './db.js';

const pool = createPool();
const app = createApp(pool);
const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`Art studio API running on http://localhost:${port}`);
});
