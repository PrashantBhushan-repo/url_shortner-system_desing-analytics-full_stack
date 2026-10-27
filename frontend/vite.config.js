




import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from 'node:url';
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, frontendRoot, '');
  const target = env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:5000';
  return {
    root: frontendRoot,
    envDir: frontendRoot,
    plugins: [react(), tailwindcss()],
    // Lazy analytics routes otherwise discover these after startup and force a
    // full-page reload while their live Socket.IO connection is being opened.
    optimizeDeps: {
      include: ['react-leaflet', 'recharts', 'socket.io-client', 'topojson-client'],
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/r/': { target, changeOrigin: true },
        '/socket.io': { target, changeOrigin: true, ws: true },
      },
    },
  };
});
