import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],

  build: {
    // Sin sourcemaps en producción: publican el código fuente completo.
    // Es la verificación 6 del gate.
    sourcemap: false,

    // Hostinger sirve estáticos sin problema con nombres con hash, y el hash
    // es lo que permite cachear un año con seguridad (ver public/.htaccess).
    assetsDir: 'assets',

    // Un solo bundle: en una landing de una página, partirlo añade peticiones
    // sin ahorrar nada.
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },

    // Aviso si el JS crece más de la cuenta. Una landing no debería pasar de
    // ~25 KB de JS propio; si lo hace, algo se está haciendo con librería.
    chunkSizeWarningLimit: 40,
  },

  server: {
    port: 5173,
    open: true,
  },
});
