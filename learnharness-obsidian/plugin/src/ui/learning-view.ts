import { ItemView, requestUrl, type WorkspaceLeaf } from 'obsidian';
import { SessionController, type SessionView, type AnswerRequest, type SessionEngine } from '../session-controller';
import { createDeepSeekEngine, createObsidianFetch } from '../adapters/deepseek-engine';
import { createDemoEngine } from '../adapters/demo-engine';
import { matchSpokenChoice, startSpeechCapture, type SpeechCapture, type SpeechWindow } from './speech-input';
import { userFacingTextOf } from '../../../upstream/learnharness/src/core/native-messages.ts';

export const LEARNING_VIEW = 'learnharness-learning';
const DEMO_GOAL = 'Understand how to combine success rates across groups of different sizes';

/** Obsidian-native elements and Vault-backed state; no desktop or filesystem API. */
export class LearningView extends ItemView {
  private session?: SessionView;
  private sessions: SessionView[] = [];
  private mode: 'demo' | 'deepseek' = 'deepseek';
  private goal = '';
  private error = '';
  private busy = false;
  private closed = false;
  private active?: AbortController;
  private statusEl?: HTMLElement;
  private recoveryId = '';
  private speechCapture?: SpeechCapture;

  constructor(leaf: WorkspaceLeaf, private readonly controller: SessionController, private readonly getApiKey: () => string | null) { super(leaf); }
  getViewType(): string { return LEARNING_VIEW; }
  getDisplayText(): string { return 'LearnHarness'; }
  getIcon(): string { return 'graduation-cap'; }
  getState(): Record<string, unknown> { return { sessionId: this.session?.id }; }
  async setState(state: { sessionId?: string }): Promise<void> {
    if (state?.sessionId) {
      this.recoveryId = state.sessionId;
      try { this.session = await this.controller.loadSession(state.sessionId); this.mode = this.session.providerMode; }
      catch (error) { this.error = this.message(error); }
    }
    if (!this.closed) this.render();
  }
  async onOpen(): Promise<void> {
    this.closed = false;
    try { this.sessions = await this.controller.listSessions(); } catch (error) { this.error = this.message(error); }
    this.render();
  }
  async onClose(): Promise<void> { this.closed = true; this.active?.abort(); this.speechCapture?.stop(); this.speechCapture = undefined; }

