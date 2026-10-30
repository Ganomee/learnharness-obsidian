import { HoverPopover, ItemView, Menu, Notice, TFile, type HoverParent, type WorkspaceLeaf } from 'obsidian';
import { arrangeDepthLayers, graphEdgePalette, includePrerequisiteAncestors, inferGraphDepths, maxLayerRadius } from '../graph/graph-layout';

// Keep the prior view type so Obsidian can restore existing workspace tabs into
// the consolidated graph instead of leaving an unknown stale leaf behind.
export const GLOBAL_GRAPH_VIEW = 'learnharness-knowledge-graph';

type GraphNode = {
  kind: 'note' | 'argument' | 'tag';
  id: string;
  path: string;
  title: string;
  tags: string[];
  attachment: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  topic?: string;
  nextIds: string[];
  nextReasoning?: string;
  contextOnly?: boolean;
  degree: number;
};
type GraphEdge = { from: string; to: string; reason: string; kind: 'link' | 'sequence' | 'derivation' | 'tag' };
type GraphGroup = { query: string; color: string };
type Settings = {
  search: string;
  showTags: boolean;
  showAttachments: boolean;
  showOrphans: boolean;
  showArrows: boolean;
  linkMode: 'all' | 'classic' | 'learn';
  textFade: number;
  nodeSize: number;
  linkSize: number;
  centerForce: number;
  repelForce: number;
  linkForce: number;
  linkDistance: number;
  animate: boolean;
  layout: 'force' | 'levels';
};

const DEFAULTS: Settings = {
  search: '', showTags: false, showAttachments: false, showOrphans: false, showArrows: true,
  linkMode: 'all',
  textFade: 0.15, nodeSize: 1, linkSize: 1, centerForce: 0.035, repelForce: 3500,
  linkForce: 0.008, linkDistance: 110, animate: true, layout: 'levels',
};

/** A single Obsidian-style vault graph with LearnHarness edge explanations. */
export class GlobalGraphView extends ItemView implements HoverParent {
  hoverPopover: HoverPopover | null = null;
  private previewPath = '';
  private readonly releaseShiftPreview = (event: KeyboardEvent): void => {
    if (event.key !== 'Shift') return;
    this.previewPath = ''; this.hoverPopover?.unload(); this.draw();
  };
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private tagNodes = new Map<string, GraphNode>();
  private groups: GraphGroup[] = [];
  private settings: Settings = { ...DEFAULTS };
  private closed = false;
  private focusedPath = '';
  private localDepth = 2;
  private frame = 0;
  private observer?: ResizeObserver;
  private canvas?: HTMLCanvasElement;
  private tooltip?: HTMLElement;
  private root?: HTMLElement;
  private panX = 0;
  private panY = 0;
  private zoom = .72;
  private needsFit = true;
  private hoveredPath = '';
  private rotationX = 0.38;
  private rotationY = 0.55;
  private levelSpacing = 230;

  constructor(leaf: WorkspaceLeaf) { super(leaf); }
  getViewType(): string { return GLOBAL_GRAPH_VIEW; }
  getDisplayText(): string { return 'LearnHarness global graph'; }
  getIcon(): string { return 'git-fork'; }
  async onOpen(): Promise<void> {
    this.closed = false;
    document.addEventListener('keyup', this.releaseShiftPreview);
    await this.loadGraph(); this.render();
    const reload = () => { void this.reloadGraph(); };
    this.registerEvent(this.app.vault.on('create', reload));
    this.registerEvent(this.app.vault.on('modify', reload));
    this.registerEvent(this.app.vault.on('delete', reload));
    this.registerEvent(this.app.vault.on('rename', reload));
  }
  async onClose(): Promise<void> { this.closed = true; document.removeEventListener('keyup', this.releaseShiftPreview); this.hoverPopover?.unload(); this.hoverPopover = null; cancelAnimationFrame(this.frame); this.observer?.disconnect(); }

