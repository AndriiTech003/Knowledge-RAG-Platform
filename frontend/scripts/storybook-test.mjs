import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, 'storybook-static');
const port = Number(process.env.STORYBOOK_TEST_PORT ?? 4441);
const url = `http://127.0.0.1:${port}`;

if (!existsSync(resolve(dist, 'index.json'))) {
  console.error('storybook-static/index.json not found. Run `npm run storybook:build` first.');
  process.exit(1);
}

const server = spawn(process.execPath, [resolve(here, 'serve.mjs')], {
  env: { ...process.env, DIST_DIR: dist, PORT: String(port) },
  stdio: ['ignore', 'inherit', 'inherit'],
});

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${url}/index.json`);
      if (response.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error(`storybook server did not start on ${url}`);
}

function stop(code) {
  server.kill('SIGTERM');
  process.exit(code);
}

try {
  await waitForServer();
} catch (error) {
  console.error(error);
  stop(1);
}

const runner = spawn(
  resolve(root, 'node_modules/.bin/test-storybook'),
  ['--index-json', '--url', url, '--maxWorkers=2', ...process.argv.slice(2)],
  { cwd: root, env: { ...process.env, STORYBOOK_DISABLE_TELEMETRY: '1' }, stdio: 'inherit' },
);
runner.on('exit', (code) => stop(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  runner.kill(signal);
  stop(1);
});
