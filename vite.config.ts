import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react'; // Import the react plugin

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'https://space-exploration-5x72.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});