  private message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
  private engine(): SessionEngine {
    if (this.mode === 'demo') return createDemoEngine();
    const apiKey = this.getApiKey()?.trim();
    if (!apiKey) throw new Error('No DeepSeek key is selected. Open Settings → Community plugins → LearnHarness Lab and select or create one in SecretStorage.');
    const transport = createObsidianFetch(requestUrl);
    return budget => createDeepSeekEngine(apiKey, transport, budget);
  }
  private button(parent: HTMLElement, label: string, action: () => void, primary = false): HTMLButtonElement {
    const actionId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const button = parent.createEl('button', { text: label, cls: primary ? 'mod-cta' : '', attr: { 'data-lh-action': actionId } });
    button.disabled = this.busy;
    button.addEventListener('click', action);
    return button;
  }
  private async perform(action: (signal: AbortSignal) => Promise<SessionView>): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.error = ''; this.active = new AbortController(); this.render();
    try {
      this.session = await action(this.active.signal);
      this.sessions = await this.controller.listSessions();
      this.mode = this.session.providerMode;
    } catch (error) {
      this.error = this.message(error);
      try { this.sessions = await this.controller.listSessions(); } catch { /* preserve the actionable read error */ }
      if (this.session) {
        try { this.session = await this.controller.loadSession(this.session.id); } catch { /* retain visible error and last view */ }
      }
    } finally {
      this.busy = false; this.active = undefined;
      if (!this.closed) this.render();
    }
  }
  private options(signal: AbortSignal) {
    return { signal, providerMode: this.mode, onEvent: () => { if (this.statusEl) this.statusEl.textContent = 'Original agent is running…'; } };
  }

  private addVoiceInput(parent: HTMLElement, field: HTMLTextAreaElement, label = 'Speak') {
    const row = parent.createDiv({ cls: 'lh-speech-row' });
    const button = row.createEl('button', { text: label, attr: { type: 'button', 'aria-label': label } });
    const status = row.createSpan({ cls: 'lh-dictation-status', text: 'Speak freely; review the transcript before sending.' });
    button.disabled = this.busy;
    button.addEventListener('click', () => {
      if (this.speechCapture) { this.speechCapture.stop(); return; }
      const capture = startSpeechCapture(window as SpeechWindow, {
        result: transcript => {
          field.value = [field.value.trim(), transcript].filter(Boolean).join(field.value.trim() ? '\n' : '');
          field.dispatchEvent(new Event('input', { bubbles: true }));
          status.setText(`Heard: “${transcript}” — review it, then send.`);
        },
        error: message => { status.setText(message); button.setText(label); this.speechCapture = undefined; },
        end: () => { button.setText(label); this.speechCapture = undefined; },
      });
      if (!capture) { status.setText('Speech input is unavailable here; type your response instead.'); return; }
      this.speechCapture = capture; button.setText('Listening…'); status.setText('Listening. Speak, then review the transcript.');
    });
  }

  private render(): void {
    if (this.error.startsWith('No DeepSeek key is selected.') && this.getApiKey()?.trim()) this.error = '';
    const root = this.contentEl;
    root.empty(); root.addClass('lh-learning'); root.setAttribute('data-lh-testid', 'learning-view');
    const header = root.createDiv({ cls: 'lh-header' });
    header.createEl('h2', { text: 'LearnHarness' });
    header.createEl('p', { text: 'Interactive preview · original probing agent', cls: 'lh-muted' });
    root.createEl('p', { text: 'Probe your understanding, answer questions, and follow the original teacher’s plan.', cls: 'lh-muted' });
    if (this.error) root.createDiv({ text: this.error, cls: 'lh-error', attr: { role: 'alert' } });
    if (this.error) {
      const details = root.createEl('details'); details.createEl('summary', { text: 'Recover a damaged session file' });
      details.createEl('p', { text: 'Restores the latest intact previous snapshot only if the current JSON is broken. Damaged bytes are retained. Future schemas and migration conflicts are never overwritten.', cls: 'lh-muted' });
      const id = details.createEl('input', { type: 'text', attr: { 'aria-label': 'Session ID to recover', placeholder: 'lh_…' } });
      id.value = this.session?.id ?? this.recoveryId;
      this.button(details, 'Recover previous saved revision', () => {
        this.recoveryId = id.value.trim();
        void this.perform(async () => this.controller.recoverSession(this.recoveryId));
      });
    }

    const controls = root.createDiv({ cls: 'lh-controls' });
    const label = controls.createEl('label', { text: 'Learning mode' });
    const mode = label.createEl('select', { attr: { 'aria-label': 'Learning mode', 'data-lh-testid': 'learning-mode' } });
    mode.createEl('option', { text: 'Adaptive LearnHarness teacher · DeepSeek', value: 'deepseek' });
    mode.createEl('option', { text: 'Fixed scripted demo · offline', value: 'demo' });
    mode.value = this.mode; mode.disabled = this.busy || !!this.session;
    mode.addEventListener('change', () => { this.mode = mode.value as typeof this.mode; this.render(); });
    if (this.mode === 'deepseek') {
      const connected = !!this.getApiKey()?.trim();
      controls.createEl('p', {
        text: connected
          ? 'Live teacher connected. The original LearnHarness prober and teacher adapt to your answers and reasoning. Your key is selected from Obsidian SecretStorage; it is not copied into session notes.'
          : 'This is the real adaptive teacher path. First select or create your DeepSeek key once in Settings → Community plugins → LearnHarness Lab. The key is read from Obsidian SecretStorage, not from session notes.',
        cls: connected ? 'lh-provider-ready' : 'lh-muted',
      });
    } else controls.createEl('p', { text: 'A fixed, offline walkthrough for checking the plugin UI. It does not adapt the lesson to your answers.', cls: 'lh-muted' });

    const resume = controls.createEl('label', { text: 'Saved sessions' });
    const picker = resume.createEl('select', { attr: { 'aria-label': 'Saved sessions', 'data-lh-testid': 'saved-sessions' } });
    picker.createEl('option', { value: '', text: 'Choose a saved session…' });
    const optionValue = (saved: SessionView) => saved.branchConflict && saved.branchSnapshotId ? `${saved.id}::${saved.branchSnapshotId}` : saved.id;
    const conflictedSessions = [...new Set(this.sessions.filter(saved => saved.branchConflict).map(saved => saved.id))];
    if (conflictedSessions.length) controls.createDiv({
      text: `${conflictedSessions.length} saved session${conflictedSessions.length === 1 ? ' has' : 's have'} concurrent edits from Vault sync. Select a branch explicitly; both copies are preserved.`,
      cls: 'lh-error', attr: { role: 'status', 'data-lh-testid': 'session-sync-conflict' },
    });
    for (const saved of this.sessions) {
      const branchLabel = saved.branchConflict ? ` · branch r${saved.revision} · ${saved.branchSnapshotId!.slice(0, 8)}` : '';
      picker.createEl('option', { value: optionValue(saved), text: `${saved.providerMode === 'demo' ? 'Demo' : 'Flash'} · ${saved.record.title}${branchLabel}` });
    }
    picker.value = this.session?.id ?? ''; picker.disabled = this.busy;
    picker.addEventListener('change', () => {
      if (!picker.value) return;
      const selected = this.sessions.find(saved => optionValue(saved) === picker.value);
      if (!selected) return;
      void this.perform(async () => selected.branchConflict && selected.branchSnapshotId
        ? this.controller.resolveSessionBranch(selected.id, selected.branchSnapshotId)
        : this.controller.loadSession(selected.id));
    });
    this.button(controls, 'New session · choose teacher', () => { this.session = undefined; this.goal = ''; this.error = ''; this.mode = 'deepseek'; this.render(); });

    if (!this.session) {
      if (this.mode === 'demo') {
        const lesson = root.createDiv({ cls: 'lh-lesson' });
        lesson.createDiv({ text: 'GUIDED OFFLINE LESSON', cls: 'lh-eyebrow' });
        lesson.createEl('h3', { text: 'Why averaging two rates can mislead' });
        lesson.createEl('p', { text: 'Work through a realistic 2-attempt group and a 10-attempt group. The original LearnHarness prober and teacher will assess your answer, create a two-step plan, ask for a prediction, explain the result, and check transfer.' });
        const outcomes = lesson.createEl('ul');
        outcomes.createEl('li', { text: 'Explain why group size changes each rate’s contribution.' });
        outcomes.createEl('li', { text: 'Combine counts before converting back to a rate.' });
        lesson.createDiv({ text: 'About 4 minutes · Offline · Saves in this vault · No API key', cls: 'lh-lesson-meta' });
      } else {
        const goalLabel = root.createEl('label', { text: 'What do you want to understand?' });
        const goal = goalLabel.createEl('textarea', { attr: { rows: '4', placeholder: 'Say it in your own words. Include what you already think, what is confusing, and what you want to be able to do.', 'aria-label': 'Learning goal' } });
        goal.value = this.goal; goal.disabled = this.busy;
        goal.addEventListener('input', () => { this.goal = goal.value; });
        this.addVoiceInput(root, goal, 'Speak your goal');
      }
      this.button(root, this.mode === 'demo' ? 'Start offline walkthrough' : 'Start with the adaptive teacher', () => {
        const requestedGoal = this.mode === 'demo' ? DEMO_GOAL : this.goal.trim();
        if (!requestedGoal) { this.error = 'Enter a learning goal first.'; this.render(); return; }
        let engine;
        try { engine = this.engine(); } catch (error) { this.error = this.message(error); this.render(); return; }
        void this.perform(signal => this.controller.createSession(requestedGoal, engine, this.options(signal)));
      }, true);
    } else {
      root.createEl('h3', { text: this.session.record.title });
      if (this.session.providerMode === 'deepseek') {
        const spent = this.session.providerBudget.spentMicros / 1_000_000;
        const reserved = this.session.providerBudget.reservations.reduce((sum, item) => sum + item.maxCostMicros, 0) / 1_000_000;
        root.createDiv({ text: `Provider spend: $${spent.toFixed(4)} spent, $${reserved.toFixed(4)} reserved, $10.00 limit`, cls: 'lh-muted' });
      }
      const progress = this.demoProgress(this.session);
      if (this.session.providerMode === 'demo') {
        const progressCard = root.createDiv({ cls: 'lh-progress' });
        progressCard.createDiv({ text: 'LESSON PROGRESS', cls: 'lh-eyebrow' });
        progressCard.createDiv({ text: `${progress.done} of ${progress.steps.length} milestones`, cls: 'lh-progress-count' });
        const progressList = progressCard.createEl('ol');
        progress.steps.forEach((step, index) => {
          const item = progressList.createEl('li', { cls: index < progress.done ? 'is-done' : index === progress.done ? 'is-current' : '' });
          item.createSpan({ text: step });
        });
      }
      root.createEl('p', { text: `Saved revision ${this.session.revision} · ${this.session.status}`, cls: 'lh-muted' });
      const transcript = root.createDiv({ cls: 'lh-transcript', attr: { 'aria-label': 'Learning conversation' } });
      for (const message of this.session.record.messages as any[]) {
        if (message.role === 'user') {
          const text = typeof message.content === 'string' ? message.content : message.content?.filter((part: any) => part.type === 'text').map((part: any) => part.text).join('\n');
          if (text) this.bubble(transcript, 'You', text);
        } else if (message.role === 'assistant') {
          const text = userFacingTextOf(message.content).join('\n\n');
          if (text) this.bubble(transcript, 'LearnHarness', text);
        } else if (message.role === 'toolResult' && message.details?.kind && !message.isError) {
          const answer = message.details;
          const text = [answer.questionText, answer.dontKnow ? 'I don’t know' : answer.text ?? answer.answers?.map((item: any) => item.label).join(', '), answer.thinking ? `My reasoning: ${answer.thinking}` : '', answer.correct === undefined ? '' : answer.correct ? 'Correct' : 'Not yet correct', answer.explanation ?? ''].filter(Boolean).join('\n\n');
          this.bubble(transcript, 'Saved answer', text);
        }
      }
      const tree = (this.session.record as any).tree;
      if (tree?.nodes?.length) this.renderPlan(root, tree);
      if (progress.complete) {
        const finish = root.createDiv({ cls: 'lh-complete', attr: { role: 'status' } });
        finish.createDiv({ text: 'LESSON COMPLETE', cls: 'lh-eyebrow' });
        finish.createEl('h3', { text: 'You combined the counts, then checked the idea in a new example.' });
        finish.createEl('p', { text: 'Your transcript, answers, reasoning, confidence, and teacher plan are saved in this vault. Open the linked lesson notes for a worked reference or start a fresh session.' });
        this.button(finish, 'Open the lesson notes', () => { void this.app.workspace.openLinkText('20 Sessions/DEMO-001 - Why averages can mislead', '', false); });
        this.button(finish, 'Start a real adaptive lesson', () => { this.session = undefined; this.goal = ''; this.error = ''; this.mode = 'deepseek'; this.render(); }, true);
      }
      if (this.session.needsTeacher) root.createDiv({ text: 'The assessment is saved. Continue to resume original teacher planning.', cls: 'lh-note' });
      if (!progress.complete && this.session.question && this.session.pending) this.renderQuestion(root, this.session);
      else if (!progress.complete) {
        const text = root.createEl('textarea', { attr: { rows: '3', placeholder: 'Continue, or describe what is still unclear', 'aria-label': 'Continue learning' } });
        text.disabled = this.busy;
        this.addVoiceInput(root, text, 'Speak a follow-up');
        this.button(root, this.mode === 'demo' ? 'Continue scripted demo' : 'Send to Flash', () => {
          let engine;
          try { engine = this.engine(); } catch (error) { this.error = this.message(error); this.render(); return; }
          const id = this.session!.id; const content = text.value;
          void this.perform(signal => this.controller.continueSession(id, content, engine, this.options(signal)));
        }, true);
      }
    }
    this.statusEl = root.createDiv({ cls: 'lh-status', text: this.busy ? 'Running original agent…' : 'Ready. Sessions are stored in this vault.', attr: { 'data-lh-testid': 'session-status', 'aria-live': 'polite' } });
    if (this.busy) {
      const cancel = root.createEl('button', { text: 'Stop waiting' });
      cancel.addEventListener('click', () => this.active?.abort());
      if (this.mode === 'deepseek') root.createEl('p', { text: 'Stopping discards late results locally. A provider request already sent may still complete and be billed.', cls: 'lh-muted' });
    }
  }

  private bubble(parent: HTMLElement, author: string, text: string): void {
    const bubble = parent.createDiv({ cls: 'lh-message' });
    bubble.createEl('strong', { text: author }); bubble.createDiv({ text, cls: 'lh-message-text' });
  }
  private demoProgress(session: SessionView): { done: number; complete: boolean; steps: string[] } {
    const messages = session.record.messages as any[];
    const calls = messages.flatMap(message => message.role === 'assistant'
      ? (message.content ?? []).filter((part: any) => part.type === 'toolCall' && part.name === 'quiz')
      : []);
    const answered = (call: any) => messages.some(message => message.role === 'toolResult'
      && message.toolName === 'quiz' && message.toolCallId === call.id && message.details?.kind);
    const probe = messages.some(message => message.role === 'toolResult' && message.toolName === 'probe' && message.details?.kind);
    const prediction = calls.find((call: any) => call.arguments?.type === 'predict');
    const check = calls.find((call: any) => call.arguments?.type === 'check');
    const complete = session.providerMode === 'demo' && !!check && answered(check);
    const flags = [probe, !!(session.record as any).tree, !!prediction && answered(prediction), complete];
    const steps = ['Share your starting idea', 'Review the teacher’s two-step plan', 'Make a prediction', 'Check the idea in a new example'];
    return { done: flags.filter(Boolean).length, complete, steps };
  }
  private renderPlan(root: HTMLElement, tree: { nodes: Array<{ id: string; title: string; summary?: string }>; edges: Array<{ from: string; to: string }> }): void {
    const card = root.createDiv({ cls: 'lh-plan' });
    card.createEl('h3', { text: 'Teacher plan · prerequisite graph' });
    const titles = new Map(tree.nodes.map(node => [node.id, node.title]));
    const children = new Map(tree.nodes.map(node => [node.id, [] as string[]]));
    const depth = new Map(tree.nodes.map(node => [node.id, 0]));
    for (const edge of tree.edges) if (children.has(edge.from) && depth.has(edge.to)) children.get(edge.from)!.push(edge.to);
    // Assign columns by longest prerequisite path. The bounded iteration also
    // leaves malformed cycles visible instead of hanging the view renderer.
    for (let pass = 0; pass < tree.nodes.length; pass++) {
      let changed = false;
      for (const edge of tree.edges) {
        if (!depth.has(edge.from) || !depth.has(edge.to)) continue;
        const next = depth.get(edge.from)! + 1;
        if (next > depth.get(edge.to)!) { depth.set(edge.to, next); changed = true; }
      }
      if (!changed) break;
    }
    const columns = new Map<number, typeof tree.nodes>();
    for (const node of tree.nodes) {
      const column = depth.get(node.id) ?? 0;
      if (!columns.has(column)) columns.set(column, []);
      columns.get(column)!.push(node);
    }
    const orderedColumns = [...columns.keys()].sort((a, b) => a - b);
    const colIndex = new Map(orderedColumns.map((column, index) => [column, index]));
    const maxRows = Math.max(1, ...[...columns.values()].map(nodes => nodes.length));
    const width = Math.max(260, orderedColumns.length * 230 + 20);
    const height = maxRows * 112 + 32;
    const positions = new Map<string, { x: number; y: number }>();
    for (const [column, nodes] of columns) {
      const x = (colIndex.get(column) ?? 0) * 230 + 12;
      const startY = (height - nodes.length * 92) / 2;
      nodes.forEach((node, index) => positions.set(node.id, { x, y: startY + index * 92 }));
    }
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Original teacher plan prerequisite graph');
    svg.classList.add('lh-plan-graph');
    const defs = document.createElementNS(svgNs, 'defs');
    const marker = document.createElementNS(svgNs, 'marker');
    marker.setAttribute('id', `lh-arrow-${this.session?.id ?? 'plan'}`);
    marker.setAttribute('viewBox', '0 0 10 10'); marker.setAttribute('refX', '9'); marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7'); marker.setAttribute('markerHeight', '7'); marker.setAttribute('orient', 'auto-start-reverse');
    const arrow = document.createElementNS(svgNs, 'path'); arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z'); arrow.classList.add('lh-plan-arrow');
    marker.appendChild(arrow); defs.appendChild(marker); svg.appendChild(defs);
    for (const edge of tree.edges) {
      const from = positions.get(edge.from), to = positions.get(edge.to);
      if (!from || !to) continue;
      const line = document.createElementNS(svgNs, 'path');
      line.setAttribute('d', `M ${from.x + 190} ${from.y + 36} C ${from.x + 214} ${from.y + 36}, ${to.x - 24} ${to.y + 36}, ${to.x - 8} ${to.y + 36}`);
      line.setAttribute('marker-end', `url(#lh-arrow-${this.session?.id ?? 'plan'})`); line.classList.add('lh-plan-edge'); svg.appendChild(line);
    }
    for (const node of tree.nodes) {
      const point = positions.get(node.id); if (!point) continue;
      const group = document.createElementNS(svgNs, 'g'); group.classList.add('lh-plan-node');
      const rect = document.createElementNS(svgNs, 'rect'); rect.setAttribute('x', `${point.x}`); rect.setAttribute('y', `${point.y}`); rect.setAttribute('width', '190'); rect.setAttribute('height', '72'); rect.setAttribute('rx', '12'); group.appendChild(rect);
      const lines = (node.title.match(/.{1,24}(?:\s|$)|\S+/g) ?? [node.title]).map(line => line.trim()).filter(Boolean).slice(0, 3);
      const text = document.createElementNS(svgNs, 'text'); text.setAttribute('x', `${point.x + 12}`); text.setAttribute('y', `${point.y + 28}`);
      lines.forEach((value, index) => { const span = document.createElementNS(svgNs, 'tspan'); span.setAttribute('x', `${point.x + 12}`); span.setAttribute('dy', index ? '18' : '0'); span.textContent = value; text.appendChild(span); });
      group.appendChild(text); svg.appendChild(group);
    }
    const scroller = card.createDiv({ cls: 'lh-plan-scroll' }); scroller.appendChild(svg);
    const details = card.createEl('details'); details.createEl('summary', { text: 'Read the plan as a list' });
    const list = details.createEl('ol');
    for (const node of tree.nodes) {
      const item = list.createEl('li'); item.createEl('strong', { text: node.title });
      if (node.summary) item.createEl('p', { text: node.summary });
      const prerequisites = tree.edges.filter(edge => edge.to === node.id).map(edge => titles.get(edge.from) ?? edge.from);
      if (prerequisites.length) item.createEl('small', { text: `Prerequisites: ${prerequisites.join(', ')}` });
    }
  }
  private renderQuestion(root: HTMLElement, session: SessionView): void {
    const question = session.question!;
    const input = session.pending?.input && typeof session.pending.input === 'object'
      ? session.pending.input as { type?: string }
      : {};
    const predicted = input.type === 'predict';
    const behindReveal = !!(session.record as any).tree && !predicted;
    const host = root.createDiv({ cls: behindReveal ? 'lh-question-gate' : '' });
    const reading = behindReveal ? host.createEl('textarea', {
      attr: { rows: '2', 'aria-label': 'Thinking while reading', placeholder: 'While reading the teacher’s explanation, what are you thinking? You can speak freely; this is optional.' },
    }) : undefined;
    if (reading) {
      reading.disabled = this.busy;
      this.addVoiceInput(host, reading, 'Speak while reading');
    }
    const reveal = behindReveal ? host.createEl('details', { cls: 'lh-check-reveal' }) : undefined;
    reveal?.createEl('summary', { text: question.kind === 'ask' ? 'Open the teacher’s question' : 'Check your understanding' });
    const card = (reveal ?? host).createDiv({ cls: 'lh-question' });
    card.createEl('h3', { text: question.question });
    if (question.context) card.createEl('p', { text: question.context });
    const selection = new Set<string>();
    for (const option of question.options) {
      const row = card.createEl('label', { cls: 'lh-option' });
      const input = row.createEl('input', { type: question.mode === 'multi-select' ? 'checkbox' : 'radio', attr: { name: `question-${question.id}`, value: option.value } });
      input.disabled = this.busy;
      input.addEventListener('change', () => { if (question.mode !== 'multi-select') selection.clear(); if (input.checked) selection.add(option.value); else selection.delete(option.value); });
      row.createSpan({ text: option.label });
      if (option.description) row.createEl('small', { text: option.description });
    }
    const freeText = question.mode === 'text' || question.kind === 'ask' ? card.createEl('textarea', { attr: { rows: '3', 'aria-label': 'Your answer', placeholder: 'Your answer' } }) : undefined;
    if (freeText) freeText.disabled = this.busy;
    const thinkingLabel = card.createEl('label', { text: 'Your reasoning or uncertainty (optional)' });
    const thinking = thinkingLabel.createEl('textarea', { attr: { rows: '2', 'aria-label': 'Your reasoning' } }); thinking.disabled = this.busy;
    const speechRow = card.createDiv({ cls: 'lh-speech-row' });
    const speechButton = speechRow.createEl('button', { text: 'Speak answer', attr: { type: 'button', 'aria-label': 'Speak your answer' } }); speechButton.disabled = this.busy;
    const speechStatus = speechRow.createSpan({ cls: 'lh-dictation-status', text: 'Speech-to-text uses the browser speech service. Review the transcript before submitting.' });
    speechButton.addEventListener('click', () => {
      if (this.speechCapture) { this.speechCapture.stop(); return; }
      const append = (field: HTMLTextAreaElement, text: string) => { field.value = [field.value.trim(), text].filter(Boolean).join(field.value.trim() ? '\n' : ''); field.dispatchEvent(new Event('input', { bubbles: true })); };
      const capture = startSpeechCapture(window as SpeechWindow, {
        result: transcript => {
          let selectedLabels: string[] = [];
          if (freeText) append(freeText, transcript);
          else {
            const matchedValues = matchSpokenChoice(transcript, question.options, question.mode === 'multi-select');
            const matched = question.options.filter(option => matchedValues.includes(option.value));
            if (matched.length && (question.mode === 'multi-select' || matched.length === 1)) {
              if (question.mode !== 'multi-select') selection.clear();
              for (const option of matched) {
                if (question.mode === 'multi-select' && selection.has(option.value)) selection.delete(option.value);
                else selection.add(option.value);
              }
              selectedLabels = matched.map(option => option.label);
              card.querySelectorAll<HTMLInputElement>('.lh-option input').forEach(input => { input.checked = selection.has(input.value); });
            }
          }
          if (!freeText) append(thinking, transcript);
          speechStatus.setText(freeText
            ? `Heard: “${transcript}” — review the text, then submit.`
            : selectedLabels.length
              ? `Heard: “${transcript}” — selected ${selectedLabels.join(', ')}. Review, then submit.`
              : `Heard: “${transcript}” — choose the matching option below, then submit.`);
        },
        error: message => { speechStatus.setText(message); speechButton.setText('Speak answer'); this.speechCapture = undefined; },
        end: () => { speechButton.setText('Speak answer'); this.speechCapture = undefined; },
      });
      if (!capture) { speechStatus.setText('Speech input is unavailable in this Obsidian environment; type your answer instead.'); return; }
      this.speechCapture = capture; speechButton.setText('Listening…'); speechStatus.setText('Listening. Speak your answer, then review the transcript.');
    });
    let confidence: HTMLInputElement | undefined;
    if (question.kind === 'quiz') {
      const label = card.createEl('label', { text: 'Confidence: ' });
      confidence = label.createEl('input', { type: 'range', attr: { min: '0', max: '100', step: '10', value: '50', 'aria-label': 'Answer confidence' } });
      const value = label.createSpan({ text: '50%' }); confidence.disabled = this.busy;
      confidence.addEventListener('input', () => { value.textContent = `${confidence!.value}%`; });
    }
    const submit = (dontKnow = false) => {
      if (!dontKnow && !selection.size && !freeText?.value.trim()) { this.error = 'Choose or enter an answer first.'; this.render(); return; }
      const request: AnswerRequest = { values: [...selection], thinking: thinking.value, ...(reading?.value.trim() ? { readingThinking: reading.value } : {}), ...(freeText ? { text: freeText.value, other: freeText.value } : {}), ...(dontKnow ? { dontKnow: true } : {}), ...(confidence && !dontKnow ? { confidence: Number(confidence.value) } : {}) };
      let engine;
      try { engine = this.engine(); } catch (error) { this.error = this.message(error); this.render(); return; }
      void this.perform(signal => this.controller.answer(session.id, session.pending!.toolCallId, request, engine, this.options(signal)));
    };
    const actions = card.createDiv({ cls: 'lh-actions' });
    this.button(actions, 'Submit answer', () => submit(), true);
    if (question.kind === 'quiz') this.button(actions, 'I don’t know', () => submit(true));
  }
}
