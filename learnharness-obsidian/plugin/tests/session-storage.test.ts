import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionStore, sessionMarkdownFolder, sessionPath, validateEnvelope } from '../src/storage/session-store';
import { MemoryVault, snapshotRows, snapshotState } from './fixtures/memory-vault';
const record = (id = 'storage_1') => ({ id, title: 'Native preservation', createdAt: '2026-10-27T12:00:00.000Z', updatedAt: '2026-10-27T12:00:00.000Z', messages: [] });
function replaceCanonical(markdown: string, replacement: string): string {
  return markdown.replace(/(<!-- learnharness:canonical-state:start -->\s*)(`{3,})json\s*\n[\s\S]*?\n\2(\s*<!-- learnharness:canonical-state:end -->)/,
    (_all, before: string, fence: string, after: string) => `${before}${fence}json\n${replacement}\n${fence}${after}`);
}

test('Markdown session snapshots preserve native and unknown fields through fresh instance load', async () => {
  const vault = new MemoryVault(); const store = new SessionStore(vault);
  const created = await store.create({ ...record(), settings: { model: { provider: 'faux', id: 'faux-1' } }, extraUpstreamField: { signature: 'opaque' } } as any, 'deepseek');
  const next = structuredClone(created); next.revision++;
  (next.record as any).messages.push({ id: 'u_1', role: 'user', content: 'reasoning', timestamp: 12 });
  (next.record as any).extractions = [{ opaque: 'preserve' }];
  await store.save(next, created);
  const loaded = await new SessionStore(vault).load(created.record.id);
  assert.deepEqual(loaded, next);
  assert.equal(loaded.providerMode, 'deepseek');
  assert.equal((loaded.record as any).extraUpstreamField.signature, 'opaque');
  const rows = snapshotRows(vault, created.record.id);
  assert.equal(rows.length, 2);
  assert.equal(rows.at(-1)!.state.envelope.providerBudget.priceRevision, 'DeepSeek-V4.1-Flash-1017');
  assert.ok(rows.every(row => row.path.startsWith(`${sessionMarkdownFolder(created.record.id)}/revision-`)));
  assert.equal(vault.files.has(sessionPath(created.record.id)), false);
  assert.match([...vault.files.values()][0]!, /## Transcript/);
});

test('legacy JSON session and backup revisions are mirrored into linked Markdown without deleting originals', async () => {
  const vault = new MemoryVault();
  const seed = await new SessionStore(vault).create(record('legacy_1'));
  vault.files.clear();
  const revision0 = { ...seed, schemaVersion: 1, revision: 0 };
  const revision1 = { ...seed, schemaVersion: 1, revision: 1, record: { ...seed.record, title: 'Legacy current' } };
  const currentPath = sessionPath(seed.record.id);
  const backupPath = `LearnHarness/SessionBackups/${seed.record.id}/revision-0.json`;
  vault.files.set(currentPath, JSON.stringify(revision1));
  vault.files.set(backupPath, JSON.stringify(revision0));

  const imported = await new SessionStore(vault).load(seed.record.id);
  assert.equal(imported.record.title, 'Legacy current');
  assert.equal(vault.files.get(currentPath), JSON.stringify(revision1));
  assert.equal(vault.files.get(backupPath), JSON.stringify(revision0));
  const rows = snapshotRows(vault, seed.record.id).sort((a, b) => a.state.envelope.revision - b.state.envelope.revision);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.state.parentSnapshotId, null);
  assert.equal(rows[1]!.state.parentSnapshotId, rows[0]!.state.snapshotId);
  assert.equal((await new SessionStore(vault).listBranches(seed.record.id)).length, 1);
});

test('malformed, future schema/native version and mismatched pin refuse load/save without overwrite', async () => {
  const vault = new MemoryVault(); const store = new SessionStore(vault); const created = await store.create(record());
  const path = snapshotRows(vault, created.record.id)[0]!.path;
  const original = vault.files.get(path)!;
  const invalidStates = [
    null,
    { ...snapshotState(original), envelope: { ...created, schemaVersion: 99 } },
    { ...snapshotState(original), envelope: { ...created, upstreamRevision: 'different' } },
    { ...snapshotState(original), envelope: { ...created, record: { ...created.record, version: 99 } } },
    { ...snapshotState(original), envelope: { ...created, record: { ...created.record, messages: [{ id: 'm', role: 'assistant', content: 'bad' }] } } },
  ];
  for (const state of invalidStates) {
    vault.files.set(path, state === null ? replaceCanonical(original, '{broken') : replaceCanonical(original, JSON.stringify(state, null, 2)));
    await assert.rejects(store.load(created.record.id));
    const next = structuredClone(created); next.revision++;
    await assert.rejects(store.save(next, created));
    assert.equal(vault.files.get(path), state === null ? replaceCanonical(original, '{broken') : replaceCanonical(original, JSON.stringify(state, null, 2)));
  }
});

test('external same-revision branch and stale revision reject without rewriting user data', async () => {
  const vault = new MemoryVault(); const first = new SessionStore(vault); const created = await first.create(record());
  const staleVault = new MemoryVault(); staleVault.files = new Map(vault.files); staleVault.folders = new Set(vault.folders);
  const staleStore = new SessionStore(staleVault);
  const external = { ...created, revision: created.revision + 1, record: { ...created.record, title: 'External edit' } };
  await new SessionStore(vault).save(external, created);
  const stale = { ...created, revision: created.revision + 1, record: { ...created.record, title: 'Stale edit' } };
  await staleStore.save(stale, created);
  for (const [path, text] of staleVault.files) if (!vault.files.has(path)) vault.files.set(path, text);
  await assert.rejects(first.load(created.record.id), /concurrent branches/);
  const branches = await first.listBranches(created.record.id);
  assert.equal(branches.length, 2);
  assert.ok(branches.some(branch => branch.envelope.record.title === 'External edit'));
  assert.ok(branches.some(branch => branch.envelope.record.title === 'Stale edit'));
  const selected = branches.find(branch => branch.envelope.record.title === 'External edit')!;
  await first.resolveBranch(created.record.id, selected.snapshotId);
  const resolved = await first.listBranches(created.record.id);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]!.snapshotId, selected.snapshotId);
  assert.equal(snapshotRows(vault, created.record.id).length, 3, 'branch resolution retains both snapshots and their parent');
});

test('stale write against one advanced Markdown head is rejected without becoming the new head', async () => {
  const vault = new MemoryVault(); const store = new SessionStore(vault); const created = await store.create(record('stale_single_head'));
  const external = { ...created, revision: created.revision + 1, record: { ...created.record, title: 'Advanced externally' } };
  await store.save(external, created);
  const stale = { ...created, revision: created.revision + 1, record: { ...created.record, title: 'Stale overwrite' } };
  await assert.rejects(store.save(stale, created), /changed externally/);
  assert.equal((await store.load(created.record.id)).record.title, 'Advanced externally');
});

test('session IDs cannot escape fixed vault folder and duplicate identity is refused', async () => {
  for (const id of ['../private', 'folder/note', 'C:\\private', '', 'x'.repeat(101)]) assert.throws(() => sessionPath(id), /Invalid session id/);
  const vault = new MemoryVault(); const store = new SessionStore(vault); const created = await store.create(record());
  await assert.rejects(store.create(record()), /already exists/);
  const malformed = structuredClone(created); (malformed.record as any).messages = [{ id: 'dup', role: 'user', content: 'one' }, { id: 'dup', role: 'user', content: 'two' }];
  assert.throws(() => validateEnvelope(malformed, malformed.record.id), /identity/);
});

test('partial Markdown snapshot write is recovered from the prior acknowledged revision and damaged bytes are retained', async () => {
  const vault = new MemoryVault(); const store = new SessionStore(vault); const created = await store.create(record());
  const next = structuredClone(created); next.revision++; next.record.title = 'unacknowledged';
  vault.partialCreateAt = 2;
  await assert.rejects(store.save(next, created), /partial Vault create failure/);
  const brokenPath = [...vault.files.keys()].find(path => path.includes('/revision-1-'))!;
  const broken = vault.files.get(brokenPath)!;
  await assert.rejects(store.load(created.record.id), /canonical state|malformed/);
  vault.partialCreateAt = -1;
  const restored = await store.recover(created.record.id);
  assert.deepEqual(restored, created);
  const incident = [...vault.files].find(([path]) => path.includes('/recoveries/incident-'))?.[1];
  assert.ok(incident?.includes(JSON.stringify(broken)));
  assert.deepEqual(await store.load(created.record.id), created);

  const goodPath = snapshotRows(vault, created.record.id).find(row => row.state.envelope.revision === 0)!.path;
  const good = vault.files.get(goodPath)!;
  const future = snapshotState(good); future.envelope.schemaVersion = 99;
  const corrupt = replaceCanonical(good, JSON.stringify(future, null, 2));
  vault.files.set(goodPath, corrupt);
  await assert.rejects(store.load(created.record.id), /schema/);
  await assert.rejects(store.recover(created.record.id));
  assert.equal(vault.files.get(goodPath), corrupt);
});
