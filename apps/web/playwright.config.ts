import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${port}`;

const externalEnvironment = [
  'NEXT_PUBLIC_PRIVY_APP_ID',
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_CHAIN_ID',
  'NEXT_PUBLIC_CERTIFICATE_FRAME_URL',
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
] as const;

const mockEnvironment: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (value !== undefined) mockEnvironment[key] = value;
}
for (const key of externalEnvironment) mockEnvironment[key] = '';
mockEnvironment.NEXT_PUBLIC_CERTIFICATE_FRAME_URL = 'https://certificate-frame.test/nft-design.jpg';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    env: mockEnvironment,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
