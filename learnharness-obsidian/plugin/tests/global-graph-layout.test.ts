import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrangeDepthLayers, graphEdgePalette, includePrerequisiteAncestors, inferGraphDepths } from '../src/graph/graph-layout';

test('sequence and derivation edges create stacked inference levels; classic links do not', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
  const edges = ids.slice(0, -1).flatMap((id, i) => [
    { from: id, to: ids[i + 1]!, kind: 'sequence' as const },
    { from: id, to: ids[i + 1]!, kind: 'link' as const },
  ]);
  const depths = inferGraphDepths(ids, edges);
  assert.deepEqual(ids.map(id => depths.get(id)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(inferGraphDepths(['a', 'b'], [{ from: 'a', to: 'b', kind: 'link' }]).get('b'), 0);
});

test('mutually derived nodes share a layer and downstream reasoning advances one layer', () => {
  const depths = inferGraphDepths(['base', 'left', 'right', 'result'], [
    { from: 'base', to: 'left', kind: 'derivation' },
    { from: 'left', to: 'right', kind: 'derivation' },
    { from: 'right', to: 'left', kind: 'sequence' },
    { from: 'right', to: 'result', kind: 'derivation' },
  ]);
  assert.equal(depths.get('base'), 0);
  assert.equal(depths.get('left'), depths.get('right'));
  assert.equal(depths.get('result'), (depths.get('left') ?? 0) + 1);
});

test('layer positioning separates inference levels along Z deterministically', () => {
  const ids = ['a', 'b', 'c'];
  const depths = new Map([['a', 0], ['b', 1], ['c', 2]]);
  const first = arrangeDepthLayers(ids, depths, 200);
  const second = arrangeDepthLayers(ids, depths, 200);
  assert.deepEqual(first, second);
  assert.equal(first.get('a')?.z, -200);
  assert.equal(first.get('b')?.z, 0);
  assert.equal(first.get('c')?.z, 200);
});

test('topic lanes stay aligned across learning levels and separate parallel strands', () => {
  const ids = ['a0', 'a1', 'b0', 'b1'];
  const depths = new Map([['a0', 0], ['a1', 1], ['b0', 0], ['b1', 1]]);
  const lanes = new Map([['a0', 'topic-a'], ['a1', 'topic-a'], ['b0', 'topic-b'], ['b1', 'topic-b']]);
  const positions = arrangeDepthLayers(ids, depths, 200, lanes);
  assert.equal(positions.get('a0')?.x, positions.get('a1')?.x);
  assert.equal(positions.get('a0')?.y, positions.get('a1')?.y);
  assert.ok(Math.hypot((positions.get('a0')?.x ?? 0) - (positions.get('b0')?.x ?? 0), (positions.get('a0')?.y ?? 0) - (positions.get('b0')?.y ?? 0)) > 100);
  assert.notEqual(positions.get('a1')?.z, positions.get('a0')?.z);
});

test('the 120-concept demo forms ten levels across twelve independent strands', () => {
  const ids = Array.from({ length: 120 }, (_, i) => `p${i}`);
  const edges = ids.flatMap((id, i) => i % 10 === 9 ? [] : [{ from: id, to: ids[i + 1]!, kind: 'sequence' as const }]);
  const depths = inferGraphDepths(ids, edges);
  const counts = new Map<number, number>();
  for (const depth of depths.values()) counts.set(depth, (counts.get(depth) ?? 0) + 1);
  assert.deepEqual([...counts.entries()].sort(([a], [b]) => a - b), Array.from({ length: 10 }, (_, level) => [level, 12]));
  const positions = arrangeDepthLayers(ids, depths, 230);
  assert.equal(new Set([...positions.values()].map(position => position.z)).size, 10);
});

test('classic and derivation connection types receive distinct palettes', () => {
  assert.equal(graphEdgePalette('link'), 'classic');
  assert.equal(graphEdgePalette('sequence'), 'sequence');
  assert.equal(graphEdgePalette('derivation'), 'derivation');
  assert.equal(graphEdgePalette('tag'), 'tag');
});

test('a filtered derived result retains its complete prerequisite path', () => {
  const edges = [
    { from: 'source', to: 'reasoning', kind: 'derivation' as const },
    { from: 'reasoning', to: 'fact', kind: 'derivation' as const },
    { from: 'fact', to: 'transfer', kind: 'sequence' as const },
  ];
  const result = includePrerequisiteAncestors(['transfer'], edges);
  assert.deepEqual([...result], ['transfer', 'fact', 'reasoning', 'source']);
  assert.deepEqual([...inferGraphDepths([...result], edges).values()].sort(), [0, 1, 2, 3]);
});
