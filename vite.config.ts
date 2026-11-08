import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    // Remotion's Player + our SVG engine are plain browser code; allow the
    // sandbox preview host and iframe embedding.
    cors: true,
    allowedHosts: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
  optimizeDeps: { include: ['remotion', '@remotion/player', 'react', 'react-dom'] },
});
