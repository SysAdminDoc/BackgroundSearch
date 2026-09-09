import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packCrx3File } from './crx3.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
const key = path.join(root, 'BackgroundSearch-selfhost.pem');
try { await fs.access(key); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
  if (!process.argv.includes('--create-key')) throw new Error('No self-host key found. Restore the existing key, or use --create-key only for the first package.');
}
const basename = `BackgroundSearch-v${version}-chrome`;
const result = await packCrx3File(path.join(root, 'dist', basename + '.zip'), key, path.join(root, 'dist', basename + '.crx'));
console.log(JSON.stringify({ version, file: basename + '.crx', ...result }, null, 2));
