import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        // Let Vite choose the port to avoid permission issues
        // port: 3005, 
        // host: '0.0.0.0', 
      },
      plugins: [react()],
      // Environment variables are automatically exposed via import.meta.env with VITE_ prefix
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
