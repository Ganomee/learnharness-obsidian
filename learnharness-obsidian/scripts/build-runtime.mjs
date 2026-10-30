import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const upstream = path.join(workspace, 'upstream/learnharness');
const slash = p => p.replaceAll('\\', '/');

function promptAssets() {
  const assets = {};
  const add = file => { assets['/learnharness/' + slash(path.relative(upstream, file))] = fs.readFileSync(file, 'utf8'); };
  add(path.join(upstream, 'src/agent/system-prompt.md'));
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file); else if (entry.name.endsWith('.md')) add(file);
    }
  }
  walk(path.join(upstream, 'src/agent/prompts'));
  return assets;
}

export function runtimeBuildOptions(options = {}) {
  const { nativePlatform = false, ...esbuildOptions } = options;
  const assets = promptAssets();
  const metadata = JSON.parse(fs.readFileSync(path.join(upstream, 'package.json'), 'utf8'));
  const identity = { userAgent: { custom: `learnharness/${metadata.version}` }, attribution: { name: metadata.name, url: metadata.homepage } };
  const shimPlugin = {
    name: 'learnharness-explicit-browser-platform',
    setup(b) {
      if (!nativePlatform) {
        b.onResolve({ filter: /^(node:)?path$/ }, () => ({ path: path.join(workspace, 'node_modules/path-browserify/index.js') }));
        b.onResolve({ filter: /^node:(fs|fs\/promises|os|crypto)$/ }, args => ({ path: args.path, namespace: 'lh-platform' }));
      }
      b.onResolve({ filter: /[\\/]models\.ts$/ }, args => {
        const target = path.resolve(args.resolveDir, args.path);
        if (target === path.join(upstream, 'src/agent/models.ts')) return { path: 'models', namespace: 'lh-platform' };
      });
      b.onLoad({ filter: /config\.ts$/ }, args => {
        if (args.path !== path.join(upstream, 'config.ts')) return;
        const original = fs.readFileSync(args.path, 'utf8');
        const expression = 'path.dirname(fileURLToPath(import.meta.url))';
        const urlImport = 'import { fileURLToPath } from "node:url";';
        if (original.split(expression).length !== 2 || original.split(urlImport).length !== 2) throw new Error('Upstream config root seam changed');
        return { contents: original.replace(urlImport, '').replace(expression, JSON.stringify(nativePlatform ? upstream : '/learnharness')), loader: 'ts', resolveDir: path.dirname(args.path) };
      });
      b.onLoad({ filter: /.*/, namespace: 'lh-platform' }, args => {
        if (args.path === 'models') return { contents: `export const APP_IDENTITY=Object.freeze({userAgent:Object.freeze(${JSON.stringify(identity.userAgent)}),attribution:Object.freeze(${JSON.stringify(identity.attribution)})}); export function piEngineFor(){throw new Error('Runtime proof requires an explicitly injected engine; live provider resolution is unsupported');}` };
        if (args.path === 'node:os') return { contents: `export function homedir(){throw new Error('Learner home filesystem is unsupported in embedded runtime proof');}` };
        if (args.path === 'node:crypto') return { contents: `const fail=()=>{throw new Error('Graph and extraction crypto facilities are unsupported in runtime proof')}; export {fail as createHash,fail as randomBytes};` };
        if (args.path === 'node:fs/promises') return { contents: `const fail=async()=>{throw new Error('Learner filesystem is unsupported in embedded runtime proof')}; export {fail as readFile,fail as readdir,fail as stat,fail as access,fail as lstat,fail as realpath,fail as open};` };
        return { contents: `
const assets=${JSON.stringify(assets)};
const dirs=new Set(Object.keys(assets).flatMap(p=>{const parts=p.split('/');return parts.slice(1,-1).map((_,i)=>parts.slice(0,i+2).join('/'))}));
function unsupported(p){throw new Error('Unsupported runtime proof filesystem operation: '+p)}
export function readFileSync(p,encoding){if(encoding!=='utf-8'&&encoding!=='utf8')unsupported(p);if(Object.hasOwn(assets,p))return assets[p];if(p.startsWith('/learnharness/data/prompts/'))throw new Error('ENOENT: prompt overrides are not enabled in runtime proof');unsupported(p)}
export function existsSync(p){if(Object.hasOwn(assets,p)||dirs.has(p))return true;if(p.startsWith('/learnharness/data/prompts/'))return false;unsupported(p)}
export function readdirSync(p){if(!dirs.has(p))unsupported(p);return [...new Set(Object.keys(assets).filter(k=>k.startsWith(p+'/')).map(k=>k.slice(p.length+1).split('/')[0]))]}
export const statSync=unsupported,mkdirSync=unsupported,appendFileSync=unsupported;
export default {readFileSync,existsSync,readdirSync,statSync,mkdirSync,appendFileSync};` };
      });
    },
  };
  return {
    absWorkingDir: workspace, entryPoints: ['plugin/src/runtime-proof.ts'], outfile: 'plugin/dist/runtime-proof.mjs',
    bundle: true, platform: nativePlatform ? 'node' : 'browser', format: 'esm', target: 'es2022', metafile: true,
    define: nativePlatform ? {} : { 'process.env': '{}', 'process.platform': '"browser"' },
    ...esbuildOptions, plugins: [shimPlugin, ...(esbuildOptions.plugins ?? [])],
  };
}

export async function buildRuntime(options = {}) { return build(runtimeBuildOptions(options)); }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildRuntime();
  fs.mkdirSync(path.join(workspace, 'plugin/dist'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'plugin/dist/runtime-metafile.json'), JSON.stringify(result.metafile, null, 2));
  console.log('Built browser-target original-agent runtime proof');
}
