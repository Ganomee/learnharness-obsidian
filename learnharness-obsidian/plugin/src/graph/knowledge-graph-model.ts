export interface NoteProposition { id: string; title: string; statement: string; path: string; aliases: string[]; nextIds?: string[]; nextReasoning?: string }
export interface NoteChain { id: string; title: string; statement: string; path: string; premises: string[]; conclusions: string[] }
export interface NoteGraphNode { id: string; title: string; kind: 'proposition' | 'chain'; sourceId: string; statement: string; path: string }
export interface NoteGraph { nodes: NoteGraphNode[]; edges: Array<{ from: string; to: string }> }

/** Derive display edges from stored premise/conclusion chains; never persist arrows. */
export function deriveNoteGraph(propositions: readonly NoteProposition[], chains: readonly NoteChain[]): NoteGraph {
  const valid = new Set(propositions.map(item => item.id));
  const nodes: NoteGraphNode[] = [
    ...propositions.map(item => ({ id: item.id, title: item.title, kind: 'proposition' as const, sourceId: item.id, statement: item.statement, path: item.path })),
    ...chains.map(item => ({ id: `chain:${item.id}`, title: item.title, kind: 'chain' as const, sourceId: item.id, statement: item.statement, path: item.path })),
  ];
  const edges = [
    ...propositions.flatMap(item => (item.nextIds ?? []).filter(id => valid.has(id)).map(id => ({ from: item.id, to: id }))),
    ...chains.flatMap(chain => [
    ...chain.premises.filter(id => valid.has(id)).map(id => ({ from: id, to: `chain:${chain.id}` })),
    ...chain.conclusions.filter(id => valid.has(id)).map(id => ({ from: `chain:${chain.id}`, to: id })),
    ]),
  ];
  return { nodes, edges };
}
