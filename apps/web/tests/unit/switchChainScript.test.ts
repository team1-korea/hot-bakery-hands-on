import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const SCRIPT = path.resolve('scripts/switch-chain.mjs');
const ARTIFACT = path.resolve('tests/fixtures/mainnet-deployment.json');

function run(...args: string[]) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

describe('Production 체인 전환 명령', () => {
  test('메인넷 준비는 주소와 블록만 등록하고 활성 체인을 건드리지 않는다', () => {
    const result = run('prepare-mainnet', '--artifact', ARTIFACT, '--offline');

    expect(result.status).toBe(0);
    const address = result.stdout.indexOf('CERTIFICATE_ADDRESS=');
    const block = result.stdout.indexOf('CERTIFICATE_DEPLOYMENT_BLOCK=');
    expect(address).toBeGreaterThan(-1);
    expect(block).toBeGreaterThan(address);
    expect(result.stdout).not.toContain('변경         NEXT_PUBLIC_CHAIN_ID=');
    expect(result.stdout).toContain('Production은 Fuji를 유지합니다');
    expect(result.stdout).toContain('DRY RUN');
    expect(result.stdout).toContain(`--artifact ${ARTIFACT} --apply --confirm PREPARE`);
  });

  test('메인넷 전환은 검증된 배포값을 먼저 맞춘 뒤 체인 ID를 마지막에 바꾼다', () => {
    const result = run('mainnet', '--artifact', ARTIFACT, '--offline');

    expect(result.status).toBe(0);
    const address = result.stdout.indexOf('CERTIFICATE_ADDRESS=');
    const block = result.stdout.indexOf('CERTIFICATE_DEPLOYMENT_BLOCK=');
    const chain = result.stdout.indexOf('NEXT_PUBLIC_CHAIN_ID=43114');
    expect(address).toBeGreaterThan(-1);
    expect(block).toBeGreaterThan(address);
    expect(chain).toBeGreaterThan(block);
    expect(result.stdout).toContain('NEXT_PUBLIC_CHAIN_ID=43114');
    expect(result.stdout).toContain(`--artifact ${ARTIFACT} --apply --confirm 43114`);
  });

  test('오프라인 검증으로 실제 반영할 수 없다', () => {
    const result = run('mainnet', '--artifact', ARTIFACT, '--offline', '--apply', '--confirm', '43114');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--offline은 dry-run에서만');
  });

  test('메인넷 배포 기록이 없으면 전환을 거절한다', () => {
    const result = run('mainnet', '--artifact', 'tests/fixtures/missing.json', '--offline');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('메인넷 배포 기록이 없습니다');
  });

  test('Fuji 복귀에는 메인넷 배포 기록이 필요하지 않다', () => {
    const result = run('fuji');

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('NEXT_PUBLIC_CHAIN_ID=43113');
  });
});
