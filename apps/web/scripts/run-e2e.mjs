import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

const externalEnvironment = [
  'NEXT_PUBLIC_PRIVY_APP_ID',
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_CHAIN_ID',
  'PRIVY_APP_ID',
  'PRIVY_APP_SECRET',
  'OPERATOR_PASSCODE',
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_BUCKET',
  'PINATA_JWT',
  'MINTER_PRIVATE_KEY',
  'CRON_SECRET',
  'AVALANCHE_RPC_URL',
  'CERTIFICATE_ADDRESS',
  'MINT_GAS_LIMIT',
  'MOCK_FAILURE_RATE',
  'ALLOW_DB_RESET',
];

const environment = { ...process.env };
for (const key of externalEnvironment) environment[key] = '';

const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      server.close();
      reject(new Error('E2E 테스트용 포트를 찾지 못했습니다.'));
      return;
    }
    server.close((error) => error ? reject(error) : resolve(address.port));
  });
});
environment.E2E_PORT = String(port);

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(args) {
  const result = spawnSync(npm, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(['run', 'build']);
run(['exec', '--', 'playwright', 'test', ...process.argv.slice(2)]);
