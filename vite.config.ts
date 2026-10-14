import { defineConfig } from 'vite';

export default defineConfig({
  base: '/LivsDyreOE/',
  define: { __BUILD_VERSION__: JSON.stringify('0.1.0') },
  test: { environment: 'node' },
});
