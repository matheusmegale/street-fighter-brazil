import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    // Phaser alone is ~1.2 MB minified
    chunkSizeWarningLimit: 1600,
  },
  test: {
    include: ['tests/**/*.test.js'],
  },
});
