import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: { port: 5173 },
    define: {
      // Bridge both FYERS_* and VITE_FYERS_* env var naming conventions
      'import.meta.env.VITE_FYERS_APP_ID':
        JSON.stringify(env.VITE_FYERS_APP_ID || env.FYERS_APP_ID || ''),
      'import.meta.env.VITE_FYERS_SECRET_KEY':
        JSON.stringify(env.VITE_FYERS_SECRET_KEY || env.FYERS_SECRET_KEY || ''),
      'import.meta.env.VITE_FYERS_REDIRECT_URI':
        JSON.stringify(env.VITE_FYERS_REDIRECT_URI || env.FYERS_REDIRECT_URI || 'https://www.google.com'),
    },
  }
})
