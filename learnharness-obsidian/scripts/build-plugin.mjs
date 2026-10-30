import './check-upstream.mjs';
import { buildRuntime } from './build-runtime.mjs';
import { mkdir, writeFile, copyFile, readdir, readFile } from 'node:fs/promises';

const result = await buildRuntime({
  entryPoints: ['plugin/src/main.ts'], outfile: 'plugin/dist/main.js',
  format: 'cjs', external: ['obsidian'],
});
for (const output of Object.values(result.metafile.outputs)) {
  for (const dependency of output.imports) {
    if (dependency.external && dependency.path !== 'obsidian') throw new Error(`Unexpected plugin runtime dependency: ${dependency.path}`);
  }
}
const packageNames = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
  const normalized = input.replaceAll('\\', '/');
  const marker = 'node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index < 0) continue;
  const parts = normalized.slice(index + marker.length).split('/');
  packageNames.add(parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
}
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
const notice = await readFile(new URL('../plugin/THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
const noticeRows = new Map([...notice.matchAll(/^\| `([^`]+)` \| ([^|]+) \| ([^|]+) \| `([^`]+)` \|$/gm)].map(row => [row[1], { version: row[2].trim(), license: row[3].trim(), file: row[4] }]));
for (const name of packageNames) {
  const dependency = lock.packages[`node_modules/${name}`];
  const row = noticeRows.get(name);
  if (!dependency || !row || row.version !== dependency.version || row.license !== dependency.license) {
    throw new Error(`Third-party notice is missing or stale for bundled package ${name}`);
  }
  const installed = JSON.parse(await readFile(new URL(`../node_modules/${name}/package.json`, import.meta.url), 'utf8'));
  if (installed.name !== name || installed.version !== dependency.version || installed.license !== dependency.license) {
    throw new Error(`Installed package metadata disagrees with package-lock.json for ${name}`);
  }
  const licensePath = row.file.replaceAll('\\', '/');
  const licensePrefix = 'THIRD_PARTY_LICENSES/';
  const licenseFile = licensePath.startsWith(licensePrefix) ? licensePath.slice(licensePrefix.length) : '';
  if (!licenseFile || licenseFile.includes('/')) throw new Error(`Third-party notice has an invalid license path for ${name}`);
  await readFile(new URL(`../plugin/third-party-licenses/${licenseFile}`, import.meta.url));
}
if (noticeRows.size !== packageNames.size) throw new Error('Third-party notice contains a stale or extra package row');
const dist = new URL('../plugin/dist/', import.meta.url);
await mkdir(dist, { recursive: true });
await writeFile(new URL('plugin-metafile.json', dist), JSON.stringify(result.metafile, null, 2) + '\n');
await copyFile(new URL('../plugin/manifest.json', import.meta.url), new URL('manifest.json', dist));
await copyFile(new URL('../plugin/styles.css', import.meta.url), new URL('styles.css', dist));
await copyFile(new URL('../upstream/learnharness/LICENSE', import.meta.url), new URL('LICENSE', dist));
await copyFile(new URL('../plugin/NOTICE.md', import.meta.url), new URL('NOTICE.md', dist));
const thirdPartySources = new URL('../plugin/third-party-licenses/', import.meta.url);
const thirdPartyDest = new URL('THIRD_PARTY_LICENSES/', dist);
await mkdir(thirdPartyDest, { recursive: true });
for (const file of await readdir(thirdPartySources)) {
  await copyFile(new URL(file, thirdPartySources), new URL(file, thirdPartyDest));
}
await copyFile(new URL('../plugin/THIRD_PARTY_NOTICES.md', import.meta.url), new URL('THIRD_PARTY_NOTICES.md', dist));
console.log('Built browser-compatible Obsidian add-on; only Obsidian is external. Physical mobile support is unverified.');
