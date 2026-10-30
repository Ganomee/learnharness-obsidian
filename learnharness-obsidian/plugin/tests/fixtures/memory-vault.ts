export class MemoryVault {
  files = new Map<string, string>(); folders = new Set<string>();
  modifications = 0; failModifyAt = -1; partialModifyAt = -1;
  creations = 0; failCreateAt = -1; partialCreateAt = -1;
  beforeModify?: (path: string, text: string, count: number) => Promise<void>;
  beforeCreate?: (path: string, text: string, count: number) => Promise<void>;
  async exists(path: string) { return this.files.has(path) || this.folders.has(path); }
  async mkdir(path: string) { this.folders.add(path); }
  async read(path: string) { if (!this.files.has(path)) throw new Error('Missing file'); return this.files.get(path)!; }
  async create(path: string, text: string) {
    this.creations++; await this.beforeCreate?.(path, text, this.creations);
    if (this.files.has(path)) throw new Error('Already exists');
    if (this.creations === this.partialCreateAt) { this.files.set(path, text.slice(0, 27)); throw new Error('Injected partial Vault create failure'); }
    if (this.creations === this.failCreateAt) throw new Error('Injected Vault create failure');
    this.files.set(path, text);
  }
  async modify(path: string, text: string) { this.modifications++; await this.beforeModify?.(path, text, this.modifications); if (this.modifications === this.partialModifyAt) { this.files.set(path, text.slice(0, 27)); throw new Error('Injected partial Vault write failure'); } if (this.modifications === this.failModifyAt) throw new Error('Injected Vault write failure'); this.files.set(path, text); }
  async listFiles() { return [...this.files.keys()]; }
}

export function snapshotState(markdown: string): any {
  const match = markdown.match(/<!-- learnharness:canonical-state:start -->\s*(`{3,})json\s*\n([\s\S]*?)\n\1\s*\n<!-- learnharness:canonical-state:end -->/);
  if (!match) throw new Error('Missing canonical Markdown state block');
  return JSON.parse(match[2]!);
}

export function snapshotRows(vault: MemoryVault, sessionId?: string): Array<{ path: string; state: any }> {
  return [...vault.files.entries()]
    .filter(([path]) => path.startsWith(`LearnHarness/Sessions/${sessionId ? `${sessionId}/` : ''}`) && path.endsWith('.md') && /\/revision-\d+-/.test(path))
    .flatMap(([path, markdown]) => {
      try { return [{ path, state: snapshotState(markdown) }]; }
      catch { return []; } // Damaged snapshots remain in the vault but are not valid rows.
    });
}

export function latestSnapshotEnvelope(vault: MemoryVault, sessionId: string): any {
  const rows = snapshotRows(vault, sessionId).sort((a, b) => a.state.envelope.revision - b.state.envelope.revision || a.state.createdAt.localeCompare(b.state.createdAt));
  if (!rows.length) throw new Error(`No Markdown snapshots for ${sessionId}`);
  return rows[rows.length - 1]!.state.envelope;
}

export function latestSessionEnvelope(vault: MemoryVault): any {
  const rows = snapshotRows(vault).sort((a, b) => a.state.envelope.revision - b.state.envelope.revision || a.state.createdAt.localeCompare(b.state.createdAt));
  if (!rows.length) throw new Error('No Markdown session snapshots');
  return rows[rows.length - 1]!.state.envelope;
}
