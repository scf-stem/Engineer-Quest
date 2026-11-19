import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Separate preview entry. The application entry and shared configuration stay untouched.
export default defineConfig({
  build: { rollupOptions: { input: {
    workstation: fileURLToPath(new URL('./preview.html', import.meta.url)),
    art: fileURLToPath(new URL('./art-preview.html', import.meta.url)),
    adventure: fileURLToPath(new URL('./adventure-preview.html', import.meta.url)),
  } } },
});
