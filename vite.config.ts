import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  ssr: {
    noExternal: ['recharts', '@reduxjs/toolkit', /d3-.*/],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    globals: true,
    server: {
      deps: {
        inline: ['@reduxjs/toolkit', 'recharts', /d3-.*/],
      },
    },
  },
});

