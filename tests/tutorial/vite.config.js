import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({build:{outDir:'dist-tutorial',rollupOptions:{input:resolve(import.meta.dirname,'../../src/tutorial/demo.html')}}});
