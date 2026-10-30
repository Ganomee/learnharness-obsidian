import fs from 'node:fs';
import * as asyncFs from 'node:fs/promises';
import * as os from 'node:os';
import { createHash } from 'node:crypto';
import { piEngineFor } from '../../../upstream/learnharness/src/agent/models.ts';

export const unsupportedSync = [
  () => fs.readFileSync('/arbitrary', 'utf8'),
  () => fs.readdirSync('/arbitrary'),
  () => fs.existsSync('/arbitrary'),
  () => fs.appendFileSync('/arbitrary', 'write'),
  () => os.homedir(),
  () => createHash('sha256'),
  () => piEngineFor('prober'),
];
export const unsupportedAsync = () => asyncFs.readFile('/arbitrary');
