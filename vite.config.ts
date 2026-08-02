import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Separa as bibliotecas pesadas do código da aplicação. Duas razões:
        //
        // 1. São usadas em poucas telas — `recharts` só nos gráficos da
        //    Evolução/metabolismo, `leaflet` só no Tracker. Em chunk próprio,
        //    elas entram junto com a rota que as importa (via React.lazy) e não
        //    no primeiro paint de quem abre o /login.
        // 2. Vendor muda muito menos que o app. Em chunk separado, um deploy de
        //    feature deixa de invalidar o cache do React inteiro no navegador.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-maps': ['leaflet', 'react-leaflet'],
          'vendor-motion': ['framer-motion'],
          'vendor-sentry': ['@sentry/react'],
        },
      },
    },
  },
})
