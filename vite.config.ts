import { defineConfig } from 'vite'

const APP_VERSION = "1.0.0";
const BUILD_TIME = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