  private async loadGraph(): Promise<void> {
    this.edges = [];
    const files = this.app.vault.getFiles();
    const nodes: GraphNode[] = [];
    const byPath = new Map<string, GraphNode>();
    const idToPath = new Map<string, string>();
    const contents = new Map<string, string>();
    const arguments_: Array<{ path: string; premises: string[]; conclusions: string[] }> = [];
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter;
      const tags = [...new Set([...(cache?.tags ?? []).map(item => item.tag), ...(cache?.frontmatter?.tags ? (Array.isArray(cache.frontmatter.tags) ? cache.frontmatter.tags : [cache.frontmatter.tags]).map(String) : [])])];
      const node: GraphNode = {
        kind: fm?.type === 'argument' ? 'argument' : 'note', id: file.path, path: file.path, title: file.basename, tags, attachment: !(file instanceof TFile && file.extension.toLowerCase() === 'md'),
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, topic: typeof fm?.topic === 'string' ? fm.topic : undefined,
        nextIds: Array.isArray(fm?.next_ids) ? fm.next_ids.filter((value): value is string => typeof value === 'string') : [],
        nextReasoning: typeof fm?.next_reasoning === 'string' ? fm.next_reasoning : undefined, degree: 0,
      };
      nodes.push(node); byPath.set(file.path, node);
      if (typeof fm?.id === 'string') idToPath.set(fm.id, file.path);
      if (fm?.type === 'argument') arguments_.push({ path: file.path, premises: Array.isArray(fm.premise_ids) ? fm.premise_ids.filter((value): value is string => typeof value === 'string') : [], conclusions: Array.isArray(fm.conclusion_ids) ? fm.conclusion_ids.filter((value): value is string => typeof value === 'string') : [] });
    }
    for (const source of nodes) {
      for (const id of source.nextIds) {
        const targetPath = idToPath.get(id);
        if (targetPath && byPath.has(targetPath)) {
          this.edges.push({ from: source.path, to: targetPath, kind: 'sequence', reason: source.nextReasoning || `Learning sequence: ${source.title} builds toward ${byPath.get(targetPath)!.title}.` });
        }
      }
      if (source.attachment) continue;
      const file = this.app.vault.getAbstractFileByPath(source.path);
      if (!(file instanceof TFile)) continue;
      try { contents.set(source.path, await this.app.vault.read(file)); } catch { /* Skip unreadable note text; links still come from Obsidian's cache. */ }
    }
    const resolved = this.app.metadataCache.resolvedLinks;
    for (const [from, targets] of Object.entries(resolved)) {
      for (const [to, count] of Object.entries(targets)) {
        if (!byPath.has(from) || !byPath.has(to)) continue;
        const source = byPath.get(from)!;
        const dest = byPath.get(to)!;
        let reason = `Internal link from ${source.title} to ${dest.title}.`;
        const text = contents.get(from);
        if (text) {
          const matchingLine = text.split(/\r?\n/).find(line => line.includes(`[[${dest.title}`) || line.includes(`[[${to}`));
          if (matchingLine) reason = matchingLine.trim().replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_match, path: string, alias?: string) => alias || path.split('/').pop()?.replace(/\.md$/, '') || path);
        }
        for (let i = 0; i < Math.min(3, Math.max(1, count)); i++) this.edges.push({ from, to, kind: 'link', reason });
      }
    }
    for (const argument of arguments_) {
      const chain = byPath.get(argument.path); if (!chain) continue;
      const explanation = contents.get(argument.path)?.replace(/^---[\s\S]*?---\s*/, '').replace(/^#.*\r?\n/, '').trim() || chain.title;
      for (const id of argument.premises) { const premise = idToPath.get(id); if (premise) this.edges.push({ from: premise, to: argument.path, kind: 'derivation', reason: `Premise for ${chain.title}: ${explanation}` }); }
      for (const id of argument.conclusions) { const conclusion = idToPath.get(id); if (conclusion) this.edges.push({ from: argument.path, to: conclusion, kind: 'derivation', reason: `Derivation step ${chain.title}: ${explanation}` }); }
    }
    for (const edge of this.edges) {
      const from = byPath.get(edge.from), to = byPath.get(edge.to);
      if (from && to) { from.degree++; to.degree++; }
    }
    const depths = inferGraphDepths(nodes.map(node => node.path), this.edges);
    const lanes = new Map(nodes.map(node => [node.path, node.topic ?? node.path.split('/')[0] ?? node.path]));
    const positions = arrangeDepthLayers(nodes.map(node => node.path), depths, this.levelSpacing, lanes);
    for (const node of nodes) Object.assign(node, positions.get(node.path));
    this.nodes = nodes;
  }

  private async reloadGraph(): Promise<void> {
    await this.loadGraph();
    if (!this.closed) this.render();
  }

  private render(): void {
    this.observer?.disconnect(); cancelAnimationFrame(this.frame);
    const root = this.contentEl; this.root = root; root.empty(); root.addClass('lh-global-graph'); root.setAttribute('data-lh-testid', 'global-graph-view');
    const toolbar = root.createDiv({ cls: 'lh-global-toolbar' });
    toolbar.createEl('h2', { text: 'Global graph' });
    toolbar.createEl('p', { cls: 'lh-muted', text: 'Vault-wide 3D graph. Drag to rotate, Shift-drag to pan, scroll to zoom. Shift-hover a note for preview; click a note to open it in a new tab. Hover a connection for its reasoning step.' });
    const topControls = toolbar.createDiv({ cls: 'lh-global-controls' });
    const search = topControls.createEl('input', { type: 'search', attr: { placeholder: 'Search files, paths, or tags', 'aria-label': 'Search graph notes' } });
    search.value = this.settings.search;
    search.addEventListener('input', () => { this.settings.search = search.value; this.refreshGraph(); });
    const linkModes = topControls.createDiv({ cls: 'lh-global-link-modes', attr: { role: 'group', 'aria-label': 'Graph link mode' } });
    for (const [mode, label] of [['all', 'All links'], ['classic', 'Classic'], ['learn', 'LearnHarness']] as const) {
      const button = linkModes.createEl('button', { text: label, attr: { 'aria-pressed': String(this.settings.linkMode === mode), 'aria-label': `${label} link view` } });
      button.addEventListener('click', () => { this.settings.linkMode = mode; this.render(); });
    }
    const layout = topControls.createEl('select', { attr: { 'aria-label': 'Graph layout' } });
    layout.createEl('option', { value: 'levels', text: '3D depth levels' }); layout.createEl('option', { value: 'force', text: 'Free 3D force layout' }); layout.value = this.settings.layout;
    layout.addEventListener('change', () => { this.settings.layout = layout.value as Settings['layout']; this.refreshGraph(); });
    const reset = topControls.createEl('button', { text: 'Reset view' });
    reset.addEventListener('click', () => { this.rotationX = .38; this.rotationY = .55; this.panX = 0; this.panY = 0; this.zoom = 1; this.needsFit = true; this.draw(); });
    if (this.focusedPath) {
      topControls.createSpan({ cls: 'lh-global-focus', text: `Local graph: ${this.nodes.find(node => node.path === this.focusedPath)?.title ?? this.focusedPath}` });
      const depthLabel = topControls.createEl('label', { text: 'Depth' });
      const depth = depthLabel.createEl('input', { type: 'range', attr: { min: '1', max: '5', step: '1', 'aria-label': 'Local graph depth' } });
      depth.value = String(this.localDepth); depth.addEventListener('input', () => { this.localDepth = Number(depth.value); this.refreshGraph(); });
      const global = topControls.createEl('button', { text: 'Back to global graph' });
      global.addEventListener('click', () => { this.focusedPath = ''; this.panX = 0; this.panY = 0; this.needsFit = true; this.render(); });
    }
    const filterDetails = toolbar.createEl('details', { cls: 'lh-global-settings' });
    filterDetails.createEl('summary', { text: 'Filters and display' });
    const checkRow = filterDetails.createDiv({ cls: 'lh-global-checks' });
    this.addToggle(checkRow, 'Tags', this.settings.showTags, value => { this.settings.showTags = value; this.refreshGraph(); });
    this.addToggle(checkRow, 'Attachments', this.settings.showAttachments, value => { this.settings.showAttachments = value; this.refreshGraph(); });
    this.addToggle(checkRow, 'Orphans', this.settings.showOrphans, value => { this.settings.showOrphans = value; this.refreshGraph(); });
    this.addToggle(checkRow, 'Display arrows', this.settings.showArrows, value => { this.settings.showArrows = value; this.refreshGraph(); });
    this.addToggle(checkRow, 'Animate', this.settings.animate, value => { this.settings.animate = value; this.refreshGraph(); });
    const sliders = filterDetails.createDiv({ cls: 'lh-global-sliders' });
    this.addRange(sliders, 'Text fade threshold', 0, 1, 0.05, this.settings.textFade, value => { this.settings.textFade = value; this.refreshGraph(); });
    this.addRange(sliders, 'Node size', 0.5, 2.5, 0.1, this.settings.nodeSize, value => { this.settings.nodeSize = value; this.refreshGraph(); });
    this.addRange(sliders, 'Link thickness', 0.5, 4, 0.1, this.settings.linkSize, value => { this.settings.linkSize = value; this.refreshGraph(); });
    const forceDetails = filterDetails.createEl('details'); forceDetails.createEl('summary', { text: 'Forces' });
    const forceSliders = forceDetails.createDiv({ cls: 'lh-global-sliders' });
    this.addRange(forceSliders, 'Center force', 0, 0.12, 0.005, this.settings.centerForce, value => { this.settings.centerForce = value; this.refreshGraph(); });
    this.addRange(forceSliders, 'Repel force', 0, 10000, 100, this.settings.repelForce, value => { this.settings.repelForce = value; this.refreshGraph(); });
    this.addRange(forceSliders, 'Link force', 0, 0.04, 0.001, this.settings.linkForce, value => { this.settings.linkForce = value; this.refreshGraph(); });
    this.addRange(forceSliders, 'Link distance', 30, 350, 5, this.settings.linkDistance, value => { this.settings.linkDistance = value; this.refreshGraph(); });
    this.addRange(forceSliders, '3D level spacing', 80, 450, 10, this.levelSpacing, value => { this.levelSpacing = value; this.refreshGraph(); });
    const groupDetails = filterDetails.createEl('details'); groupDetails.createEl('summary', { text: 'Color groups' });
    const groups = groupDetails.createDiv({ cls: 'lh-global-groups' });
    const groupAdd = groups.createDiv({ cls: 'lh-global-group-row' });
    const groupQuery = groupAdd.createEl('input', { type: 'text', attr: { placeholder: 'Group query, e.g. tag:#statistics or path:"40 Knowledge"' } });
    const groupColor = groupAdd.createEl('input', { type: 'color', attr: { 'aria-label': 'Group color' } }); groupColor.value = '#9b72cf';
    const addGroup = groupAdd.createEl('button', { text: 'Add group' });
    addGroup.addEventListener('click', () => { if (!groupQuery.value.trim()) return; this.groups.push({ query: groupQuery.value.trim(), color: groupColor.value }); this.render(); });
    for (const [index, group] of this.groups.entries()) {
      const row = groups.createDiv({ cls: 'lh-global-group-row' });
      row.createSpan({ text: group.query }); const color = row.createEl('input', { type: 'color' }); color.value = group.color;
      color.addEventListener('input', () => { group.color = color.value; this.refreshGraph(); });
      const remove = row.createEl('button', { text: 'Remove' }); remove.addEventListener('click', () => { this.groups.splice(index, 1); this.render(); });
    }
    const legend = toolbar.createDiv({ cls: 'lh-global-legend' });
    legend.createSpan({ text: 'Classic links / backlinks', cls: 'lh-legend-classic' });
    legend.createSpan({ text: 'Learning sequence', cls: 'lh-legend-sequence' });
    legend.createSpan({ text: 'Derivation', cls: 'lh-legend-derivation' });
    const canvasWrap = root.createDiv({ cls: 'lh-global-canvas-wrap' });
    this.canvas = canvasWrap.createEl('canvas', { cls: 'lh-global-canvas', attr: { 'aria-label': 'Interactive global note graph' } });
    this.tooltip = canvasWrap.createDiv({ cls: 'lh-graph-edge-tooltip', attr: { role: 'tooltip', 'aria-live': 'polite' } }); this.tooltip.hidden = true;
    root.createDiv({ cls: 'lh-global-count', text: `${this.visibleNodes().length} graph nodes · ${this.edges.length} links` });
    this.bindCanvas(this.canvas, this.tooltip, canvasWrap);
    this.observer = new ResizeObserver(() => this.draw()); this.observer.observe(this.canvas);
    this.draw();
  }

  private addToggle(parent: HTMLElement, text: string, checked: boolean, change: (value: boolean) => void): void {
    const label = parent.createEl('label', { cls: 'lh-global-toggle' });
    const input = label.createEl('input', { type: 'checkbox' }); input.checked = checked;
    label.createSpan({ text }); input.addEventListener('change', () => change(input.checked));
  }

  private addRange(parent: HTMLElement, name: string, min: number, max: number, step: number, value: number, change: (value: number) => void): void {
    const label = parent.createEl('label', { cls: 'lh-global-range' }); const display = label.createSpan({ text: `${name}: ${value}` });
    const input = label.createEl('input', { type: 'range', attr: { min: String(min), max: String(max), step: String(step), 'aria-label': name } }); input.value = String(value);
    input.addEventListener('input', () => { const next = Number(input.value); display.setText(`${name}: ${next}`); change(next); });
  }

  private matching(node: GraphNode): boolean {
    const query = this.settings.search.trim().toLowerCase();
    if (!query) return true;
    const terms: string[] = query.match(/(?:\b(?:tag|path):"[^"]+"|"[^"]+"|\S+)/g) ?? [];
    return terms.every(term => {
      const value = term.replace(/^"|"$/g, '').replace(/"/g, '');
      if (value.startsWith('tag:')) return node.tags.some(tag => tag.toLowerCase().includes(value.slice(4)));
      if (value.startsWith('path:')) return node.path.toLowerCase().includes(value.slice(5));
      return `${node.title} ${node.path} ${node.tags.join(' ')}`.toLowerCase().includes(value);
    });
  }

  private groupColor(node: GraphNode): string | undefined {
    for (const group of this.groups) {
      const test = group.query.toLowerCase().replace(/"/g, '');
      if (test.startsWith('tag:') ? node.tags.some(tag => tag.toLowerCase().includes(test.slice(4))): test.startsWith('path:') ? node.path.toLowerCase().includes(test.slice(5)) : `${node.title} ${node.path} ${node.tags.join(' ')}`.toLowerCase().includes(test)) return group.color;
    }
    return undefined;
  }

  private visibleNodes(): GraphNode[] {
    const degree = new Map(this.nodes.map(node => [node.path, 0]));
    const edges = this.graphEdges();
    for (const edge of edges) { degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1); degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1); }
    let result = this.nodes.filter(node => (this.settings.showAttachments || !node.attachment) && (this.settings.showOrphans || (degree.get(node.path) ?? 0) > 0) && this.matching(node));
    if (this.focusedPath) {
      const adjacent = new Map<string, Set<string>>();
      for (const edge of edges) { if (!adjacent.has(edge.from)) adjacent.set(edge.from, new Set()); if (!adjacent.has(edge.to)) adjacent.set(edge.to, new Set()); adjacent.get(edge.from)!.add(edge.to); adjacent.get(edge.to)!.add(edge.from); }
      const included = new Set([this.focusedPath]); let frontier = new Set(included);
      for (let i = 0; i < this.localDepth; i++) { const next = new Set<string>(); for (const path of frontier) for (const neighbor of adjacent.get(path) ?? []) if (!included.has(neighbor)) { included.add(neighbor); next.add(neighbor); } frontier = next; }
      result = result.filter(node => included.has(node.path));
    }
    // Preserve derivation context when search or local depth filters hide its sources.
    if (this.settings.layout === 'levels') {
      const selected = new Set(result.map(node => node.path));
      const included = includePrerequisiteAncestors([...selected], edges);
      const context = new Set([...included].filter(path => !selected.has(path)));
      for (const prerequisite of context) {
        const node = this.nodes.find(item => item.path === prerequisite);
        if (!node || (node.attachment && !this.settings.showAttachments)) { included.delete(prerequisite); context.delete(prerequisite); }
      }
      result = [...result.map(node => ({ ...node, contextOnly: false })), ...this.nodes.filter(node => context.has(node.path)).map(node => ({ ...node, contextOnly: true }))];
    }
    if (this.settings.showTags) {
      for (const node of result) for (const tag of node.tags) if (!this.tagNodes.has(tag)) this.tagNodes.set(tag, { kind: 'tag', id: `tag:${tag}`, path: `tag:${tag}`, title: `#${tag.replace(/^#/, '')}`, tags: [tag], attachment: false, x: node.x + 45, y: node.y + 45, z: node.z, vx: 0, vy: 0, vz: 0, nextIds: [], degree: 1 });
      result = [...result, ...[...new Set(result.flatMap(node => node.tags))].map(tag => this.tagNodes.get(tag)!).filter(Boolean)];
    }
    return result;
  }

  private graphEdges(): GraphEdge[] {
    if (!this.settings.showTags) return this.edges;
    const tagEdges: GraphEdge[] = [];
    for (const node of this.nodes) for (const tag of node.tags) tagEdges.push({ from: node.path, to: `tag:${tag}`, kind: 'tag', reason: `Tag: ${tag}` });
    return [...this.edges, ...tagEdges];
  }

  private visibleEdges(): GraphEdge[] {
    return this.graphEdges().filter(edge => edge.kind === 'tag' || this.settings.linkMode === 'all' || (this.settings.linkMode === 'classic' ? edge.kind === 'link' : edge.kind === 'sequence' || edge.kind === 'derivation'));
  }

  private refreshGraph(): void { this.needsFit = true; this.draw(); }

  private bindCanvas(canvas: HTMLCanvasElement, tooltip: HTMLElement, wrap: HTMLElement): void {
    let dragId: number | undefined, lastX = 0, lastY = 0, moved = false, panMode = false;
    canvas.addEventListener('pointerdown', event => { dragId = event.pointerId; lastX = event.clientX; lastY = event.clientY; moved = false; panMode = event.shiftKey; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
      if (dragId !== event.pointerId) {
        const point = this.hitNode(event.offsetX, event.offsetY);
        if (event.shiftKey && point?.kind !== 'tag') {
          this.hoverAt(event.offsetX, event.offsetY, tooltip, wrap);
          if (point && this.previewPath !== point.path) {
            this.previewPath = point.path;
            this.app.workspace.trigger('hover-link', { event, source: GLOBAL_GRAPH_VIEW, hoverParent: this, targetEl: canvas, linktext: point.path });
          }
        } else { if (this.previewPath) this.hoverPopover?.unload(); this.previewPath = ''; this.hoverAt(event.offsetX, event.offsetY, tooltip, wrap); }
        return;
      }
      const dx = event.clientX - lastX, dy = event.clientY - lastY; lastX = event.clientX; lastY = event.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      if (panMode) { this.panX += dx; this.panY += dy; }
      else { this.rotationY += dx * .008; this.rotationX = Math.max(-1.4, Math.min(1.4, this.rotationX + dy * .008)); }
      this.draw();
    });
    canvas.addEventListener('pointerup', event => {
      if (dragId !== event.pointerId) return; dragId = undefined;
      if (moved) return;
      const point = this.hitNode(event.offsetX, event.offsetY);
      if (point && point.kind !== 'tag') void this.app.workspace.openLinkText(point.path.replace(/\.md$/, ''), '', 'tab');
    });
    canvas.addEventListener('pointercancel', () => { dragId = undefined; });
    canvas.addEventListener('pointerleave', () => { tooltip.hidden = true; this.hoveredPath = ''; this.previewPath = ''; this.hoverPopover?.unload(); this.draw(); });
    canvas.addEventListener('wheel', event => { event.preventDefault(); this.zoom = Math.max(0.25, Math.min(3.5, this.zoom * (event.deltaY > 0 ? 0.9 : 1.1))); this.draw(); }, { passive: false });
    canvas.addEventListener('contextmenu', event => {
      const point = this.hitNode(event.offsetX, event.offsetY); if (!point) return;
      event.preventDefault(); const menu = new Menu();
      menu.addItem(item => item.setTitle('Open note in new tab').setIcon('file-text').onClick(() => { void this.app.workspace.openLinkText(point.path.replace(/\.md$/, ''), '', 'tab'); }));
      menu.addItem(item => item.setTitle('Show local graph').setIcon('git-fork').onClick(() => { this.focusedPath = point.path; this.localDepth = 2; this.panX = 0; this.panY = 0; this.needsFit = true; this.render(); }));
      menu.showAtMouseEvent(event);
    });
  }

  private project(node: GraphNode, width: number, height: number, camera: number): { x: number; y: number; scale: number; z: number } {
    const cosY = Math.cos(this.rotationY), sinY = Math.sin(this.rotationY), cosX = Math.cos(this.rotationX), sinX = Math.sin(this.rotationX);
    const x1 = node.x * cosY + node.z * sinY, z1 = -node.x * sinY + node.z * cosY;
    const y2 = node.y * cosX - z1 * sinX, z2 = node.y * sinX + z1 * cosX;
    const scale = camera / Math.max(camera * .35, camera - z2);
    return { x: width / 2 + x1 * scale * this.zoom + this.panX, y: height / 2 + y2 * scale * this.zoom + this.panY, scale, z: z2 };
  }

  private projectGraphNodes(nodes: GraphNode[], width: number, height: number, camera: number): Map<string, { x: number; y: number; scale: number; z: number }> {
    const points = new Map(nodes.map(node => [node.path, this.project(node, width, height, camera)]));
    const focus = this.focusedPath ? points.get(this.focusedPath) : undefined;
    if (focus) for (const point of points.values()) { point.x += width / 2 - focus.x; point.y += height / 2 - focus.y; }
    return points;
  }

  private fitGraph(nodes: GraphNode[], depths: Map<string, number>, width: number, height: number, camera: number): void {
    this.zoom = 1; this.panX = 0; this.panY = 0;
    const bounds = [...this.projectGraphNodes(nodes, width, height, camera).entries()].map(([path, point]) => {
      const node = nodes.find(item => item.path === path)!;
      return { left: point.x - 12, right: point.x + 12 + Math.min(180, node.title.length * 7.2), top: point.y - 12, bottom: point.y + 12 };
    });
    if (this.settings.layout === 'levels') {
      const layers = this.groupByDepth(nodes, depths), maxDepth = Math.max(0, ...depths.values());
      for (const [depth, layer] of layers) {
        const radius = Math.max(...layer.map(node => Math.hypot(node.x, node.y)), 120) + 105;
        const z = (depth - maxDepth / 2) * this.levelSpacing;
        for (let i = 0; i < 32; i++) {
          const angle = i / 32 * Math.PI * 2;
          const point = this.project({ kind: 'note', id: '', path: '', title: '', tags: [], attachment: false, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z, vx: 0, vy: 0, vz: 0, nextIds: [], degree: 0 }, width, height, camera);
          bounds.push({ left: point.x, right: point.x, top: point.y, bottom: point.y });
        }
      }
    }
    if (!bounds.length) { this.needsFit = false; return; }
    const left = Math.min(...bounds.map(box => box.left)), right = Math.max(...bounds.map(box => box.right));
    const top = Math.min(...bounds.map(box => box.top)), bottom = Math.max(...bounds.map(box => box.bottom));
    const spanX = Math.max(1, right - left), spanY = Math.max(1, bottom - top);
    this.zoom = Math.min(1, (width - 64) / spanX, (height - 64) / spanY);
    this.panX = (width / 2 - (left + right) / 2) * this.zoom;
    this.panY = (height / 2 - (top + bottom) / 2) * this.zoom;
    this.needsFit = false;
  }

  private hitNode(x: number, y: number): GraphNode | undefined {
    const canvas = this.canvas; if (!canvas) return undefined; const rect = canvas.getBoundingClientRect();
    const nodes = this.visibleNodes();
    const camera = this.cameraDistance(nodes);
    const points = this.projectGraphNodes(nodes, rect.width, rect.height, camera);
    return [...nodes].sort((a, b) => (points.get(b.path)?.z ?? 0) - (points.get(a.path)?.z ?? 0)).find(node => { const p = points.get(node.path)!; return Math.hypot(p.x - x, p.y - y) < 10 * this.settings.nodeSize * p.scale + 4; });
  }

  private cameraDistance(nodes: GraphNode[]): number { return Math.max(2600, ...nodes.map(node => Math.abs(node.z) * 3.8 + 500)); }

  private hoverAt(x: number, y: number, tooltip: HTMLElement, wrap: HTMLElement): void {
    const canvas = this.canvas; if (!canvas) return; const rect = canvas.getBoundingClientRect();
    const visibleNodes = this.visibleNodes(), visible = new Set(visibleNodes.map(node => node.path));
    const hoveredNode = this.hitNode(x, y);
    this.hoveredPath = hoveredNode?.path ?? '';
    if (hoveredNode) { tooltip.hidden = true; canvas.style.cursor = 'pointer'; this.draw(); return; }
    let best: { edge: GraphEdge; distance: number; x: number; y: number } | undefined;
    const camera = this.cameraDistance(visibleNodes), projected = this.projectGraphNodes(visibleNodes, rect.width, rect.height, camera), parallel = new Map<string, GraphEdge[]>();
    for (const edge of this.visibleEdges()) { const key = `${edge.from}\u0000${edge.to}`; if (!parallel.has(key)) parallel.set(key, []); parallel.get(key)!.push(edge); }
    for (const edge of this.visibleEdges()) {
      if (!visible.has(edge.from) || !visible.has(edge.to)) continue;
      const from = visibleNodes.find(node => node.path === edge.from), to = visibleNodes.find(node => node.path === edge.to); if (!from || !to) continue;
      const a = projected.get(from.path)!, b = projected.get(to.path)!;
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.max(1, Math.hypot(dx, dy)), key = `${edge.from}\u0000${edge.to}`, parallels = parallel.get(key)!, edgeIndex = parallels.indexOf(edge);
      const offset = (edgeIndex - (parallels.length - 1) / 2) * 10, cx = (a.x + b.x) / 2 - dy / length * offset, cy = (a.y + b.y) / 2 + dx / length * offset;
      for (let step = 0; step <= 12; step++) { const t = step / 12, u = 1 - t, px = u * u * a.x + 2 * u * t * cx + t * t * b.x, py = u * u * a.y + 2 * u * t * cy + t * t * b.y, distance = Math.hypot(x - px, y - py); if (distance < 9 && (!best || distance < best.distance)) best = { edge, distance, x: px, y: py }; }
    }
    if (!best) { tooltip.hidden = true; canvas.style.cursor = 'grab'; return; }
    const from = visibleNodes.find(node => node.path === best!.edge.from), to = visibleNodes.find(node => node.path === best!.edge.to);
    if (!from || !to) return;
    tooltip.setText(`${from.title} → ${to.title}\n${best.edge.reason}`);
    const box = wrap.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(box.width - 330, best.x + 14))}px`;
    tooltip.style.top = `${Math.max(8, Math.min(box.height - 100, best.y + 14))}px`;
    tooltip.hidden = false; canvas.style.cursor = 'help';
  }

  private draw(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    const canvas = this.canvas, ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const dpr = window.devicePixelRatio || 1, w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    const style = getComputedStyle(canvas), text = style.getPropertyValue('--text-normal').trim() || '#ddd', muted = style.getPropertyValue('--text-muted').trim() || '#888';
    const accent = style.getPropertyValue('--interactive-accent').trim() || '#8b6cef';
    const visible = this.visibleNodes(), visibleSet = new Set(visible.map(node => node.path));
    this.simulate(visible, rect.width, rect.height);
    const edgePairs = this.visibleEdges().filter(edge => visibleSet.has(edge.from) && visibleSet.has(edge.to));
    const camera = this.cameraDistance(visible);
    const depthMap = inferGraphDepths(visible.map(node => node.path), this.graphEdges());
    if (this.needsFit) this.fitGraph(visible, depthMap, rect.width, rect.height, camera);
    const projected = this.projectGraphNodes(visible, rect.width, rect.height, camera);
    const parallel = new Map<string, GraphEdge[]>();
    for (const edge of edgePairs) { const key = `${edge.from}\u0000${edge.to}`; if (!parallel.has(key)) parallel.set(key, []); parallel.get(key)!.push(edge); }
    const maxDepth = Math.max(0, ...depthMap.values());
    const focusNode = this.focusedPath ? visible.find(node => node.path === this.focusedPath) : undefined;
    const focusRaw = focusNode ? this.project(focusNode, rect.width, rect.height, camera) : undefined;
    const shiftX = focusRaw ? rect.width / 2 - focusRaw.x : 0, shiftY = focusRaw ? rect.height / 2 - focusRaw.y : 0;
    for (const [depth, layer] of [...this.groupByDepth(visible, depthMap)].sort((a, b) => a[0] - b[0])) {
      const z = (depth - maxDepth / 2) * this.levelSpacing;
      if (this.settings.layout === 'levels') {
        const ringRadius = Math.max(...layer.map(node => Math.hypot(node.x, node.y)), 120) + 105;
        ctx.strokeStyle = accent; ctx.globalAlpha = .12; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const angle = i / 64 * Math.PI * 2;
          const ringPoint = this.project({ kind: 'note', id: '', path: '', title: '', tags: [], attachment: false, x: Math.cos(angle) * ringRadius, y: Math.sin(angle) * ringRadius, z, vx: 0, vy: 0, vz: 0, nextIds: [], degree: 0 }, rect.width, rect.height, camera);
          if (i === 0) ctx.moveTo(ringPoint.x + shiftX, ringPoint.y + shiftY); else ctx.lineTo(ringPoint.x + shiftX, ringPoint.y + shiftY);
        }
        ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1;
        const markerNode: GraphNode = { kind: 'note', id: `level-${depth}`, path: `__level-${depth}`, title: '', tags: [], attachment: false, x: -maxLayerRadius(layer.length) - 60, y: 0, z, vx: 0, vy: 0, vz: 0, nextIds: [], degree: 0 };
        const marker = this.projectGraphNodes([...visible, markerNode], rect.width, rect.height, camera).get(markerNode.path)!;
        ctx.globalAlpha = .46; ctx.fillStyle = muted; ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(depth === 0 ? 'FOUNDATIONS' : `LEVEL ${depth}`, marker.x, marker.y); ctx.globalAlpha = 1;
      }
    }
    for (const [key, parallels] of parallel) {
      const [fromPath, toPath] = key.split('\u0000'); const a = projected.get(fromPath), b = projected.get(toPath); if (!a || !b) continue;
      const from = visible.find(node => node.path === fromPath), to = visible.find(node => node.path === toPath); if (!from || !to) continue;
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.max(1, Math.hypot(dx, dy)), perpX = -dy / length, perpY = dx / length;
      parallels.forEach((edge, index) => {
        const offset = (index - (parallels.length - 1) / 2) * 10;
        const cx = (a.x + b.x) / 2 + perpX * offset, cy = (a.y + b.y) / 2 + perpY * offset;
        const highlighted = (this.focusedPath && (from.path === this.focusedPath || to.path === this.focusedPath)) || (this.hoveredPath && (from.path === this.hoveredPath || to.path === this.hoveredPath));
        const palette = graphEdgePalette(edge.kind), color = palette === 'classic' ? text : palette === 'sequence' ? '#34c6c6' : palette === 'derivation' ? '#bd83ff' : muted;
        const linkCount = parallels.length;
        ctx.strokeStyle = color; ctx.globalAlpha = highlighted ? .98 : edge.kind === 'link' ? .78 : .9; ctx.lineWidth = this.settings.linkSize * (1 + Math.log2(Math.max(1, linkCount)) * .2);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y); ctx.stroke();
        if (this.settings.showArrows) {
          const angle = Math.atan2(b.y - cy, b.x - cx), size = 7, nodeRadius = (to.kind === 'argument' ? 7 : 5) * this.settings.nodeSize * b.scale + Math.min(5, Math.sqrt(to.degree));
          const tipX = b.x - Math.cos(angle) * (nodeRadius + 2), tipY = b.y - Math.sin(angle) * (nodeRadius + 2);
          ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(tipX, tipY); ctx.lineTo(tipX - size * Math.cos(angle - .45), tipY - size * Math.sin(angle - .45)); ctx.lineTo(tipX - size * Math.cos(angle + .45), tipY - size * Math.sin(angle + .45)); ctx.fill();
        }
      });
    }
    ctx.globalAlpha = 1;
    const labels: Array<{ node: GraphNode; x: number; y: number; width: number; alpha: number; priority: number }> = [];
    for (const node of [...visible].sort((a, b) => (projected.get(a.path)?.z ?? 0) - (projected.get(b.path)?.z ?? 0))) {
      const p = projected.get(node.path); if (!p) continue;
      const radius = (node.kind === 'argument' ? 7 : 5) * this.settings.nodeSize * p.scale + Math.min(5, Math.sqrt(node.degree));
      const color = this.groupColor(node) ?? (node.kind === 'argument' ? '#bd83ff' : node.kind === 'tag' ? '#d5aa54' : accent); const focused = node.path === this.focusedPath;
      ctx.globalAlpha = (this.settings.textFade === 0 ? 1 : Math.max(.2, 1 - this.settings.textFade * .55)) * (node.contextOnly ? .42 : 1);
      ctx.fillStyle = color;
      if (node.kind === 'argument') { ctx.beginPath(); ctx.rect(p.x - radius, p.y - radius, radius * 2, radius * 2); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill(); }
      if (focused) { ctx.strokeStyle = text; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.font = `${node.kind === 'argument' ? '600 ' : ''}12px sans-serif`;
      labels.push({ node, x: p.x + radius + 3, y: p.y, width: Math.min(180, ctx.measureText(node.title).width), alpha: (this.settings.textFade >= 1 ? .2 : Math.max(.3, p.scale)) * (node.contextOnly ? .6 : 1), priority: (focused || node.path === this.hoveredPath ? 10000 : 0) + p.scale * 100 + Math.min(20, node.degree) });
    }
    const occupied: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    for (const label of labels.sort((a, b) => b.priority - a.priority)) {
      const box = { left: label.x, right: label.x + label.width + 5, top: label.y - 8, bottom: label.y + 8 };
      if (occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) continue;
      occupied.push(box); ctx.globalAlpha = label.alpha; ctx.fillStyle = text; ctx.font = `${label.node.kind === 'argument' ? '600 ' : ''}12px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label.node.title, label.x, label.y, 180);
    }
    ctx.globalAlpha = 1;
    const count = this.root?.querySelector('.lh-global-count');
    if (count) count.setText(`${visible.length} graph nodes · ${edgePairs.length} links${this.focusedPath ? ` · local depth ${this.localDepth}` : ''}`);
    if (!this.closed && this.settings.animate) this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); });
  }

  private groupByDepth(nodes: GraphNode[], depth: Map<string, number>): Map<number, GraphNode[]> {
    const groups = new Map<number, GraphNode[]>();
    for (const node of nodes) { const d = depth.get(node.path) ?? 0; if (!groups.has(d)) groups.set(d, []); groups.get(d)!.push(node); }
    return groups;
  }

  private simulate(nodes: GraphNode[], width: number, height: number): void {
    if (!this.settings.animate || nodes.length < 2) return;
    const nodePaths = new Set(nodes.map(node => node.path));
    const edges = this.visibleEdges().filter(edge => nodePaths.has(edge.from) && nodePaths.has(edge.to));
    const depths = inferGraphDepths(nodes.map(node => node.path), this.graphEdges());
    const lanes = new Map(nodes.map(node => [node.path, node.topic ?? node.path.split('/')[0] ?? node.path]));
    const targets = arrangeDepthLayers(nodes.map(node => node.path), depths, this.levelSpacing, lanes);
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i], target = targets.get(a.path)!;
      let fx = -a.x * this.settings.centerForce, fy = -a.y * this.settings.centerForce, fz = -a.z * this.settings.centerForce;
      if (this.settings.layout === 'levels') { fx += (target.x - a.x) * .018; fy += (target.y - a.y) * .018; fz += (target.z - a.z) * .04; }
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z, distance2 = Math.max(100, dx * dx + dy * dy + dz * dz), force = this.settings.repelForce / (distance2 * Math.sqrt(distance2));
        fx += dx * force; fy += dy * force; fz += dz * force;
        b.vx -= dx * force * .08; b.vy -= dy * force * .08; b.vz -= dz * force * .08;
      }
      a.vx = (a.vx + fx * .08) * .84; a.vy = (a.vy + fy * .08) * .84; a.vz = (a.vz + fz * .08) * .84;
    }
    for (const edge of edges) {
      const a = nodes.find(node => node.path === edge.from), b = nodes.find(node => node.path === edge.to); if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, distance = Math.max(1, Math.hypot(dx, dy, dz)), force = (distance - this.settings.linkDistance) * this.settings.linkForce;
      a.vx += dx / distance * force; a.vy += dy / distance * force; a.vz += dz / distance * force;
      b.vx -= dx / distance * force; b.vy -= dy / distance * force; b.vz -= dz / distance * force;
    }
    const focus = nodes.find(node => node.path === this.focusedPath);
    if (focus) { focus.x *= .9; focus.y *= .9; }
    const bound = Math.max(width, height) * .8;
    for (const node of nodes) { node.x += node.vx; node.y += node.vy; node.z += node.vz; node.x = Math.max(-bound, Math.min(bound, node.x)); node.y = Math.max(-bound, Math.min(bound, node.y)); }
  }
}
