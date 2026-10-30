// Mounts the production GlobalGraphView in Firefox with Obsidian API shims and
// read-only metadata from test-vault. It captures screenshots and verifies UI events.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.dev', 'graph-visual-harness');
const require = createRequire(import.meta.url);
const playwrightRoot = process.env.PLAYWRIGHT_MODULES ?? 'G:/AIStuff/pinokio/bin/miniconda/node_modules';
const { firefox } = require(path.join(playwrightRoot, 'playwright'));
const browserPath = process.env.PLAYWRIGHT_FIREFOX ?? 'G:/AIStuff/pinokio/bin/playwright/browsers/firefox-1466/firefox/firefox.exe';

await mkdir(out, { recursive: true });
const bundle = await build({
  stdin: { contents: `export { GlobalGraphView } from './plugin/src/ui/global-graph-view'; export { inferGraphDepths } from './plugin/src/graph/graph-layout'; export { TFile } from 'obsidian';`, resolveDir: root, sourcefile: 'graph-harness-entry.ts' }, bundle: true, write: false,
  platform: 'browser', format: 'iife', globalName: 'GraphHarness',
  plugins: [{ name: 'obsidian-test-shim', setup(builder) {
    builder.onResolve({ filter: /^obsidian$/ }, () => ({ path: 'obsidian', namespace: 'shim' }));
    builder.onLoad({ filter: /.*/, namespace: 'shim' }, () => ({ contents: `
      export class TFile { constructor(path, basename, extension) { Object.assign(this,{path,basename,extension}); } }
      export class HoverPopover { unload() {} }
      export class Menu { addItem(){} showAtMouseEvent(){} }
      export class Notice { constructor(){} }
      export class ItemView { constructor(leaf){this.app=window.__graphApp;this.contentEl=leaf.contentEl;} registerEvent(){} }
    `, loader: 'js' }));
  } }],
});
await writeFile(path.join(out, 'graph.js'), bundle.outputFiles[0].contents);

