import {defineConfig} from 'vite';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
export default defineConfig({root,build:{outDir:'/tmp/eq-ui-workspace-build',emptyOutDir:true,rollupOptions:{input:{main:resolve(root,'index.html'),workspaceHarness:resolve(root,'tests/ui/workspace.html')}}}});
