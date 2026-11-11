import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dirección de la API en desarrollo. Se puede cambiar con VITE_API_PROXY_TARGET en frontend/.env.local
const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // En desarrollo, /api se redirige al backend: evita problemas de CORS.
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        configure: (proxy) => {
          // Si el backend no está corriendo, Vite respondería 502 sin explicación.
          // Aquí devolvemos un mensaje JSON que la pantalla puede mostrar.
          proxy.on('error', (err, req, res) => {
            console.error(`[proxy] No se pudo conectar con la API en ${API_TARGET}: ${err.code || err.message}`);
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
            }
            res.end(
              JSON.stringify({
                error: `No se pudo conectar con la API (${API_TARGET}). Inicia el backend con "npm run dev" dentro de la carpeta backend.`,
              }),
            );
          });
        },
      },
    },
  },
});
