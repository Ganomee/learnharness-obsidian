import { Notice, Plugin, TFile, TFolder } from 'obsidian';
import { runRuntimeProof } from './runtime-proof';
import { isDisposableVault } from './adapters/sandbox-marker.mjs';
import { SessionController, type SessionVault } from './session-controller';
import { LearningView, LEARNING_VIEW } from './ui/learning-view';
import { GlobalGraphView, GLOBAL_GRAPH_VIEW } from './ui/global-graph-view';
import { DEFAULT_SETTINGS, LearnHarnessSettingsTab, type LearnHarnessSettings } from './provider-settings';

const SANDBOX_MARKER = '00 Start/Working agreement.md';
const REPORT_FOLDER = '95 Runtime proofs';

/** Development shell only. The original upstream agent runs inside runRuntimeProof. */
export default class LearnHarnessLab extends Plugin {
  private running = false;
  private disposed = false;
  private controller?: SessionController;
  settings: LearnHarnessSettings = { ...DEFAULT_SETTINGS };
  private settingsReady: Promise<void> = Promise.resolve();

  onload(): void {
    this.disposed = false;
    this.settingsReady = this.loadData()
      .then((saved: Partial<LearnHarnessSettings> | null) => { this.settings = { ...DEFAULT_SETTINGS, ...saved }; })
      .catch((error: unknown) => {
        console.error('LearnHarness settings could not be loaded', error);
        new Notice('LearnHarness settings could not be loaded. Configure the provider key again in plugin settings.', 10000);
      });
    this.addSettingTab(new LearnHarnessSettingsTab(this.app, this));
    this.registerView(LEARNING_VIEW, leaf => new LearningView(leaf, this.sessionController(), () => this.getDeepSeekApiKey(), () => this.getDeepgramApiKey()));
    this.registerView(GLOBAL_GRAPH_VIEW, leaf => new GlobalGraphView(leaf));
    this.registerHoverLinkSource(GLOBAL_GRAPH_VIEW, { display: 'LearnHarness Lab', defaultMod: false });
    this.addCommand({ id: 'open-learning', name: 'Open learning workspace', callback: () => { void this.openLearning(); } });
    this.addCommand({ id: 'open-knowledge-graph', name: 'Open global knowledge graph', callback: () => { void this.openKnowledgeGraph(); } });
    this.addRibbonIcon('graduation-cap', 'Open LearnHarness', () => { void this.openLearning(); });
    this.addRibbonIcon('git-fork', 'Open global knowledge graph', () => { void this.openKnowledgeGraph(); });
    this.addCommand({
      id: 'run-offline-runtime-proof',
      name: 'Run offline runtime proof',
      callback: () => { void this.runProof(); },
    });
  }

  onunload(): void { this.disposed = true; this.controller?.dispose(); }

  async setDeepSeekSecretId(value: string): Promise<void> {
    const next = { ...this.settings, deepSeekSecretId: value };
    await this.saveData(next);
    this.settings = next;
  }

  async setDeepgramSecretId(value: string): Promise<void> {
    const next = { ...this.settings, deepgramSecretId: value };
    await this.saveData(next);
    this.settings = next;
  }

  getDeepSeekApiKey(): string | null {
    if (!this.settings.deepSeekSecretId) return null;
    return this.app.secretStorage.getSecret(this.settings.deepSeekSecretId);
  }

  getDeepgramApiKey(): string | null {
    if (!this.settings.deepgramSecretId) return null;
    return this.app.secretStorage.getSecret(this.settings.deepgramSecretId);
  }

