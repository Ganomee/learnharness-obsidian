import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyProviderBudgetState, ProviderBudgetLedger } from '../src/adapters/provider-budget';

const payload = JSON.stringify({ messages: [{ role: 'user', content: 'synthetic' }] });

test('budget is durably reserved before a request can be sent and actual usage is settled', async () => {
  const writes: any[] = [];
  const ledger = new ProviderBudgetLedger(emptyProviderBudgetState(), async state => { writes.push(structuredClone(state)); });
  const reservation = await ledger.reserve(payload, 512);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].requestsStarted, 1);
  assert.deepEqual(writes[0].reservations[0], reservation);
  assert.ok(reservation.maxCostMicros > 0);
  assert.equal(await ledger.settle(reservation.id, { input: 321, output: 42 }), true);
  assert.equal(ledger.snapshot().reservations.length, 0);
  assert.equal(ledger.snapshot().spentMicros, writes[1].spentMicros);
  assert.equal(ledger.snapshot().requestsStarted, 1);
});

test('unknown usage keeps the reservation charged and budget exhaustion blocks before send', async () => {
  const initial = emptyProviderBudgetState();
  initial.spentMicros = initial.ceilingMicros - 1;
  const ledger = new ProviderBudgetLedger(initial, async () => {});
  await assert.rejects(ledger.reserve(payload, 512), /US\$10 session spend ceiling/);
  assert.equal(ledger.snapshot().requestsStarted, 0);

  const normal = new ProviderBudgetLedger(emptyProviderBudgetState(), async () => {});
  const reservation = await normal.reserve(payload, 512);
  assert.equal(await normal.settle(reservation.id, undefined), false);
  assert.deepEqual(normal.snapshot().reservations, [reservation]);
});

test('changed pricing state and failed durable reservation both fail closed', async () => {
  const changed = emptyProviderBudgetState(); changed.priceRevision = 'unreviewed' as any;
  assert.throws(() => new ProviderBudgetLedger(changed, async () => {}), /policy changed/);
  const ledger = new ProviderBudgetLedger(emptyProviderBudgetState(), async () => { throw new Error('vault unavailable'); });
  await assert.rejects(ledger.reserve(payload, 512), /vault unavailable/);
  assert.equal(ledger.snapshot().requestsStarted, 0);
  assert.equal(ledger.snapshot().reservations.length, 0);
});
