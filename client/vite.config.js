import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the React app runs on :5173 and forwards API and image requests to the
// Express server on :4000, so the browser sees one origin and the session cookie just works.
const apiServer = `http://localhost:${process.env.API_PORT || 4000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiServer,
      '/images': apiServer,
    },
  },
});
