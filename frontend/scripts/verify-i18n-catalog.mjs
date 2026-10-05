import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const localeDir = join(root, 'src', 'locale');
const out = mkdtempSync(join(tmpdir(), 'kb-i18n-'));

function load(file) {
  return JSON.parse(readFileSync(file, 'utf8')).translations;
}

function placeholders(text) {
  return [...new Set([...text.matchAll(/\{\$[A-Za-z0-9_]+\}|\{[A-Z_0-9]+\}/g)].map((m) => m[0]))].sort();
}

const problems = [];
try {
  const result = spawnSync(join(root, 'node_modules', '.bin', 'ng'), ['extract-i18n', '--output-path', out], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    process.exit(result.status ?? 1);
  }
  const warnings = `${result.stdout}\n${result.stderr}`.split('\n').filter((line) => /warn|duplicate/i.test(line));
  for (const line of warnings) problems.push(`extraction: ${line.trim()}`);
  const fresh = load(join(out, 'messages.json'));
  const committed = load(join(localeDir, 'messages.json'));
  const uk = load(join(localeDir, 'messages.uk.json'));
  for (const [id, text] of Object.entries(fresh)) {
    if (!(id in committed)) problems.push(`messages.json is missing ${id} (run npm run i18n:extract)`);
    else if (committed[id] !== text) problems.push(`messages.json is stale for ${id} (run npm run i18n:extract)`);
  }
  for (const id of Object.keys(committed)) if (!(id in fresh)) problems.push(`messages.json has unused id ${id}`);
  for (const [id, text] of Object.entries(fresh)) {
    if (!(id in uk)) {
      problems.push(`messages.uk.json is missing ${id}`);
      continue;
    }
    if (!uk[id].trim()) problems.push(`messages.uk.json has an empty translation for ${id}`);
    if (placeholders(text).join() !== placeholders(uk[id]).join()) problems.push(`placeholders differ for ${id}`);
  }
  for (const id of Object.keys(uk)) if (!(id in fresh)) problems.push(`messages.uk.json has unknown id ${id}`);
  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\n${problems.length} i18n catalog problem(s)`);
    process.exit(1);
  }
  console.log(`i18n catalog: ${Object.keys(fresh).length} messages, en and uk complete`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