  private sessionController(): SessionController {
    if (this.controller) return this.controller;
    const file = (path: string): TFile => {
      const value = this.app.vault.getAbstractFileByPath(path);
      if (!(value instanceof TFile)) throw new Error(`Session file is missing: ${path}`);
      return value;
    };
    const vault: SessionVault = {
      exists: async path => this.app.vault.getAbstractFileByPath(path) !== null,
      mkdir: async path => {
        const existing = this.app.vault.getAbstractFileByPath(path);
        if (!existing) await this.app.vault.createFolder(path);
        else if (!(existing instanceof TFolder)) throw new Error(`Folder path is occupied: ${path}`);
      },
      read: async path => this.app.vault.read(file(path)),
      create: async (path, content) => { await this.app.vault.create(path, content); },
      modify: async (path, content) => { await this.app.vault.modify(file(path), content); },
      listFiles: async () => this.app.vault.getFiles().map(entry => entry.path),
    };
    this.controller = new SessionController(vault);
    return this.controller;
  }

  private async openLearning(): Promise<void> {
    try {
      await this.settingsReady;
      const marker = this.app.vault.getAbstractFileByPath(SANDBOX_MARKER);
      if (!(marker instanceof TFile) || !isDisposableVault(await this.app.vault.read(marker))) throw new Error('Use this preview in the marked disposable LearnHarness vault.');
      const existing = this.app.workspace.getLeavesOfType(LEARNING_VIEW)[0];
      const leaf = existing ?? this.app.workspace.getLeaf('tab');
      if (!existing) await leaf.setViewState({ type: LEARNING_VIEW, active: true });
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error), 10000);
    }
  }

  private async openKnowledgeGraph(): Promise<void> {
    try {
      const marker = this.app.vault.getAbstractFileByPath(SANDBOX_MARKER);
      if (!(marker instanceof TFile) || !isDisposableVault(await this.app.vault.read(marker))) throw new Error('Use this preview in the marked disposable LearnHarness vault.');
      const existing = this.app.workspace.getLeavesOfType(GLOBAL_GRAPH_VIEW)[0];
      const leaf = existing ?? this.app.workspace.getLeaf('tab');
      if (!existing) await leaf.setViewState({ type: GLOBAL_GRAPH_VIEW, active: true });
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) { new Notice(error instanceof Error ? error.message : String(error), 10000); }
  }

  private async runProof(): Promise<void> {
    if (this.running) { new Notice('The offline runtime proof is already running.'); return; }
    this.running = true;
    try {
      const marker = this.app.vault.getAbstractFileByPath(SANDBOX_MARKER);
      if (!(marker instanceof TFile) || !isDisposableVault(await this.app.vault.read(marker))) {
        throw new Error('Run this development proof only in the marked disposable LearnHarness vault.');
      }
      const report = await runRuntimeProof();
      if (this.disposed) return;
      const existing = this.app.vault.getAbstractFileByPath(REPORT_FOLDER);
      if (!existing) await this.app.vault.createFolder(REPORT_FOLDER);
      else if (!(existing instanceof TFolder)) throw new Error('The runtime report folder path is occupied by a file.');
      if (this.disposed) return;
      const timestamp = new Date().toISOString();
      const filename = `${REPORT_FOLDER}/${timestamp.replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}.md`;
      const body = [
        '---', 'type: runtime-proof', 'demo: true', `created: "${timestamp}"`, '---',
        '# LearnHarness offline runtime proof', '',
        'Executed inside Obsidian using an injected scripted model. No live provider or adaptive learner session is connected.', '',
        'This report is diagnostic evidence, not a resumable learning session. Physical mobile and full server orchestration remain unverified.', '',
        '```json', JSON.stringify(report, null, 2), '```', '', '[[Home]]', '',
      ].join('\n');
      const file = await this.app.vault.create(filename, body);
      // A success notice follows the actual Vault write/read acknowledgement.
      if (await this.app.vault.read(file) !== body) throw new Error('Vault report read-back differs from the saved content.');
      if (this.disposed) return;
      await this.app.workspace.getLeaf(false).openFile(file);
      new Notice('Offline runtime proof completed; the report was saved and read back through the Vault API.');
    } catch (error) {
      console.error('LearnHarness offline runtime proof failed', error);
      if (!this.disposed) new Notice(`Offline runtime proof failed: ${error instanceof Error ? error.message : String(error)}`, 10000);
    } finally {
      this.running = false;
    }
  }
}
