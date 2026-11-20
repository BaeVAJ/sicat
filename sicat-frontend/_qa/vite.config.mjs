import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const here = path.resolve(import.meta.dirname);
const mocks = {
  'api/client': 'mocks/client.js',
  'context/AuthContext': 'mocks/auth.jsx',
  'layout/Layout': 'mocks/Layout.jsx',
};

export default defineConfig({
  root: here,
  plugins: [
    {
      name: 'qa-mocks',
      enforce: 'pre',
      resolveId(source) {
        for (const [suffix, file] of Object.entries(mocks)) {
          if (source.endsWith(suffix)) return path.join(here, file);
        }
        return null;
      },
    },
    react(),
  ],
  server: { port: 5199, strictPort: true },
});
