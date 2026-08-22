import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  define: {
    // @dbml/core pulls in a couple of node-flavoured deps that probe `process`.
    'process.env': {},
  },
  build: {
    // @dbml/core is several MB on its own; keeping it out of the entry chunk is
    // the whole point of importing it lazily.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          reactflow: ['reactflow', 'dagre'],
          codemirror: ['@uiw/react-codemirror', '@codemirror/view', '@codemirror/language'],
        },
      },
    },
  },
});
