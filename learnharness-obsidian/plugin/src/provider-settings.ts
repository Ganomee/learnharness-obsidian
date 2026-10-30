import { PluginSettingTab, SecretComponent, Setting, type App } from 'obsidian';
import type LearnHarnessLab from './main';

export const DEFAULT_PROVIDER_SECRET_ID = 'learnharness-deepseek';
export const DEFAULT_TRANSCRIPTION_SECRET_ID = 'learnharness-deepgram';

export interface LearnHarnessSettings {
  deepSeekSecretId: string;
  deepgramSecretId: string;
}

export const DEFAULT_SETTINGS: LearnHarnessSettings = {
  deepSeekSecretId: DEFAULT_PROVIDER_SECRET_ID,
  deepgramSecretId: DEFAULT_TRANSCRIPTION_SECRET_ID,
};

/** Persist only the Obsidian SecretStorage reference, never the API key. */
export class LearnHarnessSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: LearnHarnessLab) { super(app, plugin); }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'LearnHarness' });
    containerEl.createEl('p', {
      text: 'These are separate services: the teacher model writes questions and evaluates your answers; speech recognition turns your microphone audio into editable text. Each service has its own SecretStorage key. Session notes and synced Markdown never contain either key.',
    });
    new Setting(containerEl)
      .setName('Teacher · DeepSeek text model')
      .setDesc('Creates the adaptive lesson, questions, explanations, and answer evaluation. Select a saved key or create one; only its SecretStorage name is kept in plugin settings.')
      .addComponent(el => new SecretComponent(this.app, el)
        .setValue(this.plugin.settings.deepSeekSecretId)
        .onChange(value => { void this.plugin.setDeepSeekSecretId(value ?? ''); }));
    new Setting(containerEl)
      .setName('Speech to text · Deepgram')
      .setDesc('Transcribes your spoken goal and answers. It does not generate teacher responses. Select a separate saved key or create one. Microphone audio is streamed only while speech is detected; session notes keep the transcript, not raw audio.')
      .addComponent(el => new SecretComponent(this.app, el)
        .setValue(this.plugin.settings.deepgramSecretId)
        .onChange(value => { void this.plugin.setDeepgramSecretId(value ?? ''); }));
  }
}
