import {defineConfig} from 'vite';
import {resolve} from 'node:path';
import {candidateBuild} from './scripts/candidate-build.js';

export default defineConfig(({command})=>{const identity=candidateBuild(import.meta.dirname,command);return {
  define:{__EQ_BUILD__:JSON.stringify(identity)},
  plugins:[{name:'eq-candidate-identity',generateBundle(){this.emitFile({type:'asset',fileName:'candidate-build.json',source:JSON.stringify(identity,null,2)+'\n'});}}],
  server:{watch:{ignored:['**/.worktrees/**','**/test-results*/**','**/playwright-report/**']}},
  build:{rollupOptions:{input:{main:resolve(import.meta.dirname,'index.html'),sandbox:resolve(import.meta.dirname,'sandbox.html'),legacy:resolve(import.meta.dirname,'legacy.html'),workshop:resolve(import.meta.dirname,'workshop.html')}}},
};});
