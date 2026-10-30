import { CURRENT_CHAT_VERSION, type ChatRecord } from '../../../upstream/learnharness/src/core/contracts/chat.ts';
import { emptyProviderBudgetState, PROVIDER_BUDGET_POLICY, validateProviderBudgetState, type ProviderBudgetState } from '../adapters/provider-budget';

export const UPSTREAM_REVISION = '3dc88472eea41eed0d5e5f29c2f16f8d063c415b';
export const SESSION_FOLDER = 'LearnHarness/Sessions';
export const SESSION_ENVELOPE_SCHEMA_VERSION = 2 as const;

export interface SessionVault {
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  read(path: string): Promise<string>;
  create(path: string, text: string): Promise<void>;
  modify(path: string, text: string): Promise<void>;
  listFiles(): Promise<string[]>;
}
export type SessionStatus = 'idle' | 'running' | 'interrupted' | 'failed';
export interface SessionEnvelope {
  format: 'learnharness-obsidian-session';
  schemaVersion: typeof SESSION_ENVELOPE_SCHEMA_VERSION;
  upstreamRevision: string;
  revision: number;
  providerMode: 'demo' | 'deepseek';
  status: SessionStatus;
  providerBudget: ProviderBudgetState;
  record: ChatRecord;
  [key: string]: unknown;
}
export interface SessionBranch {
  snapshotId: string;
  parentSnapshotId: string | null;
  revision: number;
  createdAt: string;
  envelope: SessionEnvelope;
}
export interface ListedSessionBranch extends SessionBranch {
  sessionId: string;
  branchCount: number;
}
export class SessionFormatError extends Error {}
export class SessionConflictError extends Error {}

const LEGACY_SCHEMA_VERSION = 1;
const START_MARKER = '<!-- learnharness:canonical-state:start -->';
const END_MARKER = '<!-- learnharness:canonical-state:end -->';
const SNAPSHOT_PREFIX = 'revision-';
const isObject = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const initialProviderBudget = (): ProviderBudgetState => emptyProviderBudgetState();

/** Legacy JSON file path retained for read-only import and migration. */
export function sessionPath(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new SessionFormatError('Invalid session id');
  return `${SESSION_FOLDER}/${id}.json`;
}
export function sessionMarkdownFolder(id: string): string {
  sessionPath(id);
  return `${SESSION_FOLDER}/${id}`;
}

