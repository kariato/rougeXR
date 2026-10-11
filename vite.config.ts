import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/rougeXR/' : '/',
  build: { rollupOptions: { input: ['index.html', 'model-preview.html'] } },
});
