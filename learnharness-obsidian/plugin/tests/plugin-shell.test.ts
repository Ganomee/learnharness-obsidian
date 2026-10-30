import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

// This suite checks the shell's actual Vault API call ordering and failures.
// The runtime itself is separately tested against original upstream code.
const compiled = await build({
  entryPoints: ['plugin/src/main.ts'], bundle: true, write: false, platform: 'browser', format: 'cjs', external: ['obsidian'],
  plugins: [{ name: 'controlled-proof-for-shell-tests', setup(builder) {
    builder.onResolve({ filter: /^\.\/runtime-proof$/ }, () => ({ path: 'proof', namespace: 'controlled' }));
    builder.onResolve({ filter: /^\.\/session-controller$/ }, () => ({ path: 'controller', namespace: 'controlled' }));
    builder.onResolve({ filter: /^\.\/ui\/learning-view$/ }, () => ({ path: 'view', namespace: 'controlled' }));
    builder.onResolve({ filter: /^\.\/ui\/global-graph-view$/ }, () => ({ path: 'graph-view', namespace: 'controlled' }));
    builder.onLoad({ filter: /.*/, namespace: 'controlled' }, args => ({ contents: args.path === 'proof' ? 'export const runRuntimeProof = () => globalThis.__proof();' : args.path === 'controller' ? 'export class SessionController {dispose(){}}' : args.path === 'graph-view' ? 'export class GlobalGraphView {}; export const GLOBAL_GRAPH_VIEW="learnharness-knowledge-graph";' : 'export class LearningView {}; export const LEARNING_VIEW="learnharness-learning";' }));
  } }],
});

class File { constructor(public path: string) {} }
class Folder { constructor(public path: string) {} }

function harness(options: { marker?: boolean | string; mismatch?: boolean; failAt?: string; proof?: () => Promise<object> } = {}) {
  const notices: string[] = []; const writes: string[] = []; const opened: string[] = []; const hoverSources: Array<{ id: string; display: string; defaultMod: boolean }> = [];
  const files = new Map<string, string>(); let calls = 0;
  if (options.marker !== false) files.set('00 Start/Working agreement.md', typeof options.marker === 'string' ? options.marker : '---\nid: learnharness-disposable-vault\n---');
  const folders = new Set<string>();
  const app = {
    vault: {
      getAbstractFileByPath: (path: string) => files.has(path) ? new File(path) : folders.has(path) ? new Folder(path) : null,
      read: async (file: File) => {
        if (options.failAt === 'read' && file.path.startsWith('95 Runtime proofs/')) throw new Error('intentional read failure');
        return options.mismatch && file.path.startsWith('95 Runtime proofs/') ? 'truncated' : files.get(file.path);
      },
      createFolder: async (path: string) => { if (options.failAt === 'createFolder') throw new Error('intentional createFolder failure'); folders.add(path); },
      create: async (path: string, body: string) => { if (options.failAt === 'create') throw new Error('intentional create failure'); writes.push(path); files.set(path, body); return new File(path); },
    },
    workspace: { getLeaf: () => ({ openFile: async (file: File) => { opened.push(file.path); } }) },
  };
  class BasePlugin { constructor(public app: unknown) {} addCommand() {} registerView() {} addRibbonIcon() {} registerHoverLinkSource(id: string, info: { display: string; defaultMod: boolean }) { hoverSources.push({ id, ...info }); } }
  const context = vm.createContext({
    module: { exports: {} },
    require: (id: string) => { assert.equal(id, 'obsidian'); return { Plugin: BasePlugin, TFile: File, TFolder: Folder, Notice: class { constructor(message: string) { notices.push(message); } } }; },
    console: { error() {} },
    crypto: { randomUUID: () => '12345678-0000-0000-0000-000000000000' },
    __proof: async () => { calls++; return options.proof ? options.proof() : { status: 'passed', mock: true }; },
  });
  vm.runInContext(compiled.outputFiles[0]!.text, context);
  const PluginClass = context.module.exports.default;
  const plugin = new PluginClass(app);
  plugin.onload();
  return { plugin, notices, writes, opened, files, hoverSources, get calls() { return calls; } };
}

test('plugin registers the graph as a Page Preview source without requiring the Mod key', () => {
  const h = harness();
  assert.deepEqual(h.hoverSources, [{ id: 'learnharness-knowledge-graph', display: 'LearnHarness Lab', defaultMod: false }]);
});

test('plugin refuses unmarked vault before invoking runtime or writing', async () => {
  const h = harness({ marker: false }); await h.plugin.runProof();
  assert.equal(h.calls, 0); assert.deepEqual(h.writes, []);
  assert.match(h.notices[0]!, /only in the marked disposable/);
});

test('plugin rejects suffixed, prose-only, and duplicate marker identities', async () => {
  for (const marker of [
    '---\nid: learnharness-disposable-vault-not-really\n---',
    'Quoted example: id: learnharness-disposable-vault',
    '---\nid: learnharness-disposable-vault\nid: personal\n---',
  ]) {
    const h = harness({ marker }); await h.plugin.runProof();
    assert.equal(h.calls, 0); assert.deepEqual(h.writes, []);
  }
});

test('plugin saves diagnostic report through Vault, reads it back and then opens it', async () => {
  const h = harness(); await h.plugin.runProof();
  assert.equal(h.calls, 1); assert.equal(h.writes.length, 1);
  assert.deepEqual(h.opened, h.writes);
  assert.match(h.files.get(h.writes[0]!)!, /"status": "passed"/);
  assert.match(h.notices[0]!, /saved and read back/);
});

test('Vault read-back mismatch reports failure and never opens a success report', async () => {
  const h = harness({ mismatch: true }); await h.plugin.runProof();
  assert.equal(h.writes.length, 1); assert.deepEqual(h.opened, []);
  assert.match(h.notices[0]!, /read-back differs/);
  assert.ok(h.notices.every(message => !message.includes('proof completed')));
});

test('runtime failure does not create a report or announce success', async () => {
  const h = harness({ proof: async () => { throw new Error('intentional proof failure'); } });
  await h.plugin.runProof();
  assert.deepEqual(h.writes, []); assert.match(h.notices[0]!, /intentional proof failure/);
});

test('Vault folder, write and read exceptions never announce success or open a report', async () => {
  for (const failAt of ['createFolder', 'create', 'read']) {
    const h = harness({ failAt }); await h.plugin.runProof();
    assert.deepEqual(h.opened, []);
    assert.ok(h.notices.some(message => message.includes(`intentional ${failAt} failure`)));
    assert.ok(h.notices.every(message => !message.includes('proof completed')));
  }
});

test('concurrent invocations run once and unloading before completion suppresses writes', async () => {
  let finish!: (value: object) => void;
  let signalStarted!: () => void;
  const started = new Promise<void>(resolve => { signalStarted = resolve; });
  const h = harness({ proof: () => new Promise(resolve => { finish = resolve; signalStarted(); }) });
  const first = h.plugin.runProof();
  await started;
  assert.equal(h.calls, 1);
  await h.plugin.runProof(); assert.equal(h.calls, 1);
  h.plugin.onunload(); finish({ status: 'passed' }); await first;
  assert.deepEqual(h.writes, []); assert.deepEqual(h.opened, []);
});
