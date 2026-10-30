/** Deploy only to this repository's marked disposable vault. Never takes a vault path argument. */
import { readFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isDisposableVault } from '../plugin/src/adapters/sandbox-marker.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const vault = path.join(root, 'test-vault');
const marker = await readFile(path.join(vault, '00 Start/Working agreement.md'), 'utf8');
if (!isDisposableVault(marker)) throw new Error('Exact disposable vault frontmatter marker is missing.');
const manifest = JSON.parse(await readFile(path.join(root, 'plugin/manifest.json'), 'utf8'));
if (manifest.id !== 'learnharness-lab') throw new Error('Unexpected plugin ID.');
const target = path.join(vault, '.obsidian/plugins', manifest.id);
await mkdir(target, { recursive: true });
await copyFile(path.join(root, 'plugin/dist/main.js'), path.join(target, 'main.js'));
await copyFile(path.join(root, 'plugin/manifest.json'), path.join(target, 'manifest.json'));
await copyFile(path.join(root, 'plugin/styles.css'), path.join(target, 'styles.css'));
await copyFile(path.join(root, 'upstream/learnharness/LICENSE'), path.join(target, 'LICENSE'));
await copyFile(path.join(root, 'plugin/NOTICE.md'), path.join(target, 'NOTICE.md'));
await copyFile(path.join(root, 'plugin/THIRD_PARTY_NOTICES.md'), path.join(target, 'THIRD_PARTY_NOTICES.md'));
const thirdPartySources = path.join(root, 'plugin/third-party-licenses');
const thirdPartyTarget = path.join(target, 'THIRD_PARTY_LICENSES');
await mkdir(thirdPartyTarget, { recursive: true });
for (const file of await readdir(thirdPartySources)) {
  await copyFile(path.join(thirdPartySources, file), path.join(thirdPartyTarget, file));
}
console.log(`Installed development plugin in ${target}`);
console.log('No plugin enablement or global profile settings were changed.');
