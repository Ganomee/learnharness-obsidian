import { PluginSettingTab, SecretComponent, Setting, type App } from 'obsidian';
import type LearnHarnessLab from './main';

export const DEFAULT_PROVIDER_SECRET_ID = 'learnharness-deepseek';

export interface LearnHarnessSettings {
  deepSeekSecretId: string;
}

export const DEFAULT_SETTINGS: LearnHarnessSettings = {
  deepSeekSecretId: DEFAULT_PROVIDER_SECRET_ID,
};

/** Persist only the Obsidian SecretStorage reference, never the API key. */
export class LearnHarnessSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: LearnHarnessLab) { super(app, plugin); }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'LearnHarness' });
    containerEl.createEl('p', {
      text: 'Connect the live teacher once. Obsidian stores the key in SecretStorage; session notes and synced Markdown contain no key.',
    });
    new Setting(containerEl)
      .setName('DeepSeek API key')
      .setDesc('Select an existing secret or create one. The plugin stores only its SecretStorage name.')
      .addComponent(el => new SecretComponent(this.app, el)
        .setValue(this.plugin.settings.deepSeekSecretId)
        .onChange(value => { void this.plugin.setDeepSeekSecretId(value ?? ''); }));
  }
}
