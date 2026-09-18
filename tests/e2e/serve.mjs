// Starts the built Worker with a brand-new local D1 database for end-to-end tests.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';

const port = process.argv[2] ?? '8790';
const state = '.wrangler/e2e-state';
const config = 'dist/server/wrangler.json';
if (!existsSync(config)) { console.error('Run `pnpm build` before the e2e tests.'); process.exit(1); }

const wrangler = ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js'];
rmSync(state, { recursive: true, force: true });
for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) {
  const r = spawnSync(process.execPath, [...wrangler, 'd1', 'execute', 'DB', '--local', '--config', config, '--persist-to', state, '--file', `drizzle/${file}`], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
// Fixed test-only credentials for the passphrase gate; tests/e2e/app.spec.ts uses the same values.
// Not secret: this only ever protects an ephemeral local D1 database created above.
const server = spawn(process.execPath, [...wrangler, 'dev', '--config', config, '--local', '--persist-to', state,
  '--ip', '127.0.0.1', '--port', port, '--inspector-port', '0',
  '--var', 'PRACTICE_PASSPHRASE:e2e-test-passphrase', '--var', 'AUTH_SECRET:e2e-test-auth-secret'], { stdio: 'inherit' });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { server.kill(sig); process.exit(0); });
server.on('exit', code => process.exit(code ?? 0));
