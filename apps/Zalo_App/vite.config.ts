import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.module.js',
        chunkFileNames: 'assets/[name].module.js',
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith('.css') === true ? 'assets/index.css' : 'assets/[name][extname]',
      },
    },
  },
});
