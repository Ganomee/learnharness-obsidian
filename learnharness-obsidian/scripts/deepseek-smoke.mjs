/** Optional, one-request provider connectivity check. Not a LearnHarness agent test.
 * Run: node --env-file=.env scripts/deepseek-smoke.mjs
 * Automated contracts never execute this script.
 */
import { mkdir, writeFile } from 'node:fs/promises';

const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
if (!apiKey) throw new Error('DEEPSEEK_API_KEY is missing. Provide it through the process environment or a local ignored .env file.');
const request = {
  model: 'deepseek-flash',
  messages: [{ role: 'user', content: 'Development connectivity check. Reply with only the numeral equal to 2 + 2.' }],
  thinking: { type: 'disabled' },
  max_tokens: 128,
  stream: false,
};
const start = Date.now();
let response;
try {
  response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(20000),
  });
} catch {
  throw new Error('DeepSeek connectivity failed or timed out. No automatic retry was attempted.');
}
if (!response.ok) throw new Error(`DeepSeek returned HTTP ${response.status}. No automatic retry was attempted.`);
const data = await response.json();
const answer = data.choices?.[0]?.message?.content?.trim();
if (answer !== '4') throw new Error('DeepSeek response did not match the bounded connectivity-check expectation.');
const report = {
  kind: 'provider-connectivity-only',
  timestamp: new Date().toISOString(),
  requestedModel: request.model,
  returnedModel: data.model,
  outputLimit: request.max_tokens,
  thinking: 'disabled',
  requests: 1,
  elapsedMs: Date.now() - start,
  usage: data.usage,
  assertion: '2 + 2 response matched 4',
  limitations: ['Not an original-agent interaction', 'Not proof of browser CORS, Obsidian provider transport, or mobile support'],
};
const folder = new URL('../.dev/', import.meta.url);
await mkdir(folder, { recursive: true });
await writeFile(new URL('deepseek-smoke.json', folder), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
