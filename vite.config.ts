import { defineConfig } from 'vite';

export default defineConfig({
  base: '/LivsDyreOE/',
  define: { __BUILD_VERSION__: JSON.stringify('0.1.0') },
  build: { rollupOptions: { input: { game: 'index.html', animation: 'animation.html' } } },
  test: { environment: 'node' },
});
