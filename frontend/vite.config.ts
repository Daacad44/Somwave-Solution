import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev/build for the React portal + internal system (SYSTEM_PROMPT §4).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 5173 },
});
