export type GraphEdgeKind = 'link' | 'sequence' | 'derivation' | 'tag';
export interface GraphLayoutEdge { from: string; to: string; kind: GraphEdgeKind }
export interface GraphPosition { x: number; y: number; z: number }

/** Return the selected nodes plus every reachable learning prerequisite. */
export function includePrerequisiteAncestors(selected: readonly string[], edges: readonly GraphLayoutEdge[]): Set<string> {
  const reverse = new Map<string, string[]>();
  for (const edge of edges) if (edge.kind === 'sequence' || edge.kind === 'derivation') {
    if (!reverse.has(edge.to)) reverse.set(edge.to, []);
    reverse.get(edge.to)!.push(edge.from);
  }
  const included = new Set(selected), frontier = [...included];
  while (frontier.length) for (const prerequisite of reverse.get(frontier.pop()!) ?? []) {
    if (!included.has(prerequisite)) { included.add(prerequisite); frontier.push(prerequisite); }
  }
  return included;
}

/** Longest derivation path from foundational nodes; ordinary links never set levels. */
export function inferGraphDepths(ids: readonly string[], edges: readonly GraphLayoutEdge[]): Map<string, number> {
  const valid = new Set(ids), forward = new Map<string, string[]>(), reverse = new Map<string, string[]>();
  for (const id of ids) { forward.set(id, []); reverse.set(id, []); }
  for (const edge of edges) if ((edge.kind === 'sequence' || edge.kind === 'derivation') && edge.from !== edge.to && valid.has(edge.from) && valid.has(edge.to)) {
    forward.get(edge.from)!.push(edge.to); reverse.get(edge.to)!.push(edge.from);
  }

  // Kosaraju SCC condensation makes mutual/cyclic derivations share one level.
  const visited = new Set<string>(), finish: string[] = [];
  for (const start of ids) if (!visited.has(start)) {
    const stack: Array<[string, boolean]> = [[start, false]];
    while (stack.length) {
      const [id, exiting] = stack.pop()!;
      if (exiting) { finish.push(id); continue; }
      if (visited.has(id)) continue;
      visited.add(id); stack.push([id, true]);
      for (const next of forward.get(id)!) if (!visited.has(next)) stack.push([next, false]);
    }
  }
  const component = new Map<string, number>(); let componentCount = 0;
  for (const start of finish.reverse()) if (!component.has(start)) {
    component.set(start, componentCount); const stack = [start];
    while (stack.length) { const id = stack.pop()!; for (const previous of reverse.get(id)!) if (!component.has(previous)) { component.set(previous, componentCount); stack.push(previous); } }
    componentCount++;
  }
  const successors = Array.from({ length: componentCount }, () => new Set<number>()), indegree = new Array<number>(componentCount).fill(0);
  for (const edge of edges) {
    if (edge.kind !== 'sequence' && edge.kind !== 'derivation') continue;
    const from = component.get(edge.from), to = component.get(edge.to);
    if (from == null || to == null || from === to || successors[from]!.has(to)) continue;
    successors[from]!.add(to); indegree[to]++;
  }
  const depth = new Array<number>(componentCount).fill(0), queue: number[] = [];
  for (let i = 0; i < componentCount; i++) if (!indegree[i]) queue.push(i);
  for (let i = 0; i < queue.length; i++) { const from = queue[i]!; for (const to of successors[from]!) { depth[to] = Math.max(depth[to]!, depth[from]! + 1); if (--indegree[to] === 0) queue.push(to); } }
  return new Map(ids.map(id => [id, depth[component.get(id)!] ?? 0]));
}

export function maxLayerRadius(count: number): number { return Math.max(120, Math.sqrt(count) * 58); }

/** Deterministic spiral placement in XY, stacked by derivation depth on Z. */
export function arrangeDepthLayers(ids: readonly string[], depths: ReadonlyMap<string, number>, spacing: number, laneById?: ReadonlyMap<string, string>): Map<string, GraphPosition> {
  const layers = new Map<number, string[]>();
  for (const id of ids) { const depth = depths.get(id) ?? 0; if (!layers.has(depth)) layers.set(depth, []); layers.get(depth)!.push(id); }
  const maxDepth = Math.max(0, ...layers.keys()), positions = new Map<string, GraphPosition>();
  if (laneById) {
    const lanes = [...new Set(ids.map(id => laneById.get(id) ?? id))].sort();
    const radius = Math.max(360, lanes.length * 29);
    const lanePoint = new Map(lanes.map((lane, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / lanes.length;
      return [lane, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, angle }] as const;
    }));
    for (const members of layers.values()) {
      const laneMembers = new Map<string, string[]>();
      for (const id of members) { const lane = laneById.get(id) ?? id; if (!laneMembers.has(lane)) laneMembers.set(lane, []); laneMembers.get(lane)!.push(id); }
      for (const [lane, laneIds] of laneMembers) {
        const center = lanePoint.get(lane)!;
        laneIds.forEach((id, index) => {
          // Branches at the same depth fan around their topic lane. A single
          // sequence remains straight through every successive level.
          const offset = (index - (laneIds.length - 1) / 2) * 92;
          positions.set(id, { x: center.x - Math.sin(center.angle) * offset, y: center.y + Math.cos(center.angle) * offset, z: ((depths.get(id) ?? 0) - maxDepth / 2) * spacing });
        });
      }
    }
    return positions;
  }
  for (const [depth, members] of layers) members.forEach((id, index) => {
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = maxLayerRadius(members.length) * Math.sqrt((index + .5) / members.length);
    positions.set(id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z: (depth - maxDepth / 2) * spacing });
  });
  return positions;
}

export function graphEdgePalette(kind: GraphEdgeKind): string {
  return kind === 'link' ? 'classic' : kind === 'sequence' ? 'sequence' : kind === 'derivation' ? 'derivation' : 'tag';
}