export function validateEnvelope(value: unknown, id: string): SessionEnvelope {
  sessionPath(id);
  if (!isObject(value) || value.format !== 'learnharness-obsidian-session' || ![LEGACY_SCHEMA_VERSION, SESSION_ENVELOPE_SCHEMA_VERSION].includes(value.schemaVersion)) {
    throw new SessionFormatError('Unknown, malformed or future integration session schema; file left unchanged');
  }
  if (value.upstreamRevision !== UPSTREAM_REVISION) throw new SessionFormatError('Session upstream revision differs; explicit migration required');
  if (!['demo', 'deepseek'].includes(value.providerMode)) throw new SessionFormatError('Unknown session provider mode; file left unchanged');
  if (!Number.isInteger(value.revision) || value.revision < 0 || !['idle', 'running', 'interrupted', 'failed'].includes(value.status)) throw new SessionFormatError('Malformed session revision/state');
  const record = value.record;
  if (!isObject(record) || record.id !== id || typeof record.title !== 'string' || typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string' || !Array.isArray(record.messages)) throw new SessionFormatError('Malformed native chat record');
  if (record.version !== undefined && record.version !== CURRENT_CHAT_VERSION) throw new SessionFormatError('Unsupported native chat version; file left unchanged');
  const ids = new Set<string>();
  for (const message of record.messages) {
    if (!isObject(message) || typeof message.id !== 'string' || !message.id || ids.has(message.id) || !['user', 'assistant', 'toolResult', 'custom'].includes(message.role)) throw new SessionFormatError('Malformed native message identity or role');
    ids.add(message.id);
    if (message.role === 'user' && typeof message.content !== 'string' && !Array.isArray(message.content)) throw new SessionFormatError('Malformed native user content');
    if ((message.role === 'assistant' || message.role === 'toolResult') && !Array.isArray(message.content)) throw new SessionFormatError('Malformed native content blocks');
    if ((message.role === 'assistant' || message.role === 'toolResult') && message.content.some((block: unknown) => !isObject(block) || typeof block.type !== 'string')) throw new SessionFormatError('Malformed native content block');
    if (message.role === 'toolResult' && (typeof message.toolCallId !== 'string' || !message.toolCallId || typeof message.toolName !== 'string')) throw new SessionFormatError('Malformed native tool result identity');
    if (message.role === 'custom' && (typeof message.customType !== 'string' || typeof message.content !== 'string')) throw new SessionFormatError('Malformed native marker');
  }

  const incomingBudget = value.providerBudget;
  // Legacy provider sessions predate shared spend accounting. Fail closed by
  // marking their budget exhausted; demo sessions have no provider spend.
  const providerBudget = incomingBudget === undefined
    ? value.schemaVersion === LEGACY_SCHEMA_VERSION && value.providerMode === 'deepseek'
      ? { ...initialProviderBudget(), reservations: [{ id: 'legacy-unknown-spend', maxCostMicros: PROVIDER_BUDGET_POLICY.ceilingMicros, inputTokenUpperBound: 0, outputTokenLimit: 0 }], requestsStarted: PROVIDER_BUDGET_POLICY.maxRequests }
      : initialProviderBudget()
    : validateProviderBudgetState(incomingBudget);
  return {
    ...value,
    schemaVersion: SESSION_ENVELOPE_SCHEMA_VERSION,
    providerBudget: { ...providerBudget },
    record,
  } as SessionEnvelope;
}

interface SnapshotPayload {
  format: 'learnharness-markdown-session';
  schemaVersion: 1;
  snapshotId: string;
  parentSnapshotId: string | null;
  createdAt: string;
  envelope: SessionEnvelope;
}
interface BranchResolutionPayload {
  format: 'learnharness-session-branch-resolution';
  schemaVersion: 1;
  sessionId: string;
  resolutionId: string;
  createdAt: string;
  resolvedHeads: string[];
  selectedSnapshotId: string;
}
interface RecoveryPayload {
  format: 'learnharness-session-recovery';
  schemaVersion: 1;
  sessionId: string;
  recoveryId: string;
  createdAt: string;
  ignoredSnapshotPaths: string[];
}
interface ParsedSnapshot extends SnapshotPayload { path: string }

function snapshotRoot(id: string): string { return sessionMarkdownFolder(id); }
function snapshotPath(id: string, revision: number, snapshotId: string): string {
  return `${snapshotRoot(id)}/${SNAPSHOT_PREFIX}${revision}-${snapshotId}.md`;
}
function legacyBackupFolder(id: string): string { sessionPath(id); return `LearnHarness/SessionBackups/${id}`; }
function resolutionFolder(id: string): string { return `${snapshotRoot(id)}/resolutions`; }
function recoveryFolder(id: string): string { return `${snapshotRoot(id)}/recoveries`; }
function randomId(): string { return crypto.randomUUID(); }
function contentTag(text: string): string {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}

function textOf(message: Record<string, any>): string {
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content.map((block: unknown) => {
    if (!isObject(block)) return '[unknown content]';
    if (block.type === 'text' && typeof block.text === 'string') return block.text;
    if (block.type === 'data' && typeof block.data === 'object') return `[${String(block.data?.type ?? 'data')} block]`;
    return `[${String(block.type ?? 'content')} block]`;
  }).join('\n');
}
function markdownHeading(text: string): string { return text.replace(/[\r\n]+/g, ' ').replace(/#/g, '\\#').trim() || '(untitled)'; }
function readableProjection(envelope: SessionEnvelope): string {
  const record = envelope.record as ChatRecord & { messages: Array<Record<string, any>> };
  const sections = [
    `# ${markdownHeading(record.title)}`,
    '',
    `- Session: \`${record.id}\``,
    `- Provider mode: \`${envelope.providerMode}\``,
    `- State: \`${envelope.status}\``,
    `- Revision: ${envelope.revision}`,
    `- Updated: ${record.updatedAt}`,
    `- Messages: ${record.messages.length}`,
    '',
    '## Transcript',
  ];
  if (envelope.providerMode === 'deepseek') {
    const reserved = envelope.providerBudget.reservations.reduce((sum, reservation) => sum + reservation.maxCostMicros, 0);
    sections.splice(8, 0,
      `- Provider price policy: \`${envelope.providerBudget.priceRevision}\``,
      `- Provider spend recorded: $${(envelope.providerBudget.spentMicros / 1_000_000).toFixed(6)}`,
      `- Provider spend reserved: $${(reserved / 1_000_000).toFixed(6)}`,
      `- Provider requests started: ${envelope.providerBudget.requestsStarted}/${PROVIDER_BUDGET_POLICY.maxRequests}`,
    );
  }
  for (const message of record.messages) {
    const role = typeof message.role === 'string' ? message.role : 'unknown';
    const id = typeof message.id === 'string' ? message.id : 'unknown';
    const callId = typeof message.toolCallId === 'string' ? ` · tool call \`${message.toolCallId}\`` : '';
    sections.push('', `### ${role} · \`${id}\`${callId}`, '', textOf(message) || '_No text content._');
  }
  if (record.tree) sections.push('', '## Plan', '', 'The complete native plan tree is preserved in the canonical state block below.');
  if (record.settings) sections.push('', '## Session settings', '', 'The complete settings object is preserved in the canonical state block below.');
  return sections.join('\n');
}

function fenceFor(text: string): string {
  let longest = 0;
  for (const match of text.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  return '`'.repeat(Math.max(3, longest + 1));
}
function stateBlock(payload: unknown, markerStart = START_MARKER, markerEnd = END_MARKER): string {
  const json = JSON.stringify(payload, null, 2);
  const fence = fenceFor(json);
  return `${markerStart}\n${fence}json\n${json}\n${fence}\n${markerEnd}`;
}
function extractStateBlock(text: string, markerStart = START_MARKER, markerEnd = END_MARKER): unknown {
  const start = text.indexOf(markerStart);
  if (start < 0) throw new SessionFormatError('Markdown session has no canonical state block; file left unchanged');
  const endMarker = text.indexOf(markerEnd, start + markerStart.length);
  if (endMarker < 0) throw new SessionFormatError('Markdown session canonical state block is incomplete; file left unchanged');
  const section = text.slice(start + markerStart.length, endMarker);
  const opener = section.match(/^\s*(`{3,})json\s*\r?\n/);
  if (!opener) throw new SessionFormatError('Markdown session canonical state block is malformed; file left unchanged');
  const fence = opener[1]!;
  const contentStart = opener[0].length;
  const closing = section.lastIndexOf(`\n${fence}`);
  if (closing < contentStart) throw new SessionFormatError('Markdown session canonical state fence is incomplete; file left unchanged');
  try { return JSON.parse(section.slice(contentStart, closing)); }
  catch (error) { throw new SessionFormatError('Cannot parse canonical Markdown session state; file left unchanged', { cause: error }); }
}
function snapshotMarkdown(payload: SnapshotPayload): string {
  const envelope = payload.envelope;
  const frontmatter = [
    '---',
    'type: learnharness-session-snapshot',
    `sessionId: ${JSON.stringify(envelope.record.id)}`,
    `snapshotId: ${JSON.stringify(payload.snapshotId)}`,
    `parentSnapshotId: ${JSON.stringify(payload.parentSnapshotId ?? '')}`,
    `revision: ${payload.envelope.revision}`,
    `updatedAt: ${JSON.stringify(envelope.record.updatedAt)}`,
    '---',
  ].join('\n');
  const json = `${readableProjection(envelope)}\n\n## Canonical native state (generated; do not edit)\n\n${stateBlock(payload)}`;
  return `${frontmatter}\n\n${json}\n`;
}
function parseSnapshot(path: string, text: string, id: string): ParsedSnapshot {
  const payload = extractStateBlock(text);
  if (!isObject(payload) || payload.format !== 'learnharness-markdown-session' || payload.schemaVersion !== 1
    || typeof payload.snapshotId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(payload.snapshotId)
    || !(payload.parentSnapshotId === null || (typeof payload.parentSnapshotId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(payload.parentSnapshotId)))
    || typeof payload.createdAt !== 'string') {
    throw new SessionFormatError('Malformed Markdown session snapshot; file left unchanged');
  }
  const envelope = validateEnvelope(payload.envelope, id);
  const frontmatterSession = text.match(/^---\r?\n[\s\S]*?^sessionId:\s*(.+)\r?\n/m)?.[1];
  const frontmatterSnapshot = text.match(/^---\r?\n[\s\S]*?^snapshotId:\s*(.+)\r?\n/m)?.[1];
  const frontmatterParent = text.match(/^---\r?\n[\s\S]*?^parentSnapshotId:\s*(.+)\r?\n/m)?.[1];
  const frontmatterRevision = text.match(/^---\r?\n[\s\S]*?^revision:\s*(\d+)\r?\n/m)?.[1];
  const frontmatterUpdated = text.match(/^---\r?\n[\s\S]*?^updatedAt:\s*(.+)\r?\n/m)?.[1];
  if (frontmatterSession !== JSON.stringify(id)
    || frontmatterSnapshot !== JSON.stringify(payload.snapshotId)
    || frontmatterParent !== JSON.stringify(payload.parentSnapshotId ?? '')
    || Number(frontmatterRevision) !== envelope.revision
    || frontmatterUpdated !== JSON.stringify(envelope.record.updatedAt)) {
    throw new SessionFormatError('Markdown session metadata does not match its canonical state; file left unchanged');
  }
  return { ...payload, envelope, path } as ParsedSnapshot;
}
function utilityMarkdown(title: string, payload: unknown): string {
  return `# ${title}\n\n${stateBlock(payload, '<!-- learnharness:utility-state:start -->', '<!-- learnharness:utility-state:end -->')}\n`;
}
function parseUtility<T>(text: string): T {
  return extractStateBlock(text, '<!-- learnharness:utility-state:start -->', '<!-- learnharness:utility-state:end -->') as T;
}

/** Immutable Markdown revisions. The native record block is the lossless
 * state; the transcript and frontmatter are generated for human reading.
 * Concurrent branches are retained and surfaced instead of text-merged. */
export class SessionStore {
  private legacyMigrations = new Map<string, Promise<ParsedSnapshot | null>>();
  constructor(readonly vault: SessionVault) {}
  private async ensureFolders(folders: string[]) {
    for (const folder of folders) {
      if (!await this.vault.exists(folder)) {
        try { await this.vault.mkdir(folder); }
        catch (error) { if (!await this.vault.exists(folder)) throw error; }
      }
    }
  }
  private snapshotFiles(id: string, paths: string[]): string[] {
    const prefix = `${snapshotRoot(id)}/${SNAPSHOT_PREFIX}`;
    return paths.filter(path => path.startsWith(prefix) && path.endsWith('.md') && !path.includes('/resolutions/') && !path.includes('/recoveries/'));
  }
  private async readResolutions(id: string, paths: string[]): Promise<BranchResolutionPayload[]> {
    const prefix = `${resolutionFolder(id)}/`;
    const files = paths.filter(path => path.startsWith(prefix) && /\/resolution-[^/]+\.md$/.test(path));
    const values = await Promise.all(files.map(async path => parseUtility<BranchResolutionPayload>(await this.vault.read(path))));
    for (const value of values) {
      if (!isObject(value) || value.format !== 'learnharness-session-branch-resolution' || value.schemaVersion !== 1
        || value.sessionId !== id || typeof value.resolutionId !== 'string' || typeof value.createdAt !== 'string'
        || !Array.isArray(value.resolvedHeads) || !value.resolvedHeads.every((head: unknown) => typeof head === 'string')
        || typeof value.selectedSnapshotId !== 'string' || !value.resolvedHeads.includes(value.selectedSnapshotId)) {
        throw new SessionFormatError('Malformed branch resolution; file left unchanged');
      }
    }
    return values;
  }
  private async readRecoveryIgnoreSet(id: string, paths: string[]): Promise<Set<string>> {
    const prefix = `${recoveryFolder(id)}/`;
    const files = paths.filter(path => path.startsWith(prefix) && /\/recovery-[^/]+\.md$/.test(path));
    const values = await Promise.all(files.map(async path => parseUtility<RecoveryPayload>(await this.vault.read(path))));
    const ignored = new Set<string>();
    for (const value of values) {
      if (!isObject(value) || value.format !== 'learnharness-session-recovery' || value.schemaVersion !== 1
        || value.sessionId !== id || typeof value.recoveryId !== 'string' || typeof value.createdAt !== 'string'
        || !Array.isArray(value.ignoredSnapshotPaths) || !value.ignoredSnapshotPaths.every((path: unknown) => typeof path === 'string')) {
        throw new SessionFormatError('Malformed recovery record; file left unchanged');
      }
      value.ignoredSnapshotPaths.forEach(path => ignored.add(path));
    }
    return ignored;
  }
  private async readSnapshots(id: string, tolerateMalformed = false): Promise<{ snapshots: ParsedSnapshot[]; malformed: string[] }> {
    const paths = await this.vault.listFiles();
    const ignored = await this.readRecoveryIgnoreSet(id, paths);
    const files = this.snapshotFiles(id, paths).filter(path => !ignored.has(path));
    const snapshots: ParsedSnapshot[] = [];
    const malformed: string[] = [];
    for (const path of files) {
      try { snapshots.push(parseSnapshot(path, await this.vault.read(path), id)); }
      catch (error) {
        if (!tolerateMalformed) throw error;
        malformed.push(path);
      }
    }
    return { snapshots, malformed };
  }
  private async effectiveHeads(id: string, snapshots: ParsedSnapshot[]): Promise<ParsedSnapshot[]> {
    const parentIds = new Set(snapshots.flatMap(snapshot => snapshot.parentSnapshotId ? [snapshot.parentSnapshotId] : []));
    const heads = snapshots.filter(snapshot => !parentIds.has(snapshot.snapshotId));
    const resolutions = await this.readResolutions(id, await this.vault.listFiles());
    const resolutionsByHeadSet = new Map<string, string>();
    for (const resolution of resolutions) {
      const key = [...resolution.resolvedHeads].sort().join('\u0000');
      const prior = resolutionsByHeadSet.get(key);
      if (prior && prior !== resolution.selectedSnapshotId) throw new SessionConflictError('Devices selected different branches; keep both and resolve explicitly.');
      resolutionsByHeadSet.set(key, resolution.selectedSnapshotId);
    }
    const suppressed = new Set<string>();
    for (const resolution of resolutions) {
      for (const head of resolution.resolvedHeads) if (head !== resolution.selectedSnapshotId) suppressed.add(head);
    }
    return heads.filter(head => !suppressed.has(head.snapshotId));
  }
  private async appendSnapshot(envelope: SessionEnvelope, parentSnapshotId: string | null, stableSnapshotId?: string): Promise<ParsedSnapshot> {
    const id = envelope.record.id;
    const folder = snapshotRoot(id);
    await this.ensureFolders(['LearnHarness', SESSION_FOLDER, folder]);
    const payload: SnapshotPayload = { format: 'learnharness-markdown-session', schemaVersion: 1, snapshotId: stableSnapshotId ?? randomId(), parentSnapshotId, createdAt: new Date().toISOString(), envelope: structuredClone(envelope) };
    const path = snapshotPath(id, envelope.revision, payload.snapshotId);
    const text = snapshotMarkdown(payload);
    if (await this.vault.exists(path)) {
      const existing = parseSnapshot(path, await this.vault.read(path), id);
      if (JSON.stringify(existing.envelope) !== JSON.stringify(envelope) || existing.parentSnapshotId !== parentSnapshotId) throw new SessionConflictError('A different snapshot already uses this migration identity; both files were left unchanged.');
      return existing;
    }
    await this.vault.create(path, text);
    if (await this.vault.read(path) !== text) throw new SessionConflictError('Markdown snapshot acknowledgement failed');
    return { ...payload, path };
  }
  private async legacyEnvelope(id: string): Promise<SessionEnvelope | null> {
    const path = sessionPath(id);
    if (!await this.vault.exists(path)) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(await this.vault.read(path)); }
    catch (error) { throw new SessionFormatError(`Cannot read legacy session ${id}; file left unchanged`, { cause: error }); }
    return validateEnvelope(parsed, id);
  }
  private async migrateLegacy(id: string): Promise<ParsedSnapshot | null> {
    const active = this.legacyMigrations.get(id);
    if (active) return active;
    const migration = this.migrateLegacyNow(id);
    this.legacyMigrations.set(id, migration);
    try { return await migration; }
    finally { if (this.legacyMigrations.get(id) === migration) this.legacyMigrations.delete(id); }
  }
  private async migrateLegacyNow(id: string): Promise<ParsedSnapshot | null> {
    const backupPrefix = `${legacyBackupFolder(id)}/`;
    const paths = await this.vault.listFiles();
    const backups = paths.map(path => ({ path, match: path.startsWith(backupPrefix) ? path.slice(backupPrefix.length).match(/^revision-(\d+)\.json$/) : null }))
      .filter((entry): entry is { path: string; match: RegExpMatchArray } => entry.match !== null)
      .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));
    const currentPath = sessionPath(id);
    const hasCurrent = await this.vault.exists(currentPath);
    if (!backups.length && !hasCurrent) return null;

    let parentSnapshotId: string | null = null;
    const mirror = async (path: string, stableId: string): Promise<ParsedSnapshot | null> => {
      const raw = await this.vault.read(path);
      const snapshotId = `${stableId}-${contentTag(raw)}`;
      let envelope: SessionEnvelope;
      try {
        const parsed = JSON.parse(raw);
        envelope = validateEnvelope(parsed, id);
      } catch (error) {
        // Preserve damaged or future-schema legacy bytes as Markdown evidence;
        // do not silently discard them or block a valid current snapshot.
        await this.writeIncident(id, path, raw, `legacy-invalid-${stableId}-${contentTag(raw)}`);
        return null;
      }
      const snapshot = await this.appendSnapshot(envelope, parentSnapshotId, snapshotId);
      parentSnapshotId = snapshot.snapshotId;
      return snapshot;
    };
    for (const backup of backups) await mirror(backup.path, `legacy-r${Number(backup.match[1])}`);
    // Keep the old JSON current record as the final imported snapshot. All later
    // writes append Markdown descendants and leave the import source untouched.
    return hasCurrent ? await mirror(currentPath, 'legacy-current') : null;
  }
  private async readState(id: string): Promise<ParsedSnapshot> {
    await this.migrateLegacy(id);
    const { snapshots } = await this.readSnapshots(id);
    if (!snapshots.length) {
      throw new SessionFormatError(`Session ${id} was not found`);
    }
    const heads = await this.effectiveHeads(id, snapshots);
    if (!heads.length) throw new SessionConflictError('Session branch resolutions conflict; preserve all snapshots and resolve explicitly.');
    if (heads.length > 1) throw new SessionConflictError(`Session has concurrent branches (${heads.map(head => head.snapshotId).join(', ')}); choose a branch explicitly.`);
    return heads[0]!;
  }
  private async writeIncident(id: string, path: string, raw: string, stableIncidentId?: string): Promise<void> {
    const folder = recoveryFolder(id);
    await this.ensureFolders([snapshotRoot(id), folder]);
    const incidentId = stableIncidentId ?? randomId();
    const incident = `${folder}/incident-${incidentId}.md`;
    const payload = { format: 'learnharness-session-incident', schemaVersion: 1, sessionId: id, incidentId, originalPath: path, capturedAt: new Date().toISOString(), originalContent: raw };
    const text = utilityMarkdown(`Preserved damaged session data: ${id}`, payload);
    if (await this.vault.exists(incident)) {
      if (await this.vault.read(incident) !== text) throw new SessionConflictError('A different preserved incident already uses this identity.');
      return;
    }
    await this.vault.create(incident, text);
    if (await this.vault.read(incident) !== text) throw new SessionConflictError('Cannot preserve damaged bytes in Markdown; recovery refused');
  }
  async load(id: string): Promise<SessionEnvelope> {
    return structuredClone((await this.readState(id)).envelope);
  }
  async create(record: ChatRecord, providerMode: 'demo' | 'deepseek' = 'demo'): Promise<SessionEnvelope> {
    await this.ensureFolders(['LearnHarness', SESSION_FOLDER]);
    const id = record.id;
    sessionPath(id);
    const paths = await this.vault.listFiles();
    if (await this.vault.exists(sessionPath(id)) || this.snapshotFiles(id, paths).length) throw new SessionConflictError('Session already exists');
    const value = validateEnvelope({ format: 'learnharness-obsidian-session', schemaVersion: SESSION_ENVELOPE_SCHEMA_VERSION, upstreamRevision: UPSTREAM_REVISION, revision: 0, providerMode, status: 'idle', providerBudget: initialProviderBudget(), record: structuredClone({ ...record, version: CURRENT_CHAT_VERSION }) }, id);
    await this.appendSnapshot(value, null);
    return structuredClone(value);
  }
  async save(next: SessionEnvelope, previous: SessionEnvelope): Promise<SessionEnvelope> {
    const id = previous.record.id;
    const normalizedNext = validateEnvelope(next, id);
    const normalizedPrevious = validateEnvelope(previous, id);
    if (normalizedNext.record.id !== id || normalizedNext.revision !== normalizedPrevious.revision + 1) throw new SessionConflictError('Invalid session revision transition');
    const current = await this.readState(id);
    if (JSON.stringify(current.envelope) !== JSON.stringify(normalizedPrevious)) throw new SessionConflictError('Session changed externally; reload before continuing');
    await this.appendSnapshot(normalizedNext, current.snapshotId);
    return structuredClone(normalizedNext);
  }
  async listBranches(id: string): Promise<SessionBranch[]> {
    sessionPath(id);
    await this.migrateLegacy(id);
    const { snapshots } = await this.readSnapshots(id);
    if (!snapshots.length) {
      const migrated = await this.migrateLegacy(id);
      return migrated ? [{ snapshotId: migrated.snapshotId, parentSnapshotId: migrated.parentSnapshotId, revision: migrated.envelope.revision, createdAt: migrated.createdAt, envelope: structuredClone(migrated.envelope) }] : [];
    }
    const heads = await this.effectiveHeads(id, snapshots);
    return heads.map(head => ({ snapshotId: head.snapshotId, parentSnapshotId: head.parentSnapshotId, revision: head.envelope.revision, createdAt: head.createdAt, envelope: structuredClone(head.envelope) }));
  }
  async resolveBranch(id: string, selectedSnapshotId: string): Promise<SessionEnvelope> {
    const heads = await this.listBranches(id);
    if (heads.length < 2) throw new SessionConflictError('There is no concurrent session branch to resolve.');
    if (!heads.some(head => head.snapshotId === selectedSnapshotId)) throw new SessionConflictError('Selected branch is not an active session head.');
    const folder = resolutionFolder(id);
    await this.ensureFolders([snapshotRoot(id), folder]);
    const payload: BranchResolutionPayload = { format: 'learnharness-session-branch-resolution', schemaVersion: 1, sessionId: id, resolutionId: randomId(), createdAt: new Date().toISOString(), resolvedHeads: heads.map(head => head.snapshotId).sort(), selectedSnapshotId };
    const path = `${folder}/resolution-${payload.resolutionId}.md`;
    const text = utilityMarkdown(`Session branch selection: ${id}`, payload);
    await this.vault.create(path, text);
    if (await this.vault.read(path) !== text) throw new SessionConflictError('Branch selection acknowledgement failed');
    return structuredClone(heads.find(head => head.snapshotId === selectedSnapshotId)!.envelope);
  }
  /** Explicitly recover from malformed Markdown/legacy JSON only when one
   * acknowledged valid branch is available. Damaged files remain untouched. */
  async recover(id: string): Promise<SessionEnvelope> {
    const paths = await this.vault.listFiles();
    const { snapshots, malformed } = await this.readSnapshots(id, true);
    const legacyPath = sessionPath(id);
    let legacyRaw: string | null = null;
    let legacyError: unknown;
    if (await this.vault.exists(legacyPath)) {
      legacyRaw = await this.vault.read(legacyPath);
      try {
        const legacy = validateEnvelope(JSON.parse(legacyRaw), id);
        if (!snapshots.length) {
          const migrated = await this.appendSnapshot(legacy, null);
          return structuredClone(migrated.envelope);
        }
      } catch (error) { legacyError = error; }
    }
    if (malformed.length) {
      const parents = new Set(snapshots.flatMap(snapshot => snapshot.parentSnapshotId ? [snapshot.parentSnapshotId] : []));
      const validLeaves = snapshots.filter(snapshot => !parents.has(snapshot.snapshotId));
      if (validLeaves.length !== 1) throw new SessionConflictError('Cannot recover malformed Markdown: there is not exactly one acknowledged valid branch. Damaged files remain unchanged.');
      const valid = validLeaves[0]!;
      const folder = recoveryFolder(id);
      await this.ensureFolders([snapshotRoot(id), folder]);
      for (const path of malformed) await this.writeIncident(id, path, await this.vault.read(path));
      const recoveryId = randomId();
      const payload: RecoveryPayload = { format: 'learnharness-session-recovery', schemaVersion: 1, sessionId: id, recoveryId, createdAt: new Date().toISOString(), ignoredSnapshotPaths: malformed };
      const note = `${folder}/recovery-${recoveryId}.md`;
      const text = utilityMarkdown(`Recovery record: ${id}`, payload);
      await this.vault.create(note, text);
      if (await this.vault.read(note) !== text) throw new SessionConflictError('Recovery acknowledgement failed');
      return structuredClone(valid.envelope);
    }
    if (snapshots.length) return this.load(id);
    if (legacyRaw !== null && legacyError) {
      const backupFolder = legacyBackupFolder(id);
      const backups = paths.filter(path => path.startsWith(`${backupFolder}/`) && /\/revision-\d+\.json$/.test(path)).sort((a, b) => Number(b.match(/revision-(\d+)/)![1]) - Number(a.match(/revision-(\d+)/)![1]));
      for (const backup of backups) {
        try {
          const candidate = validateEnvelope(JSON.parse(await this.vault.read(backup)), id);
          await this.writeIncident(id, legacyPath, legacyRaw);
          const migrated = await this.appendSnapshot(candidate, null);
          return structuredClone(migrated.envelope);
        } catch (error) {
          if (error instanceof SessionFormatError && /future|differs|unsupported/.test(error.message)) throw error;
        }
      }
      throw new SessionFormatError(`Cannot recover legacy session ${id}; corrupted JSON remains unchanged`, { cause: legacyError });
    }
    return this.load(id);
  }
  async listBranchesForAllSessions(): Promise<ListedSessionBranch[]> {
    const paths = await this.vault.listFiles();
    const ids = new Set<string>();
    const prefix = `${SESSION_FOLDER}/`;
    const backupsPrefix = 'LearnHarness/SessionBackups/';
    for (const path of paths) {
      const relative = path.slice(prefix.length);
      const markdown = relative.match(/^([A-Za-z0-9_-]{1,100})\/revision-\d+-[A-Za-z0-9_-]+\.md$/);
      const legacy = relative.match(/^([A-Za-z0-9_-]{1,100})\.json$/);
      const backup = path.startsWith(backupsPrefix) ? path.slice(backupsPrefix.length).match(/^([A-Za-z0-9_-]{1,100})\/revision-\d+\.json$/) : null;
      if (markdown?.[1]) ids.add(markdown[1]);
      if (legacy?.[1]) ids.add(legacy[1]);
      if (backup?.[1]) ids.add(backup[1]);
    }
    const rows: ListedSessionBranch[] = [];
    for (const sessionId of ids) {
      const branches = await this.listBranches(sessionId);
      for (const branch of branches) rows.push({ ...branch, sessionId, branchCount: branches.length });
    }
    return rows.sort((a, b) => b.envelope.record.updatedAt.localeCompare(a.envelope.record.updatedAt));
  }
  async list(): Promise<SessionEnvelope[]> {
    return (await this.listBranchesForAllSessions()).map(branch => branch.envelope);
  }
}