const files = [];
async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await collect(full);
    else if (/\.md$/i.test(entry.name)) files.push(full);
  }
}
await collect(path.join(root, 'test-vault'));
const notes = [];
for (const full of files) {
  const text = await readFile(full, 'utf8');
  const relative = path.relative(path.join(root, 'test-vault'), full).replaceAll('\\', '/');
  const basename = path.basename(full, '.md');
  const fmText = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const scalar = key => fmText.match(new RegExp(`^${key}:\\s*["']?([^\\r\\n"']+)`, 'm'))?.[1]?.trim();
  const array = key => (fmText.match(new RegExp(`^${key}:\\s*\\[([^\\]]*)\\]`, 'm'))?.[1] ?? '').split(',').map(value => value.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  const tags = [...text.matchAll(/(?:^|\s)#([\w/-]+)/g)].map(m => `#${m[1]}`);
  const links = [...text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)].map(m => m[1]);
  notes.push({ path: relative, basename, text, fm: { id: scalar('id'), type: scalar('type'), topic: scalar('topic'), tags: array('tags'), next_ids: array('next_ids'), next_reasoning: scalar('next_reasoning'), premise_ids: array('premise_ids'), conclusion_ids: array('conclusion_ids') }, links, tags });
}
const html = `<!doctype html><meta charset="utf-8"><title>Graph visual harness</title>
<link rel="stylesheet" href="${pathToFileURL(path.join(root, 'plugin/styles.css')).href}">
<style>
  :root{color-scheme:dark;--background-primary:#17191f;--background-secondary:#20232b;--background-modifier-border:#363a45;--background-modifier-hover:#2a2e38;--text-normal:#e5e7eb;--text-muted:#9ba2b0;--text-on-accent:#fff;--interactive-accent:#8c76e8;--interactive-success:#2ab78f;--font-small:12px}
  *{box-sizing:border-box}body{margin:0;background:#111319;color:var(--text-normal);font:14px Inter,Segoe UI,sans-serif}#root{height:100vh;width:100vw}.lh-global-graph{background:var(--background-primary)}
  button,input,select{font:inherit;color:var(--text-normal);background:#242832;border:1px solid var(--background-modifier-border);border-radius:6px;padding:5px 8px}button{cursor:pointer}button:hover{border-color:var(--interactive-accent)}
</style><div id="root"></div><script src="graph.js"></script><script>
(() => {
const notes=${JSON.stringify(notes)}; const byPath=new Map(notes.map(n=>[n.path,n]));
class File extends GraphHarness.TFile {}
const fileObjs=new Map(notes.map(n=>[n.path,new File(n.path,n.basename,'md')])); const resolved={};
for(const n of notes){const targets={};for(const link of n.links){const target=notes.find(x=>x.basename.toLowerCase()===link.toLowerCase()||x.path.toLowerCase()===link.toLowerCase()||x.path.toLowerCase().endsWith('/'+link.toLowerCase()+'.md'));if(target)targets[target.path]=(targets[target.path]||0)+1;}if(Object.keys(targets).length)resolved[n.path]=targets;}
const events=[],opened=[];
window.__events=events;window.__opened=opened;
window.__graphApp={vault:{getFiles:()=>[...fileObjs.values()],getAbstractFileByPath:p=>fileObjs.get(p)||null,read:async f=>byPath.get(f.path)?.text||'',on:()=>({})},metadataCache:{resolvedLinks:resolved,getFileCache:f=>{const n=byPath.get(f.path);return n?{frontmatter:n.fm,tags:n.tags.map(tag=>({tag}))}:null}},workspace:{registerHoverLinkSource(){},trigger:(name,payload)=>events.push({name,payload:{linktext:payload.linktext,source:payload.source,shift:payload.event.shiftKey}}),openLinkText:(link,source,leaf)=>opened.push({link,source,leaf})}};
HTMLElement.prototype.empty=function(){this.replaceChildren()}; HTMLElement.prototype.addClass=function(name){this.classList.add(name)};
HTMLElement.prototype.setText=function(text){this.textContent=text};
HTMLElement.prototype.createEl=function(tag,opts={}){const el=document.createElement(tag);if(opts.cls)el.className=opts.cls;if(opts.text!=null)el.textContent=opts.text;if(opts.type)el.type=opts.type;if(opts.value!=null)el.value=opts.value;for(const[k,v]of Object.entries(opts.attr||{}))el.setAttribute(k,String(v));this.append(el);return el};
HTMLElement.prototype.createDiv=function(opts={}){return this.createEl('div',opts)};HTMLElement.prototype.createSpan=function(opts={}){return this.createEl('span',opts)};
window.__graphView=new GraphHarness.GlobalGraphView({contentEl:document.querySelector('#root')});
window.__graphView.onOpen().then(()=>{document.documentElement.dataset.ready='true';document.querySelectorAll('.lh-global-toggle').forEach(label=>{if(label.textContent==='Animate')label.querySelector('input').click()})}).catch(error=>{document.documentElement.dataset.error=String(error);console.error(error)});
})();</script>`;
await writeFile(path.join(out, 'index.html'), html);

const browser = await firefox.launch({ headless: true, executablePath: browserPath });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => console.error('HARNESS PAGE ERROR:', error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error') console.error('HARNESS CONSOLE ERROR:', message.text()); });
  await page.goto(new URL('file://' + path.join(out, 'index.html').replaceAll('\\', '/')).href);
  await page.waitForFunction(() => document.documentElement.dataset.ready === 'true' || !!document.documentElement.dataset.error, null, { timeout: 20000 });
  const startupError = await page.evaluate(() => document.documentElement.dataset.error);
  if (startupError) throw new Error(`Graph view startup failed: ${startupError}`);
  await page.screenshot({ path: path.join(out, 'global-graph.png'), fullPage: true });
  const stats = await page.evaluate(() => {
    const view = window.__graphView;
    const learnEdges = view.visibleEdges().filter(edge => edge.kind === 'sequence' || edge.kind === 'derivation');
    const classicEdges = view.visibleEdges().filter(edge => edge.kind === 'link');
    const deepest = GraphHarness.inferGraphDepths(view.nodes.map(node => node.path), learnEdges);
    const target = view.nodes.find(node => deepest.get(node.path) >= 4 && node.kind === 'note');
    if (!target) throw new Error(`No deep concept exists: nodes=${view.nodes.length}, learnEdges=${learnEdges.length}, ids=${view.nodes.slice(0,4).map(node=>node.id).join(',')}`);
    const search = document.querySelector('[aria-label="Search graph notes"]'); search.value=target.title;search.dispatchEvent(new Event('input'));
    const visible = view.visibleNodes(), sources=visible.filter(node=>node.contextOnly);
    if (!visible.some(node=>node.path===target.path) || !sources.length) throw new Error(`Filtered level ${deepest.get(target.path)} lost its prerequisite sources.`);
    return {noteCount:view.nodes.length,classicEdges:classicEdges.length,learnEdges:learnEdges.length,deepest:deepest.get(target.path),sourceCount:sources.length,target:target.path};
  });
  await page.screenshot({ path: path.join(out, 'prerequisite-context.png'), fullPage: true });
  await page.getByRole('button', { name: 'Classic link view' }).click();
  if (await page.getByRole('button', { name: 'Classic link view' }).getAttribute('aria-pressed') !== 'true') throw new Error('Classic link toggle did not activate.');
  if (!(await page.evaluate(() => window.__graphView.visibleEdges().every(edge => edge.kind === 'link' || edge.kind === 'tag')))) throw new Error('Classic mode displayed LearnHarness edges.');
  await page.getByRole('button', { name: 'LearnHarness link view' }).click();
  if (await page.getByRole('button', { name: 'LearnHarness link view' }).getAttribute('aria-pressed') !== 'true') throw new Error('LearnHarness link toggle did not activate.');
  if (!(await page.evaluate(() => window.__graphView.visibleEdges().every(edge => edge.kind === 'sequence' || edge.kind === 'derivation' || edge.kind === 'tag')))) throw new Error('LearnHarness mode displayed classic edges.');
  const point = await page.evaluate(() => {
    const view=window.__graphView;const search=document.querySelector('[aria-label="Search graph notes"]');search.value='';search.dispatchEvent(new Event('input'));
    const canvas=document.querySelector('canvas'), nodes=view.visibleNodes().filter(node=>node.kind==='note'), camera=view.cameraDistance(nodes), projected=view.projectGraphNodes(nodes,canvas.clientWidth,canvas.clientHeight,camera);
    const node=nodes.find(item=>item.path.includes('P014 - quantitative-variable')), p=projected.get(node.path), rect=canvas.getBoundingClientRect();return{x:rect.left+p.x,y:rect.top+p.y,path:node.path};
  });
  const hit = await page.evaluate(({ x, y }) => { const r=document.querySelector('canvas').getBoundingClientRect();return window.__graphView.hitNode(x-r.left,y-r.top)?.path; }, point);
  if (hit !== point.path) throw new Error(`Harness coordinate did not hit the selected node: expected=${point.path} actual=${hit}`);
  await page.evaluate(({ x, y }) => {
    const canvas=document.querySelector('canvas'),r=canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,clientX:x,clientY:y,shiftKey:true}));
  }, point);
  const preview = await page.evaluate(() => window.__events.at(-1));
  if (!preview) throw new Error('Shift-hover did not emit a Page Preview event.');
  if (preview.payload.linktext !== point.path || preview.payload.shift !== true || preview.name !== 'hover-link') throw new Error('Shift-hover did not emit the expected Obsidian Page Preview event.');
  await page.evaluate(({ x, y }) => {
    const canvas=document.querySelector('canvas'); canvas.setPointerCapture=()=>{};
    canvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,clientX:x,clientY:y}));
    canvas.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,clientX:x,clientY:y}));
  }, point);
  const openedTab = await page.evaluate(() => window.__opened.at(-1));
  if (openedTab?.leaf !== 'tab') throw new Error('Note click did not request a new tab.');
  await page.screenshot({ path: path.join(out, 'link-modes.png'), fullPage: true });
  console.log(JSON.stringify({ ...stats, shiftHover: preview, clicked: openedTab, screenshots: out }, null, 2));
} finally { await browser.close(); }
