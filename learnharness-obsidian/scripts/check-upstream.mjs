import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const pin = JSON.parse(readFileSync(new URL('../upstream-lock.json', import.meta.url), 'utf8'));
const git = (...args) => execFileSync('git', ['-C', root + 'upstream/learnharness', ...args], { encoding: 'utf8' }).trim();
if (git('rev-parse', 'HEAD') !== pin.revision) throw new Error('Upstream revision differs from reviewed pin');
if (git('status', '--porcelain')) throw new Error('Upstream checkout is modified');
for (const [path, expected] of Object.entries(pin.sha256)) {
  const source = execFileSync('git', ['-C', root + 'upstream/learnharness', 'show', `HEAD:${path}`]);
  const actual = createHash('sha256').update(source).digest('hex');
  if (actual !== expected) throw new Error(`Upstream contract source changed: ${path}`);
}
console.log(`PASS: clean upstream at ${pin.revision}; reviewed source hashes match`);
console.log('This is a pin guard, not proof that an upgrade is compatible.');
