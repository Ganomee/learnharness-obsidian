import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveNoteGraph } from '../src/graph/knowledge-graph-model';

test('knowledge graph derives distinct reasoning-chain nodes and premise-to-conclusion arrows', () => {
  const propositions = [
    { id: 'p1', title: 'Rate denominator', statement: 'A rate has a denominator.', path: '40 Knowledge/p1.md', aliases: [] },
    { id: 'p2', title: 'Pooled rate', statement: 'Combine counts.', path: '40 Knowledge/p2.md', aliases: [] },
    { id: 'p3', title: 'Target', statement: 'Choose a weighting target.', path: '40 Knowledge/p3.md', aliases: [] },
  ];
  const chains = [
    { id: 'a1', title: 'Counts entail pooled rate', statement: 'Reasoning one.', path: '50 Arguments/a1.md', premises: ['p1'], conclusions: ['p2'] },
    { id: 'a2', title: 'Target plus denominator entail pooled method', statement: 'Reasoning two.', path: '50 Arguments/a2.md', premises: ['p1', 'p3'], conclusions: ['p2'] },
  ];
  const graph = deriveNoteGraph(propositions, chains);
  assert.equal(graph.nodes.length, 5);
  assert.deepEqual(graph.edges, [
    { from: 'p1', to: 'chain:a1' }, { from: 'chain:a1', to: 'p2' },
    { from: 'p1', to: 'chain:a2' }, { from: 'p3', to: 'chain:a2' }, { from: 'chain:a2', to: 'p2' },
  ]);
});

test('knowledge graph omits chain endpoints that are absent from the proposition notes', () => {
  const graph = deriveNoteGraph([{ id: 'p1', title: 'Known', statement: 'Known fact.', path: 'p1.md', aliases: [] }], [
    { id: 'a1', title: 'Partial', statement: '', path: 'a1.md', premises: ['missing', 'p1'], conclusions: ['also-missing'] },
  ]);
  assert.deepEqual(graph.edges, [{ from: 'p1', to: 'chain:a1' }]);
});
