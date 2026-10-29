import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode, command}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredApiUrl = env.API_BASE_URL || 'https://able-lubricants-backend-3cfl.onrender.com/api/v1';
  const apiOrigin = new URL(configuredApiUrl).origin;
  const apiBaseUrl = command === 'serve' ? '/api/v1' : configuredApiUrl.replace(/\/$/, '');
  const localLoginCredentials = command === 'serve' && mode === 'development'
    ? {
        ADMIN: { email: env.ADMIN_EMAIL || '', password: env.ADMIN_PASSWORD || '' },
        STAFF: { email: env.STAFF_EMAIL || '', password: env.STAFF_PASSWORD || '' },
      }
    : null;

  return {
    plugins: [react(), tailwindcss()],
    // Expose only the API URL to the browser bundle. Credentials and other
    // local environment variables remain server-side.
    define: {
      'import.meta.env.API_BASE_URL': JSON.stringify(
        apiBaseUrl,
      ),
      // Local-only convenience for the development login UI. Never include
      // saved login credentials in a production build.
      'import.meta.env.DEV_LOGIN_CREDENTIALS': JSON.stringify(localLoginCredentials),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Browser requests stay same-origin in development; Vite forwards them
      // to the API host, avoiding a cross-origin OPTIONS preflight for login.
      proxy: command === 'serve' ? {
        '/api/v1': {
          target: apiOrigin,
          changeOrigin: true,
        },
      } : undefined,
    },
  };
});
 
